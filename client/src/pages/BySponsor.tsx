import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TIER_LABELS, TIER_COLORS, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";

export default function BySponsor() {
  const { data: sponsors } = trpc.sponsors.list.useQuery();
  const [search, setSearch] = useState("");
  const [sponsorId, setSponsorId] = useState<number | null>(null);

  useEffect(() => {
    if (sponsors && sponsors.length > 0 && sponsorId === null) {
      setSponsorId(sponsors[0].id);
    }
  }, [sponsors, sponsorId]);

  const filtered = sponsors?.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())) ?? [];

  const { data: records } = trpc.records.bySponsor.useQuery(
    { sponsorId: sponsorId! },
    { enabled: sponsorId !== null },
  );

  const selectedSponsor = sponsors?.find((s) => s.id === sponsorId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">按赞助商查看</h1>
        <p className="text-sm text-muted-foreground">选择赞助商，查看全部场次的验收状态</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardContent className="space-y-3 p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索赞助商"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSponsorId(s.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                    sponsorId === s.id ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                  )}
                >
                  <span className="truncate">{s.name}</span>
                  <Badge
                    className={cn(sponsorId === s.id ? "" : TIER_COLORS[s.tier], "flex-shrink-0")}
                    variant="outline"
                  >
                    {TIER_LABELS[s.tier]}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">轮次</th>
                  <th className="px-4 py-2 font-medium">日期</th>
                  <th className="px-4 py-2 font-medium">主客场</th>
                  <th className="px-4 py-2 font-medium">对手</th>
                  <th className="px-4 py-2 font-medium">验收状态</th>
                  <th className="px-4 py-2 font-medium">评分</th>
                  <th className="px-4 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {records?.map(({ match, record }) => (
                  <tr key={match.id} className="border-b last:border-0">
                    <td className="px-4 py-2">第{match.round}轮</td>
                    <td className="px-4 py-2">{new Date(match.matchDate).toLocaleDateString()}</td>
                    <td className="px-4 py-2">{match.isHome ? "主场" : "客场"}</td>
                    <td className="px-4 py-2">{match.opponent}</td>
                    <td className="px-4 py-2">
                      <Badge className={STATUS_COLORS[record?.status ?? "pending"]}>
                        {STATUS_LABELS[record?.status ?? "pending"]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">{record?.overallRating ?? "-"}</td>
                    <td className="px-4 py-2">
                      <Link href={`/acceptance/${match.id}/${sponsorId}`}>
                        <Button size="sm" variant="outline">
                          {record ? "查看" : "填写"}
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedSponsor && records?.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">暂无场次数据</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
