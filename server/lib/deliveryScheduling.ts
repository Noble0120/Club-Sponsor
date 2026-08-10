import type { Asset, Match } from "../db/schema";

const MATCH_SCOPE_KEYWORDS = ["主场", "客场", "每场", "所有比赛", "全部比赛", "match", "home", "away", "matchday"];

export interface PlannedDelivery {
  matchId: number | null;
  scheduledDate: Date | null;
  status: "scheduled" | "unscheduled";
}

/**
 * Given a newly-created asset (already inserted, with an id) and the club's matches, decides
 * how many Delivery rows to create and whether each is already schedulable against a specific
 * match. This is what lets "傻瓜式" AI ingestion skip a fulfillment-mode picker entirely:
 *
 * - scope mentions matches ("全部主场比赛" etc.) → one delivery per matching home match within
 *   [asset.startDate, asset.endDate] (or all home matches if no date range given)
 * - otherwise, with a targetCount set (e.g. "4条视频") → that many unscheduled delivery slots,
 *   one per unit, so each can be scheduled individually from the Planning page
 * - otherwise → a single unscheduled delivery representing the one-off deliverable
 */
export function planDeliveriesForAsset(asset: Pick<Asset, "scope" | "startDate" | "endDate" | "targetCount">, clubMatches: Match[]): PlannedDelivery[] {
  const scope = (asset.scope ?? "").toLowerCase();
  const mentionsMatches = MATCH_SCOPE_KEYWORDS.some((k) => scope.includes(k.toLowerCase()));

  if (mentionsMatches) {
    const homeMatches = clubMatches.filter((m) => m.isHome);
    const inRange = homeMatches.filter((m) => {
      if (asset.startDate && m.matchDate < asset.startDate) return false;
      if (asset.endDate && m.matchDate > asset.endDate) return false;
      return true;
    });
    const applicable = inRange.length > 0 ? inRange : homeMatches;
    if (applicable.length > 0) {
      return applicable.map((m) => ({ matchId: m.id, scheduledDate: m.matchDate, status: "scheduled" as const }));
    }
  }

  const unitCount = asset.targetCount && asset.targetCount > 1 ? asset.targetCount : 1;
  return Array.from({ length: unitCount }, () => ({
    matchId: null,
    scheduledDate: null,
    status: "unscheduled" as const,
  }));
}
