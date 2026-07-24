import type { AcceptanceRecord, BenefitCheckItem, BenefitItem, Match } from "../db/schema";

export type ProgressStatus = "not_started" | "in_progress" | "completed" | "issue";

export interface MatchBreakdownEntry {
  match: Match;
  checkItem: BenefitCheckItem | null;
}

export interface BenefitItemProgress {
  benefitItem: BenefitItem;
  status: ProgressStatus;
  completedCount: number;
  targetCount: number | null;
  remainingCount: number | null;
  matchBreakdown: MatchBreakdownEntry[] | null;
  // Every match that actually has a check-in recorded for this item (any review status),
  // regardless of fulfillment mode — this is what powers the "browse by benefit" drill-down.
  entries: MatchBreakdownEntry[];
  isWithinWindow: boolean | null;
  hasInterruption: boolean | null;
  pendingReviewCount: number;
}

function buildEntries(
  clubMatches: Match[],
  sponsorRecords: AcceptanceRecord[],
  checkItemsForItem: BenefitCheckItem[],
): MatchBreakdownEntry[] {
  const entries: MatchBreakdownEntry[] = [];
  for (const checkItem of checkItemsForItem) {
    const record = sponsorRecords.find((r) => r.id === checkItem.recordId);
    if (!record) continue;
    const match = clubMatches.find((m) => m.id === record.matchId);
    if (!match) continue;
    entries.push({ match, checkItem });
  }
  return entries.sort((a, b) => a.match.round - b.match.round);
}

/**
 * Computes fulfillment progress for one benefit item, given all matches for the club,
 * all acceptance records for that sponsor, and all check-in rows recorded against this
 * benefit item (across every match). Only "approved" check-ins count toward completion;
 * pending/rejected ones are tracked separately via pendingReviewCount for the review queue.
 */
export function computeBenefitItemProgress(
  item: BenefitItem,
  clubMatches: Match[],
  sponsorRecords: AcceptanceRecord[],
  checkItemsForItem: BenefitCheckItem[],
): BenefitItemProgress {
  const approved = checkItemsForItem.filter((c) => c.reviewStatus === "approved");
  const pendingReviewCount = checkItemsForItem.filter((c) => c.reviewStatus === "pending").length;
  const entries = buildEntries(clubMatches, sponsorRecords, checkItemsForItem);

  if (item.fulfillmentMode === "QUANTITY" || item.fulfillmentMode === "EVENT") {
    const completedCount = approved.reduce(
      (sum, c) => sum + (c.completedCount ?? (c.fulfilled === "yes" ? 1 : 0)),
      0,
    );
    const targetCount = item.targetCount ?? null;
    const remainingCount = targetCount != null ? Math.max(0, targetCount - completedCount) : null;
    const status: ProgressStatus =
      targetCount != null && completedCount >= targetCount
        ? "completed"
        : completedCount > 0
          ? "in_progress"
          : "not_started";
    return {
      benefitItem: item,
      status,
      completedCount,
      targetCount,
      remainingCount,
      matchBreakdown: null,
      entries,
      isWithinWindow: null,
      hasInterruption: null,
      pendingReviewCount,
    };
  }

  if (item.fulfillmentMode === "MATCH" || item.fulfillmentMode === "ROUND") {
    const matchBreakdown: MatchBreakdownEntry[] = clubMatches.map((match) => {
      const record = sponsorRecords.find((r) => r.matchId === match.id);
      const checkItem = record ? (approved.find((c) => c.recordId === record.id) ?? null) : null;
      return { match, checkItem };
    });
    const completedCount = matchBreakdown.filter((b) => b.checkItem?.fulfilled === "yes").length;
    const targetCount = item.targetCount ?? clubMatches.length;
    const remainingCount = Math.max(0, targetCount - completedCount);
    const status: ProgressStatus =
      completedCount >= targetCount && targetCount > 0
        ? "completed"
        : completedCount > 0
          ? "in_progress"
          : "not_started";
    return {
      benefitItem: item,
      status,
      completedCount,
      targetCount,
      remainingCount,
      matchBreakdown,
      entries,
      isWithinWindow: null,
      hasInterruption: null,
      pendingReviewCount,
    };
  }

  if (item.fulfillmentMode === "ONE_TIME") {
    const done = approved.some((c) => c.fulfilled === "yes");
    return {
      benefitItem: item,
      status: done ? "completed" : "not_started",
      completedCount: done ? 1 : 0,
      targetCount: 1,
      remainingCount: done ? 0 : 1,
      matchBreakdown: null,
      entries,
      isWithinWindow: null,
      hasInterruption: null,
      pendingReviewCount,
    };
  }

  // CONTINUOUS
  const now = new Date();
  const afterStart = !item.startDate || now >= item.startDate;
  const beforeEnd = !item.endDate || now <= item.endDate;
  const isWithinWindow = afterStart && beforeEnd;
  const hasInterruption = approved.some((c) => c.fulfilled === "no");
  const status: ProgressStatus = hasInterruption
    ? "issue"
    : !afterStart
      ? "not_started"
      : !beforeEnd
        ? "completed"
        : "in_progress";
  return {
    benefitItem: item,
    status,
    completedCount: hasInterruption ? 0 : 1,
    targetCount: 1,
    remainingCount: null,
    matchBreakdown: null,
    entries,
    isWithinWindow,
    hasInterruption,
    pendingReviewCount,
  };
}
