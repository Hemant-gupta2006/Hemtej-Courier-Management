"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Sparkles,
  Search,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Database,
  Info,
  Layers,
  Edit2,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearAutocompleteCache } from "@/lib/autocomplete";
import Link from "next/link";

interface AutocompleteAuditItem {
  type: string;
  fieldKey: string;
  storedValue: string;
  source: string;
  count: number;
  linkageStatus: string;
  matchedMasterId?: string | null;
  matchedMasterName?: string | null;
  canRename: boolean;
  aliases?: string[];
  partyId?: string;
}

const CATEGORY_TABS = [
  { key: "all", label: "All Suggestions" },
  { key: "fromParty", label: "From Party (Sender)" },
  { key: "toParty", label: "To Party (Consignee)" },
  { key: "destination", label: "Destinations" },
];

export default function AutoCompleteSuggestionsPage() {
  const [items, setItems] = useState<AutocompleteAuditItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Independent pagination primitives to prevent recursive render/fetch cascades
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Rename modal state
  const [renamingItem, setRenamingItem] = useState<{
    field: string;
    oldVal: string;
    typeLabel: string;
  } | null>(null);
  const [renameNewValue, setRenameNewValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Delete modal state
  const [deletingItem, setDeletingItem] = useState<AutocompleteAuditItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Abort controller ref to cancel obsolete queries when user clicks rapidly
  const activeControllerRef = useRef<AbortController | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Tab switch handler
  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    setPage(1);
  };

  // Primary data loader
  const loadSuggestions = useCallback(async (
    targetPage: number,
    targetPageSize: number,
    targetCategory: string,
    targetQuery: string
  ) => {
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeControllerRef.current = controller;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        pageSize: targetPageSize.toString(),
        category: targetCategory,
      });
      if (targetQuery) {
        params.set("search", targetQuery);
      }

      const res = await fetch(`/api/autocomplete/audit?${params.toString()}`, {
        signal: controller.signal,
      });
      const resJson = await res.json();
      const payload = resJson.data || resJson;

      if (resJson.success && payload) {
        setItems(payload.items || []);
        if (payload.pagination) {
          setTotal(payload.pagination.total);
          setTotalPages(payload.pagination.totalPages);
        }
      } else {
        toast.error(resJson.error || "Failed to load autocomplete suggestions");
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error(err);
      toast.error("Error connecting to server");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Single effect triggered purely when parameters change
  useEffect(() => {
    loadSuggestions(page, pageSize, category, debouncedSearch);
    return () => {
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }
    };
  }, [loadSuggestions, page, pageSize, category, debouncedSearch]);

  // Rename handlers
  const handleOpenRename = (field: string, oldVal: string, typeLabel: string) => {
    setRenamingItem({ field, oldVal, typeLabel });
    setRenameNewValue(oldVal);
  };

  const handleExecuteRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingItem || isRenaming) return;
    const trimmedNew = renameNewValue.trim();
    if (!trimmedNew) {
      toast.error("New value cannot be empty");
      return;
    }
    if (trimmedNew.toLowerCase() === renamingItem.oldVal.toLowerCase() && trimmedNew === renamingItem.oldVal) {
      toast.info("The name has not changed");
      setRenamingItem(null);
      return;
    }

    setIsRenaming(true);
    try {
      const res = await fetch("/api/autocomplete/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: renamingItem.field,
          oldVal: renamingItem.oldVal,
          newVal: trimmedNew,
        }),
      });
      const resJson = await res.json();
      if (res.ok && resJson.success) {
        toast.success(resJson.data?.message || "Renamed successfully across courier entries");
        clearAutocompleteCache(); // Invalidate cache so register inputs pick up new name immediately
        setRenamingItem(null);
        loadSuggestions(page, pageSize, category, debouncedSearch);
      } else {
        toast.error(resJson.error || "Failed to rename entries");
      }
    } catch (err: any) {
      toast.error("Error updating entries");
    } finally {
      setIsRenaming(false);
    }
  };

  // Delete handlers
  const handleOpenDelete = (item: AutocompleteAuditItem) => {
    setDeletingItem(item);
  };

  const handleExecuteDelete = async () => {
    if (!deletingItem || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/autocomplete/suggestion", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: deletingItem.fieldKey,
          value: deletingItem.storedValue,
          partyId: deletingItem.partyId,
        }),
      });

      const resJson = await res.json();
      if (res.ok && resJson.success) {
        toast.success(resJson.data?.message || `Suggestion "${deletingItem.storedValue}" removed successfully`);
        clearAutocompleteCache(); // Clear client memory so the deleted suggestion is never suggested again
        setDeletingItem(null);

        // If the only item on the last page was deleted, step back one page
        const newPage = (items.length === 1 && page > 1) ? page - 1 : page;
        if (newPage !== page) {
          setPage(newPage);
        } else {
          loadSuggestions(newPage, pageSize, category, debouncedSearch);
        }
      } else {
        toast.error(resJson.error || "Failed to remove suggestion");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred during deletion");
    } finally {
      setIsDeleting(false);
    }
  };

  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 bg-clip-text text-transparent flex items-center gap-2.5">
            <Sparkles className="h-8 w-8 text-amber-500 inline-block" />
            Auto Complete Suggestions
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Live directory of auto-complete suggestions used when booking entries across courier registers
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => loadSuggestions(page, pageSize, category, debouncedSearch)}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="rounded-xl h-10 px-3 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Refresh directory from database"
          >
            <RefreshCw className={cn("h-4 w-4 mr-1.5", isLoading && "animate-spin")} />
            Refresh Directory
          </Button>
        </div>
      </div>

      {/* Directory Card */}
      <Card className="border-white/20 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl rounded-[24px] overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Stored Suggestion Directory
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Suggestions recorded from booking history, ranked by usage frequency.
              </CardDescription>
            </div>

            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-100/70 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 w-fit">
              {total} matching suggestions
            </span>
          </div>

          {/* Filters & Search */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleCategoryChange(tab.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                    category === tab.key
                      ? "bg-purple-600 text-white shadow-sm shadow-purple-500/20 font-bold"
                      : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Server-Side Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search suggestions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-12 h-9 rounded-xl text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
              <span className="text-xs font-medium">Loading suggestions...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Layers className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
              <p className="font-semibold text-base text-slate-700 dark:text-slate-300">No suggestions found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {debouncedSearch
                  ? `No suggestions match "${debouncedSearch}". Try clearing your search query.`
                  : "No suggestions are recorded under this category yet."}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile View: Vertical Cards / Boxes */}
              <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800/80 p-3 space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={`mobile-${item.type}-${item.storedValue}-${idx}`}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                          {item.type}
                        </span>
                        <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 mt-0.5">
                          {item.storedValue}
                        </h4>
                        {item.aliases && item.aliases.length > 0 && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Aliases: {item.aliases.join(", ")}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40 shrink-0">
                        {item.count} {item.count === 1 ? "entry" : "entries"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                      {item.canRename && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenRename(item.fieldKey, item.storedValue, item.type)}
                          className="flex-1 h-8 rounded-xl text-xs font-semibold text-indigo-600 border-indigo-200/80 hover:bg-indigo-50 dark:border-indigo-900/60 dark:hover:bg-indigo-950/30"
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" />
                          Rename
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDelete(item)}
                        className={cn(
                          "h-8 px-3 rounded-xl text-xs text-rose-600 border-rose-200/80 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-900/20",
                          !item.canRename && "w-full"
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View: Clean Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-y border-slate-200/80 dark:border-slate-800/80 bg-slate-50/75 dark:bg-slate-900/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Field / Category</th>
                      <th className="py-3 px-4">Stored Suggestion / Value</th>
                      <th className="py-3 px-4 text-center">Usage Frequency</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {items.map((item, idx) => (
                      <tr
                        key={`${item.type}-${item.storedValue}-${idx}`}
                        className="hover:bg-purple-50/30 dark:hover:bg-purple-950/10 transition-colors group"
                      >
                        <td className="py-3 px-4 font-semibold text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {item.type}
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {item.storedValue}
                          </span>
                          {item.aliases && item.aliases.length > 0 && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Aliases: {item.aliases.join(", ")}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                            {item.count} {item.count === 1 ? "entry" : "entries"}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.canRename && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenRename(item.fieldKey, item.storedValue, item.type)}
                                className="h-7 rounded-lg text-[11px] font-semibold text-indigo-600 border-indigo-200/80 hover:bg-indigo-50 dark:border-indigo-900/60 dark:hover:bg-indigo-950/30"
                              >
                                <Edit2 className="h-3 w-3 mr-1" />
                                Rename
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDelete(item)}
                              className="h-7 rounded-lg text-[11px] font-semibold text-rose-600 border-rose-200/80 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-900/20"
                              title="Permanently remove from autocomplete suggestions"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Server-Side Pagination Controls */}
              <div className="py-3.5 px-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="text-slate-500 dark:text-slate-400">
                  Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{startRecord}</span> to{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{endRecord}</span> of{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{total}</span> suggestions
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  {/* Page Size Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 text-[11px]">Per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        const newSize = parseInt(e.target.value, 10);
                        setPageSize(newSize);
                        setPage(1);
                      }}
                      className="h-8 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  {/* Navigation Controls */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page <= 1 || isLoading}
                      className="h-8 px-2.5 rounded-lg text-xs"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>

                    <span className="px-2 font-medium text-slate-700 dark:text-slate-300 text-xs">
                      Page {page} of {totalPages}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={page >= totalPages || isLoading}
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

      {/* RENAME AUTOCOMPLETE SUGGESTION DIALOG */}
      <Dialog open={!!renamingItem} onOpenChange={(open) => !open && !isRenaming && setRenamingItem(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                <Edit2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">Rename Suggestion Value</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Update this name across all courier entries in the database.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleExecuteRename} className="space-y-4 py-2">
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-slate-500">Field Type</Label>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {renamingItem?.typeLabel}
                </p>
              </div>

              <div>
                <Label className="text-xs text-slate-500">Current Value</Label>
                <p className="text-sm font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40">
                  {renamingItem?.oldVal}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="renameNewValue" className="text-xs font-semibold">
                  New Value *
                </Label>
                <Input
                  id="renameNewValue"
                  value={renameNewValue}
                  onChange={(e) => setRenameNewValue(e.target.value)}
                  placeholder="Enter corrected name..."
                  className="rounded-xl h-10"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  All courier entries with &quot;{renamingItem?.oldVal}&quot; will be updated in the database, immediately refreshing your autocomplete suggestions.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenamingItem(null)}
                disabled={isRenaming}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isRenaming}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                {isRenaming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Updating Entries...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Update All Entries
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE AUTOCOMPLETE SUGGESTION DIALOG */}
      <Dialog open={!!deletingItem} onOpenChange={(open) => !open && !isDeleting && setDeletingItem(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">Remove Suggestion</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Permanently remove this suggestion from the autocomplete directory.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-2 text-sm text-slate-600 dark:text-slate-400 space-y-3">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Target Suggestion
              </span>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {deletingItem?.storedValue}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                  <span>Category: <strong>{deletingItem?.type}</strong></span>
                  <span>•</span>
                  <span>Recorded: <strong>{deletingItem?.count}</strong> times</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                This will permanently stop <strong>&quot;{deletingItem?.storedValue}&quot;</strong> from appearing in autocomplete suggestions everywhere across the application.
                <br /><br />
                <strong className="text-slate-800 dark:text-slate-100">Safe Deletion:</strong> Your historical courier records and booking entries are completely preserved and will not be altered or destroyed.
              </span>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeletingItem(null)}
              disabled={isDeleting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleExecuteDelete}
              disabled={isDeleting}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Confirm Remove
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
