import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db } from "../../db";
import { companies, companyStageEnum } from "../../db/schema";

const tierSchema = z.string().min(1);
const stageSchema = z.enum(companyStageEnum);

export const companiesRouter = router({
  list: protectedProcedure
    .input(z.object({ stage: stageSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.user.clubId) return [];
      const conditions = [eq(companies.clubId, ctx.user.clubId)];
      if (input?.stage) conditions.push(eq(companies.stage, input.stage));
      return db
        .select()
        .from(companies)
        .where(and(...conditions))
        .orderBy(asc(companies.sortOrder));
    }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, input.id), eq(companies.clubId, ctx.user.clubId!)))
      .limit(1);
    if (!company) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    return company;
  }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        tier: tierSchema.optional(),
        stage: stageSchema.optional(),
        logoUrl: z.string().optional(),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        notes: z.string().optional(),
        sortOrder: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [result] = await db.insert(companies).values({
        clubId: ctx.user.clubId!,
        ...input,
        tier: input.tier || "待定",
      });
      const [company] = await db.select().from(companies).where(eq(companies.id, result.insertId)).limit(1);
      return company;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        tier: tierSchema.optional(),
        stage: stageSchema.optional(),
        logoUrl: z.string().optional(),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      await db
        .update(companies)
        .set(rest)
        .where(and(eq(companies.id, id), eq(companies.clubId, ctx.user.clubId!)));
      const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
      return company;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(companies)
        .where(and(eq(companies.id, input.id), eq(companies.clubId, ctx.user.clubId!)));
      return { success: true };
    }),
});
