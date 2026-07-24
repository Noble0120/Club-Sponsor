import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "../../db";
import {
  acceptanceRecords,
  benefitCheckItems,
  benefitItems,
  matches,
  sponsors,
} from "../../db/schema";

async function assertMatchInClub(matchId: number, clubId: number) {
  const [match] = await db
    .select()
    .from(matches)
    .where(and(eq(matches.id, matchId), eq(matches.clubId, clubId)))
    .limit(1);
  if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "比赛不存在" });
  return match;
}

async function assertSponsorInClub(sponsorId: number, clubId: number) {
  const [sponsor] = await db
    .select()
    .from(sponsors)
    .where(and(eq(sponsors.id, sponsorId), eq(sponsors.clubId, clubId)))
    .limit(1);
  if (!sponsor) throw new TRPCError({ code: "NOT_FOUND", message: "赞助商不存在" });
  return sponsor;
}

const checkItemInput = z.object({
  benefitItemId: z.number(),
  fulfilled: z.enum(["yes", "no", "partial", "na"]),
  note: z.string().optional(),
  completedCount: z.number().optional(),
  attachmentUrls: z.array(z.string()).optional(),
});

export const recordsRouter = router({
  byMatchAndSponsor: protectedProcedure
    .input(z.object({ matchId: z.number(), sponsorId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertMatchInClub(input.matchId, ctx.user.clubId!);
      await assertSponsorInClub(input.sponsorId, ctx.user.clubId!);

      const [record] = await db
        .select()
        .from(acceptanceRecords)
        .where(
          and(
            eq(acceptanceRecords.matchId, input.matchId),
            eq(acceptanceRecords.sponsorId, input.sponsorId),
          ),
        )
        .limit(1);

      if (!record) return { record: null, checkItems: [] };

      const checkItems = await db
        .select()
        .from(benefitCheckItems)
        .where(eq(benefitCheckItems.recordId, record.id));

      return { record, checkItems };
    }),

  byMatch: protectedProcedure
    .input(z.object({ matchId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertMatchInClub(input.matchId, ctx.user.clubId!);

      const clubSponsors = await db
        .select()
        .from(sponsors)
        .where(
          and(eq(sponsors.clubId, ctx.user.clubId!), eq(sponsors.isActive, true), eq(sponsors.stage, "signed")),
        )
        .orderBy(asc(sponsors.sortOrder));

      const records = await db
        .select()
        .from(acceptanceRecords)
        .where(eq(acceptanceRecords.matchId, input.matchId));

      const results = await Promise.all(
        clubSponsors.map(async (sponsor) => {
          const record = records.find((r) => r.sponsorId === sponsor.id) ?? null;

          const items = await db
            .select()
            .from(benefitItems)
            .where(and(eq(benefitItems.sponsorId, sponsor.id), eq(benefitItems.isActive, true)));

          let filledCount = 0;
          if (record) {
            const checkItems = await db
              .select()
              .from(benefitCheckItems)
              .where(eq(benefitCheckItems.recordId, record.id));
            filledCount = checkItems.filter((c) => c.fulfilled !== "na").length;
          }

          return {
            sponsor,
            record,
            totalCount: items.length,
            filledCount,
          };
        }),
      );

      return results;
    }),

  bySponsor: protectedProcedure
    .input(z.object({ sponsorId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertSponsorInClub(input.sponsorId, ctx.user.clubId!);

      const clubMatches = await db
        .select()
        .from(matches)
        .where(eq(matches.clubId, ctx.user.clubId!))
        .orderBy(asc(matches.round));

      const records = await db
        .select()
        .from(acceptanceRecords)
        .where(eq(acceptanceRecords.sponsorId, input.sponsorId));

      return clubMatches.map((match) => ({
        match,
        record: records.find((r) => r.matchId === match.id) ?? null,
      }));
    }),

  checkItems: protectedProcedure
    .input(z.object({ recordId: z.number() }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(benefitCheckItems)
        .where(eq(benefitCheckItems.recordId, input.recordId));
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        matchId: z.number(),
        sponsorId: z.number(),
        status: z.enum(["pending", "in_progress", "completed", "issue"]),
        overallRating: z.number().min(1).max(5).optional(),
        summary: z.string().optional(),
        checkItems: z.array(checkItemInput),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMatchInClub(input.matchId, ctx.user.clubId!);
      await assertSponsorInClub(input.sponsorId, ctx.user.clubId!);

      const [existing] = await db
        .select()
        .from(acceptanceRecords)
        .where(
          and(
            eq(acceptanceRecords.matchId, input.matchId),
            eq(acceptanceRecords.sponsorId, input.sponsorId),
          ),
        )
        .limit(1);

      let recordId: number;
      if (existing) {
        await db
          .update(acceptanceRecords)
          .set({
            status: input.status,
            overallRating: input.overallRating,
            summary: input.summary,
            submittedBy: ctx.user.id,
          })
          .where(eq(acceptanceRecords.id, existing.id));
        recordId = existing.id;
      } else {
        const [result] = await db.insert(acceptanceRecords).values({
          matchId: input.matchId,
          sponsorId: input.sponsorId,
          submittedBy: ctx.user.id,
          status: input.status,
          overallRating: input.overallRating,
          summary: input.summary,
        });
        recordId = result.insertId;
      }

      const existingCheckItems = await db
        .select()
        .from(benefitCheckItems)
        .where(eq(benefitCheckItems.recordId, recordId));

      const benefitItemIds = input.checkItems.map((c) => c.benefitItemId);
      const relevantItems =
        benefitItemIds.length > 0
          ? await db.select().from(benefitItems).where(inArray(benefitItems.id, benefitItemIds))
          : [];

      for (const item of input.checkItems) {
        const existingCheck = existingCheckItems.find((c) => c.benefitItemId === item.benefitItemId);
        const requiresApproval = relevantItems.find((i) => i.id === item.benefitItemId)?.requiresApproval ?? false;
        // Resubmitting a check-in that requires approval sends it back to "pending" for re-review.
        const values = {
          fulfilled: item.fulfilled,
          note: item.note,
          completedCount: item.completedCount,
          attachmentUrls: item.attachmentUrls ? JSON.stringify(item.attachmentUrls) : undefined,
          reviewStatus: requiresApproval ? ("pending" as const) : ("approved" as const),
          reviewedBy: requiresApproval ? null : ctx.user.id,
          reviewedAt: requiresApproval ? null : new Date(),
        };
        if (existingCheck) {
          await db
            .update(benefitCheckItems)
            .set(values)
            .where(eq(benefitCheckItems.id, existingCheck.id));
        } else {
          await db.insert(benefitCheckItems).values({
            recordId,
            benefitItemId: item.benefitItemId,
            ...values,
          });
        }
      }

      const [record] = await db.select().from(acceptanceRecords).where(eq(acceptanceRecords.id, recordId)).limit(1);
      const checkItems = await db
        .select()
        .from(benefitCheckItems)
        .where(eq(benefitCheckItems.recordId, recordId));

      return { record, checkItems };
    }),
});
