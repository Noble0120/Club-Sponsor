import { z } from "zod";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db } from "../../db";
import { companyContracts, contractPayments, companies, assets } from "../../db/schema";
import { uploadBase64File } from "../../lib/s3";
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
  if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "合同不存在" });
  await assertCompanyInClub(contract.companyId, clubId);
  return contract;
}

const EXPIRING_SOON_DAYS = 90;

export const contractsRouter = router({
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
        companyId: z.number(),
        base64: z.string().min(1),
        mimeType: z.string().min(1),
        filename: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCompanyInClub(input.companyId, ctx.user.clubId!);
      const { url, fileKey } = await uploadBase64File(input.base64, input.mimeType, ctx.user.id, input.filename);

      let extractedText: string | undefined;
      if (input.mimeType === "application/pdf") {
        try {
          const buffer = Buffer.from(input.base64.replace(/^data:.*;base64,/, ""), "base64");
          extractedText = await extractTextFromPdf(buffer);
        } catch {
          extractedText = undefined;
        }
      }

      const [result] = await db.insert(companyContracts).values({
        companyId: input.companyId,
        url,
        fileKey,
        filename: input.filename,
        mimeType: input.mimeType,
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
        amount: z.number().optional(),
        signedDate: z.coerce.date().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      await assertContractInClub(id, ctx.user.clubId!);
      await db.update(companyContracts).set(rest).where(eq(companyContracts.id, id));
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

  // Contracts whose term ends within the next 90 days, for a renewal-reminder widget.
  expiringSoon: protectedProcedure.query(async ({ ctx }) => {
    const clubId = ctx.user.clubId;
    if (!clubId) return [];
    const clubCompanies = await db.select().from(companies).where(eq(companies.clubId, clubId));
    const companyIds = clubCompanies.map((c) => c.id);
    if (companyIds.length === 0) return [];

    const now = new Date();
    const horizon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);

    const contracts = await db
      .select()
      .from(companyContracts)
      .where(
        and(
          inArray(companyContracts.companyId, companyIds),
          gte(companyContracts.endDate, now),
          lte(companyContracts.endDate, horizon),
        ),
      )
      .orderBy(asc(companyContracts.endDate));

    return contracts.map(({ extractedText: _extractedText, ...contract }) => ({
      ...contract,
      company: clubCompanies.find((c) => c.id === contract.companyId)!,
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
