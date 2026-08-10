import { useState } from "react";
import { useParams } from "wouter";
import { Streamdown } from "streamdown";
import { Trophy, Printer, ChevronDown, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { colorForText, DELIVERY_STATUS_LABELS, DELIVERY_STATUS_COLORS } from "@/lib/constants";

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

  const { company, generatedAt, assets, report } = data;
  const allDeliveries = assets.flatMap((a) => a.deliveries);
  const totalDeliveries = allDeliveries.length;
  const deliveredCount = allDeliveries.filter((d) => d.delivery.status === "delivered").length;
  const fulfillmentRate = totalDeliveries > 0 ? Math.round((deliveredCount / totalDeliveries) * 100) : 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between no-print">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4" />
            俱乐部赞助商管理系统
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" />
            打印
          </Button>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{company.name}</h1>
            <Badge className={colorForText(company.tier)} variant="outline">
              {company.tier}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            报告生成时间：{new Date(generatedAt).toLocaleString()}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{assets.length}</div>
              <div className="text-xs text-muted-foreground">资产条目</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{deliveredCount}</div>
              <div className="text-xs text-muted-foreground">已交付</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{fulfillmentRate}%</div>
              <div className="text-xs text-muted-foreground">履约率</div>
            </CardContent>
          </Card>
        </div>

        {report && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">AI 生成报告</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <Streamdown>{report.content}</Streamdown>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">各资产交付详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {assets.map(({ asset, deliveries }) => (
              <AssetRow key={asset.id} asset={asset} deliveries={deliveries} />
            ))}
            {assets.length === 0 && <p className="text-sm text-muted-foreground">暂无资产条目</p>}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} 俱乐部赞助商管理系统 · 本报告由系统自动生成
        </p>
      </div>
    </div>
  );
}

function AssetRow({
  asset,
  deliveries,
}: {
  asset: { id: number; name: string; category: string };
  deliveries: {
    delivery: { id: number; status: string; scheduledDate: string | Date | null; note: string | null };
    match: { round: number; opponent: string; matchDate: string | Date } | null;
  }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const deliveredCount = deliveries.filter((d) => d.delivery.status === "delivered").length;

  return (
    <div className="rounded-lg border">
      <button className="flex w-full items-center gap-3 p-3 text-left text-sm" onClick={() => setExpanded((e) => !e)}>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="flex-1">
          {asset.name}
          {asset.category ? `（${asset.category}）` : ""}
        </span>
        <span className="text-xs text-muted-foreground">
          {deliveredCount}/{deliveries.length}
        </span>
      </button>
      {expanded && (
        <div className="space-y-1 border-t p-3">
          {deliveries.length === 0 && <p className="text-xs text-muted-foreground">暂无交付记录</p>}
          {deliveries.map(({ delivery, match }) => (
            <div key={delivery.id} className="flex items-center gap-2 text-xs">
              <Badge className={DELIVERY_STATUS_COLORS[delivery.status]}>{DELIVERY_STATUS_LABELS[delivery.status]}</Badge>
              <span>
                {match
                  ? `第${match.round}轮 vs ${match.opponent}（${new Date(match.matchDate).toLocaleDateString()}）`
                  : delivery.scheduledDate
                    ? new Date(delivery.scheduledDate).toLocaleDateString()
                    : "未排期"}
              </span>
              {delivery.note && <span className="text-muted-foreground">（{delivery.note}）</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
