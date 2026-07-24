import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db } from "../../db";
import { sponsors, sponsorStageEnum } from "../../db/schema";

const tierSchema = z.string().min(1);
const stageSchema = z.enum(sponsorStageEnum);

export const sponsorsRouter = router({
  list: protectedProcedure
    .input(z.object({ stage: stageSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.user.clubId) return [];
      const conditions = [eq(sponsors.clubId, ctx.user.clubId)];
      if (input?.stage) conditions.push(eq(sponsors.stage, input.stage));
      return db
        .select()
        .from(sponsors)
        .where(and(...conditions))
        .orderBy(asc(sponsors.sortOrder));
    }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const [sponsor] = await db
      .select()
      .from(sponsors)
      .where(and(eq(sponsors.id, input.id), eq(sponsors.clubId, ctx.user.clubId!)))
      .limit(1);
    if (!sponsor) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    return sponsor;
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
      const [result] = await db.insert(sponsors).values({
        clubId: ctx.user.clubId!,
        ...input,
        tier: input.tier || "待定",
      });
      const [sponsor] = await db.select().from(sponsors).where(eq(sponsors.id, result.insertId)).limit(1);
      return sponsor;
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
        .update(sponsors)
        .set(rest)
        .where(and(eq(sponsors.id, id), eq(sponsors.clubId, ctx.user.clubId!)));
      const [sponsor] = await db.select().from(sponsors).where(eq(sponsors.id, id)).limit(1);
      return sponsor;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(sponsors)
        .where(and(eq(sponsors.id, input.id), eq(sponsors.clubId, ctx.user.clubId!)));
      return { success: true };
    }),
});
