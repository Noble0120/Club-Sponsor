import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { assets, companies, deliveries, deliveryTasks, matches } from "../db/schema";
import { planDeliveriesForAsset } from "./deliveryScheduling";
import { getTaskTemplate } from "./taskTemplates";

/**
 * Keeps match-scoped assets in sync with the club's match list: if a schedule spreadsheet is
 * imported (or a match is added) after an asset already exists, this fills in the missing
 * Delivery rows for newly-added matches without touching deliveries that already exist.
 */
export async function syncMatchScopedDeliveries() {
  const clubs = await db.select({ clubId: companies.clubId }).from(companies).groupBy(companies.clubId);

  for (const { clubId } of clubs) {
    const clubCompanies = await db.select().from(companies).where(eq(companies.clubId, clubId));
    const companyIds = clubCompanies.map((c) => c.id);
    if (companyIds.length === 0) continue;

    const clubAssets = await db
      .select()
      .from(assets)
      .where(inArray(assets.companyId, companyIds));
    if (clubAssets.length === 0) continue;

    const clubMatches = await db.select().from(matches).where(eq(matches.clubId, clubId));

    for (const asset of clubAssets) {
      const existing = await db.select().from(deliveries).where(eq(deliveries.assetId, asset.id));
      const existingMatchIds = new Set(existing.map((d) => d.matchId).filter((id): id is number => id != null));

      const planned = planDeliveriesForAsset(asset, clubMatches);
      const missing = planned.filter((p) => p.matchId != null && !existingMatchIds.has(p.matchId));
      if (missing.length === 0) continue;

      const taskNames = getTaskTemplate(asset.category, asset.name);
      for (const plan of missing) {
        const [deliveryResult] = await db.insert(deliveries).values({
          assetId: asset.id,
          matchId: plan.matchId,
          scheduledDate: plan.scheduledDate,
          status: plan.status,
        });
        if (taskNames.length > 0) {
          await db.insert(deliveryTasks).values(
            taskNames.map((name) => ({
              deliveryId: deliveryResult.insertId,
              name,
              dueDate: plan.scheduledDate ?? undefined,
            })),
          );
        }
      }
      console.log(`[cron] Synced ${missing.length} new delivery(ies) for asset #${asset.id} "${asset.name}"`);
    }
  }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function startHeartbeat() {
  syncMatchScopedDeliveries().catch((err) => console.error("[cron] syncMatchScopedDeliveries failed", err));
  setInterval(() => {
    syncMatchScopedDeliveries().catch((err) => console.error("[cron] syncMatchScopedDeliveries failed", err));
  }, ONE_DAY_MS);
}
