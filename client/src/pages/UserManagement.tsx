import { useState } from "react";
import { toast } from "sonner";
import { Plus, KeyRound, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();
  const { data: users } = trpc.userManagement.list.useQuery();

  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<number | null>(null);

  const deleteUser = trpc.userManagement.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      utils.userManagement.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">用户管理</h1>
          <p className="text-sm text-muted-foreground">管理俱乐部运营团队账号</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          新增用户
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">邮箱</th>
                <th className="px-4 py-2 font-medium">姓名</th>
                <th className="px-4 py-2 font-medium">角色</th>
                <th className="px-4 py-2 font-medium">创建时间</th>
                <th className="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2">
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                      {u.role === "admin" ? "管理员" : "普通用户"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setResetTarget(u.id)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={u.id === currentUser?.id}
                        onClick={() => {
                          if (confirm(`确认删除用户「${u.email}」？`)) deleteUser.mutate({ userId: u.id });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          utils.userManagement.list.invalidate();
        }}
      />
      <ResetPasswordDialog userId={resetTarget} onClose={() => setResetTarget(null)} />
    </div>
  );
}

function CreateUserDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");

  const create = trpc.userManagement.create.useMutation({
    onSuccess: () => {
      toast.success("用户已创建");
      setEmail("");
      setName("");
      setPassword("");
      setRole("user");
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增用户</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>邮箱</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>姓名</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>密码</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>角色</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "user" | "admin")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">普通用户</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              if (!email || !name || !password) {
                toast.error("请完整填写信息");
                return;
              }
              create.mutate({ email, name, password, role });
            }}
            disabled={create.isPending}
          >
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ userId, onClose }: { userId: number | null; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const resetPassword = trpc.userManagement.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("密码已重置");
      setPassword("");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={userId !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>重置密码</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>新密码</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => {
              if (!userId || !password) return;
              resetPassword.mutate({ userId, newPassword: password });
            }}
            disabled={resetPassword.isPending}
          >
            确认重置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
