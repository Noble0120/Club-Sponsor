import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, CalendarClock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { colorForText, DELIVERY_STATUS_LABELS, DELIVERY_STATUS_COLORS } from "@/lib/constants";

export default function Planning() {
  const { data: companies } = trpc.companies.list.useQuery({ stage: "signed" });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [scheduling, setScheduling] = useState<{ deliveryId: number; assetName: string } | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">排期</h1>
        <p className="text-sm text-muted-foreground">按赞助商查看每项权益在各场次/日期的交付计划</p>
      </div>

      <div className="space-y-3">
        {companies?.map((company) => (
          <Card key={company.id}>
            <button
              className="flex w-full items-center gap-3 p-4 text-left"
              onClick={() => setExpandedId(expandedId === company.id ? null : company.id)}
            >
              {expandedId === company.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="font-medium">{company.name}</span>
              <Badge className={colorForText(company.tier)} variant="outline">
                {company.tier}
              </Badge>
            </button>
            {expandedId === company.id && (
              <CardContent className="space-y-4 border-t pt-4">
                <CompanyAssetsTimeline companyId={company.id} onSchedule={setScheduling} />
              </CardContent>
            )}
          </Card>
        ))}
        {companies?.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">暂无已签约赞助商</p>
        )}
      </div>

      <ScheduleDialog scheduling={scheduling} onClose={() => setScheduling(null)} />
    </div>
  );
}

function CompanyAssetsTimeline({
  companyId,
  onSchedule,
}: {
  companyId: number;
  onSchedule: (v: { deliveryId: number; assetName: string }) => void;
}) {
  const { data: progress } = trpc.assets.progressByCompany.useQuery({ companyId });

  if (!progress || progress.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无资产（权益）条目</p>;
  }

  return (
    <div className="space-y-4">
      {progress.map((p) => (
        <div key={p.asset.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium">{p.asset.name}</span>
              {p.asset.category && (
                <Badge className={colorForText(p.asset.category)} variant="outline">
                  {p.asset.category}
                </Badge>
              )}
            </div>
            {p.targetCount != null && (
              <div className="flex items-center gap-2">
                <Progress value={p.targetCount > 0 ? (p.completedCount / p.targetCount) * 100 : 0} className="h-1.5 w-32" />
                <span className="text-xs text-muted-foreground">
                  {p.completedCount}/{p.targetCount}
                  {p.asset.countUnit ?? ""}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {p.deliveries.map(({ delivery, match }) => (
              <button
                key={delivery.id}
                onClick={() => {
                  if (delivery.status === "unscheduled") onSchedule({ deliveryId: delivery.id, assetName: p.asset.name });
                }}
                className={`rounded-md px-2 py-1 text-xs ${DELIVERY_STATUS_COLORS[delivery.status]} ${
                  delivery.status === "unscheduled" ? "cursor-pointer hover:opacity-80" : ""
                }`}
              >
                {match
                  ? `第${match.round}轮 vs ${match.opponent}`
                  : delivery.scheduledDate
                    ? new Date(delivery.scheduledDate).toLocaleDateString()
                    : DELIVERY_STATUS_LABELS[delivery.status]}
              </button>
            ))}
            {p.deliveries.length === 0 && <span className="text-xs text-muted-foreground">暂无交付记录</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduleDialog({
  scheduling,
  onClose,
}: {
  scheduling: { deliveryId: number; assetName: string } | null;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: matches } = trpc.matches.list.useQuery();
  const [matchId, setMatchId] = useState("");
  const [date, setDate] = useState("");

  const schedule = trpc.deliveries.schedule.useMutation({
    onSuccess: () => {
      toast.success("已排期");
      utils.assets.progressByCompany.invalidate();
      utils.deliveries.unscheduled.invalidate();
      utils.deliveries.upcoming.invalidate();
      setMatchId("");
      setDate("");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog
      open={scheduling !== null}
      onOpenChange={(open) => {
        if (!open) {
          setMatchId("");
          setDate("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            排期：{scheduling?.assetName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>绑定比赛（可选）</Label>
            <Select value={matchId} onValueChange={setMatchId}>
              <SelectTrigger>
                <SelectValue placeholder="选择比赛" />
              </SelectTrigger>
              <SelectContent>
                {matches?.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    第{m.round}轮 vs {m.opponent}（{new Date(m.matchDate).toLocaleDateString()}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>或直接指定日期（可选）</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              if (!scheduling) return;
              if (!matchId && !date) {
                toast.error("请选择比赛或填写日期");
                return;
              }
              schedule.mutate({
                id: scheduling.deliveryId,
                matchId: matchId ? Number(matchId) : undefined,
                scheduledDate: date ? new Date(date) : undefined,
              });
            }}
            disabled={schedule.isPending}
          >
            确认排期
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
