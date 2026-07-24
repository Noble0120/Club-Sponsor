import { Link } from "wouter";
import { CalendarDays, Trophy, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { colorForText } from "@/lib/constants";

export default function Home() {
  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: progress } = trpc.dashboard.sponsorProgress.useQuery();
  const { data: expiringContracts } = trpc.contracts.expiringSoon.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">总览</h1>
        <p className="text-sm text-muted-foreground">赞助商权益验收情况一览</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总场次</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMatches ?? "-"}</div>
            <p className="text-xs text-muted-foreground">其中主场 {stats?.homeMatches ?? 0} 场</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">赞助商数量</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSponsors ?? "-"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">验收完成率</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completionRate ?? 0}%</div>
            <Progress value={stats?.completionRate ?? 0} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">存在问题记录</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.issueRecords ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {expiringContracts && expiringContracts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-muted-foreground" />
              即将到期合同（90天内）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {expiringContracts.map((c) => (
              <Link
                key={c.id}
                href={`/sponsor/${c.sponsorId}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-accent/50"
              >
                <div>
                  <span className="font-medium">{c.sponsor.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{c.filename}</span>
                </div>
                <div className="flex items-center gap-3">
                  {c.amount != null && <span className="text-xs text-muted-foreground">￥{c.amount.toLocaleString()}</span>}
                  <Badge variant="destructive">{new Date(c.endDate!).toLocaleDateString()} 到期</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">赞助商验收进度</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {progress?.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">暂无赞助商数据</p>
          )}
          {progress?.map((p) => (
            <Link
              key={p.sponsor.id}
              href={`/sponsor/${p.sponsor.id}`}
              className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-accent/50"
            >
              <div className="w-40 flex-shrink-0">
                <div className="truncate font-medium">{p.sponsor.name}</div>
                <Badge className={colorForText(p.sponsor.tier)} variant="outline">
                  {p.sponsor.tier}
                </Badge>
              </div>
              <div className="flex-1">
                <Progress value={p.total > 0 ? (p.filled / p.total) * 100 : 0} className="h-2" />
              </div>
              <div className="w-16 flex-shrink-0 text-right text-sm text-muted-foreground">
                {p.filled}/{p.total}
              </div>
              <div className="w-28 flex-shrink-0 text-right text-xs text-muted-foreground">
                完成 {p.completedCount} · 问题 {p.issueCount}
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
