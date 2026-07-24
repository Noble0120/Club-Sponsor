import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TIER_LABELS, TIER_COLORS, STATUS_LABELS, STATUS_COLORS, FULFILLED_LABELS, FULFILLED_COLORS } from "@/lib/constants";

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
            <Badge className={TIER_COLORS[sponsor.tier]} variant="outline">
              {TIER_LABELS[sponsor.tier]}
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
          <CardTitle className="text-base">全季权益进度</CardTitle>
        </CardHeader>
        <CardContent>
          {!progress || progress.total === 0 ? (
            <p className="text-sm text-muted-foreground">该赞助商暂无全季型权益条目</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Progress value={(progress.completed / progress.total) * 100} className="h-2 flex-1" />
                <span className="text-sm text-muted-foreground">
                  {progress.completed}/{progress.total}
                </span>
              </div>
              <div className="space-y-2">
                {progress.items.map(({ benefitItem, latestCheck }) => (
                  <div key={benefitItem.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span>{benefitItem.name}</span>
                    <Badge className={FULFILLED_COLORS[latestCheck?.fulfilled ?? "na"]}>
                      {FULFILLED_LABELS[latestCheck?.fulfilled ?? "na"]}
                    </Badge>
                  </div>
                ))}
              </div>
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
