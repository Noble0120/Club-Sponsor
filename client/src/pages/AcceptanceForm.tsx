import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { toast } from "sonner";
import { Star, Upload, X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { fileToBase64, MAX_FILE_SIZE } from "@/lib/upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_COLORS, STATUS_LABELS } from "@/lib/constants";

type Fulfilled = "yes" | "no" | "partial" | "na";
type Status = "pending" | "in_progress" | "completed" | "issue";

interface ItemState {
  fulfilled: Fulfilled;
  note: string;
  completedCount: string;
  attachmentUrls: string[];
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
      };
    }
    setItems(initial);
    setInitialized(true);
  }, [benefits, recordData, initialized]);

  const grouped = useMemo(() => {
    const active = benefits?.filter((b) => b.isActive) ?? [];
    const map = new Map<string, typeof active>();
    for (const item of active) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
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

  async function handleFileSelect(id: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`文件 ${file.name} 超过 16MB 限制`);
        continue;
      }
      try {
        const base64 = await fileToBase64(file);
        const result = await uploadMutation.mutateAsync({ base64, mimeType: file.type, filename: file.name });
        updateItem(id, { attachmentUrls: [...(items[id]?.attachmentUrls ?? []), result.url] });
      } catch (err) {
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
              <Badge className={CATEGORY_COLORS[category]} variant="outline">
                {categoryItems[0]?.categoryLabel || CATEGORY_LABELS[category]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryItems.map((item) => {
              const state = items[item.id];
              if (!state) return null;
              return (
                <div key={item.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.name}</span>
                    <Select
                      value={state.fulfilled}
                      onValueChange={(v) => updateItem(item.id, { fulfilled: v as Fulfilled })}
                    >
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
                  </div>
                  {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}

                  {state.fulfilled !== "na" && (
                    <div className="space-y-2">
                      {item.totalCount != null && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">已完成数量</span>
                          <Input
                            type="number"
                            className="w-24"
                            value={state.completedCount}
                            onChange={(e) => updateItem(item.id, { completedCount: e.target.value })}
                          />
                          <span className="text-sm text-muted-foreground">
                            / {item.totalCount} {item.countUnit}
                          </span>
                        </div>
                      )}
                      <Textarea
                        placeholder="备注（可选）"
                        value={state.note}
                        onChange={(e) => updateItem(item.id, { note: e.target.value })}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        {state.attachmentUrls.map((url, idx) => (
                          <div key={idx} className="relative">
                            <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                              附件 {idx + 1}
                            </a>
                            <button
                              onClick={() =>
                                updateItem(item.id, {
                                  attachmentUrls: state.attachmentUrls.filter((_, i) => i !== idx),
                                })
                              }
                              className="ml-1 text-muted-foreground hover:text-destructive"
                            >
                              <X className="inline h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <label className="flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent">
                          {uploadMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Upload className="h-3 w-3" />
                          )}
                          上传文件
                          <input
                            type="file"
                            className="hidden"
                            multiple
                            onChange={(e) => handleFileSelect(item.id, e.target.files)}
                          />
                        </label>
                      </div>
                    </div>
                  )}
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
