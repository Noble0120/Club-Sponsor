import { and, eq, inArray, lte } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { db } from "../../db";
import { assets, companies, companyContracts, deliveries, deliveryTasks, matches } from "../../db/schema";

const EXPIRING_SOON_DAYS = 90;
const STALE_TASK_DAYS = 7;

export const dashboardRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const clubId = ctx.user.clubId;
    if (!clubId) {
      return {
        totalMatches: 0,
        homeMatches: 0,
        totalCompanies: 0,
        totalDeliveries: 0,
        deliveredCount: 0,
        issueCount: 0,
        completionRate: 0,
      };
    }

    const clubMatches = await db.select().from(matches).where(eq(matches.clubId, clubId));
    const clubCompanies = await db
      .select()
      .from(companies)
      .where(and(eq(companies.clubId, clubId), eq(companies.stage, "signed")));
    const companyIds = clubCompanies.map((c) => c.id);

    const clubAssets =
      companyIds.length > 0 ? await db.select().from(assets).where(inArray(assets.companyId, companyIds)) : [];
    const assetIds = clubAssets.map((a) => a.id);
    const clubDeliveries =
      assetIds.length > 0 ? await db.select().from(deliveries).where(inArray(deliveries.assetId, assetIds)) : [];

    const deliveredCount = clubDeliveries.filter((d) => d.status === "delivered").length;
    const issueCount = clubDeliveries.filter((d) => d.status === "issue").length;

    return {
      totalMatches: clubMatches.length,
      homeMatches: clubMatches.filter((m) => m.isHome).length,
      totalCompanies: clubCompanies.length,
      totalDeliveries: clubDeliveries.length,
      deliveredCount,
      issueCount,
      completionRate:
        clubDeliveries.length > 0 ? Math.round((deliveredCount / clubDeliveries.length) * 1000) / 10 : 0,
    };
  }),

  // Rule-based "Suggestions" for the Home page — no LLM involved, just scans for things that
  // need human attention: unscheduled rights, stale in-progress tasks, contracts expiring soon.
  suggestions: protectedProcedure.query(async ({ ctx }) => {
    const clubId = ctx.user.clubId;
    if (!clubId) return { unscheduledCount: 0, staleTaskCount: 0, expiringContractCount: 0 };

    const clubCompanies = await db.select().from(companies).where(eq(companies.clubId, clubId));
    const companyIds = clubCompanies.map((c) => c.id);
    if (companyIds.length === 0) return { unscheduledCount: 0, staleTaskCount: 0, expiringContractCount: 0 };

    const clubAssets = await db.select().from(assets).where(inArray(assets.companyId, companyIds));
    const assetIds = clubAssets.map((a) => a.id);

    const clubDeliveries =
      assetIds.length > 0 ? await db.select().from(deliveries).where(inArray(deliveries.assetId, assetIds)) : [];
    const unscheduledCount = clubDeliveries.filter((d) => d.status === "unscheduled").length;

    const deliveryIds = clubDeliveries.map((d) => d.id);
    const staleCutoff = new Date(Date.now() - STALE_TASK_DAYS * 24 * 60 * 60 * 1000);
    const clubTasks =
      deliveryIds.length > 0
        ? await db
            .select()
            .from(deliveryTasks)
            .where(
              and(
                inArray(deliveryTasks.deliveryId, deliveryIds),
                eq(deliveryTasks.status, "in_progress"),
                lte(deliveryTasks.updatedAt, staleCutoff),
              ),
            )
        : [];

    const now = new Date();
    const horizon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);
    const contracts = await db
      .select()
      .from(companyContracts)
      .where(inArray(companyContracts.companyId, companyIds));
    const expiringContractCount = contracts.filter(
      (c) => c.endDate && c.endDate.getTime() >= now.getTime() && c.endDate.getTime() <= horizon.getTime(),
    ).length;

    return {
      unscheduledCount,
      staleTaskCount: clubTasks.length,
      expiringContractCount,
    };
  }),
});
