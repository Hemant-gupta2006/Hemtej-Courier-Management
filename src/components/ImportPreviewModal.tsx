"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, CheckCircle2, AlertTriangle, Search, ChevronDown, ChevronUp, PlusCircle, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

export type FieldChange = {
  field: string;
  oldValue: string | number;
  newValue: string | number;
  internalKey: string;
  internalVal?: any;
};

export type PreviewData = {
  totalRows: number;
  updates: Array<{
    id: string;
    challanNo: number;
    changes: FieldChange[];
  }>;
  unchanged: Array<{ challanNo: number }>;
  notFound: Array<any>; // Full row data for New in Excel
  duplicates: Array<{ challanNo: number }>;
  fieldStats: {
    amount: number;
    destination: number;
    weight: number;
    status: number;
    mode: number;
    date: number;
    party: number;
  };
};

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: PreviewData | null;
  onConfirm: (insertions: any[]) => void;
  isImporting: boolean;
  fileName?: string;
}

export function ImportPreviewModal({
  isOpen,
  onClose,
  previewData,
  onConfirm,
  isImporting,
  fileName
}: ImportPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<"all" | "updates" | "skipped">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedChallans, setExpandedChallans] = useState<Set<number>>(new Set());
  const [selectedInsertions, setSelectedInsertions] = useState<Set<number>>(new Set());

  const toggleExpand = (challanNo: number) => {
    const newSet = new Set(expandedChallans);
    if (newSet.has(challanNo)) newSet.delete(challanNo);
    else newSet.add(challanNo);
    setExpandedChallans(newSet);
  };

  const toggleInsertion = (challanNo: number) => {
    const newSet = new Set(selectedInsertions);
    if (newSet.has(challanNo)) newSet.delete(challanNo);
    else newSet.add(challanNo);
    setSelectedInsertions(newSet);
  };

  const filteredUpdates = useMemo(() => {
    if (!previewData) return [];
    if (!searchQuery) return previewData.updates;
    return previewData.updates.filter(u => String(u.challanNo).includes(searchQuery));
  }, [previewData, searchQuery]);

  const filteredNotFound = useMemo(() => {
    if (!previewData) return [];
    if (!searchQuery) return previewData.notFound;
    return previewData.notFound.filter(n => String(n.challanNo).includes(searchQuery));
  }, [previewData, searchQuery]);

  const filteredDuplicates = useMemo(() => {
    if (!previewData) return [];
    if (!searchQuery) return previewData.duplicates;
    return previewData.duplicates.filter(d => String(d.challanNo).includes(searchQuery));
  }, [previewData, searchQuery]);

  if (!previewData) return null;

  const { totalRows, updates, unchanged, notFound, duplicates, fieldStats } = previewData;
  const skippedCount = notFound.length + duplicates.length;

  const handleApply = () => {
    const insertions = notFound.filter(item => selectedInsertions.has(Number(item.challanNo)));
    onConfirm(insertions);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-7xl sm:max-w-7xl h-[90vh] flex flex-col bg-slate-950 border-slate-800 text-slate-100 p-0 shadow-2xl rounded-2xl overflow-hidden">
        {/* HEADER */}
        <div className="flex-none p-6 pb-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <FileSpreadsheet className="h-6 w-6 text-blue-400" />
                </div>
                Import & Sync Workspace
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-sm mt-2 max-w-xl">
                Review the changes below before applying them to the database. Select which new rows you want to add.
              </DialogDescription>
              {fileName && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-800/50 border border-slate-700/50 text-xs text-slate-300">
                  <span className="font-semibold text-slate-500">FILE</span>
                  {fileName}
                </div>
              )}
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <Button
                onClick={handleApply}
                disabled={isImporting || (updates.length === 0 && selectedInsertions.size === 0)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 rounded-xl h-11 shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] font-semibold text-base"
              >
                {isImporting ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Syncing...
                  </span>
                ) : (
                  `Apply ${updates.length} Updates & ${selectedInsertions.size} Additions`
                )}
              </Button>
              <Button variant="ghost" onClick={onClose} disabled={isImporting} className="h-8 text-slate-400 hover:text-slate-300 hover:bg-slate-800">
                Cancel
              </Button>
            </div>
          </div>
        </div>

        {/* WORKSPACE CONTENT */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* SIDEBAR - SUMMARY & STATS */}
          <div className="w-64 border-r border-slate-800 bg-slate-900/20 p-6 flex flex-col gap-6 overflow-y-auto">
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Sync Overview</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Total Excel Rows</span>
                  <span className="font-semibold">{totalRows}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-400">Ready to Update</span>
                  <span className="font-semibold text-blue-400">{updates.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-emerald-500">Unchanged</span>
                  <span className="font-semibold text-emerald-500">{unchanged.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-amber-500">New In Excel</span>
                  <span className="font-semibold text-amber-500">{notFound.length}</span>
                </div>
                {duplicates.length > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-red-500">Duplicates (Skipped)</span>
                    <span className="font-semibold text-red-500">{duplicates.length}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="h-px bg-slate-800" />

            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Field Changes</h3>
              <div className="space-y-3">
                {[
                  { label: "Amount", count: fieldStats.amount },
                  { label: "Weight", count: fieldStats.weight },
                  { label: "Destination", count: fieldStats.destination },
                  { label: "Date", count: fieldStats.date },
                  { label: "Party (From/To)", count: fieldStats.party },
                  { label: "Status", count: fieldStats.status },
                  { label: "Mode", count: fieldStats.mode },
                ].map(stat => (
                  <div key={stat.label} className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">{stat.label}</span>
                    <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${stat.count > 0 ? 'bg-blue-500/10 text-blue-400' : 'text-slate-600'}`}>
                      {stat.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MAIN CONTENT - DIFF VIEWER */}
          <div className="flex-1 flex flex-col bg-[#0B1120]">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/40">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button 
                  onClick={() => setActiveTab("all")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  All
                </button>
                <button 
                  onClick={() => setActiveTab("updates")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'updates' ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Updates ({updates.length})
                </button>
                <button 
                  onClick={() => setActiveTab("skipped")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'skipped' ? 'bg-amber-500/20 text-amber-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  New/Skipped ({skippedCount})
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input 
                  placeholder="Search Challan No..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-9 bg-slate-950 border-slate-800 focus-visible:ring-blue-500 text-slate-200 h-9"
                />
              </div>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              
              {filteredUpdates.length === 0 && filteredNotFound.length === 0 && filteredDuplicates.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                  <CheckCircle2 className="h-12 w-12 text-slate-700" />
                  <p className="text-lg font-medium">No records match your view.</p>
                </div>
              )}

              <div className="space-y-4 max-w-4xl mx-auto">
                {/* SKIPPED/NEW RECORDS */}
                {(activeTab === "all" || activeTab === "skipped") && (
                  <>
                    {filteredNotFound.map((item, idx) => {
                      const challanNo = Number(item.challanNo);
                      const isSelected = selectedInsertions.has(challanNo);
                      return (
                        <div key={`nf-${idx}`} className={`rounded-xl border transition-all overflow-hidden ${isSelected ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
                          <div className="px-5 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-lg font-bold text-slate-200">#{item.challanNo}</span>
                                <span className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${isSelected ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                                  NEW IN EXCEL
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 font-mono flex flex-wrap gap-x-4 gap-y-1 mt-2">
                                <span><strong className="text-slate-300 font-sans text-xs">Date:</strong> {item.date}</span>
                                <span><strong className="text-slate-300 font-sans text-xs">From:</strong> {item.fromParty}</span>
                                <span><strong className="text-slate-300 font-sans text-xs">To:</strong> {item.toParty}</span>
                                <span><strong className="text-slate-300 font-sans text-xs">Dest:</strong> {item.destination}</span>
                                <span><strong className="text-slate-300 font-sans text-xs">Weight:</strong> {item.weight}</span>
                                <span><strong className="text-slate-300 font-sans text-xs">Amount:</strong> ₹{item.amount}</span>
                                <span><strong className="text-slate-300 font-sans text-xs">Status:</strong> {item.status}</span>
                                <span><strong className="text-slate-300 font-sans text-xs">Mode:</strong> {item.mode}</span>
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2 mt-2 md:mt-0">
                              <Button 
                                variant={isSelected ? "default" : "outline"}
                                onClick={() => toggleInsertion(challanNo)}
                                className={isSelected ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'}
                                size="sm"
                              >
                                {isSelected ? (
                                  <><CheckCircle2 className="h-4 w-4 mr-2" /> Added</>
                                ) : (
                                  <><PlusCircle className="h-4 w-4 mr-2" /> Add to Database</>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {filteredDuplicates.map((item, idx) => (
                      <div key={`dup-${idx}`} className="rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
                        <div className="px-5 py-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-lg font-bold text-slate-200">#{item.challanNo}</span>
                            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                              DUPLICATE IN EXCEL
                            </span>
                          </div>
                          <span className="text-sm font-medium flex items-center text-red-500/80"><XCircle className="h-4 w-4 mr-1"/> SKIPPED</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* UPDATES */}
                {(activeTab === "all" || activeTab === "updates") && filteredUpdates.map((update) => {
                  const isExpanded = expandedChallans.has(update.challanNo);
                  return (
                    <div key={update.challanNo} className="rounded-xl border border-blue-500/20 bg-slate-900/50 shadow-sm overflow-hidden transition-all hover:border-blue-500/40">
                      {/* Card Header */}
                      <button 
                        onClick={() => toggleExpand(update.challanNo)}
                        className="w-full px-5 py-4 flex items-center justify-between bg-slate-800/20 hover:bg-slate-800/40 transition-colors text-left"
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-lg font-bold text-slate-200">#{update.challanNo}</span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {update.changes.length} {update.changes.length === 1 ? 'field' : 'fields'} changed
                          </span>
                        </div>
                        <div className="text-slate-500">
                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </div>
                      </button>

                      {/* Card Body (Fields) */}
                      {isExpanded && (
                        <div className="px-5 py-4 border-t border-slate-800/50 bg-slate-900/30">
                          <div className="grid gap-3">
                            {update.changes.map((change, i) => (
                              <div key={i} className="flex items-center gap-4 text-sm bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                                <div className="w-32 shrink-0 font-medium text-slate-400">
                                  {change.field}
                                </div>
                                <div className="flex-1 flex items-center gap-3 font-mono">
                                  <span className="text-red-400/80 line-through bg-red-400/5 px-2 py-1 rounded truncate max-w-[250px]" title={String(change.oldValue || 'Empty')}>
                                    {change.oldValue || <span className="italic text-slate-600">Empty</span>}
                                  </span>
                                  <span className="text-slate-600 shrink-0">→</span>
                                  <span className="text-green-400 font-semibold bg-green-400/10 px-2 py-1 rounded truncate max-w-[250px]" title={String(change.newValue || 'Empty')}>
                                    {change.newValue || <span className="italic text-slate-600">Empty</span>}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
