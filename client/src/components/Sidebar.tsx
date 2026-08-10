import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  CalendarDays,
  GanttChartSquare,
  CheckSquare,
  Settings,
  Users,
  FileText,
  FileSignature,
  Trophy,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
};

const MAIN_NAV: NavItem[] = [
  { label: "总览", path: "/", icon: LayoutDashboard },
  { label: "排期", path: "/planning", icon: GanttChartSquare },
  { label: "任务看板", path: "/tasks", icon: CheckSquare },
];

const ADMIN_NAV: NavItem[] = [
  { label: "赞助商管理", path: "/companies-admin", icon: Settings },
  { label: "合同", path: "/contracts", icon: FileSignature },
  { label: "赛程管理", path: "/matches-admin", icon: CalendarDays },
  { label: "用户管理", path: "/user-management", icon: Users },
  { label: "履约报告", path: "/reports", icon: FileText },
];

const WIDTH_KEY = "sidebar-width";
const COLLAPSED_KEY = "sidebar-collapsed";
const MIN_WIDTH = 180;
const MAX_WIDTH = 320;
const DEFAULT_WIDTH = 240;

interface SidebarProps {
  user: { name: string | null; email: string | null; role: string };
}

export function Sidebar({ user }: SidebarProps) {
  const [location] = useLocation();
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
      window.location.href = "/login";
    },
  });

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "1");
  const [width, setWidth] = useState(() => {
    const stored = Number(localStorage.getItem(WIDTH_KEY));
    return stored >= MIN_WIDTH && stored <= MAX_WIDTH ? stored : DEFAULT_WIDTH;
  });
  const resizing = useRef(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizing.current) return;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(next);
    }
    function onMouseUp() {
      if (resizing.current) {
        resizing.current = false;
        localStorage.setItem(WIDTH_KEY, String(width));
      }
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [width]);

  const isAdmin = user.role === "admin";

  return (
    <aside
      style={{ width: collapsed ? 64 : width }}
      className="relative flex h-screen flex-shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-150"
    >
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Trophy className="h-5 w-5" />
        </div>
        {!collapsed && <span className="truncate font-semibold">俱乐部赞助商管理</span>}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.path} item={item} active={location === item.path} collapsed={collapsed} />
        ))}

        {isAdmin && (
          <>
            <div className="my-2 border-t border-sidebar-border" />
            {!collapsed && (
              <div className="px-3 py-1 text-xs font-medium uppercase text-sidebar-foreground/50">管理</div>
            )}
            {ADMIN_NAV.map((item) => (
              <NavLink key={item.path} item={item} active={location === item.path} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md p-2 hover:bg-sidebar-accent">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                  {(user.name || user.email || "U").slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex min-w-0 flex-1 flex-col items-start text-left">
                  <span className="truncate text-sm font-medium">{user.name || user.email}</span>
                  <span className="text-xs text-sidebar-foreground/60">
                    {isAdmin ? "管理员" : "普通用户"}
                  </span>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-48">
            <DropdownMenuItem onClick={() => logout.mutate()}>
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-16 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow"
      >
        {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
      </button>

      {!collapsed && (
        <div
          onMouseDown={() => (resizing.current = true)}
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-sidebar-ring/40"
        />
      )}
    </aside>
  );
}

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.path}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
