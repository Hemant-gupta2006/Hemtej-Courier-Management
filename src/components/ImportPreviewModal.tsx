"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";

export type PreviewData = {
  totalRows: number;
  matchedRows: number;
  updates: Array<{
    id: string;
    challanNo: number;
    fromParty: string;
    toParty: string;
    oldAmount: number;
    newAmount: number;
  }>;
  unchanged: Array<{ challanNo: number }>;
  notFound: Array<{ challanNo: number }>;
  duplicates: Array<{ challanNo: number }>;
};

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: PreviewData | null;
  onConfirm: () => void;
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
  if (!previewData) return null;

  const { totalRows, matchedRows, updates, unchanged, notFound, duplicates } = previewData;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border-white/10 text-slate-100 p-6 shadow-2xl">
        <DialogHeader className="pb-4 border-b border-white/5">
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FileSpreadsheet className="h-6 w-6 text-blue-400" />
            Import Preview
          </DialogTitle>
          <div className="flex flex-col gap-1 mt-2">
            {fileName && (
              <p className="text-sm font-medium text-slate-300">
                File: <span className="text-slate-400 font-normal">{fileName}</span>
              </p>
            )}
            <DialogDescription className="text-slate-400 text-sm">
              Review the changes before applying them to the database. Only the <strong className="text-slate-200">Amount</strong> field will be updated.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-4">
          <div className="bg-slate-800/40 rounded-xl p-4 border border-white/10 flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
               <FileSpreadsheet className="h-24 w-24" />
            </div>
            <span className="text-3xl font-bold text-slate-100">{totalRows}</span>
            <span className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold mt-1">Total Rows</span>
          </div>
          <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 flex flex-col justify-center relative overflow-hidden">
            <span className="text-3xl font-bold text-blue-400">{updates.length}</span>
            <span className="text-[11px] text-blue-400/80 uppercase tracking-widest font-semibold mt-1">Ready to Update</span>
          </div>
          <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20 flex flex-col justify-center relative overflow-hidden">
            <span className="text-3xl font-bold text-green-400">{unchanged.length}</span>
            <span className="text-[11px] text-green-400/80 uppercase tracking-widest font-semibold mt-1">Unchanged</span>
          </div>
          <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20 flex flex-col justify-center relative overflow-hidden">
            <span className="text-3xl font-bold text-red-400">{notFound.length + duplicates.length}</span>
            <span className="text-[11px] text-red-400/80 uppercase tracking-widest font-semibold mt-1">Issues (Skipped)</span>
          </div>
        </div>

        <div className="flex-1 bg-slate-900/50 border border-white/5 rounded-xl mt-2 overflow-hidden flex flex-col">
          <div className="overflow-y-auto max-h-[45vh] scrollbar-thin scrollbar-thumb-slate-700/50 scrollbar-track-transparent">
          {updates.length === 0 && notFound.length === 0 && duplicates.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-slate-500">
              <CheckCircle2 className="h-8 w-8 mb-2 text-green-500/50" />
              <p>No changes detected. Database is already in sync with Excel.</p>
            </div>
          )}

            <div className="p-0">
              <div className="px-5 py-4 flex items-center justify-between border-b border-white/5 bg-slate-800/20">
                <h4 className="flex items-center gap-2 font-semibold text-blue-400">
                  <CheckCircle2 className="h-4 w-4" /> Ready to Update
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold">{updates.length} records</span>
              </div>
              <Table className="border-collapse w-full text-sm">
                <TableHeader className="bg-slate-800/60 sticky top-0 z-10 backdrop-blur-md">
                  <TableRow className="border-white/5">
                    <TableHead className="text-slate-400 font-semibold h-10 px-5">Challan No</TableHead>
                    <TableHead className="text-slate-400 font-semibold h-10 px-5">Party Details</TableHead>
                    <TableHead className="text-slate-400 font-semibold h-10 px-5 text-right">Old Amount</TableHead>
                    <TableHead className="text-slate-400 font-semibold h-10 px-5 text-right">New Amount</TableHead>
                    <TableHead className="text-slate-400 font-semibold h-10 px-5 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {updates.map((u) => (
                    <TableRow key={u.id} className="border-white/5 hover:bg-white/5 transition-colors">
                      <TableCell className="font-medium text-slate-200 px-5">{u.challanNo}</TableCell>
                      <TableCell className="text-slate-400 text-xs px-5">
                        <div className="flex items-center gap-1.5 truncate max-w-[220px]">
                          <span className="truncate">{u.fromParty}</span>
                          <span className="text-slate-600 shrink-0">→</span>
                          <span className="truncate">{u.toParty}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-slate-500 line-through px-5">
                        {u.oldAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-green-400 font-bold px-5 text-base">
                        {u.newAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center px-5">
                        <span className="inline-flex items-center justify-center px-2 py-1 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 tracking-wider">
                          UPDATE
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

          {(notFound.length > 0 || duplicates.length > 0) && (
            <div className="p-0 border-t border-white/5 bg-red-500/5 mt-4">
              <div className="px-5 py-4 flex items-center justify-between border-b border-red-500/10">
                <h4 className="flex items-center gap-2 font-semibold text-red-400">
                  <AlertCircle className="h-4 w-4" /> Issues Detected (Skipped)
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold">{notFound.length + duplicates.length} issues</span>
              </div>
              <Table className="border-collapse w-full text-sm">
                <TableHeader className="bg-red-500/10 sticky top-0">
                  <TableRow className="border-red-500/10">
                    <TableHead className="text-red-300 px-5">Challan No</TableHead>
                    <TableHead className="text-red-300 px-5">Issue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicates.map((d, i) => (
                    <TableRow key={`dup-${i}`} className="border-red-500/10 hover:bg-red-500/10">
                      <TableCell className="font-medium text-red-300 px-5">{d.challanNo}</TableCell>
                      <TableCell className="text-red-400/80 px-5">Duplicate Challan No inside Excel file</TableCell>
                    </TableRow>
                  ))}
                  {notFound.map((n, i) => (
                    <TableRow key={`notfound-${i}`} className="border-red-500/10 hover:bg-red-500/10">
                      <TableCell className="font-medium text-red-300 px-5">{n.challanNo}</TableCell>
                      <TableCell className="text-red-400/80 px-5">Not Found in Database Register</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          </div>
        </div>

        <DialogFooter className="mt-6 gap-3 sm:gap-0 border-t border-white/5 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={isImporting} className="hover:bg-slate-800 text-slate-300 px-6 rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isImporting || updates.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 rounded-xl min-w-[140px] shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
          >
            {isImporting ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Importing...
              </span>
            ) : (
              `Confirm Import (${updates.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
