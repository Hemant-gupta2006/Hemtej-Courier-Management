"use client";

import { DataTable } from "./data-table";
import { columns } from "./columns";
import { MobileEntryForm } from "@/components/MobileEntryForm";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { List, Trash2, AlertTriangle, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Inline lightweight modal ──────────────────────────────────────────────
function DeleteAllModal({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTyped("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-white/20 dark:border-white/10 shadow-2xl p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Delete All Data?
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              This action <strong>cannot be undone</strong>. This will
              permanently delete <strong>all</strong> courier entries from the
              database.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
          </label>
          <Input
            ref={inputRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETE"
            className="font-mono border-red-300 dark:border-red-700 focus-visible:ring-red-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="outline" onClick={onClose} disabled={loading} className="rounded-xl">
            Cancel
          </Button>
          <Button
            disabled={typed !== "DELETE" || loading}
            onClick={onConfirm}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            {loading ? "Deleting…" : "Yes, Delete All"}
          </Button>
        </div>
      </div>
    </div>
  );
}

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
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative z-10 w-full max-w-sm rounded-[28px] bg-white dark:bg-slate-900 border border-white/20 dark:border-white/10 shadow-2xl p-6 space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Set Default Date
          </h2>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Pick a date for all new entries
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-12 text-base rounded-xl border-slate-200 dark:border-slate-700 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={onReset}
            className="h-12 rounded-xl border-slate-200 dark:border-slate-700 font-semibold"
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

// ── Page ──────────────────────────────────────────────────────────────────
export default function CourierEntryPage() {
  const isMobile = useIsMobile();
  const router = useRouter();

  const [entries, setEntries] = useState<any[]>([]);
  const [autocompleteData, setAutocompleteData] = useState<{
    fromParties: string[];
    toParties: string[];
    destinations: string[];
  }>({ fromParties: [], toParties: [], destinations: [] });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [mobileDefaultDate, setMobileDefaultDate] = useState<string | null>(null);
  const [defaultDateModalOpen, setDefaultDateModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const [entRes, acRes] = await Promise.all([
      fetch("/api/couriers"),
      fetch("/api/couriers/autocomplete"),
    ]);
    if (entRes.ok) setEntries(await entRes.json());
    if (acRes.ok) setAutocompleteData(await acRes.json());
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Only show latest 20 rows to keep typing ultra-fast.
  // API returns desc order so data[0] is already the newest.
  const visibleData = useMemo(() => entries.slice(0, 20), [entries]);

  const existingChallans = entries.map((e: any) => String(e.challanNo));

  const handleDeleteAll = useCallback(async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/couriers/delete-all", { method: "DELETE" });
      if (res.ok) {
        setEntries([]);
        setDeleteOpen(false);
        toast.success("All entries deleted successfully.");
      } else {
        toast.error("Failed to delete entries.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setDeleteLoading(false);
    }
  }, []);

  return (
    <>
      <DeleteAllModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteAll}
        loading={deleteLoading}
      />

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

      <div className="h-full flex flex-col overflow-hidden">
        {/* FIXED TOP AREA */}
        <div className="flex-shrink-0 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Courier Entries</h2>
              <p className="text-muted-foreground text-sm">
                {isMobile
                  ? "Tap + to add a new entry."
                  : "Manage courier shipments. Click a cell to edit."}
              </p>
            </div>

            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDefaultDateModalOpen(true)}
                className="md:hidden rounded-xl border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 gap-1.5 h-9 font-semibold text-xs transition-all active:scale-95"
              >
                <Calendar className="h-3.5 w-3.5" />
                {mobileDefaultDate ? mobileDefaultDate : "Set Default Date"}
              </Button>
            )}

            {!isMobile && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push("/dashboard/all-entries")}
                  className="rounded-xl border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 gap-2"
                >
                  <List className="h-4 w-4" />
                  Show All Entries
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDeleteOpen(true)}
                  className="rounded-xl border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete All
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* SCROLLABLE TABLE AREA */}
        {!isMobile && (
          <div className="flex-1 overflow-hidden mt-4">
            <div className="h-full overflow-auto will-change-transform">
              <div className="w-full overflow-x-auto pb-4">
                <DataTable columns={columns} data={visibleData} />
              </div>
            </div>
          </div>
        )}

        {/* Footer: subtle info + show-all link */}
        {!isMobile && (
          <div className="flex-shrink-0 flex justify-between items-center text-xs text-slate-400 dark:text-slate-500 mt-2">
            <span>
              {entries.length > 20
                ? `Showing latest 20 of ${entries.length} entries for faster typing`
                : `${entries.length} entries`}
            </span>
            {entries.length > 20 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard/all-entries")}
                className="rounded-xl text-xs h-7 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400"
              >
                Show All Entries →
              </Button>
            )}
          </div>
        )}

        {/* Mobile: card list + floating form */}
        {isMobile && (
          <div className="flex-1 overflow-y-auto space-y-3 pb-24 mt-4">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-400 text-sm gap-2">
                <span className="text-4xl">📦</span>
                <p className="font-medium text-base">No entries yet</p>
                <p>Tap the + button below to add your first entry.</p>
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
            onSaved={fetchData}
            mobileDefaultDate={mobileDefaultDate}
          />
        )}
      </div>
    </>
  );
}

// ── Mobile entry card (read-only view of saved entries) ──
function MobileEntryCard({ entry }: { entry: any }) {
  const statusColor: Record<string, string> = {
    Cash: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    Account: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    Pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    Delivered: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  };

  const fmt = (w: string) => {
    const g = parseFloat(w);
    return isNaN(g) ? w : g >= 1000 ? `${g / 1000}kg` : `${g}g`;
  };

  return (
    <div className="rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-sm p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">#{entry.srNo}</span>
          <span className="font-bold text-slate-900 dark:text-white text-sm">CH-{entry.challanNo}</span>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor[entry.status] ?? "bg-slate-100 text-slate-600"}`}>
          {entry.status}
        </span>
      </div>

      {/* Party info */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div>
          <p className="text-xs text-slate-400">From</p>
          <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{entry.fromParty}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">To</p>
          <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{entry.toParty}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Destination</p>
          <p className="font-medium text-slate-800 dark:text-slate-100">{entry.destination}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Weight</p>
          <p className="font-medium text-slate-800 dark:text-slate-100">{fmt(entry.weight)}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
        <span className="text-xs text-slate-400">
          {new Date(entry.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          {" · "}{entry.mode}
        </span>
        <span className="font-bold text-slate-900 dark:text-white">
          {entry.amount ? `₹${Number(entry.amount).toLocaleString("en-IN")}` : "-"}
        </span>
      </div>
    </div>
  );
}
