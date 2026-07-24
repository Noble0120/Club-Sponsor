import { useState } from "react";
import { useParams } from "wouter";
import { Trophy, Printer, ChevronDown, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  colorForText,
  STATUS_LABELS,
  STATUS_COLORS,
  FULFILLED_LABELS,
  FULFILLED_COLORS,
} from "@/lib/constants";

export default function SponsorReport() {
  const { token } = useParams<{ token: string }>();
  const { data, error, isLoading } = trpc.reports.publicView.useQuery({ token });

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">加载中...</div>;
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-lg font-medium">链接无效或已过期</h1>
        <p className="text-sm text-muted-foreground">请联系俱乐部运营团队获取最新的分享链接</p>
      </div>
    );
  }

  const { sponsor, generatedAt, matches, benefitItems } = data;
  const totalMatches = matches.length;
  const acceptedMatches = matches.filter((m) => m.record).length;
  const allChecks = matches.flatMap((m) => m.checkItems);
  const fulfillmentRate =
    allChecks.length > 0
      ? Math.round((allChecks.filter((c) => c.fulfilled === "yes").length / allChecks.length) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between no-print">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4" />
            赞助商权益验收系统
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" />
            打印
          </Button>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{sponsor.name}</h1>
            <Badge className={colorForText(sponsor.tier)} variant="outline">
              {sponsor.tier}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            报告生成时间：{new Date(generatedAt).toLocaleString()}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{totalMatches}</div>
              <div className="text-xs text-muted-foreground">总场次</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{acceptedMatches}</div>
              <div className="text-xs text-muted-foreground">已验收场次</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{fulfillmentRate}%</div>
              <div className="text-xs text-muted-foreground">履约率</div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">各场次验收详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {matches.map(({ match, record, checkItems }) => (
              <MatchRow key={match.id} match={match} record={record} checkItems={checkItems} benefitItems={benefitItems} />
            ))}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} 赞助商权益验收系统 · 本报告由系统自动生成
        </p>
      </div>
    </div>
  );
}

function MatchRow({
  match,
  record,
  checkItems,
  benefitItems,
}: {
  match: { id: number; round: number; opponent: string; isHome: boolean; matchDate: string | Date };
  record: { status: string } | null;
  checkItems: { benefitItemId: number; fulfilled: string; note: string | null }[];
  benefitItems: { id: number; name: string }[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border">
      <button className="flex w-full items-center gap-3 p-3 text-left text-sm" onClick={() => setExpanded((e) => !e)}>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="flex-1">
          第{match.round}轮 vs {match.opponent}（{match.isHome ? "主场" : "客场"}） ·{" "}
          {new Date(match.matchDate).toLocaleDateString()}
        </span>
        <Badge className={STATUS_COLORS[record?.status ?? "pending"]}>{STATUS_LABELS[record?.status ?? "pending"]}</Badge>
      </button>
      {expanded && (
        <div className="space-y-1 border-t p-3">
          {checkItems.length === 0 && <p className="text-xs text-muted-foreground">暂无验收明细</p>}
          {checkItems.map((c) => {
            const item = benefitItems.find((b) => b.id === c.benefitItemId);
            return (
              <div key={c.benefitItemId} className="flex items-center gap-2 text-xs">
                <Badge className={FULFILLED_COLORS[c.fulfilled]}>{FULFILLED_LABELS[c.fulfilled]}</Badge>
                <span>{item?.name ?? "未知权益"}</span>
                {c.note && <span className="text-muted-foreground">（{c.note}）</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
