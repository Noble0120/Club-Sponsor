import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db } from "../../db";
import { sponsorContracts, sponsors } from "../../db/schema";
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

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [contract] = await db
        .select()
        .from(sponsorContracts)
        .where(eq(sponsorContracts.id, input.id))
        .limit(1);
      if (!contract) throw new TRPCError({ code: "NOT_FOUND" });
      await assertSponsorInClub(contract.sponsorId, ctx.user.clubId!);
      await db.delete(sponsorContracts).where(eq(sponsorContracts.id, input.id));
      return { success: true };
    }),
});
