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
  TrendingUp, Coins, FileText, Settings2, Pencil, Download, SlidersHorizontal, Search
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { getAutocompleteData } from "@/lib/autocomplete";
import { formatWeight } from "@/lib/utils";
import { useRegisters, Register } from "@/context/RegisterContext";
import { RegisterFilterPopover, RegisterFilters, DEFAULT_REGISTER_FILTERS, FilterOptions } from "@/components/RegisterFilterPopover";
import { MobileSortPopover } from "@/components/MobileSortPopover";

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

// ── Professional Delete Entry Warning Modal ────────────────────────────────
function DeleteConfirmModal({
  open,
  entry,
  onClose,
  onConfirm,
  isDeleting,
}: {
  open: boolean;
  entry: any | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  if (!open || !entry) return null;

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
        className="relative z-10 w-full max-w-sm rounded-[28px] bg-slate-900 border border-white/10 shadow-2xl p-6 space-y-5 text-white"
      >
        {/* Header Icon + Title */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center shrink-0">
            <Trash2 className="h-5.5 w-5.5 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Delete Entry?</h2>
            <p className="text-xs text-slate-400">This action cannot be undone.</p>
          </div>
        </div>

        {/* Entry Card Preview */}
        <div className="rounded-xl bg-slate-800/80 border border-slate-700/60 p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-400">Entry:</span>
            <span className="font-bold text-white">#{entry.srNo} (CH-{entry.challanNo})</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-400">From / To:</span>
            <span className="font-medium text-slate-200 truncate max-w-[180px]">
              {entry.fromParty} → {entry.toParty}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-400">Amount:</span>
            <span className="font-bold text-emerald-400">
              {entry.amount ? `₹${Number(entry.amount).toLocaleString("en-IN")}` : "-"}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="h-11 rounded-xl border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold gap-2 shadow-lg shadow-red-600/20"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {isDeleting ? "Deleting..." : "Delete"}
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

  const {
    registers,
    activeRegister,
    setActiveRegister,
    isLoading: isRegistersLoading,
    refreshRegisters,
    createRegister,
    updateRegisterStatus,
    deleteRegister,
    setFilterMetrics,
  } = useRegisters();

  const [entries, setEntries] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [autocompleteData, setAutocompleteData] = useState<{
    fromParties: string[];
    toParties: string[];
    destinations: string[];
  }>({ fromParties: [], toParties: [], destinations: [] });

  // ── Pipeline State: Search, Filter, Sort, Pagination ──
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<RegisterFilters>(DEFAULT_REGISTER_FILTERS);
  const [sorting, setSorting] = useState<{ column: string; direction: "asc" | "desc" | null }>({
    column: "srNo",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(pageParam ? parseInt(pageParam, 10) : 1);

  // Sync currentPage from URL query parameter
  useEffect(() => {
    if (pageParam) {
      setCurrentPage(parseInt(pageParam, 10));
    } else {
      setCurrentPage(1);
    }
  }, [pageParam]);

  // Reset pipeline on register switch (Register Isolation)
  useEffect(() => {
    setSearchQuery("");
    setFilters(DEFAULT_REGISTER_FILTERS);
    setSorting({ column: "srNo", direction: "desc" });
    setCurrentPage(1);
  }, [registerId]);

  // Sync page changes to URL
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.replace(`/dashboard/entries?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  // Handlers that reset page to 1
  const handleSearchChange = useCallback((val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  }, []);

  const handleFiltersChange = useCallback((newFilters: RegisterFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  }, []);

  const handleToggleSort = useCallback((columnId: string) => {
    setSorting((prev) => {
      if (prev.column !== columnId) {
        return { column: columnId, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { column: columnId, direction: "desc" };
      }
      // Third click: Default / unsorted
      return { column: "srNo", direction: "desc" };
    });
    setCurrentPage(1);
  }, []);

  const handleResetSort = useCallback(() => {
    setSorting({ column: "srNo", direction: "desc" });
    setCurrentPage(1);
  }, []);

  // Update canonical entries on row save/delete
  const handleEntrySaved = useCallback((savedEntry: any, isEdit: boolean) => {
    setEntries((prev) => {
      if (isEdit) {
        return prev.map((e) => (e.id === savedEntry.id ? { ...e, ...savedEntry } : e));
      } else {
        if (prev.some((e) => e.id === savedEntry.id)) return prev;
        return [savedEntry, ...prev];
      }
    });
    refreshRegisters();
  }, [refreshRegisters]);

  const handleEntryDeleted = useCallback((deletedId: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== deletedId));
    refreshRegisters();
  }, [refreshRegisters]);

  const [mobileDefaultDate, setMobileDefaultDate] = useState<string | null>(null);
  const [defaultDateModalOpen, setDefaultDateModalOpen] = useState(false);
  const [createRegisterOpen, setCreateRegisterOpen] = useState(false);
  const [hasOrphans, setHasOrphans] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Edit & Delete entry states
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDeleteEntry = async () => {
    if (!deletingEntry) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/couriers/${deletingEntry.id}`, {
        method: "DELETE",
      });
      const resJson = await res.json().catch(() => null);

      if (res.ok && resJson?.success !== false) {
        toast.success(`Entry deleted successfully`);
        setEntries((prev) => prev.filter((e) => e.id !== deletingEntry.id));
        setDeletingEntry(null);
        refreshRegisters();
      } else {
        const errMessage = resJson?.error || "Failed to delete entry";
        toast.error(errMessage);
      }
    } catch (err) {
      console.error("Delete entry error:", err);
      toast.error("Network error while deleting entry");
    } finally {
      setIsDeleting(false);
    }
  };

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

  // Fetch ALL entries for active register
  const fetchData = useCallback(async () => {
    if (!registerId) return;
    setIsLoading(true);
    const params = new URLSearchParams({ registerId, limit: "all" });

    const [entRes, acData] = await Promise.all([
      fetch(`/api/couriers?${params.toString()}`),
      getAutocompleteData(),
    ]);

    if (entRes.ok) {
      const json = await entRes.json();
      const list = Array.isArray(json) ? json : (json.data || []);
      setEntries(list);
      setTotalCount(json.total || list.length);
    }

    setAutocompleteData(acData);
    setIsLoading(false);
  }, [registerId]);

  useEffect(() => {
    if (registerId) {
      fetchData();
    } else {
      setEntries([]);
      setTotalCount(0);
      setIsLoading(false);
    }
  }, [registerId, fetchData]);

  // ── Dynamic Filter Options from Current Register ──
  const filterOptions: FilterOptions = useMemo(() => {
    const fromMap = new Map<string, number>();
    const toMap = new Map<string, number>();
    const destMap = new Map<string, number>();
    const statusMap = new Map<string, number>();
    const modeMap = new Map<string, number>();

    entries.forEach((e) => {
      if (e.fromParty?.trim()) {
        const p = e.fromParty.trim();
        fromMap.set(p, (fromMap.get(p) || 0) + 1);
      }
      if (e.toParty?.trim()) {
        const p = e.toParty.trim();
        toMap.set(p, (toMap.get(p) || 0) + 1);
      }
      if (e.destination?.trim()) {
        const d = e.destination.trim();
        destMap.set(d, (destMap.get(d) || 0) + 1);
      }
      if (e.status?.trim()) {
        const s = e.status.trim();
        statusMap.set(s, (statusMap.get(s) || 0) + 1);
      }
      if (e.mode?.trim()) {
        const m = e.mode.trim();
        modeMap.set(m, (modeMap.get(m) || 0) + 1);
      }
    });

    const toList = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return {
      fromParties: toList(fromMap),
      toParties: toList(toMap),
      destinations: toList(destMap),
      statuses: toList(statusMap),
      modes: toList(modeMap),
    };
  }, [entries]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.dateType === "exact" && filters.exactDate) count++;
    if (filters.dateType === "range" && (filters.startDate || filters.endDate)) count++;
    count += filters.fromParties.length;
    count += filters.toParties.length;
    count += filters.destinations.length;
    count += filters.statuses.length;
    count += filters.modes.length;
    return count;
  }, [filters]);

  // ── Step 1: Search Pipeline across ALL Register Entries ──
  const searchedData = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.trim().toLowerCase();

    return entries.filter((row) => {
      if (String(row.challanNo ?? "").toLowerCase().includes(q)) return true;
      if (String(row.fromParty ?? "").toLowerCase().includes(q)) return true;
      if (String(row.toParty ?? "").toLowerCase().includes(q)) return true;
      if (String(row.destination ?? "").toLowerCase().includes(q)) return true;
      if (String(row.status ?? "").toLowerCase().includes(q)) return true;
      if (String(row.mode ?? "").toLowerCase().includes(q)) return true;
      if (String(row.amount ?? "").toLowerCase().includes(q)) return true;
      if (String(row.srNo ?? "").toLowerCase().includes(q)) return true;
      const weightStr = `${row.weightValue ?? ""} ${row.weightUnit ?? ""}`.toLowerCase();
      if (weightStr.includes(q)) return true;

      if (row.date) {
        const dateObj = new Date(row.date);
        const isoDate = dateObj.toISOString().split("T")[0];
        if (isoDate.includes(q)) return true;
        const d = String(dateObj.getDate()).padStart(2, "0");
        const m = String(dateObj.getMonth() + 1).padStart(2, "0");
        const y = dateObj.getFullYear();
        const ddmmyyyyDash = `${d}-${m}-${y}`;
        const ddmmyyyySlash = `${d}/${m}/${y}`;
        if (ddmmyyyyDash.includes(q) || ddmmyyyySlash.includes(q)) return true;
      }

      return false;
    });
  }, [entries, searchQuery]);

  // ── Step 2: Multi-Criteria Filter Pipeline (AND Logic) ──
  const filteredData = useMemo(() => {
    return searchedData.filter((row) => {
      if (filters.fromParties.length > 0 && !filters.fromParties.includes(row.fromParty)) {
        return false;
      }
      if (filters.toParties.length > 0 && !filters.toParties.includes(row.toParty)) {
        return false;
      }
      if (filters.destinations.length > 0 && !filters.destinations.includes(row.destination)) {
        return false;
      }
      if (filters.statuses.length > 0 && !filters.statuses.includes(row.status)) {
        return false;
      }
      if (filters.modes.length > 0 && !filters.modes.includes(row.mode)) {
        return false;
      }

      if (filters.dateType === "exact" && filters.exactDate) {
        if (!row.date) return false;
        const rowDateStr = new Date(row.date).toISOString().split("T")[0];
        if (rowDateStr !== filters.exactDate) return false;
      } else if (filters.dateType === "range") {
        if (!row.date) return false;
        const rowDateStr = new Date(row.date).toISOString().split("T")[0];
        if (filters.startDate && rowDateStr < filters.startDate) return false;
        if (filters.endDate && rowDateStr > filters.endDate) return false;
      }

      return true;
    });
  }, [searchedData, filters]);

  // ── Step 3: Type-Aware Sorting ──
  const normalizeWeight = (val: number | string | undefined | null, unit: string | undefined | null): number => {
    const num = Number(val) || 0;
    const u = (unit || "gm").toLowerCase();
    if (u === "kg") return num * 1000;
    return num;
  };

  const sortedData = useMemo(() => {
    if (!sorting.column || !sorting.direction) {
      return [...filteredData].sort((a, b) => (Number(b.srNo) || 0) - (Number(a.srNo) || 0));
    }

    const { column, direction } = sorting;
    const dir = direction === "asc" ? 1 : -1;

    return [...filteredData].sort((a, b) => {
      const valA = a[column];
      const valB = b[column];

      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      if (column === "date") {
        const timeA = new Date(valA).getTime() || 0;
        const timeB = new Date(valB).getTime() || 0;
        return (timeA - timeB) * dir;
      }

      if (column === "challanNo" || column === "srNo" || column === "amount") {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return (numA - numB) * dir;
      }

      if (column === "weightValue") {
        const wA = normalizeWeight(a.weightValue, a.weightUnit);
        const wB = normalizeWeight(b.weightValue, b.weightUnit);
        return (wA - wB) * dir;
      }

      return String(valA).localeCompare(String(valB), undefined, { sensitivity: "base" }) * dir;
    });
  }, [filteredData, sorting]);

  // ── Step 4: Pagination Pipeline ──
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const maxRegisterSrNo = useMemo(() => {
    let max = 0;
    for (const e of entries) {
      const s = Number(e.srNo);
      if (!isNaN(s) && s > max) max = s;
    }
    return max;
  }, [entries]);

  // ── Sync Filter Metrics with Navbar / RegisterContext ──
  useEffect(() => {
    const isFiltered = searchQuery.trim().length > 0 || activeFilterCount > 0;
    setFilterMetrics({
      filteredCount: sortedData.length,
      totalCount: entries.length,
      currentPage,
      totalPages,
      isFiltered,
      onPageChange: (newPage: number) => {
        handlePageChange(newPage);
      },
    });
    return () => {
      setFilterMetrics(null);
    };
  }, [sortedData.length, entries.length, currentPage, totalPages, searchQuery, activeFilterCount, setFilterMetrics, handlePageChange]);

  // ── Step 5: Filter-Aware Export (Exports exact sortedData) ──
  const handleExportExcel = useCallback(() => {
    if (sortedData.length === 0) {
      toast.error("No entries to export with current filters.");
      return;
    }
    const exportRows = sortedData.map((r, i) => ({
      "Sr.No": i + 1,
      Date: r.date ? new Date(r.date).toISOString().split("T")[0] : "",
      "Challan No": r.challanNo,
      "From Party": r.fromParty,
      "To Party": r.toParty,
      Weight: `${r.weightValue} ${r.weightUnit}`,
      Destination: r.destination,
      Amount: r.amount,
      Status: r.status,
      Mode: r.mode,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Courier Entries");
    const regName = (activeRegister?.name || "Register").replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `${regName}_Export_${dateStr}.xlsx`);
    toast.success(`Exported ${sortedData.length} entries to Excel`);
  }, [sortedData, activeRegister]);

  const visibleData = paginatedData;
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

      <DeleteConfirmModal
        open={Boolean(deletingEntry)}
        entry={deletingEntry}
        onClose={() => setDeletingEntry(null)}
        onConfirm={confirmDeleteEntry}
        isDeleting={isDeleting}
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
              totalCount={entries.length}
              filteredCount={sortedData.length}
              pageIndex={currentPage - 1}
              pageSize={50}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              searchValue={searchQuery}
              onSearchChange={handleSearchChange}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              filterOptions={filterOptions}
              activeFilterCount={activeFilterCount}
              currentSort={sorting}
              onToggleSort={handleToggleSort}
              onExportExcel={handleExportExcel}
              activeRegister={activeRegister}
              maxRegisterSrNo={maxRegisterSrNo}
              onEntrySaved={handleEntrySaved}
              onEntryDeleted={handleEntryDeleted}
            />
          </div>
        )}

        {/* Mobile: card list + floating form */}
        {isMobile && (
          <div className="flex-1 overflow-y-auto space-y-3 pb-28">
            {/* Mobile Search & Filter Toolbar */}
            <div className="space-y-2">
              {/* Row 1: Full-width search bar */}
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search all entries in this register..."
                  className="h-10 pl-9 pr-9 text-xs rounded-xl bg-white/50 dark:bg-slate-900/50 border-white/50 dark:border-white/10 shadow-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearchChange("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                    title="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Row 2: Action Controls: Filters, Sort, Export */}
              <div className="flex items-center gap-2">
                <RegisterFilterPopover
                  filters={filters}
                  onChange={handleFiltersChange}
                  options={filterOptions}
                  activeCount={activeFilterCount}
                />

                <MobileSortPopover
                  currentSort={sorting}
                  onToggleSort={handleToggleSort}
                  onResetSort={handleResetSort}
                />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  title="Export filtered entries"
                  className="h-9 px-3 rounded-xl border-white/50 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 text-xs font-semibold text-slate-700 dark:text-slate-300 gap-1.5 ml-auto shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export</span>
                </Button>
              </div>

              {/* Mobile Active Filter Chips */}
              {(activeFilterCount > 0 || Boolean(searchQuery.trim())) && (
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-900/60 rounded-xl border border-white/10 text-xs">
                  <span className="text-[11px] font-semibold text-slate-400 mr-1">Active:</span>

                  {searchQuery.trim() && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/15 border border-blue-500/30 text-blue-300 rounded-full text-[10px] font-medium">
                      <span>"{searchQuery}"</span>
                      <button onClick={() => handleSearchChange("")} className="hover:text-white p-0.5"><X className="w-2.5 h-2.5" /></button>
                    </div>
                  )}

                  {filters.dateType === "exact" && filters.exactDate && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/15 border border-blue-500/30 text-blue-300 rounded-full text-[10px] font-medium">
                      <span>Date: {filters.exactDate}</span>
                      <button onClick={() => handleFiltersChange({ ...filters, dateType: "all", exactDate: "" })} className="hover:text-white p-0.5"><X className="w-2.5 h-2.5" /></button>
                    </div>
                  )}

                  {filters.dateType === "range" && (filters.startDate || filters.endDate) && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/15 border border-blue-500/30 text-blue-300 rounded-full text-[10px] font-medium">
                      <span>{filters.startDate || "Start"} to {filters.endDate || "End"}</span>
                      <button onClick={() => handleFiltersChange({ ...filters, dateType: "all", startDate: "", endDate: "" })} className="hover:text-white p-0.5"><X className="w-2.5 h-2.5" /></button>
                    </div>
                  )}

                  {filters.fromParties.map((p) => (
                    <div key={`mob-from-${p}`} className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/15 border border-purple-500/30 text-purple-300 rounded-full text-[10px] font-medium">
                      <span>From: {p}</span>
                      <button onClick={() => handleFiltersChange({ ...filters, fromParties: filters.fromParties.filter(i => i !== p) })} className="hover:text-white p-0.5"><X className="w-2.5 h-2.5" /></button>
                    </div>
                  ))}

                  {filters.toParties.map((p) => (
                    <div key={`mob-to-${p}`} className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/15 border border-purple-500/30 text-purple-300 rounded-full text-[10px] font-medium">
                      <span>To: {p}</span>
                      <button onClick={() => handleFiltersChange({ ...filters, toParties: filters.toParties.filter(i => i !== p) })} className="hover:text-white p-0.5"><X className="w-2.5 h-2.5" /></button>
                    </div>
                  ))}

                  {filters.destinations.map((d) => (
                    <div key={`mob-dest-${d}`} className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-full text-[10px] font-medium">
                      <span>Dest: {d}</span>
                      <button onClick={() => handleFiltersChange({ ...filters, destinations: filters.destinations.filter(i => i !== d) })} className="hover:text-white p-0.5"><X className="w-2.5 h-2.5" /></button>
                    </div>
                  ))}

                  {filters.statuses.map((s) => (
                    <div key={`mob-st-${s}`} className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-full text-[10px] font-medium">
                      <span>Status: {s}</span>
                      <button onClick={() => handleFiltersChange({ ...filters, statuses: filters.statuses.filter(i => i !== s) })} className="hover:text-white p-0.5"><X className="w-2.5 h-2.5" /></button>
                    </div>
                  ))}

                  {filters.modes.map((m) => (
                    <div key={`mob-m-${m}`} className="flex items-center gap-1 px-2 py-0.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 rounded-full text-[10px] font-medium">
                      <span>Mode: {m}</span>
                      <button onClick={() => handleFiltersChange({ ...filters, modes: filters.modes.filter(i => i !== m) })} className="hover:text-white p-0.5"><X className="w-2.5 h-2.5" /></button>
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      handleSearchChange("");
                      handleFiltersChange(DEFAULT_REGISTER_FILTERS);
                    }}
                    className="text-[10px] font-semibold text-red-400 hover:text-red-300 hover:underline px-1 py-0.5 ml-auto"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {isLoading && entries.length === 0 ? (
              <div className="flex flex-col gap-3 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse h-36 w-full border border-slate-200 dark:border-slate-800" />
                ))}
              </div>
            ) : paginatedData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-sm gap-2">
                <span className="text-4xl">🔍</span>
                <p className="font-semibold text-base text-slate-800 dark:text-slate-200">
                  {entries.length === 0 ? "No entries in register" : "No matching entries found"}
                </p>
                <p className="text-xs text-slate-500 text-center max-w-[240px]">
                  {entries.length === 0
                    ? "Tap the + button below to log your first entry."
                    : "Try adjusting your search keywords or clear active filters."}
                </p>
                {entries.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleSearchChange("");
                      handleFiltersChange(DEFAULT_REGISTER_FILTERS);
                    }}
                    className="mt-2 text-xs rounded-xl"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              paginatedData.map((entry: any) => (
                <MobileEntryCard
                  key={entry.id}
                  entry={entry}
                  isReadOnly={isReadOnly}
                  onEdit={(item) => {
                    setEditingEntry(item);
                    setIsFormOpen(true);
                  }}
                  onDelete={(item) => {
                    setDeletingEntry(item);
                  }}
                />
              ))
            )}

            {/* Mobile Pagination Footer */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-white/10 text-xs">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-800 text-xs"
                >
                  Previous
                </Button>
                <div className="text-center font-medium text-slate-600 dark:text-slate-400">
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                  <div className="text-[10px] text-slate-400">
                    {sortedData.length} entries
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-800 text-xs"
                >
                  Next
                </Button>
              </div>
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
            editingEntry={editingEntry}
            isOpen={isFormOpen}
            onOpenChange={(val) => {
              setIsFormOpen(val);
              if (!val) setEditingEntry(null);
            }}
            onSaved={(savedEntry, isEdit) => {
              handleEntrySaved(savedEntry, isEdit);
              setIsFormOpen(false);
              setEditingEntry(null);
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
const MobileEntryCard = memo(function MobileEntryCard({
  entry,
  onEdit,
  onDelete,
  isReadOnly = false,
}: {
  entry: any;
  onEdit?: (entry: any) => void;
  onDelete?: (entry: any) => void;
  isReadOnly?: boolean;
}) {
  const statusColor: Record<string, string> = {
    Account: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    Cash: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
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

        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusColor[entry.status] ?? "bg-slate-100 text-slate-650"}`}>
            {entry.status}
          </span>
          {!isReadOnly && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(entry);
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:bg-red-500/20 transition-all active:scale-90"
              title="Delete Entry"
              aria-label="Delete entry"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content + Edit button aligned on right side */}
      <div className="flex items-center justify-between gap-3">
        {/* Party info grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-700 dark:text-slate-300 flex-1">
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

        {/* Edit Button positioned on right side where arrow points */}
        {!isReadOnly && (
          <div className="shrink-0 self-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(entry);
              }}
              className="p-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 dark:bg-blue-400/10 dark:hover:bg-blue-400/20 border border-blue-500/20 transition-all active:scale-90 flex items-center justify-center"
              title="Edit Entry"
              aria-label="Edit entry"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        )}
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
