"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Package,
  Search,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  Trash2,
  Edit,
  Eye,
  MoreVertical,
  Check,
  Download,
  AlertTriangle,
  X,
  RefreshCw,
  Plus,
  Settings2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatWeight, cn } from "@/lib/utils";
import * as XLSX from "xlsx";

const STATUS_OPTIONS = [
  "Pending",
  "Picked Up",
  "In Transit",
  "Out for Delivery",
  "Delivered",
  "Cancelled"
];

const MODE_OPTIONS = ["Surface", "Air", "Cargo", "V Fast"];

function AdminCouriersPageContent() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter");

  // Query States
  const [couriers, setCouriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  useEffect(() => {
    if (filterParam === "today") {
      const todayStr = new Date().toISOString().split("T")[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (filterParam === "month") {
      const now = new Date();
      const startOfMonthStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const todayStr = now.toISOString().split("T")[0];
      setStartDate(startOfMonthStr);
      setEndDate(todayStr);
    }
  }, [filterParam]);

  // Selection States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Column Visibility
  const [visibleColumns, setVisibleColumns] = useState({
    id: false,
    date: true,
    challanNo: true,
    fromParty: true,
    toParty: true,
    destination: true,
    weight: true,
    amount: true,
    status: true,
    mode: true,
    user: true,
    actions: true
  });

  // Modal States
  const [viewingCourier, setViewingCourier] = useState<any>(null);
  const [editingCourier, setEditingCourier] = useState<any>(null);
  const [deleteConfirmCourier, setDeleteConfirmCourier] = useState<any>(null);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Form Fields for Editing
  const [editForm, setEditForm] = useState({
    date: "",
    challanNo: 0,
    fromParty: "",
    toParty: "",
    weightValue: 0,
    weightUnit: "gm",
    destination: "",
    amount: 0,
    status: "",
    mode: ""
  });

  // Fetch Couriers
  const fetchCouriers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        status: statusFilter,
        startDate,
        endDate,
        sortBy,
        sortOrder
      });

      const res = await fetch(`/api/admin/couriers?${params.toString()}`);
      const resJson = await res.json();
      if (resJson.success) {
        setCouriers(resJson.data.couriers || []);
        setTotalCount(resJson.data.pagination.total || 0);
      } else {
        setError(resJson.error || "Failed to load couriers");
      }
    } catch (err: any) {
      setError(err.message || "Failed to retrieve couriers");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, startDate, endDate, sortBy, sortOrder]);

  useEffect(() => {
    fetchCouriers();
  }, [fetchCouriers]);

  // Sorting Handler
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  // Checkbox Selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(couriers.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  // Inline Actions
  const handleViewDetails = (courier: any) => {
    setViewingCourier(courier);
  };

  const handleStartEdit = (courier: any) => {
    setEditingCourier(courier);
    setEditForm({
      date: new Date(courier.date).toISOString().split("T")[0],
      challanNo: courier.challanNo,
      fromParty: courier.fromParty,
      toParty: courier.toParty,
      weightValue: courier.weightValue,
      weightUnit: courier.weightUnit,
      destination: courier.destination,
      amount: courier.amount,
      status: courier.status,
      mode: courier.mode || "Surface"
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourier) return;

    try {
      const res = await fetch(`/api/admin/couriers/${editingCourier.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });
      const resJson = await res.json();
      if (resJson.success) {
        toast.success("Courier updated successfully");
        setEditingCourier(null);
        fetchCouriers();
      } else {
        toast.error(resJson.error || "Failed to update courier");
      }
    } catch {
      toast.error("Failed to connect to administrative server");
    }
  };

  const handleDeleteCourier = async () => {
    if (!deleteConfirmCourier) return;

    try {
      const res = await fetch(`/api/admin/couriers/${deleteConfirmCourier.id}`, {
        method: "DELETE"
      });
      const resJson = await res.json();
      if (resJson.success) {
        toast.success("Courier deleted successfully");
        setDeleteConfirmCourier(null);
        setSelectedIds((prev) => prev.filter((id) => id !== deleteConfirmCourier.id));
        fetchCouriers();
      } else {
        toast.error(resJson.error || "Failed to delete courier");
      }
    } catch {
      toast.error("Failed to delete courier");
    }
  };

  // Bulk Actions
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await fetch("/api/admin/couriers/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action: "delete" })
      });
      const resJson = await res.json();
      if (resJson.success) {
        toast.success(`Successfully deleted ${resJson.data.count} entries`);
        setSelectedIds([]);
        setBulkDeleteOpen(false);
        fetchCouriers();
      } else {
        toast.error(resJson.error || "Failed to bulk delete");
      }
    } catch {
      toast.error("Failed to run bulk delete operations");
    }
  };

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedIds.length === 0) return;
    try {
      const res = await fetch("/api/admin/couriers/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action: "updateStatus", status })
      });
      const resJson = await res.json();
      if (resJson.success) {
        toast.success(`Successfully updated status for ${resJson.data.count} entries`);
        setSelectedIds([]);
        setBulkStatusOpen(false);
        fetchCouriers();
      } else {
        toast.error(resJson.error || "Failed to update bulk status");
      }
    } catch {
      toast.error("Failed to run bulk status operations");
    }
  };

  // Local Excel Export
  const handleExportSelected = () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one courier to export");
      return;
    }

    const selectedCouriers = couriers.filter((c) => selectedIds.includes(c.id));
    const tableData = selectedCouriers.map((row, index) => ({
      "Sr.No": index + 1,
      "Courier ID": row.id,
      "Date": new Date(row.date).toLocaleDateString("en-IN"),
      "Challan No": row.challanNo,
      "From Party": row.fromParty,
      "To Party": row.toParty,
      "Destination": row.destination,
      "Weight": formatWeight(row.weightValue, row.weightUnit),
      "Amount": Number(row.amount) || 0,
      "Status": row.status,
      "Mode": row.mode || "Surface",
      "Created By": row.user?.name || row.user?.email || "Staff"
    }));

    const worksheet = XLSX.utils.json_to_sheet(tableData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Selected Couriers");
    XLSX.writeFile(workbook, `HemTej_Couriers_Selection_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Selection exported to Excel file");
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">Courier Records</h2>
          <p className="text-muted-foreground mt-1">
            Browse and manage all shipments registered across the entire system.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchCouriers()} className="rounded-xl">
            <RefreshCw className="h-4 w-4 mr-2" /> Reload
          </Button>
        </div>
      </div>

      {/* Toolbar & Filters Card */}
      <Card className="border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search ID, Challan, Party Name, Destination..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10 rounded-xl bg-white/80 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800"
              />
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-48">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/40 text-sm focus:outline-none"
              >
                <option value="all">All Statuses</option>
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Column Visibility and Export */}
            <div className="flex gap-2">
              {/* Column Select */}
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center justify-center font-medium border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white rounded-xl h-10 px-4 text-sm cursor-pointer outline-none transition-colors">
                  <Settings2 className="h-4 w-4 mr-2" /> Columns
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {Object.keys(visibleColumns).map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col}
                      checked={visibleColumns[col as keyof typeof visibleColumns]}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({ ...prev, [col]: checked }))
                      }
                      className="capitalize"
                    >
                      {col.replace(/([A-Z])/g, " $1")}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Date range filters */}
          <div className="flex flex-wrap gap-3 items-center text-sm">
            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-lg w-36 py-0 text-xs border-slate-200 dark:border-slate-800"
              />
              <span className="text-slate-400">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-lg w-36 py-0 text-xs border-slate-200 dark:border-slate-800"
              />
            </div>
            {(startDate || endDate || statusFilter !== "all" || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setStatusFilter("all");
                  setSearch("");
                  setPage(1);
                }}
                className="h-7 text-xs text-red-500 hover:text-red-600 rounded-lg"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Controls */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl animate-in fade-in slide-in-from-top-2">
          <span className="text-xs font-semibold text-red-900 dark:text-red-300">
            {selectedIds.length} items selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSelected}
              className="h-8 text-xs rounded-lg"
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Export Excel
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center font-medium border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white rounded-lg h-8 px-3 text-xs cursor-pointer outline-none transition-colors">
                Change Status
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {STATUS_OPTIONS.map((st) => (
                  <DropdownMenuItem key={st} onClick={() => handleBulkStatusUpdate(st)}>
                    {st}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              className="h-8 text-xs rounded-lg bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* Main Grid Table Card */}
      <Card className="border-white/20 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-md rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto min-w-full">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 font-semibold uppercase text-[11px] border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === couriers.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-500 h-4 w-4 cursor-pointer"
                  />
                </th>
                {visibleColumns.id && <th className="px-6 py-4">ID</th>}
                {visibleColumns.date && (
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-850" onClick={() => handleSort("date")}>
                    Date {sortBy === "date" && (sortOrder === "asc" ? <ChevronUp className="inline h-3.5 w-3.5 ml-1" /> : <ChevronDown className="inline h-3.5 w-3.5 ml-1" />)}
                  </th>
                )}
                {visibleColumns.challanNo && (
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-850" onClick={() => handleSort("challanNo")}>
                    Challan No {sortBy === "challanNo" && (sortOrder === "asc" ? <ChevronUp className="inline h-3.5 w-3.5 ml-1" /> : <ChevronDown className="inline h-3.5 w-3.5 ml-1" />)}
                  </th>
                )}
                {visibleColumns.fromParty && (
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-850" onClick={() => handleSort("fromParty")}>
                    From Party {sortBy === "fromParty" && (sortOrder === "asc" ? <ChevronUp className="inline h-3.5 w-3.5 ml-1" /> : <ChevronDown className="inline h-3.5 w-3.5 ml-1" />)}
                  </th>
                )}
                {visibleColumns.toParty && (
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-850" onClick={() => handleSort("toParty")}>
                    To Party {sortBy === "toParty" && (sortOrder === "asc" ? <ChevronUp className="inline h-3.5 w-3.5 ml-1" /> : <ChevronDown className="inline h-3.5 w-3.5 ml-1" />)}
                  </th>
                )}
                {visibleColumns.destination && <th className="px-6 py-4">Destination</th>}
                {visibleColumns.weight && <th className="px-6 py-4 text-right">Weight</th>}
                {visibleColumns.amount && (
                  <th className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-850" onClick={() => handleSort("amount")}>
                    Amount {sortBy === "amount" && (sortOrder === "asc" ? <ChevronUp className="inline h-3.5 w-3.5 ml-1" /> : <ChevronDown className="inline h-3.5 w-3.5 ml-1" />)}
                  </th>
                )}
                {visibleColumns.status && <th className="px-6 py-4">Status</th>}
                {visibleColumns.mode && <th className="px-6 py-4">Mode</th>}
                {visibleColumns.user && <th className="px-6 py-4">Created By</th>}
                {visibleColumns.actions && <th className="px-6 py-4 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {loading ? (
                [...Array(limit)].map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-4 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                    {visibleColumns.id && <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded" /></td>}
                    {visibleColumns.date && <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded" /></td>}
                    {visibleColumns.challanNo && <td className="px-6 py-4"><div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 rounded" /></td>}
                    {visibleColumns.fromParty && <td className="px-6 py-4"><div className="h-4 w-28 bg-slate-100 dark:bg-slate-800 rounded" /></td>}
                    {visibleColumns.toParty && <td className="px-6 py-4"><div className="h-4 w-28 bg-slate-100 dark:bg-slate-800 rounded" /></td>}
                    {visibleColumns.destination && <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded" /></td>}
                    {visibleColumns.weight && <td className="px-6 py-4"><div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 rounded ml-auto" /></td>}
                    {visibleColumns.amount && <td className="px-6 py-4"><div className="h-4 w-14 bg-slate-100 dark:bg-slate-800 rounded ml-auto" /></td>}
                    {visibleColumns.status && <td className="px-6 py-4"><div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 rounded" /></td>}
                    {visibleColumns.mode && <td className="px-6 py-4"><div className="h-4 w-14 bg-slate-100 dark:bg-slate-800 rounded" /></td>}
                    {visibleColumns.user && <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded" /></td>}
                    {visibleColumns.actions && <td className="px-6 py-4"><div className="h-8 w-20 bg-slate-100 dark:bg-slate-800 rounded mx-auto" /></td>}
                  </tr>
                ))
              ) : couriers.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-12 text-slate-400 dark:text-slate-500 italic">
                    No courier records found matching the query.
                  </td>
                </tr>
              ) : (
                couriers.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={(e) => handleSelectRow(row.id, e.target.checked)}
                        className="rounded border-slate-300 text-red-600 focus:ring-red-500 h-4 w-4 cursor-pointer"
                      />
                    </td>
                    {visibleColumns.id && (
                      <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {row.id}
                      </td>
                    )}
                    {visibleColumns.date && (
                      <td className="px-6 py-4 font-medium whitespace-nowrap">
                        {new Date(row.date).toLocaleDateString("en-IN")}
                      </td>
                    )}
                    {visibleColumns.challanNo && (
                      <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                        #{row.challanNo}
                      </td>
                    )}
                    {visibleColumns.fromParty && (
                      <td className="px-6 py-4 font-medium truncate max-w-[150px]" title={row.fromParty}>
                        {row.fromParty}
                      </td>
                    )}
                    {visibleColumns.toParty && (
                      <td className="px-6 py-4 font-medium truncate max-w-[150px]" title={row.toParty}>
                        {row.toParty}
                      </td>
                    )}
                    {visibleColumns.destination && (
                      <td className="px-6 py-4 font-medium truncate max-w-[150px]" title={row.destination}>
                        {row.destination}
                      </td>
                    )}
                    {visibleColumns.weight && (
                      <td className="px-6 py-4 text-right font-mono text-xs">
                        {formatWeight(row.weightValue, row.weightUnit)}
                      </td>
                    )}
                    {visibleColumns.amount && (
                      <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                        ₹{row.amount}
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap",
                            row.status === "Delivered" && "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
                            row.status === "Pending" && "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
                            row.status === "In Transit" && "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
                            row.status === "Picked Up" && "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400",
                            row.status === "Out for Delivery" && "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
                            row.status === "Cancelled" && "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                          )}
                        >
                          {row.status}
                        </span>
                      </td>
                    )}
                    {visibleColumns.mode && (
                      <td className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 text-xs">
                        {row.mode || "Surface"}
                      </td>
                    )}
                    {visibleColumns.user && (
                      <td className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {row.user?.name || row.user?.email || "Staff"}
                      </td>
                    )}
                    {visibleColumns.actions && (
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button variant="ghost" size="icon" onClick={() => handleViewDetails(row)} className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800">
                            <Eye className="h-4 w-4 text-slate-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleStartEdit(row)} className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-800">
                            <Edit className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmCourier(row)} className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-850">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-850 text-xs">
            <div className="text-slate-500">
              Showing Page <span className="font-semibold">{page}</span> of{" "}
              <span className="font-semibold">{totalPages}</span> ({totalCount} total entries)
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 px-3 rounded-lg"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 px-3 rounded-lg"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* VIEW MODAL */}
      <Dialog open={!!viewingCourier} onOpenChange={() => setViewingCourier(null)}>
        <DialogContent className="sm:max-w-md border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#0f172a] p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
              <Package className="h-5 w-5 text-red-500 mr-2" /> Shipment Details
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Complete metadata log for tracking information.
            </DialogDescription>
          </DialogHeader>
          {viewingCourier && (
            <div className="space-y-4 py-3 text-sm text-slate-800 dark:text-slate-200">
              <div className="grid grid-cols-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="font-semibold text-slate-400">Courier ID</span>
                <span className="col-span-2 font-mono text-xs truncate select-all">{viewingCourier.id}</span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="font-semibold text-slate-400">Challan No</span>
                <span className="col-span-2 font-bold text-red-600 dark:text-red-400">#{viewingCourier.challanNo}</span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="font-semibold text-slate-400">Booking Date</span>
                <span className="col-span-2">{new Date(viewingCourier.date).toLocaleDateString("en-IN")}</span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="font-semibold text-slate-400">From Party</span>
                <span className="col-span-2 font-medium">{viewingCourier.fromParty}</span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="font-semibold text-slate-400">To Party</span>
                <span className="col-span-2 font-medium">{viewingCourier.toParty}</span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="font-semibold text-slate-400">Destination</span>
                <span className="col-span-2 font-medium">{viewingCourier.destination}</span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="font-semibold text-slate-400">Weight</span>
                <span className="col-span-2 font-mono">{formatWeight(viewingCourier.weightValue, viewingCourier.weightUnit)}</span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="font-semibold text-slate-400">Amount</span>
                <span className="col-span-2 font-bold">₹{viewingCourier.amount}</span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="font-semibold text-slate-400">Delivery Status</span>
                <span className="col-span-2">
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                    {viewingCourier.status}
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                <span className="font-semibold text-slate-400">Transit Mode</span>
                <span className="col-span-2 font-medium">{viewingCourier.mode || "Surface"}</span>
              </div>
              <div className="grid grid-cols-3 py-1.5">
                <span className="font-semibold text-slate-400">Created By</span>
                <span className="col-span-2 text-slate-500 font-semibold">{viewingCourier.user?.name || viewingCourier.user?.email || "Staff"}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewingCourier(null)} className="rounded-xl w-full">
              Close Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={!!editingCourier} onOpenChange={() => setEditingCourier(null)}>
        <DialogContent className="sm:max-w-lg border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#0f172a] p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
              Edit Courier Entry
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Make changes to shipment attributes. This action will log an Audit Entry.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-date" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-challan" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Challan No</Label>
                <Input
                  id="edit-challan"
                  type="number"
                  value={editForm.challanNo}
                  onChange={(e) => setEditForm((f) => ({ ...f, challanNo: parseInt(e.target.value, 10) || 0 }))}
                  required
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-from" className="text-xs font-semibold text-slate-600 dark:text-slate-400">From Party</Label>
                <Input
                  id="edit-from"
                  type="text"
                  value={editForm.fromParty}
                  onChange={(e) => setEditForm((f) => ({ ...f, fromParty: e.target.value }))}
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-to" className="text-xs font-semibold text-slate-600 dark:text-slate-400">To Party</Label>
                <Input
                  id="edit-to"
                  type="text"
                  value={editForm.toParty}
                  onChange={(e) => setEditForm((f) => ({ ...f, toParty: e.target.value }))}
                  required
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-dest" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Destination</Label>
                <Input
                  id="edit-dest"
                  type="text"
                  value={editForm.destination}
                  onChange={(e) => setEditForm((f) => ({ ...f, destination: e.target.value }))}
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-amount" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Amount (₹)</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                  required
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="edit-weight-val" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Weight Value</Label>
                <Input
                  id="edit-weight-val"
                  type="number"
                  step="0.01"
                  value={editForm.weightValue}
                  onChange={(e) => setEditForm((f) => ({ ...f, weightValue: parseFloat(e.target.value) || 0 }))}
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-weight-unit" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Unit</Label>
                <select
                  id="edit-weight-unit"
                  value={editForm.weightUnit}
                  onChange={(e) => setEditForm((f) => ({ ...f, weightUnit: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none"
                >
                  <option value="gm">gm</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-status" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Status</Label>
                <select
                  id="edit-status"
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none"
                >
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-mode" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Mode</Label>
                <select
                  id="edit-mode"
                  value={editForm.mode}
                  onChange={(e) => setEditForm((f) => ({ ...f, mode: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none"
                >
                  {MODE_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setEditingCourier(null)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold px-5">
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM MODAL */}
      <Dialog open={!!deleteConfirmCourier} onOpenChange={() => setDeleteConfirmCourier(null)}>
        <DialogContent className="sm:max-w-md border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#0f172a] p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" /> Delete Courier Entry?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-slate-600 dark:text-slate-400">
            <p>
              Are you sure you want to permanently delete Challan{" "}
              <strong className="text-slate-950 dark:text-white">#{deleteConfirmCourier?.challanNo}</strong>?
            </p>
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">
              This action cannot be undone and will create a permanent Audit Log.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirmCourier(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleDeleteCourier} className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold">
              Yes, Delete Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BULK DELETE CONFIRM MODAL */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="sm:max-w-md border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#0f172a] p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" /> Bulk Delete Entries?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-slate-600 dark:text-slate-400">
            <p>
              Are you sure you want to delete the{" "}
              <strong className="text-slate-950 dark:text-white">{selectedIds.length}</strong> selected courier entries?
            </p>
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">
              This will remove all selected rows permanently and create audit logs for each record.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleBulkDelete} className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold">
              Yes, Delete Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminCouriersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading courier directory...</div>}>
      <AdminCouriersPageContent />
    </Suspense>
  );
}
