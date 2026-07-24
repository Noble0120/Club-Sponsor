import { and, eq, inArray } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "../../db";
import { acceptanceRecords, matches, sponsors } from "../../db/schema";

export const dashboardRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const clubId = ctx.user.clubId;
    if (!clubId) {
      return {
        totalMatches: 0,
        homeMatches: 0,
        totalSponsors: 0,
        totalRecords: 0,
        completedRecords: 0,
        issueRecords: 0,
        completionRate: 0,
      };
    }

    const clubMatches = await db.select().from(matches).where(eq(matches.clubId, clubId));
    const clubSponsors = await db
      .select()
      .from(sponsors)
      .where(and(eq(sponsors.clubId, clubId), eq(sponsors.stage, "signed")));

    const matchIds = clubMatches.map((m) => m.id);
    const records =
      matchIds.length > 0
        ? await db.select().from(acceptanceRecords).where(inArray(acceptanceRecords.matchId, matchIds))
        : [];

    const totalPossible = clubMatches.length * clubSponsors.filter((s) => s.isActive).length;
    const completedRecords = records.filter((r) => r.status === "completed").length;
    const issueRecords = records.filter((r) => r.status === "issue").length;

    return {
      totalMatches: clubMatches.length,
      homeMatches: clubMatches.filter((m) => m.isHome).length,
      totalSponsors: clubSponsors.length,
      totalRecords: records.length,
      completedRecords,
      issueRecords,
      completionRate: totalPossible > 0 ? Math.round((completedRecords / totalPossible) * 1000) / 10 : 0,
    };
  }),

  sponsorProgress: protectedProcedure.query(async ({ ctx }) => {
    const clubId = ctx.user.clubId;
    if (!clubId) return [];

    const clubSponsors = await db
      .select()
      .from(sponsors)
      .where(and(eq(sponsors.clubId, clubId), eq(sponsors.stage, "signed")));
    const clubMatches = await db.select().from(matches).where(eq(matches.clubId, clubId));
    const matchIds = clubMatches.map((m) => m.id);
    const records =
      matchIds.length > 0
        ? await db.select().from(acceptanceRecords).where(inArray(acceptanceRecords.matchId, matchIds))
        : [];

    return clubSponsors.map((sponsor) => {
      const sponsorRecords = records.filter((r) => r.sponsorId === sponsor.id);
      return {
        sponsor,
        filled: sponsorRecords.length,
        total: clubMatches.length,
        completedCount: sponsorRecords.filter((r) => r.status === "completed").length,
        issueCount: sponsorRecords.filter((r) => r.status === "issue").length,
      };
    });
  }),
});
