import { z } from "zod";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db } from "../../db";
import { sponsorContracts, contractPayments, sponsors } from "../../db/schema";
import { uploadBase64File } from "../../lib/s3";
import { extractTextFromPdf } from "../../lib/pdf";

async function assertSponsorInClub(sponsorId: number, clubId: number) {
  const [sponsor] = await db
    .select()
    .from(sponsors)
    .where(and(eq(sponsors.id, sponsorId), eq(sponsors.clubId, clubId)))
    .limit(1);
  if (!sponsor) throw new TRPCError({ code: "NOT_FOUND", message: "赞助商不存在" });
  return sponsor;
}

async function assertContractInClub(contractId: number, clubId: number) {
  const [contract] = await db
    .select()
    .from(sponsorContracts)
    .where(eq(sponsorContracts.id, contractId))
    .limit(1);
  if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: "合同不存在" });
  await assertSponsorInClub(contract.sponsorId, clubId);
  return contract;
}

const EXPIRING_SOON_DAYS = 90;

export const contractsRouter = router({
  bySponsor: protectedProcedure
    .input(z.object({ sponsorId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertSponsorInClub(input.sponsorId, ctx.user.clubId!);
      const rows = await db
        .select()
        .from(sponsorContracts)
        .where(eq(sponsorContracts.sponsorId, input.sponsorId))
        .orderBy(desc(sponsorContracts.createdAt));
      // Extracted text can be large and isn't needed by the contract list UI.
      return rows.map(({ extractedText: _extractedText, ...rest }) => rest);
    }),

  upload: adminProcedure
    .input(
      z.object({
        sponsorId: z.number(),
        base64: z.string().min(1),
        mimeType: z.string().min(1),
        filename: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertSponsorInClub(input.sponsorId, ctx.user.clubId!);
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

      const [result] = await db.insert(sponsorContracts).values({
        sponsorId: input.sponsorId,
        url,
        fileKey,
        filename: input.filename,
        mimeType: input.mimeType,
        extractedText,
        uploadedBy: ctx.user.id,
      });
      const [contract] = await db
        .select()
        .from(sponsorContracts)
        .where(eq(sponsorContracts.id, result.insertId))
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
      await db.update(sponsorContracts).set(rest).where(eq(sponsorContracts.id, id));
      const [contract] = await db
        .select()
        .from(sponsorContracts)
        .where(eq(sponsorContracts.id, id))
        .limit(1);
      const { extractedText: _extractedText, ...contractRest } = contract;
      return contractRest;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const contract = await assertContractInClub(input.id, ctx.user.clubId!);
      await db.delete(contractPayments).where(eq(contractPayments.contractId, contract.id));
      await db.delete(sponsorContracts).where(eq(sponsorContracts.id, input.id));
      return { success: true };
    }),

  // Contracts whose term ends within the next 90 days, for a renewal-reminder widget.
  expiringSoon: protectedProcedure.query(async ({ ctx }) => {
    const clubId = ctx.user.clubId;
    if (!clubId) return [];
    const clubSponsors = await db.select().from(sponsors).where(eq(sponsors.clubId, clubId));
    const sponsorIds = clubSponsors.map((s) => s.id);
    if (sponsorIds.length === 0) return [];

    const now = new Date();
    const horizon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);

    const contracts = await db
      .select()
      .from(sponsorContracts)
      .where(
        and(
          inArray(sponsorContracts.sponsorId, sponsorIds),
          gte(sponsorContracts.endDate, now),
          lte(sponsorContracts.endDate, horizon),
        ),
      )
      .orderBy(asc(sponsorContracts.endDate));

    return contracts.map(({ extractedText: _extractedText, ...contract }) => ({
      ...contract,
      sponsor: clubSponsors.find((s) => s.id === contract.sponsorId)!,
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
