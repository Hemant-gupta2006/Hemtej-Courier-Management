"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  History,
  Search,
  Eye,
  RefreshCw,
  Clock,
  User,
  ShieldCheck,
  Tag,
  AlertTriangle,
  Download,
  Calendar,
  Globe,
  Terminal
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { parseActivityMeta } from "@/lib/activityLogClient";
import { toast } from "sonner";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filterUsers, setFilterUsers] = useState<any[]>([]);
  const [filterActions, setFilterActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Dialog State
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search
      });

      if (userFilter !== "all") params.append("adminId", userFilter);
      if (actionFilter !== "all") params.append("action", actionFilter);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const resJson = await res.json();
      if (resJson.success) {
        setLogs(resJson.data.logs || []);
        setFilterUsers(resJson.data.filterUsers || []);
        setFilterActions(resJson.data.filterActions || []);
        setTotalCount(resJson.data.pagination.total || 0);
      } else {
        setError(resJson.error || "Failed to load audit logs");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to administrative server");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, userFilter, actionFilter, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(totalCount / limit);

  // Reset Filters
  const handleClearFilters = () => {
    setSearch("");
    setUserFilter("all");
    setActionFilter("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({
        search,
        limit: "10000" // high limit
      });

      if (userFilter !== "all") params.append("adminId", userFilter);
      if (actionFilter !== "all") params.append("action", actionFilter);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const resJson = await res.json();
      if (!resJson.success) {
        toast.error("Failed to load audit logs for CSV export");
        return;
      }

      const rawLogs = resJson.data.logs || [];
      if (rawLogs.length === 0) {
        toast.warning("No records found to export");
        return;
      }

      // Format CSV
      const headers = ["Timestamp", "Admin Name", "Role", "IP Address", "Browser", "Action", "Entity", "Entity ID", "Original Value", "New Value"];
      const rows = rawLogs.map((log: any) => {
        const meta = parseActivityMeta(log);
        return [
          new Date(log.timestamp).toLocaleString("en-IN"),
          log.adminName,
          meta.role,
          meta.ip,
          meta.browser,
          log.action,
          log.entity,
          log.entityId,
          meta.oldValue ? meta.oldValue.replace(/"/g, '""') : "",
          meta.newValue ? meta.newValue.replace(/"/g, '""') : ""
        ];
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r: any) => r.map((val: any) => `"${val}"`).join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Audit_Trail_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Successfully exported ${rawLogs.length} activity records.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export logs");
    }
  };

  // Parse and display oldValue vs newValue safely
  const renderValueDiff = (log: any) => {
    if (!log) return null;
    const meta = parseActivityMeta(log);

    let oldObj: any = null;
    let newObj: any = null;

    try { oldObj = JSON.parse(meta.oldValue || "{}"); } catch { oldObj = meta.oldValue; }
    try { newObj = JSON.parse(meta.newValue || "{}"); } catch { newObj = meta.newValue; }

    return (
      <div className="space-y-4 text-xs font-mono">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Previous State</p>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-60 max-w-full">
              {oldObj && Object.keys(oldObj).length > 0 ? (
                <pre className="text-slate-800 dark:text-slate-200">{JSON.stringify(oldObj, null, 2)}</pre>
              ) : (
                <span className="italic text-slate-400">NULL (Record Created / Simple Event)</span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Updated/New State</p>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-60 max-w-full">
              {newObj && Object.keys(newObj).length > 0 ? (
                <pre className="text-slate-850 dark:text-slate-150">{JSON.stringify(newObj, null, 2)}</pre>
              ) : (
                <span className="italic text-red-500">NULL (Record Deleted)</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("CREATE")) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400";
    if (action.includes("EDIT") || action.includes("UPDATE")) return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-450";
    if (action.includes("DELETE")) return "bg-rose-100 text-rose-800 dark:bg-rose-900/20 dark:text-rose-450";
    if (action.includes("DOWNLOAD") || action.includes("EXPORT")) return "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400";
    return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">Audit Trail</h2>
          <p className="text-muted-foreground mt-1">
            Secure administrative ledger recording user logins, exports, downloads, and operational database changes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="rounded-xl w-fit border-slate-200 dark:border-slate-800">
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs} className="rounded-xl w-fit">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh Logs
          </Button>
        </div>
      </div>

      {/* Sleek Filters Panel */}
      <Card className="border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Search Input */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search description, entity target, ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10 rounded-xl bg-white/80 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800"
              />
            </div>

            {/* User Select */}
            <div>
              <select
                value={userFilter}
                onChange={(e) => {
                  setUserFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none"
              >
                <option value="all">All Administrators</option>
                {filterUsers.map((u) => (
                  <option key={u.adminId} value={u.adminId}>
                    {u.adminName}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Select */}
            <div>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none"
              >
                <option value="all">All Actions</option>
                {filterActions.map((act) => (
                  <option key={act} value={act}>
                    {act.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Button */}
            <div>
              <Button onClick={handleClearFilters} variant="ghost" className="w-full h-10 rounded-xl border border-dashed border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800">
                Reset Filters
              </Button>
            </div>
          </div>

          {/* Date Picker Range */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100 dark:border-slate-850">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">Date Range:</span>
            </div>
            <div className="flex items-center gap-2 flex-1 sm:max-w-md">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl h-9 text-xs bg-white/80 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800"
              />
              <span className="text-xs text-slate-400">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl h-9 text-xs bg-white/80 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card className="border-white/20 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-md rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto min-w-full">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 font-semibold uppercase text-[11px] border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Entity Target</th>
                <th className="px-6 py-4">Client Access</th>
                <th className="px-6 py-4 text-center">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {loading ? (
                [...Array(10)].map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-28 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-8 w-20 bg-slate-100 dark:bg-slate-800 rounded mx-auto" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 dark:text-slate-500 italic">
                    No matching audit trail logs found. Try resetting the filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const meta = parseActivityMeta(log);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {new Date(log.timestamp).toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                            {log.adminName}
                          </p>
                          <span className="text-[9px] font-bold text-slate-450 dark:text-slate-450">
                            {meta.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${getActionBadgeColor(log.action)}`}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5 max-w-[200px] truncate">
                          <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                            {log.entity}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
                            ID: {log.entityId}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-350">
                            <Globe className="h-3 w-3 text-slate-450" /> {meta.ip}
                          </div>
                          <div className="flex items-center gap-1">
                            <Terminal className="h-3 w-3 text-slate-450" /> {meta.browser}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold"
                        >
                          <Eye className="h-4 w-4 mr-1.5" /> View Diff
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-855 text-xs">
            <div className="text-slate-500">
              Showing Page <span className="font-semibold">{page}</span> of{" "}
              <span className="font-semibold">{totalPages}</span> ({totalCount} total records)
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

      {/* DIFF MODAL */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="sm:max-w-4xl border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#0f172a] p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
              <History className="h-5 w-5 text-red-500 mr-2" /> Audit Log Change Details
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Detailed payload audit comparison showing modification history.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 pt-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-semibold bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-450 uppercase">Administrator</span>
                  <p className="text-slate-900 dark:text-white font-bold">{selectedLog.adminName}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-450 uppercase">IP Address</span>
                  <p className="text-slate-900 dark:text-white font-bold">{parseActivityMeta(selectedLog).ip}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-450 uppercase">Target Entity</span>
                  <p className="text-slate-900 dark:text-white font-bold">{selectedLog.entity}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-450 uppercase">Timestamp</span>
                  <p className="text-slate-900 dark:text-white font-bold">
                    {new Date(selectedLog.timestamp).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              {renderValueDiff(selectedLog)}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setSelectedLog(null)} className="rounded-xl w-full sm:w-auto px-6">
              Close Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
