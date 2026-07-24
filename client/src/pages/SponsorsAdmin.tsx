import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  FileText,
  Upload,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { fileToBase64 } from "@/lib/upload";
import { parseSpreadsheet, excelCell } from "@/lib/excel";
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
              <CardContent className="space-y-6 border-t pt-4">
                <ContractsManager sponsorId={sponsor.id} />
                <BenefitItemsManager sponsorId={sponsor.id} sponsorName={sponsor.name} />
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

function ContractsManager({ sponsorId }: { sponsorId: number }) {
  const utils = trpc.useUtils();
  const { data: contracts } = trpc.contracts.bySponsor.useQuery({ sponsorId });
  const uploadMutation = trpc.contracts.upload.useMutation({
    onSuccess: () => {
      toast.success("合同已上传");
      utils.contracts.bySponsor.invalidate({ sponsorId });
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.contracts.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      utils.contracts.bySponsor.invalidate({ sponsorId });
    },
  });

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    const base64 = await fileToBase64(file);
    await uploadMutation.mutateAsync({ sponsorId, base64, mimeType: file.type, filename: file.name });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">合同文件</h3>
        <label className="flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent">
          {uploadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          上传合同（PDF）
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />
        </label>
      </div>
      <div className="space-y-2">
        {contracts?.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <a href={c.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-primary underline">
              {c.filename || "合同文件"}
            </a>
            <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
            <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate({ id: c.id })}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
        {contracts?.length === 0 && <p className="text-sm text-muted-foreground">暂无合同文件</p>}
      </div>
    </div>
  );
}

function BenefitItemsManager({ sponsorId, sponsorName }: { sponsorId: number; sponsorName: string }) {
  const utils = trpc.useUtils();
  const { data: items } = trpc.benefits.bySponsor.useQuery({ sponsorId });
  const { data: users } = trpc.userManagement.list.useQuery();
  type BenefitItemRow = NonNullable<typeof items>[number];
  const [dialogItem, setDialogItem] = useState<BenefitItemRow | "new" | null>(null);
  const [aiImportOpen, setAiImportOpen] = useState(false);
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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAiImportOpen(true)}>
            <Sparkles className="mr-1 h-3 w-3" />
            合同+Excel智能导入
          </Button>
          <Button size="sm" onClick={() => setDialogItem("new")}>
            <Plus className="mr-1 h-3 w-3" />
            新增权益条目
          </Button>
        </div>
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

      <AIImportDialog
        sponsorId={sponsorId}
        sponsorName={sponsorName}
        open={aiImportOpen}
        onClose={() => setAiImportOpen(false)}
        onImported={() => {
          setAiImportOpen(false);
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

interface ExcelHint {
  name: string;
  category?: string;
}

interface ExtractedRow {
  name: string;
  category?: string | null;
  fulfillmentMode: FulfillmentMode;
  targetCount?: number | null;
  countUnit?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  scope?: string | null;
  attachmentRequirement?: string | null;
  requiresApproval?: boolean | null;
  contractNote?: string | null;
}

function AIImportDialog({
  sponsorId,
  sponsorName,
  open,
  onClose,
  onImported,
}: {
  sponsorId: number;
  sponsorName: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const { data: contracts } = trpc.contracts.bySponsor.useQuery({ sponsorId }, { enabled: open });
  const [contractId, setContractId] = useState("");
  const [excelName, setExcelName] = useState("");
  const [hints, setHints] = useState<ExcelHint[]>([]);
  const [rows, setRows] = useState<ExtractedRow[]>([]);
  const [error, setError] = useState("");

  const extractMutation = trpc.benefits.extractFromContract.useMutation({
    onSuccess: (result) => {
      setRows(result);
      if (result.length === 0) setError("AI 未能从合同中识别出权益条款，请检查合同内容或换一份文件重试");
    },
    onError: (e) => {
      setError(e.message);
    },
  });

  const importMutation = trpc.benefits.importList.useMutation({
    onSuccess: (result) => {
      toast.success(`导入成功：新增 ${result.created} 条权益条目`);
      setRows([]);
      setHints([]);
      setExcelName("");
      onImported();
    },
    onError: (e) => toast.error(e.message),
  });

  async function handleExcel(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const parsed = await parseSpreadsheet(file);
      const result: ExcelHint[] = [];
      for (const row of parsed) {
        const name = excelCell(row, "权益名称", "名称", "name");
        if (!name) continue;
        result.push({ name, category: excelCell(row, "权益分类", "分类", "category") });
      }
      setHints(result);
      setExcelName(file.name);
    } catch {
      setError("Excel 解析失败，请确认是 .xlsx/.csv 格式");
    }
  }

  function handleExtract() {
    setError("");
    if (!contractId) {
      setError("请先选择一份合同");
      return;
    }
    extractMutation.mutate({ sponsorId, contractId: Number(contractId), hints });
  }

  function handleImport() {
    importMutation.mutate(
      rows.map((row) => ({
        sponsorName,
        name: row.name,
        category: row.category || undefined,
        fulfillmentMode: row.fulfillmentMode,
        targetCount: row.targetCount ?? undefined,
        countUnit: row.countUnit || undefined,
        startDate: row.startDate ? new Date(row.startDate) : undefined,
        endDate: row.endDate ? new Date(row.endDate) : undefined,
        scope: row.scope || undefined,
        attachmentRequirement: row.attachmentRequirement || undefined,
        requiresApproval: row.requiresApproval ?? undefined,
        contractNote: row.contractNote || undefined,
      })),
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setRows([]);
          setError("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>合同 + Excel 智能导入权益</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            选择一份已上传的合同（在上方"合同文件"中先上传），AI 会读取合同原文自动拆解出权益条款；如果还有 Excel
            权益清单，可以一并上传作为参考，AI 会结合两者互相校对、补全信息。
          </p>
          <div className="space-y-1.5">
            <Label>选择合同</Label>
            <Select value={contractId} onValueChange={setContractId}>
              <SelectTrigger>
                <SelectValue placeholder="选择合同文件" />
              </SelectTrigger>
              <SelectContent>
                {contracts?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.filename || `合同 #${c.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {contracts?.length === 0 && (
              <p className="text-xs text-muted-foreground">该赞助商暂无合同，请先在上方上传</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Excel 权益清单（可选，作为辅助参考）</Label>
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleExcel(e.target.files?.[0])} />
            {excelName && (
              <p className="text-xs text-muted-foreground">
                已加载 {excelName}，解析到 {hints.length} 条权益名称
              </p>
            )}
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleExtract}
            disabled={extractMutation.isPending || !contractId}
          >
            {extractMutation.isPending ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                AI 识别中（可能需要 10-30 秒）...
              </>
            ) : (
              <>
                <Sparkles className="mr-1 h-4 w-4" />
                开始智能识别
              </>
            )}
          </Button>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {rows.length > 0 && (
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-2 py-1">权益名称</th>
                    <th className="px-2 py-1">分类</th>
                    <th className="px-2 py-1">模式</th>
                    <th className="px-2 py-1">目标</th>
                    <th className="px-2 py-1">审核</th>
                    <th className="px-2 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className="border-t align-top">
                      <td className="px-2 py-1">
                        <div className="font-medium">{row.name}</div>
                        {row.contractNote && (
                          <div className="mt-0.5 max-w-xs truncate text-muted-foreground" title={row.contractNote}>
                            {row.contractNote}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1">{row.category || "-"}</td>
                      <td className="px-2 py-1">{FULFILLMENT_MODE_LABELS[row.fulfillmentMode]}</td>
                      <td className="px-2 py-1">
                        {row.targetCount != null ? `${row.targetCount}${row.countUnit ?? ""}` : "-"}
                      </td>
                      <td className="px-2 py-1">{row.requiresApproval ? "需审核" : "-"}</td>
                      <td className="px-2 py-1">
                        <button
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          移除
                        </button>
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
          <Button onClick={handleImport} disabled={rows.length === 0 || importMutation.isPending}>
            {importMutation.isPending ? "导入中..." : `确认导入 ${rows.length} 条`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
