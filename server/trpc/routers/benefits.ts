import { z } from "zod";
import { and, asc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db } from "../../db";
import {
  benefitItems,
  benefitCheckItems,
  acceptanceRecords,
  sponsors,
  matches,
  fulfillmentModeEnum,
} from "../../db/schema";
import { computeBenefitItemProgress } from "../../lib/benefitProgress";

const fulfillmentModeSchema = z.enum(fulfillmentModeEnum);

async function assertSponsorInClub(sponsorId: number, clubId: number) {
  const [sponsor] = await db
    .select()
    .from(sponsors)
    .where(and(eq(sponsors.id, sponsorId), eq(sponsors.clubId, clubId)))
    .limit(1);
  if (!sponsor) {
    throw new TRPCError({ code: "NOT_FOUND", message: "赞助商不存在" });
  }
  return sponsor;
}

async function getBenefitItemWithSponsor(benefitItemId: number) {
  const [item] = await db.select().from(benefitItems).where(eq(benefitItems.id, benefitItemId)).limit(1);
  if (!item) {
    throw new TRPCError({ code: "NOT_FOUND", message: "权益条目不存在" });
  }
  const [sponsor] = await db.select().from(sponsors).where(eq(sponsors.id, item.sponsorId)).limit(1);
  return { item, sponsor };
}

const benefitItemFields = {
  code: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  fulfillmentMode: fulfillmentModeSchema.default("MATCH"),
  targetCount: z.number().optional(),
  countUnit: z.string().optional(),
  category: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  scope: z.string().optional(),
  attachmentRequirement: z.string().optional(),
  requiresApproval: z.boolean().optional(),
  assigneeId: z.number().optional(),
  contractNote: z.string().optional(),
  sortOrder: z.number().optional(),
};

export const benefitsRouter = router({
  bySponsor: protectedProcedure
    .input(z.object({ sponsorId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertSponsorInClub(input.sponsorId, ctx.user.clubId!);
      return db
        .select()
        .from(benefitItems)
        .where(eq(benefitItems.sponsorId, input.sponsorId))
        .orderBy(asc(benefitItems.sortOrder));
    }),

  create: adminProcedure
    .input(z.object({ sponsorId: z.number(), ...benefitItemFields }))
    .mutation(async ({ ctx, input }) => {
      await assertSponsorInClub(input.sponsorId, ctx.user.clubId!);
      const [result] = await db.insert(benefitItems).values(input);
      const [item] = await db.select().from(benefitItems).where(eq(benefitItems.id, result.insertId)).limit(1);
      return item;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        code: z.string().optional(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        fulfillmentMode: fulfillmentModeSchema.optional(),
        targetCount: z.number().optional(),
        countUnit: z.string().optional(),
        category: z.string().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        scope: z.string().optional(),
        attachmentRequirement: z.string().optional(),
        requiresApproval: z.boolean().optional(),
        assigneeId: z.number().optional(),
        contractNote: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const { sponsor } = await getBenefitItemWithSponsor(id);
      if (!sponsor || sponsor.clubId !== ctx.user.clubId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.update(benefitItems).set(rest).where(eq(benefitItems.id, id));
      const [item] = await db.select().from(benefitItems).where(eq(benefitItems.id, id)).limit(1);
      return item;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { sponsor } = await getBenefitItemWithSponsor(input.id);
      if (!sponsor || sponsor.clubId !== ctx.user.clubId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.delete(benefitItems).where(eq(benefitItems.id, input.id));
      return { success: true };
    }),

  progressBySponsor: protectedProcedure
    .input(z.object({ sponsorId: z.number() }))
    .query(async ({ ctx, input }) => {
      const clubId = ctx.user.clubId!;
      await assertSponsorInClub(input.sponsorId, clubId);

      const items = await db
        .select()
        .from(benefitItems)
        .where(and(eq(benefitItems.sponsorId, input.sponsorId), eq(benefitItems.isActive, true)))
        .orderBy(asc(benefitItems.sortOrder));

      const clubMatches = await db.select().from(matches).where(eq(matches.clubId, clubId));
      const sponsorRecords = await db
        .select()
        .from(acceptanceRecords)
        .where(eq(acceptanceRecords.sponsorId, input.sponsorId));
      const recordIds = sponsorRecords.map((r) => r.id);
      const itemIds = items.map((i) => i.id);

      const checkItems =
        recordIds.length > 0 && itemIds.length > 0
          ? await db
              .select()
              .from(benefitCheckItems)
              .where(
                and(
                  inArray(benefitCheckItems.recordId, recordIds),
                  inArray(benefitCheckItems.benefitItemId, itemIds),
                ),
              )
          : [];

      const progress = items.map((item) =>
        computeBenefitItemProgress(
          item,
          clubMatches,
          sponsorRecords,
          checkItems.filter((c) => c.benefitItemId === item.id),
        ),
      );

      return progress;
    }),

  // Rows already parsed client-side from the uploaded spreadsheet. Sponsors are matched by
  // name (case-insensitive) within the club and auto-created if no match exists.
  importList: adminProcedure
    .input(
      z.array(
        z.object({
          sponsorName: z.string().min(1),
          name: z.string().min(1),
          category: z.string().optional(),
          fulfillmentMode: fulfillmentModeSchema,
          targetCount: z.number().optional(),
          countUnit: z.string().optional(),
          startDate: z.coerce.date().optional(),
          endDate: z.coerce.date().optional(),
        }),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const clubId = ctx.user.clubId!;
      const clubSponsors = await db.select().from(sponsors).where(eq(sponsors.clubId, clubId));
      const sponsorsCreated: string[] = [];

      let created = 0;
      for (const row of input) {
        let sponsor = clubSponsors.find(
          (s) => s.name.trim().toLowerCase() === row.sponsorName.trim().toLowerCase(),
        );
        if (!sponsor) {
          const [result] = await db.insert(sponsors).values({
            clubId,
            name: row.sponsorName.trim(),
            tier: "待设置",
          });
          const [newSponsor] = await db.select().from(sponsors).where(eq(sponsors.id, result.insertId)).limit(1);
          sponsor = newSponsor;
          clubSponsors.push(sponsor);
          sponsorsCreated.push(sponsor.name);
        }

        await db.insert(benefitItems).values({
          sponsorId: sponsor.id,
          name: row.name,
          category: row.category || "",
          fulfillmentMode: row.fulfillmentMode,
          targetCount: row.targetCount,
          countUnit: row.countUnit,
          startDate: row.startDate,
          endDate: row.endDate,
        });
        created += 1;
      }

      return { created, sponsorsCreated };
    }),

  pendingReviews: adminProcedure.query(async ({ ctx }) => {
    const clubId = ctx.user.clubId!;
    const clubSponsors = await db.select().from(sponsors).where(eq(sponsors.clubId, clubId));
    const sponsorIds = clubSponsors.map((s) => s.id);
    if (sponsorIds.length === 0) return [];

    const items = await db.select().from(benefitItems).where(inArray(benefitItems.sponsorId, sponsorIds));
    const itemIds = items.map((i) => i.id);
    if (itemIds.length === 0) return [];

    const records = await db
      .select()
      .from(acceptanceRecords)
      .where(inArray(acceptanceRecords.sponsorId, sponsorIds));
    const recordIds = records.map((r) => r.id);
    if (recordIds.length === 0) return [];

    const pending = await db
      .select()
      .from(benefitCheckItems)
      .where(
        and(
          inArray(benefitCheckItems.recordId, recordIds),
          inArray(benefitCheckItems.benefitItemId, itemIds),
          eq(benefitCheckItems.reviewStatus, "pending"),
        ),
      );

    const matchIds = [...new Set(records.map((r) => r.matchId))];
    const matchRows = matchIds.length > 0 ? await db.select().from(matches).where(inArray(matches.id, matchIds)) : [];

    return pending.map((checkItem) => {
      const record = records.find((r) => r.id === checkItem.recordId)!;
      const benefitItem = items.find((i) => i.id === checkItem.benefitItemId)!;
      const sponsor = clubSponsors.find((s) => s.id === record.sponsorId)!;
      const match = matchRows.find((m) => m.id === record.matchId)!;
      return { checkItem, benefitItem, sponsor, match };
    });
  }),

  reviewCheckItem: adminProcedure
    .input(z.object({ checkItemId: z.number(), approve: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [checkItem] = await db
        .select()
        .from(benefitCheckItems)
        .where(eq(benefitCheckItems.id, input.checkItemId))
        .limit(1);
      if (!checkItem) throw new TRPCError({ code: "NOT_FOUND" });

      const { sponsor } = await getBenefitItemWithSponsor(checkItem.benefitItemId);
      if (!sponsor || sponsor.clubId !== ctx.user.clubId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db
        .update(benefitCheckItems)
        .set({
          reviewStatus: input.approve ? "approved" : "rejected",
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
        })
        .where(eq(benefitCheckItems.id, input.checkItemId));

      const [updated] = await db
        .select()
        .from(benefitCheckItems)
        .where(eq(benefitCheckItems.id, input.checkItemId))
        .limit(1);
      return updated;
    }),
});
