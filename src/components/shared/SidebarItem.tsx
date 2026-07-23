"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: string | number;
  collapsed?: boolean;
}

export function SidebarItem({
  href,
  label,
  icon: Icon,
  active,
  badge,
  collapsed = false,
}: SidebarItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
        active
          ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon
        className={cn(
          "w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
          active ? "text-white" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
        )}
      />

      {!collapsed && <span className="truncate">{label}</span>}

      {!collapsed && badge !== undefined && (
        <span
          className={cn(
            "ml-auto text-xs px-2 py-0.5 rounded-full font-semibold",
            active
              ? "bg-white/20 text-white"
              : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
