import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  FileText,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
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
import { colorForText, COMPANY_STAGE_LABELS, COMPANY_STAGE_COLORS, ACTIVITY_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { companyStageEnum, companyActivityTypeEnum } from "@server/db/schema";

type CompanyStage = (typeof companyStageEnum)[number];
type ActivityType = (typeof companyActivityTypeEnum)[number];

const STAGE_TABS: (CompanyStage | "all")[] = ["all", "lead", "negotiating", "signed", "lost"];

export default function CompaniesAdmin() {
  const utils = trpc.useUtils();
  const { data: companies } = trpc.companies.list.useQuery();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [stageFilter, setStageFilter] = useState<CompanyStage | "all">("all");
  type CompanyRow = NonNullable<typeof companies>[number];
  const [dialogCompany, setDialogCompany] = useState<CompanyRow | "new" | null>(null);

  const deleteCompany = trpc.companies.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      utils.companies.list.invalidate();
    },
  });

  const filteredCompanies = companies?.filter((c) => stageFilter === "all" || c.stage === stageFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">赞助商管理</h1>
          <p className="text-sm text-muted-foreground">管理商务合作全流程：从潜在客户到已签约赞助商</p>
        </div>
        <Button onClick={() => setDialogCompany("new")}>
          <Plus className="mr-1 h-4 w-4" />
          新增赞助商
        </Button>
      </div>

      <div className="flex gap-2">
        {STAGE_TABS.map((stage) => (
          <button
            key={stage}
            onClick={() => setStageFilter(stage)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              stageFilter === stage ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {stage === "all" ? "全部" : COMPANY_STAGE_LABELS[stage]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredCompanies?.map((company) => (
          <Card key={company.id}>
            <button
              className="flex w-full items-center gap-3 p-4 text-left"
              onClick={() => setExpandedId(expandedId === company.id ? null : company.id)}
            >
              {expandedId === company.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{company.name}</span>
                  <Badge className={COMPANY_STAGE_COLORS[company.stage]}>{COMPANY_STAGE_LABELS[company.stage]}</Badge>
                  <Badge className={colorForText(company.tier)} variant="outline">
                    {company.tier}
                  </Badge>
                  {!company.isActive && <Badge variant="secondary">已停用</Badge>}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setDialogCompany(company);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`确认删除赞助商「${company.name}」？`)) deleteCompany.mutate({ id: company.id });
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </button>
            {expandedId === company.id && (
              <CardContent className="space-y-6 border-t pt-4">
                <ActivitiesManager companyId={company.id} />
                <ContractsSummaryLink companyId={company.id} />
                <AssetsManager companyId={company.id} companyName={company.name} />
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <CompanyDialog
        company={dialogCompany}
        onClose={() => setDialogCompany(null)}
        onSaved={() => {
          setDialogCompany(null);
          utils.companies.list.invalidate();
        }}
      />
    </div>
  );
}

function CompanyDialog({
  company,
  onClose,
  onSaved,
}: {
  company:
    | {
        id: number;
        name: string;
        tier: string;
        stage: string;
        contactName: string | null;
        contactPhone: string | null;
        notes: string | null;
      }
    | "new"
    | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = company === "new";
  const existing = isNew ? null : company;

  const [name, setName] = useState("");
  const [tier, setTier] = useState("");
  const [stage, setStage] = useState<CompanyStage>("lead");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");

  const create = trpc.companies.create.useMutation({ onSuccess: onSaved, onError: (e) => toast.error(e.message) });
  const update = trpc.companies.update.useMutation({ onSuccess: onSaved, onError: (e) => toast.error(e.message) });

  function reset(c: typeof existing) {
    setName(c?.name ?? "");
    setTier(c?.tier ?? "");
    setStage((c?.stage as CompanyStage) ?? "lead");
    setContactName(c?.contactName ?? "");
    setContactPhone(c?.contactPhone ?? "");
    setNotes(c?.notes ?? "");
  }

  return (
    <Dialog
      open={company !== null}
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>阶段</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as CompanyStage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COMPANY_STAGE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>赞助层级（可选）</Label>
              <Input value={tier} onChange={(e) => setTier(e.target.value)} placeholder="例如：冠名赞助商" />
            </div>
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
                create.mutate({ name, tier: tier || undefined, stage, contactName, contactPhone, notes });
              } else if (existing) {
                update.mutate({ id: existing.id, name, tier: tier || undefined, stage, contactName, contactPhone, notes });
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

function ActivitiesManager({ companyId }: { companyId: number }) {
  const utils = trpc.useUtils();
  const { data: activities } = trpc.companyActivities.byCompany.useQuery({ companyId });
  const [type, setType] = useState<ActivityType>("visit");
  const [content, setContent] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  const create = trpc.companyActivities.create.useMutation({
    onSuccess: () => {
      setContent("");
      setContactPerson("");
      setFollowUpDate("");
      utils.companyActivities.byCompany.invalidate({ companyId });
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.companyActivities.delete.useMutation({
    onSuccess: () => utils.companyActivities.byCompany.invalidate({ companyId }),
  });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">跟进记录</h3>
      <div className="space-y-2">
        {activities?.map((a) => (
          <div key={a.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
            <Badge variant="outline">{ACTIVITY_TYPE_LABELS[a.type]}</Badge>
            <div className="flex-1">
              <p>{a.content}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(a.createdAt).toLocaleString()}
                {a.contactPerson ? ` · 联系人：${a.contactPerson}` : ""}
                {a.followUpDate ? ` · 下次跟进：${new Date(a.followUpDate).toLocaleDateString()}` : ""}
              </p>
            </div>
            <button
              className="text-muted-foreground hover:text-destructive"
              onClick={() => deleteMutation.mutate({ id: a.id })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {activities?.length === 0 && <p className="text-sm text-muted-foreground">暂无跟进记录</p>}
      </div>
      <div className="space-y-2 rounded-md border p-3">
        <div className="grid grid-cols-3 gap-2">
          <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="联系人（可选）" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} title="下次跟进日期（可选）" />
        </div>
        <Textarea placeholder="记录本次沟通内容..." value={content} onChange={(e) => setContent(e.target.value)} />
        <Button
          size="sm"
          onClick={() => {
            if (!content) {
              toast.error("请填写沟通内容");
              return;
            }
            create.mutate({
              companyId,
              type,
              content,
              contactPerson: contactPerson || undefined,
              followUpDate: followUpDate ? new Date(followUpDate) : undefined,
            });
          }}
          disabled={create.isPending}
        >
          添加记录
        </Button>
      </div>
    </div>
  );
}

function ContractsSummaryLink({ companyId }: { companyId: number }) {
  const { data: contracts } = trpc.contracts.byCompany.useQuery({ companyId });
  return (
    <div className="flex items-center justify-between rounded-md border p-2 text-sm">
      <span className="text-muted-foreground">
        <FileText className="mr-1.5 inline h-3.5 w-3.5" />
        {contracts?.length ?? 0} 份合同
      </span>
      <Link href={`/contracts?company=${companyId}`} className="text-primary hover:underline">
        查看合同 →
      </Link>
    </div>
  );
}

function AssetsManager({ companyId, companyName }: { companyId: number; companyName: string }) {
  const utils = trpc.useUtils();
  const { data: assets } = trpc.assets.byCompany.useQuery({ companyId });
  type AssetRow = NonNullable<typeof assets>[number];
  const [dialogAsset, setDialogAsset] = useState<AssetRow | "new" | null>(null);
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const deleteAsset = trpc.assets.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      utils.assets.byCompany.invalidate({ companyId });
      utils.assets.progressByCompany.invalidate({ companyId });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">资产（权益）条目</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAiImportOpen(true)}>
            <Sparkles className="mr-1 h-3 w-3" />
            合同智能识别
          </Button>
          <Button size="sm" onClick={() => setDialogAsset("new")}>
            <Plus className="mr-1 h-3 w-3" />
            新增资产
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {assets?.map((asset) => (
          <div key={asset.id} className="flex items-center gap-3 rounded-md border p-2 text-sm">
            {asset.category && (
              <Badge className={colorForText(asset.category)} variant="outline">
                {asset.category}
              </Badge>
            )}
            <span className="flex-1">
              {asset.code && <span className="mr-1 text-xs text-muted-foreground">{asset.code}</span>}
              {asset.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {asset.targetCount != null ? `目标${asset.targetCount}${asset.countUnit ?? ""}` : ""}
              {asset.requiresApproval ? " · 需审核" : ""}
              {asset.scope ? ` · ${asset.scope}` : ""}
            </span>
            <Button size="icon" variant="ghost" onClick={() => setDialogAsset(asset)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => deleteAsset.mutate({ id: asset.id })}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
        {assets?.length === 0 && <p className="text-sm text-muted-foreground">暂无资产条目</p>}
      </div>

      <AssetDialog
        companyId={companyId}
        asset={dialogAsset}
        onClose={() => setDialogAsset(null)}
        onSaved={() => {
          setDialogAsset(null);
          utils.assets.byCompany.invalidate({ companyId });
          utils.assets.progressByCompany.invalidate({ companyId });
        }}
      />

      <AIImportDialog
        companyId={companyId}
        companyName={companyName}
        open={aiImportOpen}
        onClose={() => setAiImportOpen(false)}
        onImported={() => {
          setAiImportOpen(false);
          utils.assets.byCompany.invalidate({ companyId });
          utils.assets.progressByCompany.invalidate({ companyId });
        }}
      />
    </div>
  );
}

interface AssetFull {
  id: number;
  code: string | null;
  name: string;
  description: string | null;
  category: string;
  targetCount: number | null;
  countUnit: string | null;
  startDate: string | Date | null;
  endDate: string | Date | null;
  scope: string | null;
  attachmentRequirement: string | null;
  requiresApproval: boolean;
}

function toDateInputValue(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function AssetDialog({
  companyId,
  asset,
  onClose,
  onSaved,
}: {
  companyId: number;
  asset: AssetFull | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = asset === "new";
  const existing = isNew ? null : asset;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [targetCount, setTargetCount] = useState("");
  const [countUnit, setCountUnit] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [scope, setScope] = useState("");
  const [attachmentRequirement, setAttachmentRequirement] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);

  const create = trpc.assets.create.useMutation({ onSuccess: onSaved, onError: (e) => toast.error(e.message) });
  const update = trpc.assets.update.useMutation({ onSuccess: onSaved, onError: (e) => toast.error(e.message) });

  function reset(a: typeof existing) {
    setCode(a?.code ?? "");
    setName(a?.name ?? "");
    setDescription(a?.description ?? "");
    setCategory(a?.category ?? "");
    setTargetCount(a?.targetCount != null ? String(a.targetCount) : "");
    setCountUnit(a?.countUnit ?? "");
    setStartDate(toDateInputValue(a?.startDate));
    setEndDate(toDateInputValue(a?.endDate));
    setScope(a?.scope ?? "");
    setAttachmentRequirement(a?.attachmentRequirement ?? "");
    setRequiresApproval(a?.requiresApproval ?? false);
  }

  return (
    <Dialog
      open={asset !== null}
      onOpenChange={(open) => {
        if (open) reset(existing);
        else onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "新增资产" : "编辑资产"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label>资产编号（可选）</Label>
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
              <Label>分类（可选）</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="例如：媒体曝光" />
            </div>
            <div className="space-y-1.5">
              <Label>目标数量（可选）</Label>
              <Input type="number" value={targetCount} onChange={(e) => setTargetCount(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>单位（可选）</Label>
              <Input value={countUnit} onChange={(e) => setCountUnit(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>开始日期（可选）</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>结束日期（可选）</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>适用范围（可选，用于自动排期）</Label>
            <Input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="例如：全部主场比赛" />
          </div>
          <div className="space-y-1.5">
            <Label>附件要求（可选）</Label>
            <Input value={attachmentRequirement} onChange={(e) => setAttachmentRequirement(e.target.value)} placeholder="例如：必须上传视频文件" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={requiresApproval} onCheckedChange={(v) => setRequiresApproval(!!v)} />
            需要审核
          </label>
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
                category: category || undefined,
                targetCount: targetCount ? Number(targetCount) : undefined,
                countUnit: countUnit || undefined,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                scope: scope || undefined,
                attachmentRequirement: attachmentRequirement || undefined,
                requiresApproval,
              };
              if (isNew) {
                create.mutate({ companyId, ...payload });
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
  targetCount?: number | null;
  countUnit?: string | null;
  scope?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  attachmentRequirement?: string | null;
  requiresApproval?: boolean | null;
}

function AIImportDialog({
  companyId,
  companyName: _companyName,
  open,
  onClose,
  onImported,
}: {
  companyId: number;
  companyName: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const { data: contracts } = trpc.contracts.byCompany.useQuery({ companyId }, { enabled: open });
  const [contractId, setContractId] = useState("");
  const [excelName, setExcelName] = useState("");
  const [hints, setHints] = useState<ExcelHint[]>([]);
  const [rows, setRows] = useState<ExtractedRow[]>([]);
  const [error, setError] = useState("");

  const extractMutation = trpc.assets.extractFromContract.useMutation({
    onSuccess: (result) => {
      setRows(result);
      if (result.length === 0) setError("AI 未能从合同中识别出权益条款，请检查合同内容或换一份文件重试");
    },
    onError: (e) => {
      setError(e.message);
    },
  });

  const importMutation = trpc.assets.importExtracted.useMutation({
    onSuccess: (result) => {
      toast.success(`导入成功：新增 ${result.created} 项资产`);
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
    extractMutation.mutate({ companyId, contractId: Number(contractId), hints });
  }

  function handleImport() {
    importMutation.mutate({
      companyId,
      contractId: contractId ? Number(contractId) : undefined,
      rows,
    });
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
          <DialogTitle>合同智能识别生成资产</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            选择一份已上传的合同（在上方"合同文件"中先上传），AI 会读取合同原文自动拆解出权益条款并生成资产，无需手动选择履约模式——AI 会据此自动生成对应的交付计划。如果还有 Excel
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
                    <th className="px-2 py-1">资产名称</th>
                    <th className="px-2 py-1">分类</th>
                    <th className="px-2 py-1">适用范围</th>
                    <th className="px-2 py-1">目标</th>
                    <th className="px-2 py-1">审核</th>
                    <th className="px-2 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className="border-t align-top">
                      <td className="px-2 py-1 font-medium">{row.name}</td>
                      <td className="px-2 py-1">{row.category || "-"}</td>
                      <td className="px-2 py-1 max-w-xs truncate" title={row.scope ?? undefined}>
                        {row.scope || "-"}
                      </td>
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
            {importMutation.isPending ? "导入中..." : `确认导入 ${rows.length} 项`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
