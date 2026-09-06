"use client";

import { UserButton } from "./UserButton";
import { ThemeToggle } from "./ThemeToggle";
import { Menu, PanelLeftClose, PanelLeftOpen, Trash2, AlertTriangle, ChevronLeft, ChevronRight, FolderClosed } from "lucide-react";
import { Button } from "./ui/button";
import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Input } from "./ui/input";
import { useRegisters } from "@/context/RegisterContext";

// ── Inline lightweight modal for Delete All ─────────────────────────────────
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
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
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

interface NavbarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

function NavbarInner({ onToggleSidebar, isSidebarOpen }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const registerId = searchParams.get("registerId");

  const { activeRegister, updateRegisterStatus, deleteRegister, filterMetrics } = useRegisters();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const pageParam = searchParams.get("page");
  const rawPage = pageParam ? parseInt(pageParam, 10) : 1;
  const currentPage = filterMetrics ? filterMetrics.currentPage : rawPage;
  const entryCount = activeRegister?.entryCount ?? 0;
  const totalPages = filterMetrics ? filterMetrics.totalPages : Math.max(1, Math.ceil(entryCount / 50));

  const handlePageChange = (newPage: number) => {
    if (filterMetrics?.onPageChange) {
      filterMetrics.onPageChange(newPage);
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleDeleteAll = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/couriers/delete-all", { method: "DELETE" });
      if (res.ok) {
        setDeleteOpen(false);
        toast.success("All entries deleted successfully.");
        window.location.reload();
      } else {
        toast.error("Failed to delete entries.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteRegister = async () => {
    if (!activeRegister) return;
    if (confirm(`Are you sure you want to delete register "${activeRegister.name}" and all its entries? This action cannot be undone.`)) {
      const ok = await deleteRegister(activeRegister.id);
      if (ok) {
        router.push("/dashboard/entries");
      }
    }
  };

  const isRegisterView = pathname === "/dashboard/entries" && registerId && activeRegister;

  return (
    <>
      <DeleteAllModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteAll}
        loading={deleteLoading}
      />
      <div className="flex items-center justify-between py-2 px-3 md:px-6 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] h-14 w-full gap-4">
        <div className="flex items-center gap-2 min-w-0">
          {/* Sidebar toggle — visible on desktop */}
          {onToggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              className="hidden md:flex text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors shrink-0 h-9 w-9"
              title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Mobile-only hamburger */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="md:hidden text-slate-700 dark:text-slate-300 h-9 w-9 shrink-0"
          >
            <Menu className="h-4 w-4" />
          </Button>

          {/* Breadcrumbs for Active Register */}
          {isRegisterView ? (
            <div className="flex items-center gap-1.5 text-xs md:text-sm font-semibold text-slate-500 dark:text-slate-400 min-w-0">
              <button
                onClick={() => router.push("/dashboard/entries")}
                className="hidden sm:inline hover:text-purple-600 dark:hover:text-purple-400 transition-colors shrink-0"
              >
                Registers
              </button>
              <ChevronRight className="hidden sm:inline h-3.5 w-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
              <div className="flex items-center gap-1.5 text-slate-900 dark:text-slate-100 font-bold min-w-0">
                <FolderClosed className="h-4 w-4 text-purple-650 dark:text-purple-400 shrink-0" />
                <span className="truncate max-w-[80px] sm:max-w-none">{activeRegister.name}</span>
              </div>
              <select
                value={activeRegister.status}
                onChange={(e) => updateRegisterStatus(activeRegister.id, e.target.value as any)}
                className={`text-[10px] font-bold px-2 py-0.5 ml-1.5 rounded-full outline-none border cursor-pointer appearance-none transition-colors ${
                  activeRegister.status === "Active"
                    ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                    : activeRegister.status === "Locked"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-slate-500/10 text-slate-650 dark:text-slate-400 border-slate-500/20"
                }`}
              >
                <option value="Active" className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white">Active</option>
                <option value="Locked" className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white">Locked</option>
                <option value="Archived" className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white">Archived</option>
              </select>
            </div>
          ) : (
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {pathname === "/dashboard"
                ? "Dashboard"
                : pathname === "/dashboard/entries"
                ? "Courier Registers"
                : pathname === "/dashboard/reports"
                ? "Reports"
                : pathname === "/dashboard/bills"
                ? "Bill Register"
                : pathname === "/dashboard/all-entries"
                ? "All Entries"
                : "Courier Management"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-auto">
          {/* Stats & Pagination in Navbar */}
          {isRegisterView && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-3 py-1 rounded-full">
                <span>
                  Entries{" "}
                  {filterMetrics?.isFiltered ? (
                    <strong className="text-blue-600 dark:text-blue-400 font-bold">
                      {filterMetrics.filteredCount}{" "}
                      <span className="text-slate-400 font-normal">/ {filterMetrics.totalCount}</span>
                    </strong>
                  ) : (
                    <strong className="text-slate-800 dark:text-slate-200">{activeRegister.entryCount ?? 0}</strong>
                  )}
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span>Pending <strong className="text-slate-800 dark:text-slate-200">{activeRegister.pendingCount ?? 0}</strong></span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span>Amount <strong className="text-slate-800 dark:text-slate-200">₹{(activeRegister.totalAmount ?? 0).toLocaleString("en-IN")}</strong></span>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-1.5 py-0.5 rounded-full">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="h-5 w-5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-350 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="px-1 select-none whitespace-nowrap">
                  <span className="hidden sm:inline">Page </span>
                  <strong>{currentPage}</strong>
                  <span className="hidden sm:inline mx-1">of</span>
                  <span className="inline sm:hidden mx-0.5">/</span>
                  <strong>{totalPages}</strong>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={currentPage >= totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="h-5 w-5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-350 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Delete Register trigger */}
          {isRegisterView && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteRegister}
              className="hidden sm:flex h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-500/10 shrink-0"
              title="Delete Register"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          <ThemeToggle />
          <UserButton />
        </div>
      </div>
    </>
  );
}

export const Navbar = (props: NavbarProps) => {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-between py-2 px-3 md:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] h-14 w-full" />
    }>
      <NavbarInner {...props} />
    </Suspense>
  );
};
