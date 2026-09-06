"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Receipt, Search, RefreshCw, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Bill {
  id: string;
  billNo: string;
  invoiceDate: string;
  grossAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  netAmount: number;
  party: {
    officialInvoiceName: string;
  } | null;
  billingPartyNames: string[];
}

export default function BillRegisterPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [deletingBill, setDeletingBill] = useState<Bill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchBills();
  }, [page]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchBills();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bills?page=${page}&pageSize=10&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.success) {
        setBills(data.data.bills);
        setTotalPages(data.data.totalPages);
        setTotal(data.data.total);
      }
    } catch (error) {
      console.error("Failed to load bills", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async (id: string) => {
    if (regeneratingId) return;
    setRegeneratingId(id);
    try {
      const res = await fetch(`/api/bills/${id}/regenerate`, {
        method: "POST"
      });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to regenerate bill");
      }

      // Decode base64 and trigger download
      const binaryString = window.atob(data.data.fileBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = data.data.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();
      
      toast.success("Bill regenerated and updated successfully");
      
      // Refresh the table to show updated amounts
      fetchBills();
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setRegeneratingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deletingBill || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/bills/${deletingBill.id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete bill");
      }

      toast.success("Bill deleted successfully");
      setDeletingBill(null);

      if (bills.length === 1 && page > 1) {
        setPage(p => p - 1);
      } else {
        fetchBills();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete bill");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 px-4 md:px-0">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Bill Register
        </h2>
        <p className="text-muted-foreground">
          View and regenerate historical bills
        </p>
      </div>

      <Card className="border-white/20 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl rounded-[24px] overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-purple-100 dark:bg-purple-900/30">
                <Receipt className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Generated Bills</CardTitle>
                <CardDescription>Total {total} bills found</CardDescription>
              </div>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search Bill No or Customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 bg-white dark:bg-slate-950 rounded-xl border-slate-200 dark:border-slate-800"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto bg-white dark:bg-slate-950">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-4 rounded-tl-xl">Bill No</th>
                  <th className="px-4 py-4">Date</th>
                  <th className="px-4 py-4">Customer / Party</th>
                  <th className="px-4 py-4 text-right">Gross Amt</th>
                  <th className="px-4 py-4 text-right">CGST</th>
                  <th className="px-4 py-4 text-right">SGST</th>
                  <th className="px-4 py-4 text-right">Net Amount</th>
                  <th className="px-4 py-4 text-center rounded-tr-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-purple-500" />
                    </td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      No bills found.
                    </td>
                  </tr>
                ) : (
                  bills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-4 font-semibold text-slate-900 dark:text-slate-100">
                        {bill.billNo || "-"}
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-400">
                        {new Date(bill.invoiceDate).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-700 dark:text-slate-300">
                        {bill.party?.officialInvoiceName || bill.billingPartyNames[0] || "Unknown"}
                      </td>
                      <td className="px-4 py-4 text-right font-medium">₹{bill.grossAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-4 text-right text-slate-500">₹{bill.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-4 text-right text-slate-500">₹{bill.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-4 text-right font-bold text-slate-900 dark:text-slate-100">₹{bill.netAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRegenerate(bill.id)}
                            disabled={regeneratingId === bill.id || isDeleting}
                            className="h-8 rounded-lg text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-900 dark:hover:bg-purple-900/30"
                          >
                            {regeneratingId === bill.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Regenerate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingBill(bill)}
                            disabled={regeneratingId === bill.id || isDeleting}
                            className="h-8 rounded-lg text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/20 hover:border-rose-300 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 mt-6">
              <p className="text-sm text-slate-500">
                Showing page <span className="font-semibold text-slate-700 dark:text-slate-300">{page}</span> of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="rounded-lg h-9 w-9 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                  className="rounded-lg h-9 w-9 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingBill} onOpenChange={(open) => !open && !isDeleting && setDeletingBill(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">Delete Bill</DialogTitle>
                <DialogDescription className="text-sm mt-0.5">
                  This action cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-2 text-sm text-slate-600 dark:text-slate-400">
            Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-slate-100">Bill #{deletingBill?.billNo || "No number"}</span> ({deletingBill?.party?.officialInvoiceName || deletingBill?.billingPartyNames[0] || "Unknown Party"})? Associated courier entries will remain intact and unlinked.
          </div>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeletingBill(null)}
              disabled={isDeleting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-md shadow-rose-600/20"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete Bill
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
