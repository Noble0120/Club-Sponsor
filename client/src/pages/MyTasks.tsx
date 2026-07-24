import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { fileToBase64, MAX_FILE_SIZE } from "@/lib/upload";
import { FileDropUpload } from "@/components/FileDropUpload";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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

export default function MyTasks() {
  const utils = trpc.useUtils();
  const { data: tasks } = trpc.workflow.execute.myTasks.useQuery();
  type MyTask = NonNullable<typeof tasks>[number];
  const [activeTask, setActiveTask] = useState<MyTask | null>(null);

  const sorted = [...(tasks ?? [])].sort((a, b) => {
    const da = a.execution.dueDate ? new Date(a.execution.dueDate).getTime() : Infinity;
    const db = b.execution.dueDate ? new Date(b.execution.dueDate).getTime() : Infinity;
    return da - db;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">我的待办</h1>
        <p className="text-sm text-muted-foreground">工作流步骤待办事项</p>
      </div>

      <div className="space-y-3">
        {sorted.map((task) => (
          <Card key={task.execution.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <div className="font-medium">{task.step?.name ?? "未知步骤"}</div>
                <div className="text-sm text-muted-foreground">
                  {task.template?.name}
                  {task.match && ` · 第${task.match.round}轮 vs ${task.match.opponent}`}
                </div>
                {task.execution.dueDate && (
                  <div className="text-xs text-muted-foreground">
                    截止日期：{new Date(task.execution.dueDate).toLocaleDateString()}
                  </div>
                )}
              </div>
              <Badge className={EXECUTION_STATUS_COLORS[task.execution.status]}>
                {EXECUTION_STATUS_LABELS[task.execution.status]}
              </Badge>
              {task.execution.status !== "completed" && (
                <Button size="sm" onClick={() => setActiveTask(task)}>
                  完成
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {sorted.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">暂无待办任务</p>}
      </div>

      <CompleteTaskDialog
        task={activeTask}
        onClose={() => setActiveTask(null)}
        onCompleted={() => {
          setActiveTask(null);
          utils.workflow.execute.myTasks.invalidate();
        }}
      />
    </div>
  );
}

function CompleteTaskDialog({
  task,
  onClose,
  onCompleted,
}: {
  task: { execution: { id: number }; step: { requiresNote: boolean; requiresFile: boolean } | null } | null;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [note, setNote] = useState("");
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const uploadMutation = trpc.upload.image.useMutation();
  const complete = trpc.workflow.execute.complete.useMutation({
    onSuccess: () => {
      toast.success("任务已完成");
      setNote("");
      setFileUrls([]);
      onCompleted();
    },
    onError: (err) => toast.error(err.message || "操作失败"),
  });

  async function handleFileSelect(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`文件 ${file.name} 超过 16MB 限制`);
        continue;
      }
      const base64 = await fileToBase64(file);
      const result = await uploadMutation.mutateAsync({ base64, mimeType: file.type, filename: file.name });
      setFileUrls((prev) => [...prev, result.url]);
    }
  }

  function handleConfirm() {
    if (!task) return;
    if (task.step?.requiresNote && !note) {
      toast.error("该步骤要求填写备注");
      return;
    }
    if (task.step?.requiresFile && fileUrls.length === 0) {
      toast.error("该步骤要求上传文件");
      return;
    }
    complete.mutate({ executionId: task.execution.id, note: note || undefined, fileUrls: fileUrls.length > 0 ? fileUrls : undefined });
  }

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>完成任务</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            placeholder={task?.step?.requiresNote ? "请填写备注（必填）" : "备注（可选）"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <FileDropUpload
            urls={fileUrls}
            onFiles={handleFileSelect}
            onRemove={(idx) => setFileUrls((prev) => prev.filter((_, i) => i !== idx))}
            isUploading={uploadMutation.isPending}
            label={task?.step?.requiresFile ? "点击选择文件，或拖到这里（必填）" : "点击选择文件，或拖到这里"}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={complete.isPending}>
            {complete.isPending ? "提交中..." : "确认完成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
