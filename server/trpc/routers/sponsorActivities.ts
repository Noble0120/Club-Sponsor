import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "../../db";
import { sponsorActivities, sponsors, sponsorActivityTypeEnum } from "../../db/schema";

const activityTypeSchema = z.enum(sponsorActivityTypeEnum);

async function assertSponsorInClub(sponsorId: number, clubId: number) {
  const [sponsor] = await db
    .select()
    .from(sponsors)
    .where(and(eq(sponsors.id, sponsorId), eq(sponsors.clubId, clubId)))
    .limit(1);
  if (!sponsor) throw new TRPCError({ code: "NOT_FOUND", message: "赞助商不存在" });
  return sponsor;
}

export const sponsorActivitiesRouter = router({
  bySponsor: protectedProcedure
    .input(z.object({ sponsorId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertSponsorInClub(input.sponsorId, ctx.user.clubId!);
      return db
        .select()
        .from(sponsorActivities)
        .where(eq(sponsorActivities.sponsorId, input.sponsorId))
        .orderBy(desc(sponsorActivities.createdAt));
    }),

  create: protectedProcedure
    .input(
      z.object({
        sponsorId: z.number(),
        type: activityTypeSchema,
        content: z.string().min(1),
        contactPerson: z.string().optional(),
        followUpDate: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertSponsorInClub(input.sponsorId, ctx.user.clubId!);
      const [result] = await db.insert(sponsorActivities).values({ ...input, createdBy: ctx.user.id });
      const [activity] = await db
        .select()
        .from(sponsorActivities)
        .where(eq(sponsorActivities.id, result.insertId))
        .limit(1);
      return activity;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [activity] = await db
        .select()
        .from(sponsorActivities)
        .where(eq(sponsorActivities.id, input.id))
        .limit(1);
      if (!activity) throw new TRPCError({ code: "NOT_FOUND" });
      await assertSponsorInClub(activity.sponsorId, ctx.user.clubId!);
      if (ctx.user.role !== "admin" && activity.createdBy !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.delete(sponsorActivities).where(eq(sponsorActivities.id, input.id));
      return { success: true };
    }),
});
