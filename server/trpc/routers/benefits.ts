import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db } from "../../db";
import { benefitItems, benefitCheckItems, acceptanceRecords, sponsors, benefitCategoryEnum } from "../../db/schema";

const categorySchema = z.enum(benefitCategoryEnum);

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
    .input(
      z.object({
        sponsorId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        itemType: z.enum(["per_match", "season"]).default("per_match"),
        totalCount: z.number().optional(),
        countUnit: z.string().optional(),
        category: categorySchema,
        categoryLabel: z.string().optional(),
        sortOrder: z.number().optional(),
      }),
    )
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
        name: z.string().optional(),
        description: z.string().optional(),
        itemType: z.enum(["per_match", "season"]).optional(),
        totalCount: z.number().optional(),
        countUnit: z.string().optional(),
        category: categorySchema.optional(),
        categoryLabel: z.string().optional(),
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
      await assertSponsorInClub(input.sponsorId, ctx.user.clubId!);

      const seasonItems = await db
        .select()
        .from(benefitItems)
        .where(and(eq(benefitItems.sponsorId, input.sponsorId), eq(benefitItems.itemType, "season")))
        .orderBy(asc(benefitItems.sortOrder));

      if (seasonItems.length === 0) {
        return { total: 0, completed: 0, items: [] };
      }

      const records = await db
        .select()
        .from(acceptanceRecords)
        .where(eq(acceptanceRecords.sponsorId, input.sponsorId));
      const recordIds = records.map((r) => r.id);

      const seasonItemIds = seasonItems.map((i) => i.id);
      const checkItems =
        recordIds.length > 0
          ? await db
              .select()
              .from(benefitCheckItems)
              .where(
                and(
                  inArray(benefitCheckItems.recordId, recordIds),
                  inArray(benefitCheckItems.benefitItemId, seasonItemIds),
                ),
              )
              .orderBy(desc(benefitCheckItems.updatedAt))
          : [];

      const items = seasonItems.map((benefitItem) => {
        const latestCheck = checkItems.find((c) => c.benefitItemId === benefitItem.id) ?? null;
        return { benefitItem, latestCheck };
      });

      const completed = items.filter((i) => i.latestCheck?.fulfilled === "yes").length;

      return { total: seasonItems.length, completed, items };
    }),
});
