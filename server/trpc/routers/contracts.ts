import { z } from "zod";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db } from "../../db";
import { companyContracts, contractPayments, companies, assets, clubs, users } from "../../db/schema";
import { uploadBase64File, getContractDownloadUrl } from "../../lib/s3";
import { extractTextFromPdf } from "../../lib/pdf";

async function assertCompanyInClub(companyId: number, clubId: number) {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.clubId, clubId)))
    .limit(1);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "赞助商不存在" });
  return company;
}

async function assertContractInClub(contractId: number, clubId: number) {
  const [contract] = await db
    .select()
    .from(companyContracts)
    .where(eq(companyContracts.id, contractId))
    .limit(1);
  if (!contract || contract.clubId !== clubId) throw new TRPCError({ code: "NOT_FOUND", message: "合同不存在" });
  return contract;
}

const EXPIRING_SOON_DAYS = 90;

export const contractsRouter = router({
  // All contracts in the club, regardless of company assignment — powers the standalone
  // Contracts page. Season filtering happens client-side (small per-club dataset).
  list: protectedProcedure.query(async ({ ctx }) => {
    const clubId = ctx.user.clubId;
    if (!clubId) return [];

    const rows = await db
      .select()
      .from(companyContracts)
      .where(eq(companyContracts.clubId, clubId))
      .orderBy(desc(companyContracts.createdAt));

    const companyIds = [...new Set(rows.map((r) => r.companyId).filter((id): id is number => id != null))];
    const uploaderIds = [...new Set(rows.map((r) => r.uploadedBy))];
    const [companyRows, uploaderRows] = await Promise.all([
      companyIds.length > 0 ? db.select().from(companies).where(inArray(companies.id, companyIds)) : [],
      uploaderIds.length > 0 ? db.select().from(users).where(inArray(users.id, uploaderIds)) : [],
    ]);

    return rows.map(({ extractedText: _extractedText, ...contract }) => ({
      ...contract,
      company: contract.companyId ? (companyRows.find((c) => c.id === contract.companyId) ?? null) : null,
      uploader: uploaderRows.find((u) => u.id === contract.uploadedBy) ?? null,
    }));
  }),

  byCompany: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertCompanyInClub(input.companyId, ctx.user.clubId!);
      const rows = await db
        .select()
        .from(companyContracts)
        .where(eq(companyContracts.companyId, input.companyId))
        .orderBy(desc(companyContracts.createdAt));
      // Extracted text can be large and isn't needed by the contract list UI.
      return rows.map(({ extractedText: _extractedText, ...rest }) => rest);
    }),

  upload: adminProcedure
    .input(
      z.object({
        companyId: z.number().optional(),
        season: z.string().optional(),
        base64: z.string().min(1),
        mimeType: z.string().min(1),
        filename: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const clubId = ctx.user.clubId!;
      if (input.companyId) await assertCompanyInClub(input.companyId, clubId);

      const buffer = Buffer.from(input.base64.replace(/^data:.*;base64,/, ""), "base64");
      const { url, fileKey } = await uploadBase64File(input.base64, input.mimeType, ctx.user.id, input.filename);

      let extractedText: string | undefined;
      if (input.mimeType === "application/pdf") {
        try {
          extractedText = await extractTextFromPdf(buffer);
        } catch {
          extractedText = undefined;
        }
      }

      let season = input.season;
      if (!season) {
        const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
        season = club?.season ?? String(new Date().getFullYear());
      }

      const [result] = await db.insert(companyContracts).values({
        clubId,
        companyId: input.companyId,
        season,
        url,
        fileKey,
        filename: input.filename,
        mimeType: input.mimeType,
        fileSize: buffer.length,
        extractedText,
        uploadedBy: ctx.user.id,
      });
      const [contract] = await db
        .select()
        .from(companyContracts)
        .where(eq(companyContracts.id, result.insertId))
        .limit(1);
      const { extractedText: _extractedText, ...rest } = contract;
      return { ...rest, hasExtractedText: !!contract.extractedText };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        companyId: z.number().nullable().optional(),
        season: z.string().optional(),
        amount: z.number().optional(),
        signedDate: z.coerce.date().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, companyId, ...rest } = input;
      await assertContractInClub(id, ctx.user.clubId!);
      if (companyId) await assertCompanyInClub(companyId, ctx.user.clubId!);
      await db
        .update(companyContracts)
        .set({ ...rest, ...(companyId !== undefined ? { companyId } : {}) })
        .where(eq(companyContracts.id, id));
      const [contract] = await db
        .select()
        .from(companyContracts)
        .where(eq(companyContracts.id, id))
        .limit(1);
      const { extractedText: _extractedText, ...contractRest } = contract;
      return contractRest;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const contract = await assertContractInClub(input.id, ctx.user.clubId!);
      await db.delete(contractPayments).where(eq(contractPayments.contractId, contract.id));
      await db.update(assets).set({ contractId: null }).where(eq(assets.contractId, contract.id));
      await db.delete(companyContracts).where(eq(companyContracts.id, input.id));
      return { success: true };
    }),

  getDownloadUrl: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const contract = await assertContractInClub(input.id, ctx.user.clubId!);
      const url = await getContractDownloadUrl(contract.fileKey, contract.filename || `contract-${contract.id}.pdf`);
      return { url };
    }),

  // Contracts whose term ends within the next 90 days, for a renewal-reminder widget.
  expiringSoon: protectedProcedure.query(async ({ ctx }) => {
    const clubId = ctx.user.clubId;
    if (!clubId) return [];

    const now = new Date();
    const horizon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);

    const contracts = await db
      .select()
      .from(companyContracts)
      .where(
        and(
          eq(companyContracts.clubId, clubId),
          gte(companyContracts.endDate, now),
          lte(companyContracts.endDate, horizon),
        ),
      )
      .orderBy(asc(companyContracts.endDate));

    const companyIds = [...new Set(contracts.map((c) => c.companyId).filter((id): id is number => id != null))];
    const companyRows = companyIds.length > 0 ? await db.select().from(companies).where(inArray(companies.id, companyIds)) : [];

    return contracts
      .filter((c) => c.companyId != null)
      .map(({ extractedText: _extractedText, ...contract }) => ({
        ...contract,
        company: companyRows.find((c) => c.id === contract.companyId)!,
      }));
  }),

  payments: router({
    byContract: protectedProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ ctx, input }) => {
        await assertContractInClub(input.contractId, ctx.user.clubId!);
        return db
          .select()
          .from(contractPayments)
          .where(eq(contractPayments.contractId, input.contractId))
          .orderBy(asc(contractPayments.dueDate));
      }),

    create: adminProcedure
      .input(
        z.object({
          contractId: z.number(),
          dueDate: z.coerce.date().optional(),
          amount: z.number(),
          note: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertContractInClub(input.contractId, ctx.user.clubId!);
        const [result] = await db.insert(contractPayments).values(input);
        const [payment] = await db
          .select()
          .from(contractPayments)
          .where(eq(contractPayments.id, result.insertId))
          .limit(1);
        return payment;
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          dueDate: z.coerce.date().optional(),
          amount: z.number().optional(),
          status: z.enum(["pending", "paid"]).optional(),
          paidDate: z.coerce.date().optional(),
          paidAmount: z.number().optional(),
          note: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...rest } = input;
        const [payment] = await db.select().from(contractPayments).where(eq(contractPayments.id, id)).limit(1);
        if (!payment) throw new TRPCError({ code: "NOT_FOUND" });
        await assertContractInClub(payment.contractId, ctx.user.clubId!);
        await db.update(contractPayments).set(rest).where(eq(contractPayments.id, id));
        const [updated] = await db.select().from(contractPayments).where(eq(contractPayments.id, id)).limit(1);
        return updated;
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const [payment] = await db
          .select()
          .from(contractPayments)
          .where(eq(contractPayments.id, input.id))
          .limit(1);
        if (!payment) throw new TRPCError({ code: "NOT_FOUND" });
        await assertContractInClub(payment.contractId, ctx.user.clubId!);
        await db.delete(contractPayments).where(eq(contractPayments.id, input.id));
        return { success: true };
      }),
  }),
});
