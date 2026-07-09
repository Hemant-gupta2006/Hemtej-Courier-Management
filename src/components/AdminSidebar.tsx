"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Users,
  BarChart3,
  FileSpreadsheet,
  Settings,
  User,
  History,
  LogOut
} from "lucide-react";
import { motion } from "framer-motion";
import { signOut } from "next-auth/react";

const adminRoutes = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/admin",
    color: "from-blue-500 to-cyan-500",
  },
  {
    label: "Couriers",
    icon: Package,
    href: "/admin/couriers",
    color: "from-purple-500 to-pink-500",
  },
  {
    label: "Customers",
    icon: Users,
    href: "/admin/customers",
    color: "from-amber-500 to-orange-500",
  },
  {
    label: "Analytics",
    icon: BarChart3,
    href: "/admin/analytics",
    color: "from-red-500 to-rose-500",
  },
  {
    label: "Reports",
    icon: FileSpreadsheet,
    href: "/admin/reports",
    color: "from-emerald-500 to-teal-500",
  },
  {
    label: "Audit Logs",
    icon: History,
    href: "/admin/audit-logs",
    color: "from-indigo-500 to-violet-500",
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/admin/settings",
    color: "from-slate-500 to-zinc-500",
  },
  {
    label: "Profile",
    icon: User,
    href: "/admin/profile",
    color: "from-cyan-500 to-blue-500",
  },
];

export const AdminSidebar = () => {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <div className="space-y-4 py-8 flex flex-col h-full bg-transparent text-slate-800 dark:text-slate-100">
      <div className="px-6 flex-1 flex flex-col h-full">
        {/* Logo */}
        <Link href="/admin" className="flex items-center gap-3 mb-12 group pl-2">
          <img
            src="/icon.png"
            alt="HemTej Co Logo"
            className="w-12 h-12 object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-110"
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-red-700 to-orange-700 dark:from-red-400 dark:to-orange-400">
              HemTej Admin
            </h1>
            <p className="text-[10px] text-muted-foreground font-semibold tracking-wider uppercase">
              Control Panel
            </p>
          </div>
        </Link>

        {/* Navigation Items */}
        <div className="space-y-2 flex-1 overflow-y-auto pr-1">
          {adminRoutes.map((route) => {
            const isActive = pathname === route.href || (route.href !== "/admin" && pathname.startsWith(route.href));
            return (
              <Link key={route.href} href={route.href}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "group flex p-3 w-full justify-start font-medium cursor-pointer rounded-xl transition-all duration-300 relative overflow-hidden mb-1",
                    isActive
                      ? "bg-white/60 dark:bg-white/10 shadow-sm border border-white/50 dark:border-white/5 text-slate-900 dark:text-white"
                      : "text-slate-500 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-white/5"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-admin-nav-bg"
                      className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent dark:from-red-500/20"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <div className="flex items-center flex-1 relative z-10">
                    <div className={cn(
                      "p-1.5 rounded-lg mr-3 transition-colors duration-300",
                      isActive ? `bg-gradient-to-br ${route.color} text-white shadow-md` : "group-hover:bg-white dark:group-hover:bg-slate-800"
                    )}>
                      <route.icon className={cn("h-4 w-4", isActive ? "text-white" : "text-current")} />
                    </div>
                    {route.label}
                  </div>
                </motion.div>
              </Link>
            );
          })}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="group flex p-3 w-full justify-start font-medium cursor-pointer rounded-xl transition-all duration-300 relative overflow-hidden text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 mt-6"
          >
            <div className="flex items-center flex-1 relative z-10">
              <div className="p-1.5 rounded-lg mr-3 transition-colors duration-300 group-hover:bg-white dark:group-hover:bg-slate-800">
                <LogOut className="h-4 w-4 text-current" />
              </div>
              Logout
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
