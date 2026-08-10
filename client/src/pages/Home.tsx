import { Link } from "wouter";
import { CalendarDays, Trophy, TrendingUp, AlertTriangle, Clock, ListTodo } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { colorForText } from "@/lib/constants";

export default function Home() {
  const { data: stats } = trpc.dashboard.stats.useQuery();
  const { data: suggestions } = trpc.dashboard.suggestions.useQuery();
  const { data: upcoming } = trpc.deliveries.upcoming.useQuery();
  const { data: unscheduled } = trpc.deliveries.unscheduled.useQuery();
  const { data: expiringContracts } = trpc.contracts.expiringSoon.useQuery();

  const hasSuggestions =
    suggestions &&
    (suggestions.unscheduledCount > 0 || suggestions.staleTaskCount > 0 || suggestions.expiringContractCount > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">总览</h1>
        <p className="text-sm text-muted-foreground">赞助商权益履约情况一览</p>
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
            <div className="text-2xl font-bold">{stats?.totalCompanies ?? "-"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">履约完成率</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completionRate ?? 0}%</div>
            <Progress value={stats?.completionRate ?? 0} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">存在问题的交付</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.issueCount ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {hasSuggestions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              建议关注
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {suggestions!.unscheduledCount > 0 && (
              <Link href="/planning" className="flex-1 min-w-56 rounded-md border p-3 text-sm hover:bg-accent/50">
                <span className="font-medium">{suggestions!.unscheduledCount}</span> 项权益尚未排期
              </Link>
            )}
            {suggestions!.staleTaskCount > 0 && (
              <Link href="/tasks" className="flex-1 min-w-56 rounded-md border p-3 text-sm hover:bg-accent/50">
                <span className="font-medium">{suggestions!.staleTaskCount}</span> 个任务超过7天未更新
              </Link>
            )}
            {suggestions!.expiringContractCount > 0 && (
              <div className="flex-1 min-w-56 rounded-md border p-3 text-sm">
                <span className="font-medium">{suggestions!.expiringContractCount}</span> 份合同即将到期
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                href={`/company/${c.companyId}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-accent/50"
              >
                <div>
                  <span className="font-medium">{c.company.name}</span>
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
          <CardTitle className="text-base">即将交付</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcoming?.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">暂无即将到来的交付</p>}
          {upcoming?.map((row) => (
            <Link
              key={row.delivery.id}
              href={`/company/${row.company.id}`}
              className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-accent/50"
            >
              <div className="w-40 flex-shrink-0">
                <div className="truncate font-medium">{row.asset.name}</div>
                <Badge className={colorForText(row.company.name)} variant="outline">
                  {row.company.name}
                </Badge>
              </div>
              <div className="flex-1 text-sm text-muted-foreground">
                {row.match ? `第${row.match.round}轮 vs ${row.match.opponent}` : ""}
                {row.effectiveDate ? ` · ${new Date(row.effectiveDate).toLocaleDateString()}` : ""}
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">未排期权益</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {unscheduled?.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">暂无待排期权益</p>}
          {unscheduled?.map((row) => (
            <Link
              key={row.delivery.id}
              href="/planning"
              className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-accent/50"
            >
              <div className="w-40 flex-shrink-0 truncate font-medium">{row.asset.name}</div>
              <div className="flex-1 text-sm text-muted-foreground">{row.company.name}</div>
              <Badge variant="outline">待排期</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
