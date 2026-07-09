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
import {
  Users,
  Search,
  Eye,
  Calendar,
  Package,
  TrendingUp,
  MapPin,
  Truck,
  ArrowRight,
  Loader2,
  AlertTriangle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { formatWeight } from "@/lib/utils";

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Customer Detail Dialog State
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/customers");
      const resJson = await res.json();
      if (resJson.success) {
        setCustomers(resJson.data || []);
      } else {
        setError(resJson.error || "Failed to load customers list");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenDetail = async (name: string) => {
    setSelectedCustomerName(name);
    setDetailLoading(true);
    setDetailError(null);
    setCustomerDetail(null);
    try {
      const res = await fetch(`/api/admin/customers/${encodeURIComponent(name)}`);
      const resJson = await res.json();
      if (resJson.success) {
        setCustomerDetail(resJson.data);
      } else {
        setDetailError(resJson.error || "Failed to load customer profile details");
      }
    } catch (err: any) {
      setDetailError(err.message || "Network error loading customer details");
    } finally {
      setDetailLoading(false);
    }
  };

  // Filter local list by search query
  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">Customer Directory</h2>
        <p className="text-muted-foreground mt-1">
          Dynamically aggregated list of senders and receivers parsed from tracking database.
        </p>
      </div>

      {/* Toolbar */}
      <Card className="border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl bg-white/80 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Customers Grid List */}
      <Card className="border-white/20 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-md rounded-[24px] overflow-hidden">
        <div className="overflow-x-auto min-w-full">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 font-semibold uppercase text-[11px] border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4 text-center">Total Shipments</th>
                <th className="px-6 py-4">Last Booking Date</th>
                <th className="px-6 py-4">Recent Role</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {loading ? (
                [...Array(6)].map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-44 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 rounded mx-auto" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-28 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-8 w-20 bg-slate-100 dark:bg-slate-800 rounded mx-auto" /></td>
                  </tr>
                ))
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400 dark:text-slate-500 italic">
                    No customers found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">
                      {customer.name}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-900 dark:text-white">
                      {customer.shipmentCount}
                    </td>
                    <td className="px-6 py-4 font-medium whitespace-nowrap">
                      {customer.lastBooking && customer.lastBooking !== "1970-01-01T00:00:00.000Z"
                        ? new Date(customer.lastBooking).toLocaleDateString("en-IN")
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350">
                        {customer.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDetail(customer.name)}
                        className="rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 font-semibold"
                      >
                        <Eye className="h-4 w-4 mr-1.5" /> View Profile
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* CUSTOMER PROFILE DETAILS DIALOG */}
      <Dialog open={!!selectedCustomerName} onOpenChange={() => setSelectedCustomerName(null)}>
        <DialogContent className="sm:max-w-3xl border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#0f172a] p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
              <Users className="h-6 w-6 text-red-500 mr-2" /> Customer Profile
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Aggregated profile statistics and historical shipment details.
            </DialogDescription>
          </DialogHeader>

          {detailLoading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="h-8 w-8 text-red-500 animate-spin" />
              <p className="text-xs text-slate-500">Compiling profile details...</p>
            </div>
          )}

          {detailError && (
            <div className="flex flex-col items-center justify-center py-8 space-y-2 text-red-500">
              <AlertTriangle className="h-8 w-8" />
              <p className="text-xs font-semibold">{detailError}</p>
            </div>
          )}

          {customerDetail && (
            <div className="space-y-6 pt-2">
              {/* Profile summary cards */}
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-none">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <Package className="h-3 w-3" /> Shipments Sent
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <span className="text-lg font-bold">{customerDetail.profile.sentCount}</span>
                  </CardContent>
                </Card>

                <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-none">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <Package className="h-3 w-3" /> Shipments Received
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <span className="text-lg font-bold">{customerDetail.profile.receivedCount}</span>
                  </CardContent>
                </Card>

                <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-none">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Last Destination
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <span className="text-xs font-bold block truncate" title={customerDetail.profile.lastDestination}>
                      {customerDetail.profile.lastDestination}
                    </span>
                  </CardContent>
                </Card>

                <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-none">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Total Volume (₹)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <span className="text-lg font-extrabold text-red-600 dark:text-red-400">
                      ₹{customerDetail.profile.totalSpent}
                    </span>
                  </CardContent>
                </Card>
              </div>

              {/* Shipment history table */}
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-slate-500" /> Shipment History
                </h3>
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 font-semibold uppercase text-[10px] text-slate-500 border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Challan No</th>
                        <th className="px-4 py-2.5">From &rarr; To</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {customerDetail.history.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-6 italic text-slate-400">
                            No recorded shipments.
                          </td>
                        </tr>
                      ) : (
                        customerDetail.history.map((h: any) => {
                          const isSender = h.fromParty.toLowerCase() === selectedCustomerName?.toLowerCase();
                          return (
                            <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                {new Date(h.date).toLocaleDateString("en-IN")}
                              </td>
                              <td className="px-4 py-2.5 font-bold">#{h.challanNo}</td>
                              <td className="px-4 py-2.5 truncate max-w-[200px]" title={`${h.fromParty} to ${h.toParty}`}>
                                <span className={isSender ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                                  {h.fromParty}
                                </span>{" "}
                                &rarr;{" "}
                                <span className={!isSender ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                                  {h.toParty}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-bold">₹{h.amount}</td>
                              <td className="px-4 py-2.5">
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                                  {h.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button onClick={() => setSelectedCustomerName(null)} className="rounded-xl">
              Close Profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
