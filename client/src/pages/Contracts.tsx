import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { toast } from "sonner";
import { FileText, Plus, Trash2, Download, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { fileToBase64 } from "@/lib/upload";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NO_COMPANY = "__none__";

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "-";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Contracts() {
  const search = useSearch();
  const preselectedCompanyId = Number(new URLSearchParams(search).get("company")) || null;

  const utils = trpc.useUtils();
  const { data: contracts } = trpc.contracts.list.useQuery();
  const { data: companies } = trpc.companies.list.useQuery();
  const [seasonFilter, setSeasonFilter] = useState<string | "all">("all");
  const [companyFilter, setCompanyFilter] = useState<number | null>(preselectedCompanyId);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);

  const seasons = useMemo(() => {
    const set = new Set((contracts ?? []).map((c) => c.season));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [contracts]);

  const filtered = (contracts ?? []).filter((c) => {
    if (seasonFilter !== "all" && c.season !== seasonFilter) return false;
    if (companyFilter != null && c.companyId !== companyFilter) return false;
    return true;
  });

  const deleteMutation = trpc.contracts.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      utils.contracts.list.invalidate();
    },
  });

  const assignCompany = trpc.contracts.update.useMutation({
    onSuccess: () => {
      utils.contracts.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">合同</h1>
          <p className="text-sm text-muted-foreground">按赛季管理所有赞助合同文件</p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          New Contract
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={seasonFilter} onValueChange={(v) => setSeasonFilter(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部赛季</SelectItem>
            {seasons.map((s) => (
              <SelectItem key={s} value={s}>
                {s}赛季
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {companyFilter != null && (
          <Badge variant="outline" className="flex items-center gap-1">
            {companies?.find((c) => c.id === companyFilter)?.name ?? `赞助商 #${companyFilter}`}
            <button onClick={() => setCompanyFilter(null)}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 font-medium">Season</th>
                <th className="px-4 py-2 font-medium">Uploaded By</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Size</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="px-4 py-2">
                    <button
                      className="flex items-center gap-2 text-left text-primary hover:underline"
                      onClick={() => setPreviewId(c.id)}
                    >
                      <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate">{c.filename || "合同文件"}</span>
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <Select
                      value={c.companyId != null ? String(c.companyId) : NO_COMPANY}
                      onValueChange={(v) =>
                        assignCompany.mutate({ id: c.id, companyId: v === NO_COMPANY ? null : Number(v) })
                      }
                    >
                      <SelectTrigger className={cn("h-8 w-40", c.companyId == null && "text-muted-foreground italic")}>
                        <SelectValue placeholder="No company" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_COMPANY}>
                          <span className="italic text-muted-foreground">No company</span>
                        </SelectItem>
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={String(company.id)}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{c.season}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.uploader?.name || "-"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatFileSize(c.fileSize)}</td>
                  <td className="px-4 py-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`确认删除「${c.filename || "该合同"}」？`)) deleteMutation.mutate({ id: c.id });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p>No contracts yet</p>
              <p className="text-xs">上传一份合同 PDF，AI 会自动识别其中的权益条款</p>
            </div>
          )}
        </CardContent>
      </Card>

      <UploadDialog
        open={uploadOpen}
        defaultCompanyId={preselectedCompanyId}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setUploadOpen(false);
          utils.contracts.list.invalidate();
        }}
      />

      <PreviewDialog contractId={previewId} onClose={() => setPreviewId(null)} />
    </div>
  );
}

function UploadDialog({
  open,
  defaultCompanyId,
  onClose,
  onUploaded,
}: {
  open: boolean;
  defaultCompanyId: number | null;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { data: companies } = trpc.companies.list.useQuery(undefined, { enabled: open });
  const { data: club } = trpc.clubs.current.useQuery(undefined, { enabled: open });
  const [file, setFile] = useState<File | null>(null);
  const [season, setSeason] = useState("");
  const [companyId, setCompanyId] = useState<string>(defaultCompanyId ? String(defaultCompanyId) : NO_COMPANY);

  const upload = trpc.contracts.upload.useMutation({
    onSuccess: () => {
      toast.success("合同已上传");
      setFile(null);
      setSeason("");
      setCompanyId(NO_COMPANY);
      onUploaded();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Contract</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>合同文件（PDF）</Label>
            <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1.5">
            <Label>赛季</Label>
            <Input
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder={club?.season ? `默认：${club.season}` : "例如：2026"}
            />
          </div>
          <div className="space-y-1.5">
            <Label>赞助商（可选，之后也可在列表里指定）</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COMPANY}>暂不指定</SelectItem>
                {companies?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={async () => {
              if (!file) {
                toast.error("请选择合同文件");
                return;
              }
              const base64 = await fileToBase64(file);
              upload.mutate({
                base64,
                mimeType: file.type,
                filename: file.name,
                season: season || undefined,
                companyId: companyId !== NO_COMPANY ? Number(companyId) : undefined,
              });
            }}
            disabled={upload.isPending || !file}
          >
            {upload.isPending ? "上传中..." : "上传"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewDialog({ contractId, onClose }: { contractId: number | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: contracts } = trpc.contracts.list.useQuery(undefined, { enabled: contractId != null });
  const contract = contracts?.find((c) => c.id === contractId) ?? null;

  const getDownloadUrl = trpc.contracts.getDownloadUrl.useQuery(
    { id: contractId ?? -1 },
    { enabled: false },
  );

  async function handleDownload() {
    if (!contractId) return;
    const result = await getDownloadUrl.refetch();
    if (result.data?.url) window.location.href = result.data.url;
  }

  return (
    <Dialog open={contractId !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 pr-6">
            <span className="truncate">{contract?.filename || "合同预览"}</span>
          </DialogTitle>
        </DialogHeader>
        {contract && (
          <>
            <div className="flex-1 overflow-hidden rounded-md border">
              <iframe src={contract.url} title={contract.filename ?? "contract"} className="h-[70vh] w-full" />
            </div>
            <ContractCommercialForm
              contract={contract}
              onSaved={() => utils.contracts.list.invalidate()}
            />
            <ContractPaymentsManager contractId={contract.id} />
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
          <Button onClick={handleDownload} disabled={getDownloadUrl.isFetching}>
            <Download className="mr-1 h-4 w-4" />
            下载
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ContractCommercial {
  id: number;
  amount: number | null;
  signedDate: string | Date | null;
  startDate: string | Date | null;
  endDate: string | Date | null;
}

function toDateInputValue(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function ContractCommercialForm({ contract, onSaved }: { contract: ContractCommercial; onSaved: () => void }) {
  const [amount, setAmount] = useState(contract.amount != null ? String(contract.amount) : "");
  const [signedDate, setSignedDate] = useState(toDateInputValue(contract.signedDate));
  const [startDate, setStartDate] = useState(toDateInputValue(contract.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(contract.endDate));

  const update = trpc.contracts.update.useMutation({
    onSuccess: () => {
      toast.success("已保存");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-2 rounded-md border p-3">
      <h4 className="text-xs font-medium text-muted-foreground">合同商务信息</h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label>合同金额（可选）</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="元" />
        </div>
        <div className="space-y-1.5">
          <Label>签订日期</Label>
          <Input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>起始日期</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>结束日期</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <Button
        size="sm"
        onClick={() =>
          update.mutate({
            id: contract.id,
            amount: amount ? Number(amount) : undefined,
            signedDate: signedDate ? new Date(signedDate) : undefined,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
          })
        }
        disabled={update.isPending}
      >
        保存商务信息
      </Button>
    </div>
  );
}

function ContractPaymentsManager({ contractId }: { contractId: number }) {
  const utils = trpc.useUtils();
  const { data: payments } = trpc.contracts.payments.byContract.useQuery({ contractId });
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const create = trpc.contracts.payments.create.useMutation({
    onSuccess: () => {
      setDueDate("");
      setAmount("");
      setNote("");
      utils.contracts.payments.byContract.invalidate({ contractId });
    },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.contracts.payments.update.useMutation({
    onSuccess: () => utils.contracts.payments.byContract.invalidate({ contractId }),
  });
  const deleteMutation = trpc.contracts.payments.delete.useMutation({
    onSuccess: () => utils.contracts.payments.byContract.invalidate({ contractId }),
  });

  const totalAmount = payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const paidAmount = payments?.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0) ?? 0;

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-muted-foreground">回款计划</h4>
        {payments && payments.length > 0 && (
          <span className="text-xs text-muted-foreground">
            已回款 {paidAmount.toLocaleString()} / {totalAmount.toLocaleString()}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {payments?.map((p) => {
          const isOverdue = p.status === "pending" && p.dueDate && new Date(p.dueDate).getTime() < Date.now();
          return (
            <div key={p.id} className="flex items-center gap-2 rounded-md border p-2 text-xs">
              <span className="flex-1">
                {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : "无到期日"} · ￥{p.amount.toLocaleString()}
                {p.note ? ` · ${p.note}` : ""}
              </span>
              {isOverdue && <Badge variant="destructive">已逾期</Badge>}
              <Badge
                className={p.status === "paid" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}
                onClick={() =>
                  update.mutate({
                    id: p.id,
                    status: p.status === "paid" ? "pending" : "paid",
                    paidDate: p.status === "paid" ? undefined : new Date(),
                  })
                }
                style={{ cursor: "pointer" }}
              >
                {p.status === "paid" ? "已回款" : "标记为已回款"}
              </Badge>
              <button
                className="text-muted-foreground hover:text-destructive"
                onClick={() => deleteMutation.mutate({ id: p.id })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        {payments?.length === 0 && <p className="text-xs text-muted-foreground">暂无回款计划</p>}
      </div>
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">到期日</Label>
          <Input type="date" className="h-8" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">金额</Label>
          <Input
            type="number"
            className="h-8 w-24"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="元"
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs">备注</Label>
          <Input className="h-8" value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：首付款" />
        </div>
        <Button
          size="sm"
          onClick={() => {
            if (!amount) {
              toast.error("请填写金额");
              return;
            }
            create.mutate({
              contractId,
              dueDate: dueDate ? new Date(dueDate) : undefined,
              amount: Number(amount),
              note: note || undefined,
            });
          }}
          disabled={create.isPending}
        >
          添加
        </Button>
      </div>
    </div>
  );
}
