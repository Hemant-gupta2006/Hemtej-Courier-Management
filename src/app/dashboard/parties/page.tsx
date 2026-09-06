"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PartyFormModal } from "@/components/PartyFormModal";
import { toast } from "sonner";
import {
  Building2,
  Search,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Tag,
  MapPin,
  Phone,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BillingParty {
  id: string;
  officialInvoiceName: string;
  aliases: string[];
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  contactNumber?: string | null;
  gstNumber?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    invoices: number;
  };
}

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function BillingPartiesPage() {
  // Parties List & Pagination State
  const [parties, setParties] = useState<BillingParty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<BillingParty | null>(null);
  const [deletingParty, setDeletingParty] = useState<BillingParty | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch paginated billing parties from server
  const fetchParties = useCallback(async (targetPage = pagination.page, targetPageSize = pagination.pageSize, query = debouncedSearch) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        pageSize: targetPageSize.toString(),
      });
      if (query.trim()) {
        params.set("search", query.trim());
      }

      const res = await fetch(`/api/billing/parties?${params.toString()}`);
      const resJson = await res.json();
      const payload = resJson.data || resJson;

      if (resJson.success || payload) {
        if (payload.parties && payload.pagination) {
          setParties(payload.parties);
          setPagination(payload.pagination);
        } else if (Array.isArray(payload)) {
          setParties(payload);
          setPagination({
            page: 1,
            pageSize: payload.length,
            total: payload.length,
            totalPages: 1,
          });
        }
      } else {
        toast.error(resJson.error || "Failed to load billing parties");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Error connecting to server");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.pageSize, debouncedSearch]);

  useEffect(() => {
    fetchParties(pagination.page, pagination.pageSize, debouncedSearch);
  }, [fetchParties, pagination.page, pagination.pageSize, debouncedSearch]);

  const handleOpenCreate = () => {
    setEditingParty(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (party: BillingParty) => {
    setEditingParty(party);
    setIsModalOpen(true);
  };

  const handlePartySaved = () => {
    fetchParties(pagination.page, pagination.pageSize, debouncedSearch);
  };

  const confirmDelete = async () => {
    if (!deletingParty || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/billing/parties/${deletingParty.id}`, {
        method: "DELETE",
      });
      const resJson = await res.json();
      if (res.ok && resJson.success) {
        toast.success(resJson.data?.message || "Party processed successfully");
        setDeletingParty(null);
        // If we deleted the only item on the last page, step back one page
        const newPage = (parties.length === 1 && pagination.page > 1)
          ? pagination.page - 1
          : pagination.page;
        fetchParties(newPage, pagination.pageSize, debouncedSearch);
      } else {
        toast.error(resJson.error || "Failed to delete party");
      }
    } catch (err: any) {
      toast.error("An error occurred during deletion");
    } finally {
      setIsDeleting(false);
    }
  };

  const startRecord = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const endRecord = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2.5">
            <Building2 className="h-8 w-8 text-purple-600 inline-block" />
            Party Invoice Profiles
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage party invoicing details, GST credentials, billing addresses, and aliases for GST bill generation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => fetchParties(pagination.page, pagination.pageSize, debouncedSearch)}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="rounded-xl h-10 px-3 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Refresh list from database"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>

          <Button
            onClick={handleOpenCreate}
            className="rounded-xl h-10 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-md shadow-purple-500/20"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Invoicing Profile
          </Button>
        </div>
      </div>

      {/* Main Card */}
      <Card className="border-white/20 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl rounded-[24px] overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                Invoicing Profiles Directory
                <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 rounded-full bg-purple-100/70 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                  {pagination.total} registered
                </span>
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Party invoice details and GST credentials used for GST bill generation.
              </CardDescription>
            </div>

            {/* Server-Side Filter Search */}
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search name, alias, GST, city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <span className="text-xs font-medium">Loading invoicing profiles from database...</span>
            </div>
          ) : parties.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Building2 className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
              <p className="font-semibold text-base text-slate-700 dark:text-slate-300">No invoicing profiles found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {debouncedSearch
                  ? `No profiles match "${debouncedSearch}". Try a different keyword or clear search.`
                  : "Click 'Add Invoicing Profile' above to create your first party profile."}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile View: Vertical Cards / Boxes */}
              <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800/80 p-3 space-y-3">
                {parties.map((party) => (
                  <div
                    key={`mobile-${party.id}`}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3"
                  >
                    {/* Header: Name and status badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          {party.officialInvoiceName}
                        </h4>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          ID: {party.id.slice(-6)}
                        </span>
                      </div>
                      {party.isArchived ? (
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                          Archived
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                          Active
                        </span>
                      )}
                    </div>

                    {/* GST & Invoices Count */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">GST Number</span>
                        {party.gstNumber ? (
                          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {party.gstNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unregistered</span>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Invoices Generated</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {party._count?.invoices || 0} bills
                        </span>
                      </div>
                    </div>

                    {/* Booking Aliases */}
                    {party.aliases && party.aliases.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Booking Aliases</span>
                        <div className="flex flex-wrap gap-1">
                          {party.aliases.map((alias, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40"
                            >
                              <Tag className="h-2.5 w-2.5 opacity-70" />
                              {alias}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Address & Contact */}
                    {(party.addressLine1 || party.city || party.contactNumber) && (
                      <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl space-y-0.5">
                        {party.addressLine1 && <p>{party.addressLine1}</p>}
                        {(party.city || party.state || party.pincode) && (
                          <p className="text-[11px]">
                            {[party.city, party.state, party.pincode].filter(Boolean).join(", ")}
                          </p>
                        )}
                        {party.contactNumber && (
                          <p className="text-[11px] text-slate-500 font-mono mt-1">📞 {party.contactNumber}</p>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(party)}
                        className="flex-1 h-8 rounded-xl text-xs font-semibold text-purple-600 border-purple-200/80 hover:bg-purple-50 dark:border-purple-900/60 dark:hover:bg-purple-900/30"
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingParty(party)}
                        className="h-8 px-3 rounded-xl text-xs text-rose-600 border-rose-200/80 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-900/20"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View: Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-y border-slate-200/80 dark:border-slate-800/80 bg-slate-50/75 dark:bg-slate-900/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Official Invoice Name</th>
                      <th className="py-3 px-4">Booking Aliases</th>
                      <th className="py-3 px-4">GST Number</th>
                      <th className="py-3 px-4">Address & Contact</th>
                      <th className="py-3 px-4 text-center">Invoices</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {parties.map((party) => (
                      <tr
                        key={party.id}
                        className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors group"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            {party.officialInvoiceName}
                            {party.isArchived && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                                Archived
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ID: {party.id.slice(-6)}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {party.aliases && party.aliases.length > 0 ? (
                              party.aliases.map((alias, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40"
                                >
                                  <Tag className="h-2.5 w-2.5 opacity-70" />
                                  {alias}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground italic">None</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {party.gstNumber ? (
                            <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                              {party.gstNumber}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Unregistered</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-sm">
                          <div className="flex flex-col gap-0.5">
                            {(party.city || party.state) && (
                              <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                                <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                <span>
                                  {[party.city, party.state, party.pincode].filter(Boolean).join(", ")}
                                </span>
                              </div>
                            )}
                            {party.contactNumber && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                <span>{party.contactNumber}</span>
                              </div>
                            )}
                            {!party.city && !party.contactNumber && (
                              <span className="text-slate-400 italic">No address details</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                              (party._count?.invoices || 0) > 0
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                            )}
                          >
                            {party._count?.invoices || 0}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEdit(party)}
                              className="h-8 rounded-xl px-2.5 text-xs text-purple-600 border-purple-200/80 hover:bg-purple-50 dark:border-purple-900/60 dark:hover:bg-purple-900/30 font-medium"
                            >
                              <Edit2 className="h-3.5 w-3.5 mr-1" />
                              Edit
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingParty(party)}
                              className="h-8 rounded-xl px-2.5 text-xs text-rose-600 border-rose-200/80 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-900/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Server-Side Pagination Bar */}
              <div className="py-3.5 px-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="text-slate-500 dark:text-slate-400">
                  Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{startRecord}</span> to{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{endRecord}</span> of{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{pagination.total}</span> profiles
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  {/* Page Size Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 text-[11px]">Per page:</span>
                    <select
                      value={pagination.pageSize}
                      onChange={(e) => {
                        const newSize = parseInt(e.target.value, 10);
                        setPagination((prev) => ({ ...prev, pageSize: newSize, page: 1 }));
                      }}
                      className="h-8 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  {/* Navigation Controls */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page <= 1 || isLoading}
                      className="h-8 px-2.5 rounded-lg text-xs"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>

                    <span className="px-2 font-medium text-slate-700 dark:text-slate-300 text-xs">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                      disabled={pagination.page >= pagination.totalPages || isLoading}
                      className="h-8 px-2.5 rounded-lg text-xs"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* EDIT / ADD PARTY MODAL */}
      <PartyFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handlePartySaved}
        initialData={editingParty}
      />

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={!!deletingParty} onOpenChange={(open) => !open && !isDeleting && setDeletingParty(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">Delete Invoicing Profile</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Confirm deletion or archival of this party invoice profile.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-2 text-sm text-slate-600 dark:text-slate-400 space-y-2">
            <p>
              Are you sure you want to delete{" "}
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {deletingParty?.officialInvoiceName}
              </span>
              ?
            </p>
            {(deletingParty?._count?.invoices || 0) > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  This party is linked to <strong>{deletingParty?._count?.invoices}</strong> existing invoice(s). To protect historical billing records, it will be safely <strong>archived</strong> rather than permanently erased.
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeletingParty(null)}
              disabled={isDeleting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Processing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Confirm Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
