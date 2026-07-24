import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db } from "../../db";
import { clubs, users } from "../../db/schema";

export const clubsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        city: z.string().optional(),
        season: z.string().optional(),
        league: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const [result] = await db.insert(clubs).values({
        name: input.name,
        city: input.city,
        season: input.season || "2026",
        league: input.league,
        isSetupDone: true,
      });
      const [club] = await db.select().from(clubs).where(eq(clubs.id, result.insertId)).limit(1);
      return club;
    }),

  join: protectedProcedure
    .input(z.object({ clubId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [club] = await db.select().from(clubs).where(eq(clubs.id, input.clubId)).limit(1);
      if (!club) {
        throw new TRPCError({ code: "NOT_FOUND", message: "俱乐部不存在" });
      }
      await db.update(users).set({ clubId: input.clubId }).where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  current: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.clubId) return null;
    const [club] = await db.select().from(clubs).where(eq(clubs.id, ctx.user.clubId)).limit(1);
    return club ?? null;
  }),

  update: adminProcedure
    .input(
      z.object({
        name: z.string().optional(),
        logoUrl: z.string().optional(),
        city: z.string().optional(),
        season: z.string().optional(),
        league: z.string().optional(),
        contactEmail: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.clubId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "尚未关联俱乐部" });
      }
      await db.update(clubs).set(input).where(eq(clubs.id, ctx.user.clubId));
      const [club] = await db.select().from(clubs).where(eq(clubs.id, ctx.user.clubId)).limit(1);
      return club;
    }),
});
