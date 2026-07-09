"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Package,
  TrendingUp,
  Clock,
  Calendar,
  Users,
  Wallet,
  Activity,
  History,
  AlertTriangle,
  Folder,
  FileText,
  Download,
  ShieldCheck,
  ArrowRight,
  Monitor
} from "lucide-react";
import Link from "next/link";
import { parseActivityMeta } from "@/lib/activityLogClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

const COLORS = ["#10b981", "#3b82f6", "#6366f1", "#f59e0b", "#ef4444"];

export default function AdminDashboardClient() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/admin/overview");
        const resJson = await res.json();
        if (resJson.success) {
          setData(resJson.data);
        } else {
          setError(resJson.error || "Failed to load dashboard statistics");
        }
      } catch (err: any) {
        setError(err.message || "Failed to connect to administrative server");
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-4 w-72 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mt-1" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, idx) => (
            <Card key={idx} className="h-28 animate-pulse bg-slate-100 dark:bg-slate-900 border-none" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-7">
          <Card className="col-span-4 h-96 animate-pulse bg-slate-100 dark:bg-slate-900 border-none" />
          <Card className="col-span-3 h-96 animate-pulse bg-slate-100 dark:bg-slate-900 border-none" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <AlertTriangle className="h-12 w-12 text-red-500 animate-bounce" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Error Loading Stats</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md text-center">{error}</p>
      </div>
    );
  }

  const { metrics, recentAuditLogs, activeUsers } = data || {};

  // Formulate data for Cash vs Account chart
  const revenueChartData = [
    { name: "Cash", value: metrics?.cashAmount || 0 },
    { name: "Account", value: metrics?.accountAmount || 0 }
  ].filter((item) => item.value > 0);

  // Formulate booking metrics chart
  const bookingsBarData = [
    { name: "Today", value: metrics?.todayBookings || 0 },
    { name: "This Month", value: metrics?.monthlyBookings || 0 },
    { name: "Total Entries", value: metrics?.totalCouriers || 0 }
  ];

  // Helper to format activity description
  const getActivityDescription = (log: any) => {
    try {
      const parsed = parseActivityMeta(log);
      let details: any = {};
      try {
        details = JSON.parse(parsed.newValue || parsed.oldValue || "{}");
      } catch {
        // Not JSON
      }

      switch (log.action) {
        case "COURIER_CREATE":
          return `Created courier entry (Challan #${details.challanNo || log.entityId.slice(0, 8)})`;
        case "COURIER_EDIT":
          return `Modified courier details (Challan #${details.challanNo || details.raw ? JSON.parse(details.raw).challanNo : log.entityId.slice(0, 8)})`;
        case "COURIER_DELETE":
          return `Deleted courier entry (ID: ${log.entityId.slice(0, 8)})`;
        case "REGISTER_CREATE":
          return `Created register "${details.name || log.entityId.slice(0, 8)}"`;
        case "REGISTER_DELETE":
          return `Deleted register (ID: ${log.entityId.slice(0, 8)})`;
        case "SETTINGS_UPDATE":
          return "Updated global company settings";
        case "PROFILE_UPDATE":
          return "Updated admin profile details";
        case "PASSWORD_CHANGE":
          return "Changed account security password";
        case "LOGIN":
          return `Logged in from IP ${parsed.ip}`;
        case "LOGOUT":
          return "Logged out from session";
        case "REPORT_EXPORT":
          return `Exported excel report (${details.entriesCount || 0} entries)`;
        case "INVOICE_DOWNLOAD":
          return `Generated billing invoice for "${details.fromParty || 'All'}"`;
        case "MANIFEST_DOWNLOAD":
          return `Generated manifest for date ${details.dateStr || log.entityId}`;
        default:
          return log.action.replace(/_/g, " ").toLowerCase();
      }
    } catch {
      return log.action.replace(/_/g, " ");
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("CREATE")) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-450";
    if (action.includes("EDIT") || action.includes("UPDATE")) return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
    if (action.includes("DELETE")) return "bg-rose-100 text-rose-800 dark:bg-rose-900/20 dark:text-rose-400";
    if (action.includes("DOWNLOAD") || action.includes("EXPORT")) return "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400";
    return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Admin Dashboard
          </h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Operational ledger overview and business metrics for Seetaram Enterprise.
          </p>
        </div>
        <Link
          href="/admin/analytics"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] w-fit"
        >
          View Detailed Analytics <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total Courier Entries */}
        <Link href="/admin/couriers" className="block transition-transform hover:scale-[1.02]">
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/20 dark:border-white/5 shadow-sm h-full hover:bg-white/60 dark:hover:bg-slate-900/60 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Entries</CardTitle>
              <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{metrics?.totalCouriers}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Lifetime courier records</p>
            </CardContent>
          </Card>
        </Link>

        {/* Today's Entries */}
        <Link href="/admin/couriers?filter=today" className="block transition-transform hover:scale-[1.02]">
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/20 dark:border-white/5 shadow-sm h-full hover:bg-white/60 dark:hover:bg-slate-900/60 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Today's Entries</CardTitle>
              <Calendar className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{metrics?.todayBookings}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Entered today</p>
            </CardContent>
          </Card>
        </Link>

        {/* This Month Entries */}
        <Link href="/admin/couriers?filter=month" className="block transition-transform hover:scale-[1.02]">
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/20 dark:border-white/5 shadow-sm h-full hover:bg-white/60 dark:hover:bg-slate-900/60 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{metrics?.monthlyBookings}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Current calendar month</p>
            </CardContent>
          </Card>
        </Link>

        {/* Total Registers */}
        <Link href="/admin/couriers" className="block transition-transform hover:scale-[1.02]">
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/20 dark:border-white/5 shadow-sm h-full hover:bg-white/60 dark:hover:bg-slate-900/60 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Registers</CardTitle>
              <Folder className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{metrics?.totalRegisters}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Monthly batch registers</p>
            </CardContent>
          </Card>
        </Link>

        {/* Total Customers */}
        <Link href="/admin/customers" className="block transition-transform hover:scale-[1.02]">
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/20 dark:border-white/5 shadow-sm h-full hover:bg-white/60 dark:hover:bg-slate-900/60 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-pink-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">{metrics?.totalCustomers}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Distinct senders/receivers</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Cash Amount */}
        <Link href="/admin/reports" className="block transition-transform hover:scale-[1.02]">
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/20 dark:border-white/5 shadow-sm h-full hover:bg-white/60 dark:hover:bg-slate-900/60 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cash Amount</CardTitle>
              <Wallet className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">₹{metrics?.cashAmount}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Cash entries revenue</p>
            </CardContent>
          </Card>
        </Link>

        {/* Account Amount */}
        <Link href="/admin/reports" className="block transition-transform hover:scale-[1.02]">
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/20 dark:border-white/5 shadow-sm h-full hover:bg-white/60 dark:hover:bg-slate-900/60 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Account Amount</CardTitle>
              <Wallet className="h-4 w-4 text-teal-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">₹{metrics?.accountAmount}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Credit billing entries</p>
            </CardContent>
          </Card>
        </Link>

        {/* Total Revenue */}
        <Link href="/admin/analytics" className="block transition-transform hover:scale-[1.02]">
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/20 dark:border-white/5 shadow-sm h-full hover:bg-white/60 dark:hover:bg-slate-900/60 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Revenue</CardTitle>
              <Wallet className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">₹{metrics?.totalRevenue}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Excludes cancelled items</p>
            </CardContent>
          </Card>
        </Link>

        {/* Invoices */}
        <Link href="/admin/reports" className="block transition-transform hover:scale-[1.02]">
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/20 dark:border-white/5 shadow-sm h-full hover:bg-white/60 dark:hover:bg-slate-900/60 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Invoices Gen.</CardTitle>
              <FileText className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{metrics?.totalInvoices}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Tax invoices downloaded</p>
            </CardContent>
          </Card>
        </Link>

        {/* Manifests */}
        <Link href="/admin/reports" className="block transition-transform hover:scale-[1.02]">
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-white/20 dark:border-white/5 shadow-sm h-full hover:bg-white/60 dark:hover:bg-slate-900/60 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Manifests Gen.</CardTitle>
              <Download className="h-4 w-4 text-cyan-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{metrics?.totalManifests}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Manifest reports exported</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Business Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-white/20 dark:border-white/10 bg-white/30 dark:bg-slate-900/30">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Entry Volume Overview</CardTitle>
            <CardDescription>Comparison of today, current month, and total booking entries</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bookingsBarData}>
                <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "transparent" }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={45} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-white/20 dark:border-white/10 bg-white/30 dark:bg-slate-900/30">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Revenue Share (Cash vs Account)</CardTitle>
            <CardDescription>Breakdown of cash collection vs ledger account entries</CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            {revenueChartData.length === 0 ? (
              <div className="text-sm text-slate-400 italic">No revenue transaction data to display</div>
            ) : (
              <div className="w-full h-full flex flex-col sm:flex-row items-center gap-6 justify-center">
                <div className="w-1/2 h-full min-h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {revenueChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `₹${value}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2.5">
                  {revenueChartData.map((item, idx) => (
                    <div key={item.name} className="flex items-center gap-2 text-xs">
                      <div className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {item.name}: ₹{item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Logs & Active Users Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Latest Activity (Audit Log based) */}
        <Card className="md:col-span-2 border-white/20 dark:border-white/10 bg-white/30 dark:bg-slate-900/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div>
              <CardTitle className="text-base font-semibold">Latest Activity</CardTitle>
              <CardDescription>Chronological system activity logs</CardDescription>
            </div>
            <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              {recentAuditLogs.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">No recent activity found.</div>
              ) : (
                recentAuditLogs.slice(0, 6).map((log: any) => {
                  const meta = parseActivityMeta(log);
                  return (
                    <div key={log.id} className="flex items-start justify-between text-sm pb-3 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0 gap-3">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            {log.adminName}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${getActionBadgeColor(log.action)}`}>
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {getActivityDescription(log)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-slate-450 dark:text-slate-450 font-medium">
                          {new Date(log.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-850 flex justify-end">
              <Link href="/admin/audit-logs" className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1">
                View All Audit Logs <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Active Users Widget */}
        <Card className="border-white/20 dark:border-white/10 bg-white/30 dark:bg-slate-900/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div>
              <CardTitle className="text-base font-semibold">Active Users</CardTitle>
              <CardDescription>Presence inside the last 15 minutes</CardDescription>
            </div>
            <Monitor className="h-4 w-4 text-emerald-500 animate-pulse" />
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              {activeUsers.length === 0 ? (
                <div className="text-xs text-slate-400 italic text-center py-4">
                  No user activity recorded in the last 15 minutes.
                </div>
              ) : (
                activeUsers.map((user: any) => (
                  <div key={user.id} className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {user.name}
                        </p>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        Last action: <span className="font-semibold text-slate-600 dark:text-slate-300">{user.lastAction}</span>
                      </p>
                    </div>
                    <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-medium">
                      {new Date(user.lastActive).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
