"use client";

import React, { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown, Check, RotateCcw, X } from "lucide-react";

interface MobileSortPopoverProps {
  currentSort?: { column: string; direction: "asc" | "desc" | null };
  onToggleSort?: (columnId: string) => void;
  onResetSort?: () => void;
}

const SORTABLE_COLUMNS = [
  { id: "date", label: "Date" },
  { id: "challanNo", label: "Challan No" },
  { id: "fromParty", label: "From Party" },
  { id: "toParty", label: "To Party" },
  { id: "destination", label: "Destination" },
  { id: "weightValue", label: "Weight" },
  { id: "amount", label: "Amount" },
  { id: "status", label: "Status" },
  { id: "mode", label: "Mode" },
];

export function MobileSortPopover({ currentSort, onToggleSort, onResetSort }: MobileSortPopoverProps) {
  const [open, setOpen] = useState(false);

  const activeCol = currentSort?.column && currentSort.column !== "srNo" ? currentSort.column : null;
  const activeDirection = activeCol ? currentSort?.direction : null;
  const activeLabel = SORTABLE_COLUMNS.find((c) => c.id === activeCol)?.label;

  const handleSelect = (colId: string) => {
    onToggleSort?.(colId);
  };

  const handleReset = () => {
    if (onResetSort) {
      onResetSort();
    } else if (activeCol) {
      onToggleSort?.("srNo");
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={`inline-flex items-center justify-center rounded-xl border transition-all text-xs font-semibold px-2.5 h-9 gap-1.5 cursor-pointer outline-none ${
          activeCol
            ? "bg-blue-500/15 border-blue-500/30 text-blue-400 hover:bg-blue-500/25"
            : "bg-white/10 dark:bg-slate-900/50 border-white/20 dark:border-white/10 text-slate-300 hover:bg-white/15"
        }`}
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        <span>{activeCol ? `${activeLabel} ${activeDirection === "asc" ? "↑" : "↓"}` : "Sort"}</span>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[280px] max-w-[calc(100vw-24px)] p-0 bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200 z-50"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-slate-800/50">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-bold text-white">Sort Entries</span>
          </div>
          <div className="flex items-center gap-1">
            {activeCol && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-6 text-[10px] text-slate-400 hover:text-red-400 gap-1 px-1.5"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Reset
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-6 w-6 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Sort Options List */}
        <div className="p-1.5 max-h-[300px] overflow-y-auto space-y-0.5">
          {SORTABLE_COLUMNS.map((col) => {
            const isSelected = activeCol === col.id;
            return (
              <button
                key={col.id}
                onClick={() => handleSelect(col.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                  isSelected
                    ? "bg-blue-600/20 text-blue-300 font-semibold"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>{col.label}</span>
                {isSelected ? (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                    {activeDirection === "asc" ? (
                      <>
                        <ArrowUp className="h-3 w-3" /> Asc
                      </>
                    ) : (
                      <>
                        <ArrowDown className="h-3 w-3" /> Desc
                      </>
                    )}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100">
                    Tap to sort
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
