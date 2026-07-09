"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef, startTransition, memo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { MobileEntryForm } from "@/components/MobileEntryForm";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  List, Trash2, Calendar, Loader2, FolderOpen, Plus, ArrowLeft, ArrowRight,
  AlertCircle, RefreshCw, X, HelpCircle, CheckCircle, Lock, Archive,
  TrendingUp, Coins, FileText, Settings2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getAutocompleteData } from "@/lib/autocomplete";
import { formatWeight } from "@/lib/utils";
import { useRegisters, Register } from "@/context/RegisterContext";

// Status Colors
const registerStatusColors: Record<string, string> = {
  Active: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-450",
  Locked: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:bg-amber-500/20 dark:text-amber-450",
  Archived: "bg-slate-500/10 text-slate-500 ring-slate-500/20 dark:bg-slate-800/40 dark:text-slate-400",
};

// ── Default Date Modal (Mobile Only) ──────────────────────────────────────
function DefaultDateModal({
  open,
  onClose,
  currentDefault,
  onApply,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  currentDefault: string | null;
  onApply: (date: string) => void;
  onReset: () => void;
}) {
  const [date, setDate] = useState(currentDefault || new Date().toISOString().split("T")[0]);

  useEffect(() => {
    if (open) setDate(currentDefault || new Date().toISOString().split("T")[0]);
  }, [open, currentDefault]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative z-10 w-full max-w-sm rounded-[28px] bg-slate-900 border border-white/10 shadow-2xl p-6 space-y-6 text-white"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Set Default Date</h2>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-400">
            Pick a date for all new entries
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-12 bg-slate-800 border border-white/10 rounded-xl text-sm focus:ring-blue-500 text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={onReset}
            className="h-12 rounded-xl border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
          >
            Reset
          </Button>
          <Button
            onClick={() => onApply(date)}
            className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            Apply Default
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Create Register Modal ──────────────────────────────────────
function CreateRegisterModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (month: number, year: number, name?: string) => Promise<boolean>;
}) {
  const currentYear = new Date().getFullYear();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);
  const [customNameEdited, setCustomNameEdited] = useState(false);

  useEffect(() => {
    if (!customNameEdited) {
      const monthLabel = months.find((m) => m.value === month)?.label || "";
      setName(`${monthLabel} ${year}`);
    }
  }, [month, year, customNameEdited]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative z-10 w-full max-w-md rounded-[28px] bg-slate-900 border border-white/10 shadow-2xl p-6 space-y-6 text-white"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <Plus className="h-5 w-5 text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Create New Register</h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 font-sans">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full h-11 px-3 bg-slate-800 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value} className="bg-slate-900 text-white">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 font-sans">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full h-11 px-3 bg-slate-800 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {years.map((y) => (
                  <option key={y} value={y} className="bg-slate-900 text-white">
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 font-sans">Register Name</label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setCustomNameEdited(true);
              }}
              placeholder="e.g. July 2026"
              className="h-11 bg-slate-800 border border-white/10 rounded-xl text-sm focus:ring-blue-500 text-white"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-11 rounded-xl border-slate-700 bg-transparent text-slate-300 hover:bg-slate-850"
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              setIsSubmitting(true);
              const success = await onCreate(month, year, name);
              setIsSubmitting(false);
              if (success) {
                onClose();
              }
            }}
            disabled={isSubmitting}
            className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold min-w-[100px]"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Inner Page Content Component ──────────────────────────────────────────
function CourierEntryPageInner() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const registerId = searchParams.get("registerId");
  const pageParam = searchParams.get("page");
  const currentPage = pageParam ? parseInt(pageParam, 10) : 1;

  const {
    registers,
    activeRegister,
    setActiveRegister,
    isLoading: isRegistersLoading,
    refreshRegisters,
    createRegister,
    updateRegisterStatus,
    deleteRegister,
  } = useRegisters();

  const [entries, setEntries] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [autocompleteData, setAutocompleteData] = useState<{
    fromParties: string[];
    toParties: string[];
    destinations: string[];
  }>({ fromParties: [], toParties: [], destinations: [] });

  const [mobileDefaultDate, setMobileDefaultDate] = useState<string | null>(null);
  const [defaultDateModalOpen, setDefaultDateModalOpen] = useState(false);
  const [createRegisterOpen, setCreateRegisterOpen] = useState(false);
  const [hasOrphans, setHasOrphans] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Sync registerId from searchParams to context
  useEffect(() => {
    if (registerId) {
      const matched = registers.find((r) => r.id === registerId);
      if (matched) {
        setActiveRegister(matched);
      }
    } else {
      setActiveRegister(null);
    }
  }, [registerId, registers, setActiveRegister]);

  // Check for orphan (register-less) legacy entries
  useEffect(() => {
    if (!registerId) {
      const checkOrphans = async () => {
        try {
          const res = await fetch("/api/couriers?registerId=null&limit=1");
          if (res.ok) {
            const json = await res.json();
            const list = Array.isArray(json) ? json : (json.data || []);
            setHasOrphans(list.length > 0);
          }
        } catch (e) {
          console.error(e);
        }
      };
      checkOrphans();
    }
  }, [registerId, registers]);

  // Fetch entries for active register
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({ limit: "50", page: currentPage.toString() });
    if (registerId) {
      params.append("registerId", registerId);
    }

    const [entRes, acData] = await Promise.all([
      fetch(`/api/couriers?${params.toString()}`),
      getAutocompleteData(),
    ]);

    if (entRes.ok) {
      const json = await entRes.json();
      setEntries(Array.isArray(json) ? json : (json.data || []));
      setTotalCount(json.total || (Array.isArray(json) ? json.length : 0));
    }

    setAutocompleteData(acData);
    setIsLoading(false);
  }, [registerId, currentPage]);

  useEffect(() => {
    if (registerId) {
      fetchData();
    } else {
      setEntries([]);
      setTotalCount(0);
      setIsLoading(false);
    }
  }, [registerId, fetchData]);

  const visibleData = useMemo(() => entries, [entries]);
  const existingChallans = entries.map((e: any) => String(e.challanNo));

  const handleMigrate = async () => {
    if (!confirm("This will organize all legacy entries into monthly registers based on their dates. Proceed?")) return;
    setIsMigrating(true);
    try {
      const res = await fetch("/api/registers/migrate", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Migration completed successfully!");
        setHasOrphans(false);
        await refreshRegisters();
      } else {
        toast.error(data.error || "Failed to migrate legacy entries.");
      }
    } catch (e) {
      toast.error("Network error during migration.");
    } finally {
      setIsMigrating(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: "Active" | "Locked" | "Archived") => {
    const success = await updateRegisterStatus(id, newStatus);
    if (success) {
      refreshRegisters();
    }
  };

  const handleDeleteRegister = async (reg: Register) => {
    const warningText = reg.entryCount > 0
      ? `Delete register "${reg.name}"? WARNING: This will also permanently delete all ${reg.entryCount} courier entries inside it!`
      : `Delete register "${reg.name}"?`;

    if (!confirm(warningText)) return;
    const success = await deleteRegister(reg.id);
    if (success) {
      if (registerId === reg.id) {
        router.push("/dashboard/entries");
      }
      refreshRegisters();
    }
  };

  // Render register dashboard
  if (!registerId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Registers Dashboard</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage your monthly courier journals and entry books.
            </p>
          </div>
          <Button
            onClick={() => setCreateRegisterOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 font-semibold gap-1.5 h-11"
          >
            <Plus className="h-5 w-5" /> Create Register
          </Button>
        </div>

        {/* Orphans Warning Banner */}
        {hasOrphans && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div className="flex gap-3">
              <AlertCircle className="h-5.5 w-5.5 text-amber-500 shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-300">Legacy Entries Found</h3>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  There are courier entries that do not belong to any monthly register. You can automatically group them into registers by date.
                </p>
              </div>
            </div>
            <Button
              onClick={handleMigrate}
              disabled={isMigrating}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md h-10 font-semibold text-xs shrink-0 disabled:opacity-50"
            >
              {isMigrating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Organize Entries
            </Button>
          </motion.div>
        )}

        {isRegistersLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 rounded-[20px] bg-slate-100 dark:bg-slate-900/50 animate-pulse border border-slate-200 dark:border-slate-800" />
            ))}
          </div>
        ) : registers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 rounded-3xl bg-slate-500/5 border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-sm gap-2">
            <span className="text-5xl">📂</span>
            <p className="font-medium text-base text-slate-800 dark:text-slate-200">No registers available</p>
            <p className="text-xs text-slate-500">Create a register to begin logging monthly courier data.</p>
            <Button
              onClick={() => setCreateRegisterOpen(true)}
              variant="outline"
              className="mt-2 rounded-xl border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              Get Started
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {/* Create Card Shortcut */}
            <div
              onClick={() => setCreateRegisterOpen(true)}
              className="group cursor-pointer h-48 rounded-[20px] border border-dashed border-slate-300 dark:border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all duration-300 flex flex-col items-center justify-center p-6 gap-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 group-hover:bg-blue-500/10 flex items-center justify-center transition-colors">
                <Plus className="h-6 w-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
              </div>
              <p className="font-semibold text-sm text-slate-600 dark:text-slate-400 group-hover:text-blue-500 transition-colors">
                Add Month Register
              </p>
            </div>

            {/* Folder Cards */}
            {registers.map((reg) => (
              <div
                key={reg.id}
                onClick={() => router.push(`/dashboard/entries?registerId=${reg.id}`)}
                className="group cursor-pointer h-48 rounded-[20px] bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-white/10 hover:border-blue-500/30 hover:shadow-lg shadow-sm hover:-translate-y-1 transition-all duration-300 p-5 flex flex-col justify-between relative overflow-hidden"
              >
                {/* Folder Top Trim color indicator */}
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 group-hover:from-blue-500/50 group-hover:to-purple-500/50 transition-all" />

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                      <FolderOpen className="h-5.5 w-5.5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors line-clamp-1">{reg.name}</h3>
                      <p className="text-[10px] text-slate-450 uppercase tracking-wider font-sans mt-0.5">
                        {new Date(reg.year, reg.month - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <select
                    value={reg.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleStatusChange(reg.id, e.target.value as any)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full outline-none border-none cursor-pointer select-none appearance-none transition-colors ${registerStatusColors[reg.status]}`}
                  >
                    <option value="Active">Active</option>
                    <option value="Locked">Locked</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>

                {/* Statistics counts inside card */}
                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-slate-400 font-medium">Entries</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      {reg.entryCount}
                    </p>
                  </div>
                  <div className="space-y-0.5 col-span-2">
                    <p className="text-[10px] text-slate-400 font-medium">Total Amount</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-slate-400" />
                      ₹{reg.totalAmount.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                {/* Card footer delete option */}
                <div className="flex justify-end pt-2 border-t border-slate-100/50 dark:border-slate-800/40">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRegister(reg);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                    title="Delete Register"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <CreateRegisterModal
          open={createRegisterOpen}
          onClose={() => setCreateRegisterOpen(false)}
          onCreate={createRegister}
        />
      </div>
    );
  }

  // Active register view
  if (!activeRegister) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const isReadOnly = activeRegister.status === "Locked" || activeRegister.status === "Archived";

  return (
    <>
      <DefaultDateModal
        open={defaultDateModalOpen}
        onClose={() => setDefaultDateModalOpen(false)}
        currentDefault={mobileDefaultDate}
        onApply={(d) => {
          setMobileDefaultDate(d);
          setDefaultDateModalOpen(false);
          toast.success(`Default date set to ${d}`);
        }}
        onReset={() => {
          setMobileDefaultDate(null);
          setDefaultDateModalOpen(false);
          toast.info("Default date cleared");
        }}
      />

      <div className="h-full flex flex-col overflow-hidden space-y-2">
        {/* Mobile only compact header */}
        {isMobile && (
          <div className="flex items-center justify-between p-3 bg-white/40 dark:bg-slate-900/40 border border-white/50 dark:border-white/10 rounded-2xl backdrop-blur-xl">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {activeRegister.name}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDefaultDateModalOpen(true)}
              className="rounded-xl border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 gap-1.5 h-9 font-semibold text-xs transition-all active:scale-95"
            >
              <Calendar className="h-3.5 w-3.5" />
              {mobileDefaultDate ? mobileDefaultDate : "Default Date"}
            </Button>
          </div>
        )}

        {/* SCROLLABLE TABLE AREA */}
        {!isMobile && (
          <div className="flex-1 flex flex-col min-h-0">
            <DataTable
              columns={columns}
              data={visibleData}
              totalCount={totalCount}
              pageIndex={currentPage - 1}
              pageSize={50}
              onExportExcel={() => window.open(`/api/couriers/export?registerId=${registerId}`)}
              activeRegister={activeRegister}
            />
          </div>
        )}

        {/* Mobile: card list + floating form */}
        {isMobile && (
          <div className="flex-1 overflow-y-auto space-y-3 pb-24">
            {isLoading && entries.length === 0 ? (
              <div className="flex flex-col gap-3 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse h-36 w-full border border-slate-200 dark:border-slate-800" />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-sm gap-2">
                <span className="text-4xl">📦</span>
                <p className="font-semibold text-base text-slate-800 dark:text-slate-200">No entries in register</p>
                <p className="text-xs text-slate-500">Tap the + button below to log your first entry.</p>
              </div>
            ) : (
              visibleData.map((entry: any) => (
                <MobileEntryCard key={entry.id} entry={entry} />
              ))
            )}
          </div>
        )}

        {/* Mobile FAB + form */}
        {isMobile && (
          <MobileEntryForm
            existingChallans={existingChallans}
            autocompleteData={autocompleteData}
            activeRegisterId={activeRegister.id}
            isReadOnly={isReadOnly}
            onSaved={(newEntry) => {
              // Trigger reload of active register counts as well
              refreshRegisters();
              startTransition(() => {
                setEntries((prev) => {
                  if (prev.some((e) => e.id === newEntry.id)) return prev;
                  return [newEntry, ...prev].slice(0, 100);
                });
              });
            }}
            mobileDefaultDate={mobileDefaultDate}
          />
        )}
      </div>
    </>
  );
}

// ── Main Page Wrap with Suspense ──────────────────────────────────────────
export default function CourierEntryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <CourierEntryPageInner />
    </Suspense>
  );
}

// ── Mobile entry card (read-only view of saved entries) ──
const MobileEntryCard = memo(function MobileEntryCard({ entry }: { entry: any }) {
  const statusColor: Record<string, string> = {
    Account: "bg-blue-105 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    Cash: "bg-green-105 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-sm hover:shadow-md transition-all p-4 space-y-3 relative overflow-hidden"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20" />
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">#{entry.srNo}</span>
          <span className="font-bold text-slate-900 dark:text-white text-sm">CH-{entry.challanNo}</span>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusColor[entry.status] ?? "bg-slate-100 text-slate-650"}`}>
          {entry.status}
        </span>
      </div>

      {/* Party info */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-700 dark:text-slate-300">
        <div>
          <p className="text-[10px] text-slate-400">From</p>
          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{entry.fromParty}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400">To</p>
          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{entry.toParty}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400">Destination</p>
          <p className="font-semibold text-slate-800 dark:text-slate-100">{entry.destination}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400">Weight</p>
          <p className="font-semibold text-slate-800 dark:text-slate-100">{formatWeight(entry.weightValue, entry.weightUnit)}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
        <span className="text-[10px] text-slate-400">
          {new Date(entry.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          {" · "}{entry.mode}
        </span>
        <span className="font-extrabold text-slate-900 dark:text-white text-sm">
          {entry.amount ? `₹${Number(entry.amount).toLocaleString("en-IN")}` : "-"}
        </span>
      </div>
    </motion.div>
  );
});
