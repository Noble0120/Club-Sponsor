import { eq, asc } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
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
});
