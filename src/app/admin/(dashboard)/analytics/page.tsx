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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend
} from "recharts";
import {
  TrendingUp,
  PieChart as PieIcon,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Calendar,
  Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";

const COLORS = ["#10b981", "#3b82f6", "#6366f1", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"];

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/analytics");
      const resJson = await res.json();
      if (resJson.success) {
        setData(resJson.data);
      } else {
        setError(resJson.error || "Failed to retrieve analytics metrics");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to administrative server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-4 w-72 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mt-1" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="h-80 animate-pulse bg-slate-100 dark:bg-slate-900 border-none" />
          <Card className="h-80 animate-pulse bg-slate-100 dark:bg-slate-900 border-none" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="h-80 animate-pulse bg-slate-100 dark:bg-slate-900 border-none" />
          <Card className="h-80 animate-pulse bg-slate-100 dark:bg-slate-900 border-none" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 animate-bounce" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Failed to load analytics</h2>
        <p className="text-sm text-slate-500 max-w-sm">{error || "Could not retrieve statistics"}</p>
        <Button onClick={fetchStats} className="rounded-xl">Try Again</Button>
      </div>
    );
  }

  const { entriesPerDay, entriesPerMonth, revenueBreakdown, topDestinations } = data;

  const validRevenueData = revenueBreakdown.filter((item: any) => item.value > 0);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">Business Analytics</h2>
          <p className="text-muted-foreground mt-1">
            Real-time ledger analytics, booking volumes, destination distributions, and collection types.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} className="rounded-xl w-fit">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh Analytics
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Entries Per Day (Last 15 days) */}
        <Card className="border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div>
              <CardTitle className="text-base font-semibold">Daily Booking Entries</CardTitle>
              <CardDescription>Volume of courier entries registered per day (last 15 days)</CardDescription>
            </div>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="h-72 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={entriesPerDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200 dark:stroke-slate-850" />
                <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} name="Entries Count" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Entries Per Month (Last 6 Months) */}
        <Card className="border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div>
              <CardTitle className="text-base font-semibold">Monthly Booking Volume</CardTitle>
              <CardDescription>Challan bookings grouped by calendar month (last 6 months)</CardDescription>
            </div>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="h-72 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={entriesPerMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200 dark:stroke-slate-850" />
                <XAxis dataKey="month" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={45} name="Monthly Bookings" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Cash vs Account (Revenue share) */}
        <Card className="border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div>
              <CardTitle className="text-base font-semibold">Revenue Collection Split</CardTitle>
              <CardDescription>Visual share comparing immediate cash collection vs billing ledger accounts</CardDescription>
            </div>
            <Wallet className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent className="h-72 flex items-center justify-center pt-4">
            {validRevenueData.length === 0 ? (
              <div className="text-sm text-slate-400 italic">No revenue transactions recorded yet.</div>
            ) : (
              <div className="w-full h-full flex flex-col sm:flex-row items-center gap-6 justify-center">
                <div className="w-1/2 h-full min-h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={validRevenueData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {validRevenueData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `₹${value}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2.5">
                  {validRevenueData.map((item: any, idx: number) => (
                    <div key={item.name} className="flex items-center gap-2 text-xs">
                      <div className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="font-bold text-slate-700 dark:text-slate-200">{item.name}</span>
                      <span className="text-slate-400">₹{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Destinations */}
        <Card className="border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div>
              <CardTitle className="text-base font-semibold">Top Courier Destinations</CardTitle>
              <CardDescription>Popular routes/cities sorted by total parcel entries volume</CardDescription>
            </div>
            <MapPin className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent className="h-72 pt-4">
            {topDestinations.length === 0 ? (
              <div className="text-sm text-slate-400 italic text-center py-10">No destination data to display.</div>
            ) : (
              <div className="w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topDestinations} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-slate-200 dark:stroke-slate-850" />
                    <XAxis type="number" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis dataKey="destination" type="category" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} width={80} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#ec4899" radius={[0, 4, 4, 0]} maxBarSize={20} name="Entries Count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
