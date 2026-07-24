import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const INSTANCE_STATUS_LABELS: Record<string, string> = {
  active: "进行中",
  completed: "已完成",
  overdue: "已逾期",
};
const EXECUTION_STATUS_LABELS: Record<string, string> = {
  pending: "待开始",
  active: "进行中",
  completed: "已完成",
  overdue: "已逾期",
};
const EXECUTION_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  active: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};

export default function WorkflowOverview() {
  const utils = trpc.useUtils();
  const { data: instances } = trpc.workflow.instances.all.useQuery();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);

  const deleteInstance = trpc.workflow.instances.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      utils.workflow.instances.all.invalidate();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">工作流管理</h1>
          <p className="text-sm text-muted-foreground">查看各比赛的 SOP 工作流执行情况</p>
        </div>
        <Button onClick={() => setGenerateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          手动生成工作流
        </Button>
      </div>

      <div className="space-y-3">
        {instances?.map(({ instance, template, match, executions }) => {
          const completedCount = executions.filter((e) => e.status === "completed").length;
          return (
            <Card key={instance.id}>
              <button
                className="flex w-full items-center gap-3 p-4 text-left"
                onClick={() => setExpandedId(expandedId === instance.id ? null : instance.id)}
              >
                {expandedId === instance.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{template?.name}</span>
                    {match && (
                      <span className="text-sm text-muted-foreground">
                        第{match.round}轮 vs {match.opponent}
                      </span>
                    )}
                    <Badge variant="outline">{INSTANCE_STATUS_LABELS[instance.status]}</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Progress
                      value={executions.length > 0 ? (completedCount / executions.length) * 100 : 0}
                      className="h-1.5 w-40"
                    />
                    <span className="text-xs text-muted-foreground">
                      {completedCount}/{executions.length} 步完成
                    </span>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("确认删除该工作流实例？")) deleteInstance.mutate({ id: instance.id });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </button>
              {expandedId === instance.id && (
                <CardContent className="space-y-2 border-t pt-4">
                  {executions.map((exec) => (
                    <div key={exec.id} className="rounded-md border p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">步骤 {exec.stepOrder}</span>
                        <Badge className={EXECUTION_STATUS_COLORS[exec.status]}>
                          {EXECUTION_STATUS_LABELS[exec.status]}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {exec.dueDate && `截止：${new Date(exec.dueDate).toLocaleDateString()}`}
                        {exec.completedAt && ` · 完成于：${new Date(exec.completedAt).toLocaleString()}`}
                      </div>
                      {exec.note && <p className="mt-1 text-xs">备注：{exec.note}</p>}
                    </div>
                  ))}
                  {executions.length === 0 && <p className="text-sm text-muted-foreground">暂无步骤</p>}
                </CardContent>
              )}
            </Card>
          );
        })}
        {instances?.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">暂无工作流实例</p>}
      </div>

      <GenerateDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onGenerated={() => {
          setGenerateOpen(false);
          utils.workflow.instances.all.invalidate();
        }}
      />
    </div>
  );
}

function GenerateDialog({
  open,
  onClose,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const { data: matches } = trpc.matches.list.useQuery();
  const { data: templates } = trpc.workflow.templates.list.useQuery();
  const [matchId, setMatchId] = useState("");
  const [templateId, setTemplateId] = useState("");

  const generate = trpc.workflow.instances.generate.useMutation({
    onSuccess: () => {
      setMatchId("");
      setTemplateId("");
      onGenerated();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>手动生成工作流实例</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>选择比赛</Label>
            <Select value={matchId} onValueChange={setMatchId}>
              <SelectTrigger>
                <SelectValue placeholder="选择比赛" />
              </SelectTrigger>
              <SelectContent>
                {matches?.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    第{m.round}轮 vs {m.opponent}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>选择模板</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="选择 SOP 模板" />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              if (!matchId || !templateId) {
                toast.error("请选择比赛和模板");
                return;
              }
              generate.mutate({ matchId: Number(matchId), templateId: Number(templateId) });
            }}
            disabled={generate.isPending}
          >
            生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
