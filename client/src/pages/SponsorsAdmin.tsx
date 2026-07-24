import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TIER_LABELS, TIER_COLORS, CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { sponsorTierEnum, benefitCategoryEnum } from "@server/db/schema";

type Tier = (typeof sponsorTierEnum)[number];
type Category = (typeof benefitCategoryEnum)[number];

export default function SponsorsAdmin() {
  const utils = trpc.useUtils();
  const { data: sponsors } = trpc.sponsors.list.useQuery();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  type SponsorRow = NonNullable<typeof sponsors>[number];
  const [dialogSponsor, setDialogSponsor] = useState<SponsorRow | "new" | null>(null);

  const deleteSponsor = trpc.sponsors.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      utils.sponsors.list.invalidate();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">赞助商管理</h1>
          <p className="text-sm text-muted-foreground">管理赞助商基本信息与权益条目</p>
        </div>
        <Button onClick={() => setDialogSponsor("new")}>
          <Plus className="mr-1 h-4 w-4" />
          新增赞助商
        </Button>
      </div>

      <div className="space-y-3">
        {sponsors?.map((sponsor) => (
          <Card key={sponsor.id}>
            <button
              className="flex w-full items-center gap-3 p-4 text-left"
              onClick={() => setExpandedId(expandedId === sponsor.id ? null : sponsor.id)}
            >
              {expandedId === sponsor.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{sponsor.name}</span>
                  <Badge className={TIER_COLORS[sponsor.tier]} variant="outline">
                    {TIER_LABELS[sponsor.tier]}
                  </Badge>
                  {!sponsor.isActive && <Badge variant="secondary">已停用</Badge>}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setDialogSponsor(sponsor);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`确认删除赞助商「${sponsor.name}」？`)) deleteSponsor.mutate({ id: sponsor.id });
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </button>
            {expandedId === sponsor.id && (
              <CardContent className="border-t pt-4">
                <BenefitItemsManager sponsorId={sponsor.id} />
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <SponsorDialog
        sponsor={dialogSponsor}
        onClose={() => setDialogSponsor(null)}
        onSaved={() => {
          setDialogSponsor(null);
          utils.sponsors.list.invalidate();
        }}
      />
    </div>
  );
}

function SponsorDialog({
  sponsor,
  onClose,
  onSaved,
}: {
  sponsor: { id: number; name: string; tier: string; contactName: string | null; contactPhone: string | null; notes: string | null } | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = sponsor === "new";
  const existing = isNew ? null : sponsor;

  const [name, setName] = useState("");
  const [tier, setTier] = useState<Tier>("gold");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");

  const create = trpc.sponsors.create.useMutation({ onSuccess: onSaved, onError: (e) => toast.error(e.message) });
  const update = trpc.sponsors.update.useMutation({ onSuccess: onSaved, onError: (e) => toast.error(e.message) });

  function reset(s: typeof existing) {
    setName(s?.name ?? "");
    setTier((s?.tier as Tier) ?? "gold");
    setContactName(s?.contactName ?? "");
    setContactPhone(s?.contactPhone ?? "");
    setNotes(s?.notes ?? "");
  }

  return (
    <Dialog
      open={sponsor !== null}
      onOpenChange={(open) => {
        if (open) reset(existing);
        else onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "新增赞助商" : "编辑赞助商"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>赞助层级</Label>
            <Select value={tier} onValueChange={(v) => setTier(v as Tier)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>联系人</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>联系电话</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>备注</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              if (!name) {
                toast.error("请填写名称");
                return;
              }
              if (isNew) {
                create.mutate({ name, tier, contactName, contactPhone, notes });
              } else if (existing) {
                update.mutate({ id: existing.id, name, tier, contactName, contactPhone, notes });
              }
            }}
            disabled={create.isPending || update.isPending}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BenefitItemsManager({ sponsorId }: { sponsorId: number }) {
  const utils = trpc.useUtils();
  const { data: items } = trpc.benefits.bySponsor.useQuery({ sponsorId });
  type BenefitItemRow = NonNullable<typeof items>[number];
  const [dialogItem, setDialogItem] = useState<BenefitItemRow | "new" | null>(null);
  const deleteItem = trpc.benefits.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      utils.benefits.bySponsor.invalidate({ sponsorId });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">权益条目</h3>
        <Button size="sm" onClick={() => setDialogItem("new")}>
          <Plus className="mr-1 h-3 w-3" />
          新增权益条目
        </Button>
      </div>
      <div className="space-y-2">
        {items?.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-md border p-2 text-sm">
            <Badge className={CATEGORY_COLORS[item.category]} variant="outline">
              {item.categoryLabel || CATEGORY_LABELS[item.category]}
            </Badge>
            <span className="flex-1">{item.name}</span>
            <span className="text-xs text-muted-foreground">
              {item.itemType === "per_match" ? "场次型" : "全季型"}
              {item.totalCount != null ? ` · ${item.totalCount}${item.countUnit ?? ""}` : ""}
            </span>
            <Button size="icon" variant="ghost" onClick={() => setDialogItem(item)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => deleteItem.mutate({ id: item.id })}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
        {items?.length === 0 && <p className="text-sm text-muted-foreground">暂无权益条目</p>}
      </div>

      <BenefitItemDialog
        sponsorId={sponsorId}
        item={dialogItem}
        onClose={() => setDialogItem(null)}
        onSaved={() => {
          setDialogItem(null);
          utils.benefits.bySponsor.invalidate({ sponsorId });
        }}
      />
    </div>
  );
}

function BenefitItemDialog({
  sponsorId,
  item,
  onClose,
  onSaved,
}: {
  sponsorId: number;
  item:
    | {
        id: number;
        name: string;
        description: string | null;
        itemType: string;
        totalCount: number | null;
        countUnit: string | null;
        category: string;
        categoryLabel: string | null;
      }
    | "new"
    | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = item === "new";
  const existing = isNew ? null : item;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [itemType, setItemType] = useState<"per_match" | "season">("per_match");
  const [category, setCategory] = useState<Category>("ad_exposure");
  const [categoryLabel, setCategoryLabel] = useState("");
  const [totalCount, setTotalCount] = useState("");
  const [countUnit, setCountUnit] = useState("");

  const create = trpc.benefits.create.useMutation({ onSuccess: onSaved, onError: (e) => toast.error(e.message) });
  const update = trpc.benefits.update.useMutation({ onSuccess: onSaved, onError: (e) => toast.error(e.message) });

  function reset(i: typeof existing) {
    setName(i?.name ?? "");
    setDescription(i?.description ?? "");
    setItemType((i?.itemType as "per_match" | "season") ?? "per_match");
    setCategory((i?.category as Category) ?? "ad_exposure");
    setCategoryLabel(i?.categoryLabel ?? "");
    setTotalCount(i?.totalCount != null ? String(i.totalCount) : "");
    setCountUnit(i?.countUnit ?? "");
  }

  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (open) reset(existing);
        else onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "新增权益条目" : "编辑权益条目"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>说明</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>类型</Label>
              <Select value={itemType} onValueChange={(v) => setItemType(v as "per_match" | "season")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_match">场次型</SelectItem>
                  <SelectItem value="season">全季型</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>分类</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>分类自定义标签（可选）</Label>
            <Input value={categoryLabel} onChange={(e) => setCategoryLabel(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>总数量（可选）</Label>
              <Input type="number" value={totalCount} onChange={(e) => setTotalCount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>单位（可选）</Label>
              <Input value={countUnit} onChange={(e) => setCountUnit(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              if (!name) {
                toast.error("请填写名称");
                return;
              }
              const payload = {
                name,
                description: description || undefined,
                itemType,
                category,
                categoryLabel: categoryLabel || undefined,
                totalCount: totalCount ? Number(totalCount) : undefined,
                countUnit: countUnit || undefined,
              };
              if (isNew) {
                create.mutate({ sponsorId, ...payload });
              } else if (existing) {
                update.mutate({ id: existing.id, ...payload });
              }
            }}
            disabled={create.isPending || update.isPending}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
