import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "../../db";
import { companyActivities, companies, companyActivityTypeEnum } from "../../db/schema";

const activityTypeSchema = z.enum(companyActivityTypeEnum);

async function assertCompanyInClub(companyId: number, clubId: number) {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.clubId, clubId)))
    .limit(1);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "赞助商不存在" });
  return company;
}

export const companyActivitiesRouter = router({
  byCompany: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertCompanyInClub(input.companyId, ctx.user.clubId!);
      return db
        .select()
        .from(companyActivities)
        .where(eq(companyActivities.companyId, input.companyId))
        .orderBy(desc(companyActivities.createdAt));
    }),

  create: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        type: activityTypeSchema,
        content: z.string().min(1),
        contactPerson: z.string().optional(),
        followUpDate: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCompanyInClub(input.companyId, ctx.user.clubId!);
      const [result] = await db.insert(companyActivities).values({ ...input, createdBy: ctx.user.id });
      const [activity] = await db
        .select()
        .from(companyActivities)
        .where(eq(companyActivities.id, result.insertId))
        .limit(1);
      return activity;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [activity] = await db
        .select()
        .from(companyActivities)
        .where(eq(companyActivities.id, input.id))
        .limit(1);
      if (!activity) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCompanyInClub(activity.companyId, ctx.user.clubId!);
      if (ctx.user.role !== "admin" && activity.createdBy !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.delete(companyActivities).where(eq(companyActivities.id, input.id));
      return { success: true };
    }),
});
