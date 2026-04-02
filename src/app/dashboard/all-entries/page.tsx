"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { DataTable } from "../entries/data-table";
import { columns } from "../entries/columns";

export default function AllEntriesPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 50;

  const [searchValue, setSearchValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    startDate: "",
    endDate: "",
    status: "all"
  });

  const handleApplyFilters = () => {
    setAppliedFilters({
      search: searchValue,
      startDate,
      endDate,
      status: statusFilter
    });
    setPage(1);
  };

  const handleApplyStatusFilter = (status: string) => {
    setStatusFilter(status);
    setAppliedFilters({
      search: searchValue,
      startDate,
      endDate,
      status: status
    });
    setPage(1);
  };

  const handleClearDate = () => {
    setStartDate("");
    setEndDate("");
    setAppliedFilters(prev => ({ ...prev, startDate: "", endDate: "" }));
    setPage(1);
  };

  const handleClearStatus = () => {
    setStatusFilter("all");
    setAppliedFilters(prev => ({ ...prev, status: "all" }));
    setPage(1);
  };

  const handleClearAll = () => {
    setSearchValue("");
    setStartDate("");
    setEndDate("");
    setStatusFilter("all");
    setAppliedFilters({ search: "", startDate: "", endDate: "", status: "all" });
    setPage(1);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (appliedFilters.search) params.append("search", appliedFilters.search);
      if (appliedFilters.startDate) params.append("startDate", appliedFilters.startDate);
      if (appliedFilters.endDate) params.append("endDate", appliedFilters.endDate);
      if (appliedFilters.status && appliedFilters.status !== "all") params.append("status", appliedFilters.status);

      const res = await fetch(`/api/couriers?${params.toString()}`);
      if (res.ok) {
        const result = await res.json();
        if (Array.isArray(result)) {
          // If backend still returns a flat array, slice it here to simulate pagination
          const total = Math.ceil(result.length / limit) || 1;
          const start = (page - 1) * limit;
          setEntries(result.slice(start, start + limit));
          setTotalPages(total);
          setTotalCount(result.length);
        } else {
          // Use real backend pagination if available
          setEntries(result.data || []);
          setTotalPages(result.totalPages || 1);
          setTotalCount(result.total || 0);
        }

      } else {
        const errDetails = await res.json().catch(() => null);
        toast.error(errDetails?.error || "Failed to load entries.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  }, [page, appliedFilters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const memoData = useMemo(() => entries, [entries]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* FIXED HEADER */}
      <div className="flex-shrink-0 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/entries")}
            className="rounded-xl hover:bg-white/40 dark:hover:bg-slate-800/40"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">All Entries</h2>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading…"
                : `${entries.length.toLocaleString()} entries — fully editable, virtualised scrolling`}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-slate-400 text-sm">
          Loading entries…
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-hidden mt-4">
            <div className="h-full overflow-auto will-change-transform">
              <div className="w-full overflow-x-auto pb-4">
                <DataTable 
                  columns={columns} 
                  data={memoData} 
                  totalCount={totalCount}
                  pageIndex={page - 1}
                  pageSize={limit}
                  mode="all"
                  searchValue={searchValue}
                  onSearchChange={setSearchValue}
                  startDate={startDate}
                  onStartDateChange={setStartDate}
                  endDate={endDate}
                  onEndDateChange={setEndDate}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  onApplyFilters={handleApplyFilters}
                  onApplyStatusFilter={handleApplyStatusFilter}
                  appliedFilters={appliedFilters}
                  onClearDate={handleClearDate}
                  onClearStatus={handleClearStatus}
                  onClearAll={handleClearAll}
                  onExportExcel={() => {
                    const params = new URLSearchParams();
                    if (appliedFilters.search) params.append("search", appliedFilters.search);
                    if (appliedFilters.startDate) params.append("startDate", appliedFilters.startDate);
                    if (appliedFilters.endDate) params.append("endDate", appliedFilters.endDate);
                    if (appliedFilters.status && appliedFilters.status !== "all") params.append("status", appliedFilters.status);
                    const a = document.createElement("a");
                    a.href = `/api/couriers/export?${params.toString()}`;
                    a.download = "Couriers_Filtered_Export.xlsx";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 flex justify-between items-center pt-4 pb-2 px-1">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <span className="text-sm font-medium">Page {page} / {totalPages}</span>
            <Button variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
