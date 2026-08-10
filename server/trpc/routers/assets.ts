import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db } from "../../db";
import { assets, companies, companyContracts, deliveries, deliveryTasks, matches, type Asset } from "../../db/schema";
import { computeAssetProgress } from "../../lib/deliveryProgress";
import { planDeliveriesForAsset } from "../../lib/deliveryScheduling";
import { getTaskTemplate } from "../../lib/taskTemplates";
import { extractAssetsFromContract, extractedAssetSchema } from "../../lib/assetExtraction";

async function assertCompanyInClub(companyId: number, clubId: number) {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.clubId, clubId)))
    .limit(1);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "赞助商不存在" });
  return company;
}

async function getAssetWithCompany(assetId: number) {
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "资产不存在" });
  const [company] = await db.select().from(companies).where(eq(companies.id, asset.companyId)).limit(1);
  return { asset, company };
}

const assetFields = {
  code: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  targetCount: z.number().optional(),
  countUnit: z.string().optional(),
  scope: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  attachmentRequirement: z.string().optional(),
  requiresApproval: z.boolean().optional(),
  sortOrder: z.number().optional(),
};

interface NewAssetFields {
  code?: string;
  name: string;
  description?: string;
  category?: string;
  targetCount?: number;
  countUnit?: string;
  scope?: string;
  startDate?: Date;
  endDate?: Date;
  attachmentRequirement?: string;
  requiresApproval?: boolean;
  sortOrder?: number;
}

/** Creates an asset and immediately generates its deliveries + default task checklist — the
 * "no fulfillment-mode picker" automation, shared by manual creation and AI import. */
async function createAssetWithDeliveries(
  clubId: number,
  companyId: number,
  contractId: number | undefined,
  fields: NewAssetFields,
): Promise<Asset> {
  const [result] = await db.insert(assets).values({ companyId, contractId, ...fields });
  const assetId = result.insertId;
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);

  const clubMatches = await db.select().from(matches).where(eq(matches.clubId, clubId));
  const planned = planDeliveriesForAsset(asset, clubMatches);
  const taskNames = getTaskTemplate(asset.category, asset.name);

  for (const plan of planned) {
    const [deliveryResult] = await db.insert(deliveries).values({
      assetId,
      matchId: plan.matchId,
      scheduledDate: plan.scheduledDate,
      status: plan.status,
    });
    const deliveryId = deliveryResult.insertId;
    if (taskNames.length > 0) {
      await db.insert(deliveryTasks).values(
        taskNames.map((name) => ({
          deliveryId,
          name,
          dueDate: plan.scheduledDate ?? undefined,
        })),
      );
    }
  }

  return asset;
}

export const assetsRouter = router({
  byCompany: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertCompanyInClub(input.companyId, ctx.user.clubId!);
      return db
        .select()
        .from(assets)
        .where(eq(assets.companyId, input.companyId))
        .orderBy(asc(assets.sortOrder));
    }),

  create: adminProcedure
    .input(z.object({ companyId: z.number(), ...assetFields }))
    .mutation(async ({ ctx, input }) => {
      const { companyId, ...fields } = input;
      await assertCompanyInClub(companyId, ctx.user.clubId!);
      return createAssetWithDeliveries(ctx.user.clubId!, companyId, undefined, fields);
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        code: z.string().optional(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        targetCount: z.number().optional(),
        countUnit: z.string().optional(),
        scope: z.string().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        attachmentRequirement: z.string().optional(),
        requiresApproval: z.boolean().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const { company } = await getAssetWithCompany(id);
      if (!company || company.clubId !== ctx.user.clubId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.update(assets).set(rest).where(eq(assets.id, id));
      const [asset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
      return asset;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { company } = await getAssetWithCompany(input.id);
      if (!company || company.clubId !== ctx.user.clubId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const assetDeliveries = await db.select().from(deliveries).where(eq(deliveries.assetId, input.id));
      const deliveryIds = assetDeliveries.map((d) => d.id);
      if (deliveryIds.length > 0) {
        await db.delete(deliveryTasks).where(inArray(deliveryTasks.deliveryId, deliveryIds));
        await db.delete(deliveries).where(inArray(deliveries.id, deliveryIds));
      }
      await db.delete(assets).where(eq(assets.id, input.id));
      return { success: true };
    }),

  progressByCompany: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const clubId = ctx.user.clubId!;
      await assertCompanyInClub(input.companyId, clubId);

      const companyAssets = await db
        .select()
        .from(assets)
        .where(and(eq(assets.companyId, input.companyId), eq(assets.isActive, true)))
        .orderBy(asc(assets.sortOrder));

      const assetIds = companyAssets.map((a) => a.id);
      const clubMatches = await db.select().from(matches).where(eq(matches.clubId, clubId));
      const allDeliveries =
        assetIds.length > 0 ? await db.select().from(deliveries).where(inArray(deliveries.assetId, assetIds)) : [];

      return companyAssets.map((asset) =>
        computeAssetProgress(
          asset,
          allDeliveries.filter((d) => d.assetId === asset.id),
          clubMatches,
        ),
      );
    }),

  // Reads a previously-uploaded contract's cached extracted text, cross-references it against
  // any hints parsed from an Excel sheet, and asks the LLM to produce a structured, reviewable
  // list of assets. Nothing is written to the database here — the admin reviews the result and
  // confirms via importExtracted.
  extractFromContract: adminProcedure
    .input(
      z.object({
        companyId: z.number(),
        contractId: z.number(),
        hints: z.array(z.object({ name: z.string(), category: z.string().optional() })).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const company = await assertCompanyInClub(input.companyId, ctx.user.clubId!);

      const [contract] = await db
        .select()
        .from(companyContracts)
        .where(eq(companyContracts.id, input.contractId))
        .limit(1);
      if (!contract || contract.companyId !== input.companyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "合同不存在" });
      }
      if (!contract.extractedText) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "该合同未能提取出文本内容，请确认是文字版 PDF" });
      }

      return extractAssetsFromContract(company.name, contract.extractedText, input.hints ?? []);
    }),

  importExtracted: adminProcedure
    .input(
      z.object({
        companyId: z.number(),
        contractId: z.number().optional(),
        rows: z.array(extractedAssetSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCompanyInClub(input.companyId, ctx.user.clubId!);

      let created = 0;
      for (const row of input.rows) {
        await createAssetWithDeliveries(ctx.user.clubId!, input.companyId, input.contractId, {
          name: row.name,
          category: row.category || undefined,
          targetCount: row.targetCount ?? undefined,
          countUnit: row.countUnit || undefined,
          scope: row.scope || undefined,
          startDate: row.startDate ? new Date(row.startDate) : undefined,
          endDate: row.endDate ? new Date(row.endDate) : undefined,
          attachmentRequirement: row.attachmentRequirement || undefined,
          requiresApproval: row.requiresApproval ?? undefined,
        });
        created += 1;
      }

      return { created };
    }),
});
