"use client";

import { useState, useEffect } from "react";
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
  FileSpreadsheet,
  Download,
  Calendar,
  User,
  CheckCircle,
  FileText,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { formatWeight } from "@/lib/utils";
import * as XLSX from "xlsx";

const REPORT_TYPES = [
  { id: "daily", label: "Daily Report", desc: "Shipments registered on a specific day" },
  { id: "weekly", label: "Weekly Report", desc: "Shipments registered within a 7-day range" },
  { id: "monthly", label: "Monthly Report", desc: "Shipments registered during a full calendar month" },
  { id: "customer", label: "Customer-Wise Report", desc: "Shipments filtered by customer sender/receiver" },
  { id: "delivery", label: "Delivery Status Report", desc: "Shipments filtered by operational status" }
];

const STATUS_OPTIONS = [
  "Pending",
  "Picked Up",
  "In Transit",
  "Out for Delivery",
  "Delivered",
  "Cancelled"
];

export default function AdminReportsPage() {
  const [reportType, setReportType] = useState("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(false);

  // Set default dates based on selection
  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];

    if (reportType === "daily") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (reportType === "weekly") {
      const prevWeek = new Date();
      prevWeek.setDate(prevWeek.getDate() - 7);
      setStartDate(prevWeek.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (reportType === "monthly") {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      setStartDate(startOfMonth.toISOString().split("T")[0]);
      setEndDate(todayStr);
    }
  }, [reportType]);

  const generateReportData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "100000", // Large limit to fetch all matching entries
        startDate,
        endDate
      });

      if (reportType === "customer" && customerName) {
        params.append("customer", customerName);
      }

      if (reportType === "delivery" && status !== "all") {
        params.append("status", status);
      }

      const res = await fetch(`/api/admin/couriers?${params.toString()}`);
      const resJson = await res.json();

      if (!resJson.success) {
        throw new Error(resJson.error || "Failed to query records");
      }

      const rawCouriers = resJson.data.couriers || [];

      if (rawCouriers.length === 0) {
        toast.warning("No entries found matching the selected report criteria.");
        setLoading(false);
        return null;
      }

      return rawCouriers.map((row: any, idx: number) => ({
        "Sr.No": idx + 1,
        "Date": new Date(row.date).toLocaleDateString("en-IN"),
        "Challan No": row.challanNo,
        "From Party": row.fromParty,
        "To Party": row.toParty,
        "Destination": row.destination,
        "Weight": formatWeight(row.weightValue, row.weightUnit),
        "Amount": Number(row.amount) || 0,
        "Status": row.status,
        "Mode": row.mode || "Surface",
        "Created By": row.user?.name || row.user?.email || "Staff",
        "Registered On": new Date(row.createdAt).toLocaleDateString("en-IN")
      }));
    } catch (err: any) {
      toast.error(err.message || "Failed to compile report data");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    const data = await generateReportData();
    if (!data) return;

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `HemTej_Report_${reportType}_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel report downloaded successfully");
  };

  const handleExportCSV = async () => {
    const data = await generateReportData();
    if (!data) return;

    const worksheet = XLSX.utils.json_to_sheet(data);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `HemTej_Report_${reportType}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV report downloaded successfully");
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">Reports Central</h2>
        <p className="text-muted-foreground mt-1">
          Generate, filter, and download spreadsheet reports for analytical records.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Selection side panel */}
        <Card className="md:col-span-1 border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Report Categories</CardTitle>
            <CardDescription>Select the template model to download</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {REPORT_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setReportType(t.id)}
                className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                  reportType === t.id
                    ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-900 dark:text-red-300 font-semibold"
                    : "bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100/50"
                }`}
              >
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <FileText className="h-3.5 w-3.5" /> {t.label}
                </div>
                <div className="opacity-80 leading-normal">{t.desc}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Filter configuration and download panel */}
        <Card className="md:col-span-2 border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Configure Report Parameters</CardTitle>
            <CardDescription>Adjust search constraints and choose download format</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Conditional Date inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Start Date
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-xl bg-white dark:bg-slate-950/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> End Date
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-xl bg-white dark:bg-slate-950/40"
                />
              </div>
            </div>

            {/* Conditional Customer input */}
            {reportType === "customer" && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Customer Name (Sender/Receiver)
                </Label>
                <Input
                  placeholder="e.g. Rahul Sharma"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="rounded-xl bg-white dark:bg-slate-950/40"
                />
              </div>
            )}

            {/* Conditional Status select */}
            {reportType === "delivery" && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> Select Delivery Status
                </Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 text-sm focus:outline-none"
                >
                  <option value="all">All statuses</option>
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row gap-3">
              <Button
                disabled={loading || (reportType === "customer" && !customerName)}
                onClick={handleExportExcel}
                className="rounded-xl flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md shadow-red-500/20"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {loading ? "Compiling..." : "Export to Excel (.xlsx)"}
              </Button>
              <Button
                disabled={loading || (reportType === "customer" && !customerName)}
                variant="outline"
                onClick={handleExportCSV}
                className="rounded-xl flex-1 border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800 font-semibold"
              >
                <Download className="h-4 w-4 mr-2" />
                {loading ? "Compiling..." : "Export to CSV (.csv)"}
              </Button>
            </div>

            {reportType === "customer" && !customerName && (
              <p className="text-[10px] text-amber-600 font-semibold uppercase flex items-center gap-1 mt-1">
                <AlertCircle className="h-3.5 w-3.5" /> Please specify a customer name to compile report
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
