import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { fileToBase64, MAX_FILE_SIZE } from "@/lib/upload";
import { FileDropUpload } from "@/components/FileDropUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  colorForText,
  STATUS_LABELS,
  FULFILLMENT_MODE_LABELS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
} from "@/lib/constants";

type Fulfilled = "yes" | "no" | "partial" | "na";
type Status = "pending" | "in_progress" | "completed" | "issue";

interface ItemState {
  fulfilled: Fulfilled;
  note: string;
  completedCount: string;
  attachmentUrls: string[];
  reviewStatus?: "pending" | "approved" | "rejected";
}

export default function AcceptanceForm() {
  const { matchId: matchIdParam, sponsorId: sponsorIdParam } = useParams<{
    matchId: string;
    sponsorId: string;
  }>();
  const matchId = Number(matchIdParam);
  const sponsorId = Number(sponsorIdParam);

  const { data: matches } = trpc.matches.list.useQuery();
  const match = matches?.find((m) => m.id === matchId);
  const { data: sponsor } = trpc.sponsors.get.useQuery({ id: sponsorId });
  const { data: benefits } = trpc.benefits.bySponsor.useQuery({ sponsorId });
  const { data: recordData } = trpc.records.byMatchAndSponsor.useQuery({ matchId, sponsorId });

  const [status, setStatus] = useState<Status>("in_progress");
  const [overallRating, setOverallRating] = useState<number>(0);
  const [summary, setSummary] = useState("");
  const [items, setItems] = useState<Record<number, ItemState>>({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!benefits || initialized) return;
    if (recordData?.record) {
      setStatus(recordData.record.status as Status);
      setOverallRating(recordData.record.overallRating ?? 0);
      setSummary(recordData.record.summary ?? "");
    }
    const initial: Record<number, ItemState> = {};
    for (const item of benefits) {
      const check = recordData?.checkItems.find((c) => c.benefitItemId === item.id);
      initial[item.id] = {
        fulfilled: (check?.fulfilled as Fulfilled) ?? "na",
        note: check?.note ?? "",
        completedCount: check?.completedCount != null ? String(check.completedCount) : "",
        attachmentUrls: check?.attachmentUrls ? JSON.parse(check.attachmentUrls) : [],
        reviewStatus: check?.reviewStatus,
      };
    }
    setItems(initial);
    setInitialized(true);
  }, [benefits, recordData, initialized]);

  const grouped = useMemo(() => {
    const active = benefits?.filter((b) => b.isActive) ?? [];
    const map = new Map<string, typeof active>();
    for (const item of active) {
      const key = item.category || "未分类";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [benefits]);

  const upsert = trpc.records.upsert.useMutation({
    onSuccess: () => {
      toast.success("验收记录已保存");
    },
    onError: (err) => toast.error(err.message || "保存失败"),
  });

  function updateItem(id: number, patch: Partial<ItemState>) {
    setItems((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  const uploadMutation = trpc.upload.image.useMutation();

  async function handleFileSelect(id: number, files: FileList | File[]) {
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`文件 ${file.name} 超过 16MB 限制`);
        continue;
      }
      try {
        const base64 = await fileToBase64(file);
        const result = await uploadMutation.mutateAsync({ base64, mimeType: file.type, filename: file.name });
        setItems((prev) => ({
          ...prev,
          [id]: { ...prev[id], attachmentUrls: [...(prev[id]?.attachmentUrls ?? []), result.url] },
        }));
      } catch {
        toast.error("文件上传失败");
      }
    }
  }

  function handleSave() {
    upsert.mutate({
      matchId,
      sponsorId,
      status,
      overallRating: overallRating > 0 ? overallRating : undefined,
      summary: summary || undefined,
      checkItems: Object.entries(items).map(([benefitItemId, state]) => ({
        benefitItemId: Number(benefitItemId),
        fulfilled: state.fulfilled,
        note: state.note || undefined,
        completedCount: state.completedCount ? Number(state.completedCount) : undefined,
        attachmentUrls: state.attachmentUrls.length > 0 ? state.attachmentUrls : undefined,
      })),
    });
  }

  if (!sponsor || !match) return null;

  return (
    <div className="space-y-6 pb-20">
      <div>
        <p className="text-sm text-muted-foreground">
          第{match.round}轮 vs {match.opponent}（{match.isHome ? "主场" : "客场"}） ·{" "}
          {new Date(match.matchDate).toLocaleDateString()}
        </p>
        <h1 className="text-2xl font-semibold">{sponsor.name} · 权益验收</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">整体验收</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["pending", "in_progress", "completed", "issue"] as Status[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  status === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-1 text-sm text-muted-foreground">整体评分</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setOverallRating(n === overallRating ? 0 : n)}>
                  <Star
                    className={cn(
                      "h-6 w-6",
                      n <= overallRating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm text-muted-foreground">整体备注</p>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="填写整体备注（可选）" />
          </div>
        </CardContent>
      </Card>

      {grouped.map(([category, categoryItems]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge className={colorForText(category)} variant="outline">
                {category}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryItems.map((item) => {
              const state = items[item.id];
              if (!state) return null;
              return (
                <div key={item.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.code && <span className="text-xs text-muted-foreground">{item.code}</span>}
                    <span className="font-medium">{item.name}</span>
                    <Badge variant="outline">{FULFILLMENT_MODE_LABELS[item.fulfillmentMode]}</Badge>
                    {item.requiresApproval && <Badge variant="secondary">需审核</Badge>}
                    {state.reviewStatus && state.reviewStatus !== "approved" && (
                      <Badge className={REVIEW_STATUS_COLORS[state.reviewStatus]}>
                        {REVIEW_STATUS_LABELS[state.reviewStatus]}
                      </Badge>
                    )}
                  </div>
                  {(item.description || item.scope || item.attachmentRequirement) && (
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      {item.description && <p>{item.description}</p>}
                      {item.scope && <p>适用范围：{item.scope}</p>}
                      {item.attachmentRequirement && <p>附件要求：{item.attachmentRequirement}</p>}
                    </div>
                  )}

                  <ModeInput
                    item={item}
                    state={state}
                    onChange={(patch) => updateItem(item.id, patch)}
                    onFiles={(files) => handleFileSelect(item.id, files)}
                    isUploading={uploadMutation.isPending}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl justify-end gap-2">
          <Button variant="outline" onClick={() => window.history.back()}>
            返回
          </Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface BenefitItemLike {
  id: number;
  fulfillmentMode: string;
  targetCount: number | null;
  countUnit: string | null;
}

function ModeInput({
  item,
  state,
  onChange,
  onFiles,
  isUploading,
}: {
  item: BenefitItemLike;
  state: ItemState;
  onChange: (patch: Partial<ItemState>) => void;
  onFiles: (files: FileList | File[]) => void;
  isUploading: boolean;
}) {
  if (item.fulfillmentMode === "QUANTITY" || item.fulfillmentMode === "EVENT") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">本场新增数量</span>
          <Input
            type="number"
            className="w-24"
            value={state.completedCount}
            onChange={(e) => {
              const value = e.target.value;
              onChange({ completedCount: value, fulfilled: Number(value) > 0 ? "yes" : "na" });
            }}
          />
          {item.countUnit && <span className="text-sm text-muted-foreground">{item.countUnit}</span>}
          {item.targetCount != null && (
            <span className="text-sm text-muted-foreground">（全季目标 {item.targetCount}{item.countUnit}）</span>
          )}
        </div>
        <Textarea placeholder="备注（可选）" value={state.note} onChange={(e) => onChange({ note: e.target.value })} />
        <FileDropUpload urls={state.attachmentUrls} onFiles={onFiles} isUploading={isUploading} onRemove={(idx) => onChange({ attachmentUrls: state.attachmentUrls.filter((_, i) => i !== idx) })} />
      </div>
    );
  }

  if (item.fulfillmentMode === "ONE_TIME") {
    return (
      <div className="space-y-2">
        <button
          onClick={() => onChange({ fulfilled: state.fulfilled === "yes" ? "na" : "yes" })}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm transition-colors",
            state.fulfilled === "yes" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
          )}
        >
          {state.fulfilled === "yes" ? "已在此场标记完成" : "标记为已完成"}
        </button>
        {state.fulfilled === "yes" && (
          <>
            <Textarea placeholder="备注（可选）" value={state.note} onChange={(e) => onChange({ note: e.target.value })} />
            <FileDropUpload urls={state.attachmentUrls} onFiles={onFiles} isUploading={isUploading} onRemove={(idx) => onChange({ attachmentUrls: state.attachmentUrls.filter((_, i) => i !== idx) })} />
          </>
        )}
      </div>
    );
  }

  if (item.fulfillmentMode === "CONTINUOUS") {
    return (
      <div className="space-y-2">
        <Select value={state.fulfilled === "no" ? "no" : "yes"} onValueChange={(v) => onChange({ fulfilled: v as Fulfilled })}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">正常持续</SelectItem>
            <SelectItem value="no">发生中断</SelectItem>
          </SelectContent>
        </Select>
        <Textarea placeholder="备注（可选）" value={state.note} onChange={(e) => onChange({ note: e.target.value })} />
        <FileDropUpload urls={state.attachmentUrls} onFiles={onFiles} isUploading={isUploading} onRemove={(idx) => onChange({ attachmentUrls: state.attachmentUrls.filter((_, i) => i !== idx) })} />
      </div>
    );
  }

  // MATCH / ROUND
  return (
    <div className="space-y-2">
      <Select value={state.fulfilled} onValueChange={(v) => onChange({ fulfilled: v as Fulfilled })}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="yes">已履约</SelectItem>
          <SelectItem value="no">未履约</SelectItem>
          <SelectItem value="partial">部分履约</SelectItem>
          <SelectItem value="na">不适用</SelectItem>
        </SelectContent>
      </Select>
      {state.fulfilled !== "na" && (
        <>
          <Textarea placeholder="备注（可选）" value={state.note} onChange={(e) => onChange({ note: e.target.value })} />
          <FileDropUpload urls={state.attachmentUrls} onFiles={onFiles} isUploading={isUploading} onRemove={(idx) => onChange({ attachmentUrls: state.attachmentUrls.filter((_, i) => i !== idx) })} />
        </>
      )}
    </div>
  );
}
