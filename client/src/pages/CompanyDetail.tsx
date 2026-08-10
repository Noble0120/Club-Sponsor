import { useState } from "react";
import { useParams } from "wouter";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { fileToBase64, MAX_FILE_SIZE } from "@/lib/upload";
import { FileDropUpload } from "@/components/FileDropUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  colorForText,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_COLORS,
  ASSET_PROGRESS_STATUS_LABELS,
  ASSET_PROGRESS_STATUS_COLORS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
} from "@/lib/constants";
import type { AssetProgress } from "@server/lib/deliveryProgress";

type ProgressRow = AssetProgress;

function assetProgressStatus(p: ProgressRow): string {
  if (p.deliveries.some((d) => d.delivery.status === "issue")) return "issue";
  if (p.targetCount != null && p.completedCount >= p.targetCount && p.targetCount > 0) return "completed";
  if (p.completedCount > 0) return "in_progress";
  return "not_started";
}

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const companyId = Number(id);

  const { data: company } = trpc.companies.get.useQuery({ id: companyId });
  const { data: progress } = trpc.assets.progressByCompany.useQuery({ companyId });
  const [expandedAssetId, setExpandedAssetId] = useState<number | null>(null);
  const [markingDelivery, setMarkingDelivery] = useState<{ id: number; assetName: string } | null>(null);

  if (!company) return null;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{company.name}</h1>
          <Badge className={colorForText(company.tier)} variant="outline">
            {company.tier}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          联系人：{company.contactName || "-"} · 电话：{company.contactPhone || "-"}
        </p>
        {company.notes && <p className="mt-1 text-sm text-muted-foreground">备注：{company.notes}</p>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">权益履约进度</CardTitle>
        </CardHeader>
        <CardContent>
          {!progress || progress.length === 0 ? (
            <p className="text-sm text-muted-foreground">该赞助商暂无资产条目</p>
          ) : (
            <div className="space-y-2">
              {progress.map((p) => {
                const status = assetProgressStatus(p);
                const expanded = expandedAssetId === p.asset.id;
                return (
                  <div key={p.asset.id} className="rounded-md border">
                    <button
                      className="flex w-full items-center gap-3 p-3 text-left text-sm"
                      onClick={() => setExpandedAssetId(expanded ? null : p.asset.id)}
                    >
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div className="flex flex-1 items-center gap-2">
                        <span className="font-medium">{p.asset.name}</span>
                        {p.pendingReviewCount > 0 && (
                          <Badge className="bg-yellow-100 text-yellow-700">{p.pendingReviewCount}条待审核</Badge>
                        )}
                      </div>
                      {p.targetCount != null && (
                        <div className="flex items-center gap-3">
                          <Progress
                            value={p.targetCount > 0 ? (p.completedCount / p.targetCount) * 100 : 0}
                            className="h-1.5 w-32"
                          />
                          <span className="text-xs text-muted-foreground">
                            {p.completedCount}/{p.targetCount}
                            {p.asset.countUnit ?? ""}
                          </span>
                        </div>
                      )}
                      <Badge className={ASSET_PROGRESS_STATUS_COLORS[status]}>{ASSET_PROGRESS_STATUS_LABELS[status]}</Badge>
                    </button>
                    {expanded && (
                      <div className="space-y-1.5 border-t p-3">
                        {p.deliveries.length === 0 && <p className="text-xs text-muted-foreground">暂无交付记录</p>}
                        {p.deliveries.map(({ delivery, match }) => (
                          <div key={delivery.id} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                            <span className="flex-1">
                              {match
                                ? `第${match.round}轮 vs ${match.opponent}（${new Date(match.matchDate).toLocaleDateString()}）`
                                : delivery.scheduledDate
                                  ? new Date(delivery.scheduledDate).toLocaleDateString()
                                  : "未排期"}
                              {delivery.note ? ` · ${delivery.note}` : ""}
                            </span>
                            <Badge className={DELIVERY_STATUS_COLORS[delivery.status]}>
                              {DELIVERY_STATUS_LABELS[delivery.status]}
                            </Badge>
                            {delivery.status === "delivered" && (
                              <Badge className={REVIEW_STATUS_COLORS[delivery.reviewStatus]}>
                                {REVIEW_STATUS_LABELS[delivery.reviewStatus]}
                              </Badge>
                            )}
                            {delivery.status !== "delivered" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setMarkingDelivery({ id: delivery.id, assetName: p.asset.name })}
                              >
                                标记交付
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <MarkDeliveredDialog delivery={markingDelivery} onClose={() => setMarkingDelivery(null)} />
    </div>
  );
}

function MarkDeliveredDialog({
  delivery,
  onClose,
}: {
  delivery: { id: number; assetName: string } | null;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [note, setNote] = useState("");
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const uploadMutation = trpc.upload.image.useMutation();

  const markDelivered = trpc.deliveries.markDelivered.useMutation({
    onSuccess: () => {
      toast.success("已标记为交付");
      utils.assets.progressByCompany.invalidate();
      utils.deliveries.upcoming.invalidate();
      reset();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const markIssue = trpc.deliveries.markIssue.useMutation({
    onSuccess: () => {
      toast.success("已标记为异常");
      utils.assets.progressByCompany.invalidate();
      reset();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function reset() {
    setNote("");
    setFileUrls([]);
  }

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

  return (
    <Dialog
      open={delivery !== null}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{delivery?.assetName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea placeholder="备注（可选）" value={note} onChange={(e) => setNote(e.target.value)} />
          <FileDropUpload
            urls={fileUrls}
            onFiles={handleFileSelect}
            onRemove={(idx) => setFileUrls((prev) => prev.filter((_, i) => i !== idx))}
            isUploading={uploadMutation.isPending}
            label="上传履约凭证（照片/视频），或直接拖到这里"
          />
        </div>
        <DialogFooter className="justify-between sm:justify-between">
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => delivery && markIssue.mutate({ id: delivery.id, note: note || undefined })}
            disabled={markIssue.isPending}
          >
            <AlertTriangle className="mr-1 h-4 w-4" />
            标记异常
          </Button>
          <Button
            onClick={() =>
              delivery &&
              markDelivered.mutate({
                id: delivery.id,
                note: note || undefined,
                attachmentUrls: fileUrls.length > 0 ? fileUrls : undefined,
              })
            }
            disabled={markDelivered.isPending}
          >
            <CheckCircle2 className="mr-1 h-4 w-4" />
            确认已交付
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
