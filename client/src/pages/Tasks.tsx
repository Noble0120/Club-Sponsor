import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { colorForText, TASK_BOARD_COLUMNS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type BoardRow = {
  task: { id: number; name: string; status: string; dueDate: string | Date | null };
  asset: { name: string; category: string };
  company: { id: number; name: string };
  match: { round: number; opponent: string } | null;
};

export default function Tasks() {
  const utils = trpc.useUtils();
  const { data: rows } = trpc.tasks.board.useQuery();
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);

  const updateStatus = trpc.tasks.updateStatus.useMutation({
    onSuccess: () => utils.tasks.board.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">任务看板</h1>
        <p className="text-sm text-muted-foreground">交付执行子任务，可拖拽卡片变更状态</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {TASK_BOARD_COLUMNS.map((col) => {
          const colTasks = (rows ?? []).filter((r) => r.task.status === col.status);
          return (
            <div
              key={col.status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragTaskId != null) updateStatus.mutate({ id: dragTaskId, status: col.status as never });
                setDragTaskId(null);
              }}
              className="space-y-2 rounded-lg bg-muted/40 p-3"
            >
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">{col.label}</h2>
                <span className="text-xs text-muted-foreground">{colTasks.length}</span>
              </div>
              <div className="space-y-2">
                {colTasks.map((row) => (
                  <TaskCard key={row.task.id} row={row} onDragStart={() => setDragTaskId(row.task.id)} />
                ))}
                {colTasks.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">暂无任务</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({ row, onDragStart }: { row: BoardRow; onDragStart: () => void }) {
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      className={cn("cursor-grab space-y-1.5 p-3 text-sm active:cursor-grabbing")}
    >
      <div className="font-medium">{row.task.name}</div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Badge className={colorForText(row.company.name)} variant="outline">
          {row.company.name}
        </Badge>
        <span>{row.asset.name}</span>
      </div>
      {(row.match || row.task.dueDate) && (
        <div className="text-xs text-muted-foreground">
          {row.match ? `第${row.match.round}轮 vs ${row.match.opponent}` : ""}
          {row.task.dueDate ? ` · 截止 ${new Date(row.task.dueDate).toLocaleDateString()}` : ""}
        </div>
      )}
    </Card>
  );
}
