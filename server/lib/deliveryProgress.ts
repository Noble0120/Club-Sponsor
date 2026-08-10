import type { Asset, Delivery, Match } from "../db/schema";

export interface DeliveryWithMatch {
  delivery: Delivery;
  match: Match | null;
}

export interface AssetProgress {
  asset: Asset;
  completedCount: number;
  targetCount: number | null;
  remainingCount: number | null;
  totalDeliveries: number;
  unscheduledCount: number;
  pendingReviewCount: number;
  deliveries: DeliveryWithMatch[];
}

/** Only "approved" deliveries count toward an asset's official completion progress. */
export function computeAssetProgress(asset: Asset, assetDeliveries: Delivery[], clubMatches: Match[]): AssetProgress {
  const withMatch: DeliveryWithMatch[] = assetDeliveries
    .map((delivery) => ({
      delivery,
      match: delivery.matchId ? (clubMatches.find((m) => m.id === delivery.matchId) ?? null) : null,
    }))
    .sort((a, b) => (a.match?.round ?? 0) - (b.match?.round ?? 0));

  const approved = assetDeliveries.filter((d) => d.reviewStatus === "approved" && d.status === "delivered");
  const completedCount = approved.reduce((sum, d) => sum + (d.completedCount ?? 1), 0);
  const targetCount = asset.targetCount ?? (assetDeliveries.length > 0 ? assetDeliveries.length : null);
  const remainingCount = targetCount != null ? Math.max(0, targetCount - completedCount) : null;

  return {
    asset,
    completedCount,
    targetCount,
    remainingCount,
    totalDeliveries: assetDeliveries.length,
    unscheduledCount: assetDeliveries.filter((d) => d.status === "unscheduled").length,
    pendingReviewCount: assetDeliveries.filter((d) => d.reviewStatus === "pending").length,
    deliveries: withMatch,
  };
}
