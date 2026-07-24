import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { parseSpreadsheet, excelCell, excelNumber, excelDate, isHomeMarker } from "@/lib/excel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface ParsedMatchRow {
  round: number;
  matchDate: Date;
  isHome: boolean;
  opponent: string;
  venue?: string;
}

export default function MatchesAdmin() {
  const utils = trpc.useUtils();
  const { data: matches } = trpc.matches.list.useQuery();
  const [importOpen, setImportOpen] = useState(false);

  const deleteMatch = trpc.matches.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      utils.matches.list.invalidate();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">赛程管理</h1>
          <p className="text-sm text-muted-foreground">导入赛程表，系统会自动筛选出主场场次</p>
        </div>
        <Button onClick={() => setImportOpen(true)}>
          <FileSpreadsheet className="mr-1 h-4 w-4" />
          导入赛程 Excel
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">轮次</th>
                <th className="px-4 py-2 font-medium">日期</th>
                <th className="px-4 py-2 font-medium">对手</th>
                <th className="px-4 py-2 font-medium">场地</th>
                <th className="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {matches?.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="px-4 py-2">第{m.round}轮</td>
                  <td className="px-4 py-2">{new Date(m.matchDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{m.opponent}</td>
                  <td className="px-4 py-2 text-muted-foreground">{m.venue || "-"}</td>
                  <td className="px-4 py-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`确认删除第${m.round}轮 vs ${m.opponent}？`)) deleteMatch.mutate({ id: m.id });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {matches?.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">暂无赛程，请先导入</p>
          )}
        </CardContent>
      </Card>

      <MatchImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
          utils.matches.list.invalidate();
        }}
      />
    </div>
  );
}

function MatchImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [rows, setRows] = useState<ParsedMatchRow[]>([]);
  const [awayCount, setAwayCount] = useState(0);
  const [error, setError] = useState("");

  const importMutation = trpc.matches.importSchedule.useMutation({
    onSuccess: (result) => {
      toast.success(`导入成功：新增 ${result.created} 场主场比赛`);
      setRows([]);
      onImported();
    },
    onError: (e) => toast.error(e.message),
  });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const parsed = await parseSpreadsheet(file);
      const home: ParsedMatchRow[] = [];
      let away = 0;
      for (const row of parsed) {
        const round = excelNumber(row, "轮次", "round");
        const matchDate = excelDate(row, "日期", "matchDate");
        const opponent = excelCell(row, "对手", "opponent");
        const venue = excelCell(row, "场地", "venue");
        const homeAwayRaw = excelCell(row, "主客场", "主客", "isHome");
        if (round == null || !matchDate || !opponent) continue;
        if (isHomeMarker(homeAwayRaw)) {
          home.push({ round, matchDate, isHome: true, opponent, venue });
        } else {
          away += 1;
        }
      }
      if (home.length === 0) {
        setError("没有解析到主场场次，请确认表头包含：轮次、日期、对手、主客场");
      }
      setRows(home);
      setAwayCount(away);
    } catch {
      setError("文件解析失败，请确认是 .xlsx/.csv 格式");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>导入赛程 Excel</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            表头需要包含：轮次、日期、对手、主客场、场地。主客场列写"主"/"主场"即视为主场，其余(如"客"/"客场")会被自动过滤掉，只导入主场场次。
          </p>
          <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleFile(e.target.files?.[0])} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">解析到 {rows.length} 场主场</Badge>
                {awayCount > 0 && <Badge variant="secondary">已自动过滤 {awayCount} 场客场</Badge>}
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-2 py-1">轮次</th>
                      <th className="px-2 py-1">日期</th>
                      <th className="px-2 py-1">对手</th>
                      <th className="px-2 py-1">场地</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-2 py-1">第{row.round}轮</td>
                        <td className="px-2 py-1">{row.matchDate.toLocaleDateString()}</td>
                        <td className="px-2 py-1">{row.opponent}</td>
                        <td className="px-2 py-1">{row.venue || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => importMutation.mutate(rows)}
            disabled={rows.length === 0 || importMutation.isPending}
          >
            {importMutation.isPending ? "导入中..." : `导入 ${rows.length} 场主场比赛`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
