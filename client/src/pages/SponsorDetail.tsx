import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  colorForText,
  STATUS_LABELS,
  STATUS_COLORS,
  FULFILLMENT_MODE_LABELS,
  PROGRESS_STATUS_LABELS,
  PROGRESS_STATUS_COLORS,
} from "@/lib/constants";

export default function SponsorDetail() {
  const { id } = useParams<{ id: string }>();
  const sponsorId = Number(id);

  const { data: sponsor } = trpc.sponsors.get.useQuery({ id: sponsorId });
  const { data: records } = trpc.records.bySponsor.useQuery({ sponsorId });
  const { data: progress } = trpc.benefits.progressBySponsor.useQuery({ sponsorId });

  if (!sponsor) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{sponsor.name}</h1>
            <Badge className={colorForText(sponsor.tier)} variant="outline">
              {sponsor.tier}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            联系人：{sponsor.contactName || "-"} · 电话：{sponsor.contactPhone || "-"}
          </p>
          {sponsor.notes && <p className="mt-1 text-sm text-muted-foreground">备注：{sponsor.notes}</p>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">权益履约进度</CardTitle>
        </CardHeader>
        <CardContent>
          {!progress || progress.length === 0 ? (
            <p className="text-sm text-muted-foreground">该赞助商暂无权益条目</p>
          ) : (
            <div className="space-y-2">
              {progress.map((p) => (
                <Link
                  key={p.benefitItem.id}
                  href={`/by-benefit?sponsor=${sponsorId}&item=${p.benefitItem.id}`}
                  className="block rounded-md border p-3 text-sm transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.benefitItem.name}</span>
                      <Badge variant="outline">{FULFILLMENT_MODE_LABELS[p.benefitItem.fulfillmentMode]}</Badge>
                      {p.pendingReviewCount > 0 && (
                        <Badge className="bg-yellow-100 text-yellow-700">{p.pendingReviewCount}条待审核</Badge>
                      )}
                    </div>
                    <Badge className={PROGRESS_STATUS_COLORS[p.status]}>{PROGRESS_STATUS_LABELS[p.status]}</Badge>
                  </div>
                  {p.targetCount != null && (
                    <div className="mt-2 flex items-center gap-3">
                      <Progress
                        value={p.targetCount > 0 ? (p.completedCount / p.targetCount) * 100 : 0}
                        className="h-1.5 flex-1"
                      />
                      <span className="text-xs text-muted-foreground">
                        {p.completedCount}/{p.targetCount}
                        {p.benefitItem.countUnit ?? ""}
                      </span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">各场次验收记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {records?.map(({ match, record }) => (
            <Link
              key={match.id}
              href={`/acceptance/${match.id}/${sponsorId}`}
              className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-accent/50"
            >
              <div>
                第{match.round}轮 vs {match.opponent}（{match.isHome ? "主场" : "客场"}） ·{" "}
                {new Date(match.matchDate).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-3">
                <Badge className={STATUS_COLORS[record?.status ?? "pending"]}>
                  {STATUS_LABELS[record?.status ?? "pending"]}
                </Badge>
                <Button size="sm" variant="outline">
                  {record ? "查看" : "填写"}
                </Button>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
