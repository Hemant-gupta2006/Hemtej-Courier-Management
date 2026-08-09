"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  LayoutDashboard,
  TableProperties,
  Settings,
  FileSpreadsheet,
  List,
  ChevronDown,
  ChevronRight,
  Plus,
  Lock,
  Archive,
  FolderClosed,
  Merge,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRegisters } from "@/context/RegisterContext";
import { CombineRegistersModal } from "@/components/CombineRegistersModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const baseRoutes = [
  {
    label: "Home",
    icon: Home,
    href: "/",
    color: "from-blue-500 to-indigo-500",
  },
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    color: "from-blue-500 to-cyan-500",
  },
  {
    label: "Reports",
    icon: FileSpreadsheet,
    href: "/dashboard/reports",
    color: "from-emerald-500 to-teal-500",
  },
  {
    label: "Bill Register",
    icon: List,
    href: "/dashboard/bills",
    color: "from-fuchsia-500 to-pink-500",
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/dashboard/settings",
    color: "from-orange-500 to-amber-500",
  },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { registers, activeRegister, setActiveRegister, createRegister } = useRegisters();

  const [isRegistersOpen, setIsRegistersOpen] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCombineOpen, setIsCombineOpen] = useState(false);

  // Form states for new register
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [customName, setCustomName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await createRegister(month, year, customName);
    setIsSubmitting(false);
    if (success) {
      setIsCreateOpen(false);
      setCustomName("");
      // Navigate to entries page with the new register
      router.push("/dashboard/entries");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Locked":
        return <Lock className="h-3 w-3 text-amber-500" />;
      case "Archived":
        return <Archive className="h-3 w-3 text-slate-500" />;
      default:
        return <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />;
    }
  };

  return (
    <div className="space-y-4 py-8 flex flex-col h-full bg-transparent text-slate-800 dark:text-slate-100">
      <div className="px-6 flex-1 flex flex-col h-full">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 mb-12 group pl-2">
          <img src="/icon.png" alt="HemTej Co Logo" className="w-12 h-12 object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-110" />
          <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-purple-700 dark:from-blue-400 dark:to-purple-400">
            HemTej Co
          </h1>
        </Link>

        {/* Navigation Items */}
        <div className="space-y-2 flex-1 overflow-y-auto pr-1">
          {/* Home and Dashboard */}
          {baseRoutes.slice(0, 2).map((route) => {
            const isActive = pathname === route.href;
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
                      layoutId="active-nav-bg"
                      className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent dark:from-blue-500/20"
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

          {/* Courier Registers (Collapsible Dropdown) */}
          <div className="mb-1">
            <div
              onClick={() => {
                setIsRegistersOpen(!isRegistersOpen);
                router.push("/dashboard/entries");
              }}
              className={cn(
                "group flex p-3 w-full justify-between items-center font-medium cursor-pointer rounded-xl transition-all duration-300 text-slate-500 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-white/5",
                pathname.startsWith("/dashboard/entries") && "bg-white/40 dark:bg-white/5 text-slate-900 dark:text-white"
              )}
            >
              <div className="flex items-center">
                <div className={cn(
                  "p-1.5 rounded-lg mr-3 transition-colors duration-300 bg-transparent group-hover:bg-white dark:group-hover:bg-slate-800",
                  pathname.startsWith("/dashboard/entries") && "bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md group-hover:bg-none"
                )}>
                  <TableProperties className={cn("h-4 w-4", pathname.startsWith("/dashboard/entries") ? "text-white" : "text-current")} />
                </div>
                <span>Courier Registers</span>
              </div>
              <div className="flex items-center gap-1">
                {isRegistersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </div>

            <AnimatePresence initial={false}>
              {isRegistersOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden pl-4 pr-1 mt-1 space-y-1"
                >
                  {/* Registers List */}
                  <div className="max-h-48 overflow-y-auto space-y-0.5 border-l border-slate-200 dark:border-slate-800 pl-2">
                    {registers.length === 0 ? (
                      <div className="text-xs text-slate-400 dark:text-slate-500 py-2 pl-2 italic">
                        No registers found
                      </div>
                    ) : (
                      registers.map((reg) => {
                        const isRegActive = activeRegister?.id === reg.id && pathname.startsWith("/dashboard/entries");
                        return (
                          <div
                            key={reg.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRegister(reg);
                              router.push(`/dashboard/entries?registerId=${reg.id}`);
                            }}
                            className={cn(
                              "flex items-center justify-between px-2.5 py-1.5 w-full rounded-md text-xs font-medium cursor-pointer transition-all",
                              isRegActive
                                ? "bg-purple-100/60 dark:bg-purple-950/30 text-purple-950 dark:text-purple-200 font-semibold border-l-4 border-purple-500 rounded-l-none pl-1.5"
                                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-900/60"
                            )}
                          >
                            <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                              <FolderClosed className={cn("h-3 w-3 shrink-0", isRegActive ? "text-purple-600" : "text-slate-400")} />
                              <span className="truncate">{reg.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <span className="text-[10px] opacity-75 font-normal">{reg.entryCount}</span>
                              {getStatusIcon(reg.status)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* New Register Button */}
                  <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800/80 mt-1 space-y-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCreateOpen(true);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 w-full text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20 rounded-lg transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>New Register</span>
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCombineOpen(true);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 w-full text-xs font-semibold text-yellow-600 dark:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-950/20 rounded-lg transition-all"
                    >
                      <Merge className="h-3.5 w-3.5" />
                      <span>Combine Registers</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Reports and Settings */}
          {baseRoutes.slice(2).map((route) => {
            const isActive = pathname === route.href;
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
                      layoutId="active-nav-bg"
                      className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent dark:from-blue-500/20"
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
        </div>
      </div>

      {/* New Register Dialog Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px] border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-[#0f172a]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Create New Register
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRegisterSubmit} className="space-y-4 py-4">
            {/* Month Selection */}
            <div className="flex flex-col gap-2">
              <label htmlFor="month-select" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Select Month
              </label>
              <select
                id="month-select"
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                className="flex h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-900/50"
              >
                <option value={1}>January</option>
                <option value={2}>February</option>
                <option value={3}>March</option>
                <option value={4}>April</option>
                <option value={5}>May</option>
                <option value={6}>June</option>
                <option value={7}>July</option>
                <option value={8}>August</option>
                <option value={9}>September</option>
                <option value={10}>October</option>
                <option value={11}>November</option>
                <option value={12}>December</option>
              </select>
            </div>

            {/* Year Input */}
            <div className="flex flex-col gap-2">
              <label htmlFor="year-input" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Year
              </label>
              <input
                id="year-input"
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="flex h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-900/50"
                required
              />
            </div>

            {/* Custom Name */}
            <div className="flex flex-col gap-2">
              <label htmlFor="name-input" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Register Name (Optional)
              </label>
              <input
                id="name-input"
                type="text"
                placeholder="e.g. July 2026 Special"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="flex h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-900/50"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Leave blank to automatically name it (e.g. &quot;July 2026&quot;)
              </span>
            </div>

            {/* Form actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-900">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-purple-500/20"
              >
                {isSubmitting ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Combine Registers Modal */}
      <CombineRegistersModal 
        isOpen={isCombineOpen} 
        onClose={() => setIsCombineOpen(false)} 
      />
    </div>
  );
};
