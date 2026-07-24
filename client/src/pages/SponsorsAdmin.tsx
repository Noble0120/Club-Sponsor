import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, FileSpreadsheet } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { parseSpreadsheet, excelCell, excelNumber, excelDate } from "@/lib/excel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { colorForText, FULFILLMENT_MODE_LABELS } from "@/lib/constants";
import type { fulfillmentModeEnum } from "@server/db/schema";

type FulfillmentMode = (typeof fulfillmentModeEnum)[number];

export default function SponsorsAdmin() {
  const utils = trpc.useUtils();
  const { data: sponsors } = trpc.sponsors.list.useQuery();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  type SponsorRow = NonNullable<typeof sponsors>[number];
  const [dialogSponsor, setDialogSponsor] = useState<SponsorRow | "new" | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="mr-1 h-4 w-4" />
            导入权益 Excel
          </Button>
          <Button onClick={() => setDialogSponsor("new")}>
            <Plus className="mr-1 h-4 w-4" />
            新增赞助商
          </Button>
        </div>
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
                  <Badge className={colorForText(sponsor.tier)} variant="outline">
                    {sponsor.tier}
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

      <BenefitImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
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
  const [tier, setTier] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");

  const create = trpc.sponsors.create.useMutation({ onSuccess: onSaved, onError: (e) => toast.error(e.message) });
  const update = trpc.sponsors.update.useMutation({ onSuccess: onSaved, onError: (e) => toast.error(e.message) });

  function reset(s: typeof existing) {
    setName(s?.name ?? "");
    setTier(s?.tier ?? "");
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
            <Input value={tier} onChange={(e) => setTier(e.target.value)} placeholder="例如：冠名赞助商、官方合作伙伴" />
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
              if (!name || !tier) {
                toast.error("请填写名称和赞助层级");
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
  const { data: users } = trpc.userManagement.list.useQuery();
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
        {items?.map((item) => {
          const assignee = users?.find((u) => u.id === item.assigneeId);
          return (
            <div key={item.id} className="flex items-center gap-3 rounded-md border p-2 text-sm">
              {item.category && (
                <Badge className={colorForText(item.category)} variant="outline">
                  {item.category}
                </Badge>
              )}
              <span className="flex-1">
                {item.code && <span className="mr-1 text-xs text-muted-foreground">{item.code}</span>}
                {item.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {FULFILLMENT_MODE_LABELS[item.fulfillmentMode]}
                {item.targetCount != null ? ` · 目标${item.targetCount}${item.countUnit ?? ""}` : ""}
                {item.requiresApproval ? " · 需审核" : ""}
                {assignee ? ` · 负责人${assignee.name}` : ""}
              </span>
              <Button size="icon" variant="ghost" onClick={() => setDialogItem(item)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => deleteItem.mutate({ id: item.id })}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          );
        })}
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

interface BenefitItemFull {
  id: number;
  code: string | null;
  name: string;
  description: string | null;
  fulfillmentMode: string;
  targetCount: number | null;
  countUnit: string | null;
  category: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
  scope: string | null;
  attachmentRequirement: string | null;
  requiresApproval: boolean;
  assigneeId: number | null;
  contractNote: string | null;
}

function toDateInputValue(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function BenefitItemDialog({
  sponsorId,
  item,
  onClose,
  onSaved,
}: {
  sponsorId: number;
  item: BenefitItemFull | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = item === "new";
  const existing = isNew ? null : item;
  const { data: users } = trpc.userManagement.list.useQuery();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>("MATCH");
  const [category, setCategory] = useState("");
  const [targetCount, setTargetCount] = useState("");
  const [countUnit, setCountUnit] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [scope, setScope] = useState("");
  const [attachmentRequirement, setAttachmentRequirement] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [contractNote, setContractNote] = useState("");

  const create = trpc.benefits.create.useMutation({ onSuccess: onSaved, onError: (e) => toast.error(e.message) });
  const update = trpc.benefits.update.useMutation({ onSuccess: onSaved, onError: (e) => toast.error(e.message) });

  function reset(i: typeof existing) {
    setCode(i?.code ?? "");
    setName(i?.name ?? "");
    setDescription(i?.description ?? "");
    setFulfillmentMode((i?.fulfillmentMode as FulfillmentMode) ?? "MATCH");
    setCategory(i?.category ?? "");
    setTargetCount(i?.targetCount != null ? String(i.targetCount) : "");
    setCountUnit(i?.countUnit ?? "");
    setStartDate(toDateInputValue(i?.startDate));
    setEndDate(toDateInputValue(i?.endDate));
    setScope(i?.scope ?? "");
    setAttachmentRequirement(i?.attachmentRequirement ?? "");
    setRequiresApproval(i?.requiresApproval ?? false);
    setAssigneeId(i?.assigneeId != null ? String(i.assigneeId) : "");
    setContractNote(i?.contractNote ?? "");
  }

  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (open) reset(existing);
        else onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "新增权益条目" : "编辑权益条目"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label>权益ID（可选）</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>说明</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>履约模式</Label>
              <Select value={fulfillmentMode} onValueChange={(v) => setFulfillmentMode(v as FulfillmentMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FULFILLMENT_MODE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>权益分类（可选）</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="例如：媒体曝光" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>目标数量（可选）</Label>
              <Input type="number" value={targetCount} onChange={(e) => setTargetCount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>单位（可选）</Label>
              <Input value={countUnit} onChange={(e) => setCountUnit(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>开始日期（可选）</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>结束日期（可选）</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>适用范围（可选）</Label>
            <Input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="例如：全部主场比赛" />
          </div>
          <div className="space-y-1.5">
            <Label>附件要求（可选）</Label>
            <Input value={attachmentRequirement} onChange={(e) => setAttachmentRequirement(e.target.value)} placeholder="例如：必须上传视频文件" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={requiresApproval} onCheckedChange={(v) => setRequiresApproval(!!v)} />
              需要审核
            </label>
            <div className="flex flex-1 items-center gap-2">
              <Label className="whitespace-nowrap">负责人（可选）</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择负责人" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>合同原文/备注（可选）</Label>
            <Textarea value={contractNote} onChange={(e) => setContractNote(e.target.value)} />
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
                code: code || undefined,
                name,
                description: description || undefined,
                fulfillmentMode,
                category: category || undefined,
                targetCount: targetCount ? Number(targetCount) : undefined,
                countUnit: countUnit || undefined,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                scope: scope || undefined,
                attachmentRequirement: attachmentRequirement || undefined,
                requiresApproval,
                assigneeId: assigneeId ? Number(assigneeId) : undefined,
                contractNote: contractNote || undefined,
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

interface ParsedBenefitRow {
  sponsorName: string;
  name: string;
  category?: string;
  fulfillmentMode: FulfillmentMode;
  targetCount?: number;
  countUnit?: string;
  startDate?: Date;
  endDate?: Date;
}

const VALID_MODES = new Set(["QUANTITY", "MATCH", "ROUND", "EVENT", "ONE_TIME", "CONTINUOUS"]);

function BenefitImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [rows, setRows] = useState<ParsedBenefitRow[]>([]);
  const [error, setError] = useState("");

  const importMutation = trpc.benefits.importList.useMutation({
    onSuccess: (result) => {
      toast.success(
        `导入成功：新增 ${result.created} 条权益条目${result.sponsorsCreated.length > 0 ? `，自动创建赞助商：${result.sponsorsCreated.join("、")}` : ""}`,
      );
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
      const result: ParsedBenefitRow[] = [];
      for (const row of parsed) {
        const sponsorName = excelCell(row, "赞助商", "合作方", "sponsorName");
        const name = excelCell(row, "权益名称", "名称", "name");
        const modeRaw = excelCell(row, "履约模式", "fulfillmentMode")?.toUpperCase();
        if (!sponsorName || !name || !modeRaw || !VALID_MODES.has(modeRaw)) continue;
        result.push({
          sponsorName,
          name,
          category: excelCell(row, "权益分类", "分类", "category"),
          fulfillmentMode: modeRaw as FulfillmentMode,
          targetCount: excelNumber(row, "目标数量", "targetCount"),
          countUnit: excelCell(row, "单位", "countUnit"),
          startDate: excelDate(row, "开始日期", "startDate"),
          endDate: excelDate(row, "结束日期", "endDate"),
        });
      }
      if (result.length === 0) {
        setError("没有解析到有效行，请确认表头包含：赞助商、权益名称、履约模式");
      }
      setRows(result);
    } catch {
      setError("文件解析失败，请确认是 .xlsx/.csv 格式");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>导入权益列表 Excel</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            表头需要包含：赞助商、权益名称、履约模式（QUANTITY/MATCH/ROUND/EVENT/ONE_TIME/CONTINUOUS），可选：权益分类、目标数量、单位、开始日期、结束日期。赞助商名称不存在时会自动新建。
          </p>
          <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleFile(e.target.files?.[0])} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {rows.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-2 py-1">赞助商</th>
                    <th className="px-2 py-1">权益名称</th>
                    <th className="px-2 py-1">模式</th>
                    <th className="px-2 py-1">目标</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-1">{row.sponsorName}</td>
                      <td className="px-2 py-1">{row.name}</td>
                      <td className="px-2 py-1">{FULFILLMENT_MODE_LABELS[row.fulfillmentMode]}</td>
                      <td className="px-2 py-1">
                        {row.targetCount != null ? `${row.targetCount}${row.countUnit ?? ""}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            {importMutation.isPending ? "导入中..." : `导入 ${rows.length} 条`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
