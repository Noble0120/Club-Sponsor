import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TIER_LABELS,
  TIER_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  FULFILLED_LABELS,
  FULFILLED_COLORS,
} from "@/lib/constants";

export default function ByRound() {
  const { data: matches } = trpc.matches.list.useQuery();
  const [matchId, setMatchId] = useState<number | null>(null);

  useEffect(() => {
    if (matches && matches.length > 0 && matchId === null) {
      setMatchId(matches[0].id);
    }
  }, [matches, matchId]);

  const { data: overview } = trpc.records.byMatch.useQuery(
    { matchId: matchId! },
    { enabled: matchId !== null },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">按轮次查看</h1>
        <p className="text-sm text-muted-foreground">选择比赛场次，查看各赞助商的权益验收情况</p>
      </div>

      <Select value={matchId ? String(matchId) : undefined} onValueChange={(v) => setMatchId(Number(v))}>
        <SelectTrigger className="w-72">
          <SelectValue placeholder="选择比赛场次" />
        </SelectTrigger>
        <SelectContent>
          {matches?.map((m) => (
            <SelectItem key={m.id} value={String(m.id)}>
              第{m.round}轮 vs {m.opponent}（{m.isHome ? "主场" : "客场"}）
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="space-y-3">
        {overview?.map((row) => (
          <SponsorMatchCard key={row.sponsor.id} matchId={matchId!} row={row} />
        ))}
        {overview?.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">该俱乐部暂无赞助商</p>
        )}
      </div>
    </div>
  );
}

function SponsorMatchCard({
  matchId,
  row,
}: {
  matchId: number;
  row: {
    sponsor: { id: number; name: string; tier: string };
    record: { status: string } | null;
    totalCount: number;
    filledCount: number;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: benefits } = trpc.benefits.bySponsor.useQuery(
    { sponsorId: row.sponsor.id },
    { enabled: expanded },
  );
  const { data: recordDetail } = trpc.records.byMatchAndSponsor.useQuery(
    { matchId, sponsorId: row.sponsor.id },
    { enabled: expanded },
  );

  const status = row.record?.status ?? "pending";
  const perMatchBenefits = benefits?.filter((b) => b.itemType === "per_match" && b.isActive) ?? [];

  return (
    <Card>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.sponsor.name}</span>
            <Badge className={TIER_COLORS[row.sponsor.tier]} variant="outline">
              {TIER_LABELS[row.sponsor.tier]}
            </Badge>
          </div>
        </div>
        <span className="text-sm text-muted-foreground">
          {row.filledCount}/{row.totalCount}
        </span>
        <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
        <Link href={`/acceptance/${matchId}/${row.sponsor.id}`} onClick={(e) => e.stopPropagation()}>
          <Button size="sm">填写验收</Button>
        </Link>
      </button>

      {expanded && (
        <CardContent className="border-t pt-4">
          {perMatchBenefits.length === 0 && (
            <p className="text-sm text-muted-foreground">该赞助商暂无场次型权益条目</p>
          )}
          <div className="space-y-2">
            {perMatchBenefits.map((item) => {
              const check = recordDetail?.checkItems.find((c) => c.benefitItemId === item.id);
              const fulfilled = check?.fulfilled ?? "na";
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-md border p-2 text-sm">
                  <Badge className={CATEGORY_COLORS[item.category]} variant="outline">
                    {item.categoryLabel || CATEGORY_LABELS[item.category]}
                  </Badge>
                  <span className="flex-1">{item.name}</span>
                  <Badge className={FULFILLED_COLORS[fulfilled]}>{FULFILLED_LABELS[fulfilled]}</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
