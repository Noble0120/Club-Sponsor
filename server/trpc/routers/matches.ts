import { z } from "zod";
import { and, eq, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db } from "../../db";
import { matches } from "../../db/schema";

export const matchesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.clubId) return [];
    return db
      .select()
      .from(matches)
      .where(eq(matches.clubId, ctx.user.clubId))
      .orderBy(asc(matches.round));
  }),

  create: adminProcedure
    .input(
      z.object({
        round: z.number(),
        matchDate: z.coerce.date(),
        isHome: z.boolean(),
        opponent: z.string().min(1),
        venue: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [result] = await db.insert(matches).values({ clubId: ctx.user.clubId!, ...input });
      const [match] = await db.select().from(matches).where(eq(matches.id, result.insertId)).limit(1);
      return match;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(matches)
        .where(and(eq(matches.id, input.id), eq(matches.clubId, ctx.user.clubId!)));
      return { success: true };
    }),

  // Rows already parsed client-side from the uploaded spreadsheet. Only home matches are
  // imported — the away schedule isn't relevant to sponsor benefit acceptance.
  importSchedule: adminProcedure
    .input(
      z.array(
        z.object({
          round: z.number(),
          matchDate: z.coerce.date(),
          isHome: z.boolean(),
          opponent: z.string().min(1),
          venue: z.string().optional(),
        }),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const clubId = ctx.user.clubId;
      if (!clubId) throw new TRPCError({ code: "BAD_REQUEST", message: "尚未关联俱乐部" });

      const homeRows = input.filter((row) => row.isHome);
      if (homeRows.length === 0) {
        return { created: 0 };
      }

      await db.insert(matches).values(homeRows.map((row) => ({ clubId, ...row })));
      return { created: homeRows.length };
    }),
});
