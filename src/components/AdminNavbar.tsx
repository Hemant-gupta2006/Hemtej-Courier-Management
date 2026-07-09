"use client";

import React, { useState, useEffect } from "react";
import { UserButton } from "./UserButton";
import { ThemeToggle } from "./ThemeToggle";
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2
} from "lucide-react";
import { Button } from "./ui/button";
import { usePathname, useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface AdminNavbarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export function AdminNavbar({ onToggleSidebar, isSidebarOpen }: AdminNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Derive breadcrumbs from path
  const getBreadcrumbs = () => {
    const paths = pathname.split("/").filter(Boolean);
    return paths.map((path, idx) => {
      const name = path.charAt(0).toUpperCase() + path.slice(1);
      const href = "/" + paths.slice(0, idx + 1).join("/");
      const isLast = idx === paths.length - 1;
      return { name, href, isLast };
    });
  };

  const breadcrumbs = getBreadcrumbs();

  const fetchNotificationLogs = async () => {
    try {
      const res = await fetch("/api/admin/audit-logs?limit=5");
      const resJson = await res.json();
      if (resJson.success && resJson.data?.logs) {
        setLogs(resJson.data.logs);
        // Simulate unread count for demonstration or track client-side
        setUnreadCount(resJson.data.logs.length);
      }
    } catch {
      // Fail silently for system alerts
    }
  };

  useEffect(() => {
    fetchNotificationLogs();
    const interval = setInterval(fetchNotificationLogs, 30000); // 30s polling
    return () => clearInterval(interval);
  }, []);

  const markAllRead = () => {
    setUnreadCount(0);
    toast.success("Notifications marked as read");
  };

  const getLogIcon = (action: string) => {
    switch (action) {
      case "DELETE_ENTRY":
      case "BULK_DELETE":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "UPDATE_STATUS":
      case "BULK_STATUS_UPDATE":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "SETTINGS_UPDATE":
        return <ShieldCheck className="h-4 w-4 text-purple-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-[#0f172a]/60 backdrop-blur px-4 md:px-6 relative z-30">
      {/* Left side: toggle + breadcrumbs */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="h-9 w-9 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <PanelLeftOpen className="h-5 w-5" />
          )}
        </Button>

        {/* Desktop Breadcrumbs */}
        <nav className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
          <span className="text-slate-400 dark:text-slate-500">Admin</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
          {breadcrumbs.map((bc, idx) => (
            <React.Fragment key={bc.href}>
              {idx > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
              )}
              {bc.isLast ? (
                <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[120px] md:max-w-[200px]">
                  {bc.name === "Admin" ? "Overview" : bc.name}
                </span>
              ) : (
                <button
                  onClick={() => router.push(bc.href)}
                  className="hover:text-slate-950 dark:hover:text-white transition-colors"
                >
                  {bc.name === "Admin" ? "Overview" : bc.name}
                </button>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right side: notifications + theme toggle + user profile */}
      <div className="flex items-center gap-3">
        {/* Notifications Popover */}
        <DropdownMenu>
          <DropdownMenuTrigger className="h-9 w-9 rounded-xl relative flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors outline-none cursor-pointer">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#0f172a] animate-pulse">
                {unreadCount}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#0f172a] shadow-xl p-2 space-y-1">
            <div className="flex items-center justify-between px-3 py-2">
              <DropdownMenuLabel className="p-0 font-bold text-slate-950 dark:text-white">
                Admin Alerts
              </DropdownMenuLabel>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
            <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
            {logs.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-400 italic">
                No new alerts
              </div>
            ) : (
              logs.map((log) => (
                <DropdownMenuItem
                  key={log.id}
                  onClick={() => router.push("/admin/audit-logs")}
                  className="flex items-start gap-3 p-3 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {getLogIcon(log.action)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {log.adminName} performed {log.action.replace("_", " ")}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      Entity: {log.entity} ({log.entityId.slice(0, 8)}...)
                    </p>
                    <p className="text-[9px] text-slate-500 font-medium">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
            <DropdownMenuItem
              onClick={() => router.push("/admin/audit-logs")}
              className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white justify-center py-2"
            >
              View Full Audit Logs
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />
        <UserButton />
      </div>
    </header>
  );
}
