import { useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { Sparkles, Printer, Share2, Copy, Trash2, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { colorForText } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Reports() {
  const { data: sponsors } = trpc.sponsors.list.useQuery();
  const [sponsorId, setSponsorId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: seasonReports } = trpc.reports.season.useQuery();
  const generateSeason = trpc.reports.generateSeason.useMutation({
    onSuccess: () => {
      toast.success("赛季报告已生成");
      utils.reports.season.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">验收报告</h1>
        <p className="text-sm text-muted-foreground">生成 AI 权益验收报告并管理分享链接</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">全赛季报告</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                onClick={() => generateSeason.mutate()}
                disabled={generateSeason.isPending}
              >
                {generateSeason.isPending ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    生成中（约10-30秒）...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1 h-4 w-4" />
                    生成全赛季总结报告
                  </>
                )}
              </Button>
              <div className="space-y-2">
                {seasonReports?.slice(0, 3).map((r) => (
                  <div key={r.id} className="rounded-md border p-2 text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">赞助商</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {sponsors?.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSponsorId(s.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                    sponsorId === s.id ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                  )}
                >
                  <span className="truncate">{s.name}</span>
                  <Badge className={cn(sponsorId === s.id ? "" : colorForText(s.tier))} variant="outline">
                    {s.tier}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {sponsorId ? (
          <SponsorReportPanel sponsorId={sponsorId} />
        ) : (
          <Card className="flex h-64 items-center justify-center">
            <p className="text-sm text-muted-foreground">请选择左侧赞助商查看报告</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function SponsorReportPanel({ sponsorId }: { sponsorId: number }) {
  const utils = trpc.useUtils();
  const { data: sponsor } = trpc.sponsors.get.useQuery({ id: sponsorId });
  const { data: reports } = trpc.reports.bySponsor.useQuery({ sponsorId });
  const { data: shareLinks } = trpc.reports.listShareLinks.useQuery({ sponsorId });
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const generateSponsor = trpc.reports.generateSponsor.useMutation({
    onSuccess: () => {
      toast.success("报告已生成");
      utils.reports.bySponsor.invalidate({ sponsorId });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteShareLink = trpc.reports.deleteShareLink.useMutation({
    onSuccess: () => {
      toast.success("已删除分享链接");
      utils.reports.listShareLinks.invalidate({ sponsorId });
    },
  });

  const latestReports = reports?.slice(0, 3) ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{sponsor?.name} · 权益验收报告</CardTitle>
          <div className="flex gap-2 no-print">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" />
              打印/导出PDF
            </Button>
            <Button size="sm" onClick={() => generateSponsor.mutate({ sponsorId })} disabled={generateSponsor.isPending}>
              {generateSponsor.isPending ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 h-4 w-4" />
                  生成报告
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {latestReports.length === 0 && (
            <p className="text-sm text-muted-foreground">暂无历史报告，点击上方按钮生成</p>
          )}
          {latestReports.map((report) => (
            <div key={report.id} className="rounded-lg border p-4">
              <p className="mb-2 text-xs text-muted-foreground">
                生成时间：{new Date(report.createdAt).toLocaleString()}
              </p>
              <div className="prose prose-sm max-w-none">
                <Streamdown>{report.content}</Streamdown>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="no-print">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">分享链接管理</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShareDialogOpen(true)}>
            <Share2 className="mr-1 h-4 w-4" />
            创建分享链接
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {shareLinks?.map((link) => {
            const url = `${window.location.origin}/report/${link.token}`;
            return (
              <div key={link.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <span className="flex-1 truncate text-muted-foreground">{url}</span>
                <span className="text-xs text-muted-foreground">
                  {link.expiresAt ? `过期于 ${new Date(link.expiresAt).toLocaleDateString()}` : "永久有效"}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(url);
                    toast.success("已复制链接");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deleteShareLink.mutate({ id: link.id })}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            );
          })}
          {shareLinks?.length === 0 && <p className="text-sm text-muted-foreground">暂无分享链接</p>}
        </CardContent>
      </Card>

      <ShareLinkDialog
        sponsorId={sponsorId}
        reports={reports ?? []}
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        onCreated={() => {
          setShareDialogOpen(false);
          utils.reports.listShareLinks.invalidate({ sponsorId });
        }}
      />
    </div>
  );
}

function ShareLinkDialog({
  sponsorId,
  reports,
  open,
  onClose,
  onCreated,
}: {
  sponsorId: number;
  reports: { id: number; createdAt: string | Date }[];
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [reportId, setReportId] = useState<string>("");
  const [expiresInDays, setExpiresInDays] = useState("30");

  const create = trpc.reports.createShareLink.useMutation({
    onSuccess: onCreated,
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建分享链接</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>选择报告（可选，留空则不绑定特定报告）</Label>
            <Select value={reportId} onValueChange={setReportId}>
              <SelectTrigger>
                <SelectValue placeholder="选择历史报告" />
              </SelectTrigger>
              <SelectContent>
                {reports.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {new Date(r.createdAt).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>过期天数（留空为永久有效）</Label>
            <Input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              placeholder="30"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() =>
              create.mutate({
                sponsorId,
                reportId: reportId ? Number(reportId) : undefined,
                expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
              })
            }
            disabled={create.isPending}
          >
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
