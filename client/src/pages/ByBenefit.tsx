import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  colorForText,
  FULFILLMENT_MODE_LABELS,
  PROGRESS_STATUS_LABELS,
  PROGRESS_STATUS_COLORS,
  FULFILLED_LABELS,
  FULFILLED_COLORS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
} from "@/lib/constants";

export default function ByBenefit() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: sponsors } = trpc.sponsors.list.useQuery();
  const [sponsorId, setSponsorId] = useState<number | null>(
    params.get("sponsor") ? Number(params.get("sponsor")) : null,
  );
  const [itemId, setItemId] = useState<number | null>(params.get("item") ? Number(params.get("item")) : null);

  useEffect(() => {
    if (sponsorId === null && sponsors && sponsors.length > 0) setSponsorId(sponsors[0].id);
  }, [sponsors, sponsorId]);

  const utils = trpc.useUtils();
  const { data: progress } = trpc.benefits.progressBySponsor.useQuery(
    { sponsorId: sponsorId! },
    { enabled: sponsorId !== null },
  );

  useEffect(() => {
    if (itemId === null && progress && progress.length > 0) setItemId(progress[0].benefitItem.id);
  }, [progress, itemId]);

  const review = trpc.benefits.reviewCheckItem.useMutation({
    onSuccess: () => {
      toast.success("已处理");
      utils.benefits.progressBySponsor.invalidate({ sponsorId: sponsorId! });
    },
    onError: (e) => toast.error(e.message),
  });

  const selected = progress?.find((p) => p.benefitItem.id === itemId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">按权益查看</h1>
        <p className="text-sm text-muted-foreground">选择赞助商与权益条目，查看完成进度、对应场次、上传文件与备注</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_280px_1fr]">
        <Card className="h-fit">
          <CardContent className="space-y-1 p-3">
            {sponsors?.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSponsorId(s.id);
                  setItemId(null);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                  sponsorId === s.id ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                <span className="truncate">{s.name}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardContent className="space-y-1 p-3">
            {progress?.map((p) => (
              <button
                key={p.benefitItem.id}
                onClick={() => setItemId(p.benefitItem.id)}
                className={cn(
                  "flex w-full flex-col rounded-md px-3 py-2 text-left text-sm transition-colors",
                  itemId === p.benefitItem.id ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                <span className="truncate font-medium">{p.benefitItem.name}</span>
                <span
                  className={cn(
                    "text-xs",
                    itemId === p.benefitItem.id ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {p.targetCount != null ? `${p.completedCount}/${p.targetCount}` : PROGRESS_STATUS_LABELS[p.status]}
                  {p.pendingReviewCount > 0 ? ` · ${p.pendingReviewCount}条待审核` : ""}
                </span>
              </button>
            ))}
            {progress?.length === 0 && <p className="p-2 text-sm text-muted-foreground">暂无权益条目</p>}
          </CardContent>
        </Card>

        {selected ? (
          <Card>
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{selected.benefitItem.name}</h2>
                  <Badge variant="outline">{FULFILLMENT_MODE_LABELS[selected.benefitItem.fulfillmentMode]}</Badge>
                  {selected.benefitItem.category && (
                    <Badge className={colorForText(selected.benefitItem.category)} variant="outline">
                      {selected.benefitItem.category}
                    </Badge>
                  )}
                </div>
                <Badge className={PROGRESS_STATUS_COLORS[selected.status]}>
                  {PROGRESS_STATUS_LABELS[selected.status]}
                </Badge>
              </div>

              {selected.targetCount != null && (
                <div className="flex items-center gap-3">
                  <Progress
                    value={selected.targetCount > 0 ? (selected.completedCount / selected.targetCount) * 100 : 0}
                    className="h-2 flex-1"
                  />
                  <span className="text-sm text-muted-foreground">
                    {selected.completedCount}/{selected.targetCount}
                    {selected.benefitItem.countUnit ?? ""}
                  </span>
                </div>
              )}

              {selected.matchBreakdown ? (
                <div className="space-y-2">
                  {selected.matchBreakdown.map(({ match, checkItem }) => (
                    <EntryRow
                      key={match.id}
                      title={`第${match.round}轮 vs ${match.opponent}`}
                      subtitle={new Date(match.matchDate).toLocaleDateString()}
                      checkItem={checkItem}
                      emptyLabel="未填写"
                      isAdmin={isAdmin}
                      onReview={(approve) => checkItem && review.mutate({ checkItemId: checkItem.id, approve })}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {selected.entries.length === 0 && (
                    <p className="text-sm text-muted-foreground">暂无验收记录</p>
                  )}
                  {selected.entries.map(({ match, checkItem }) => (
                    <EntryRow
                      key={checkItem!.id}
                      title={`第${match.round}轮 vs ${match.opponent}`}
                      subtitle={new Date(match.matchDate).toLocaleDateString()}
                      checkItem={checkItem}
                      emptyLabel="未填写"
                      isAdmin={isAdmin}
                      onReview={(approve) => checkItem && review.mutate({ checkItemId: checkItem.id, approve })}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="flex h-64 items-center justify-center">
            <p className="text-sm text-muted-foreground">请选择左侧权益条目</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function EntryRow({
  title,
  subtitle,
  checkItem,
  emptyLabel,
  isAdmin,
  onReview,
}: {
  title: string;
  subtitle: string;
  checkItem: { fulfilled: string; note: string | null; completedCount: number | null; attachmentUrls: string | null; reviewStatus: string } | null;
  emptyLabel: string;
  isAdmin: boolean;
  onReview: (approve: boolean) => void;
}) {
  const attachments: string[] = checkItem?.attachmentUrls ? JSON.parse(checkItem.attachmentUrls) : [];

  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{title}</span>
          <span className="ml-2 text-xs text-muted-foreground">{subtitle}</span>
        </div>
        <div className="flex items-center gap-2">
          {checkItem ? (
            <>
              {checkItem.completedCount != null && (
                <Badge variant="outline">本场 {checkItem.completedCount}</Badge>
              )}
              <Badge className={FULFILLED_COLORS[checkItem.fulfilled]}>{FULFILLED_LABELS[checkItem.fulfilled]}</Badge>
              {checkItem.reviewStatus !== "approved" && (
                <Badge className={REVIEW_STATUS_COLORS[checkItem.reviewStatus]}>
                  {REVIEW_STATUS_LABELS[checkItem.reviewStatus]}
                </Badge>
              )}
            </>
          ) : (
            <Badge variant="secondary">{emptyLabel}</Badge>
          )}
        </div>
      </div>
      {checkItem?.note && <p className="mt-1 text-xs text-muted-foreground">备注：{checkItem.note}</p>}
      {attachments.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          {attachments.map((url, idx) => (
            <a key={idx} href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
              附件 {idx + 1}
            </a>
          ))}
        </div>
      )}
      {isAdmin && checkItem?.reviewStatus === "pending" && (
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onReview(true)}>
            <Check className="mr-1 h-3 w-3" />
            审核通过
          </Button>
          <Button size="sm" variant="outline" onClick={() => onReview(false)}>
            <X className="mr-1 h-3 w-3" />
            驳回
          </Button>
        </div>
      )}
    </div>
  );
}
