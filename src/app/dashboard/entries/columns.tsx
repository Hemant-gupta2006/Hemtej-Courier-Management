"use client";

import { ColumnDef, RowData } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect, useRef } from "react";
import { CourierEntry } from "@prisma/client";
import { Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    updateData: (identifier: string, columnId: string, value: unknown) => void;
    deleteRow: (id: string, identifier: string) => void;
    saveNewRow: (identifier: string, addNextRow?: boolean) => Promise<{ success: boolean; nextTempId?: string }>;
    saveEditedRow: (identifier: string) => void;
    autocompleteData: any;
    handleCellKeyDown: (
      e: React.KeyboardEvent<HTMLInputElement>,
      identifier: string,
      columnId: string,
      inputElement: HTMLInputElement | null
    ) => void;
    errorsRef?: React.MutableRefObject<Record<string, Record<string, string>>>;
    clearFieldError?: (identifier: string, columnId: string) => void;
  }
}

// ───────────────────────────────────────────
// Shared error message component — in-flow, not absolute
// ───────────────────────────────────────────
const FieldError = ({ message }: { message?: string }) => {
  if (!message) return null;
  return (
    <span className="absolute bottom-0 right-2 text-[10px] text-red-500 font-medium z-20 pointer-events-none">
      {message}
    </span>
  );
};

// ───────────────────────────────────────────
// AutocompleteCell — fromParty, toParty, destination
// ───────────────────────────────────────────
const AutocompleteCell = ({ getValue, row, column, table }: any) => {
  const initialValue = String(getValue() ?? "");
  const [value, setValue] = useState(initialValue);
  const [suggestion, setSuggestion] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const identifier: string = row.original.tempId || row.original.id;
  // Map column IDs to the correct autocomplete API key
  const acKeyMap: Record<string, string> = {
    fromParty: "fromParties",
    toParty: "toParties",
    destination: "destinations",
  };
  const acKey = acKeyMap[column.id] ?? `${column.id}s`;
  const acData: string[] = table.options.meta?.autocompleteData?.[acKey] ?? [];
  // Read errors from ref for zero-lag rendering (ref never triggers re-render)
  const error: string | undefined = table.options.meta?.errorsRef?.current?.[identifier]?.[column.id];

  // Only re-sync when the row identity changes (prevents cross-row leakage)
  useEffect(() => {
    setValue(String(getValue() ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.original.tempId, row.original.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Apply live auto-capitalization for party/destination fields
    const raw = e.target.value;
    const capitalizeFields = ["fromParty", "toParty", "destination"];
    const val = capitalizeFields.includes(column.id)
      ? raw
        .split(" ")
        .map((w, i, arr) =>
          // Only capitalize the last word-in-progress if cursor is at end
          w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)
        )
        .join(" ")
      : raw;
    setValue(val);
    if (error) table.options.meta?.clearFieldError?.(identifier, column.id);
    setSuggestion(
      val.length > 0
        ? (acData.find((i) => i.toLowerCase().startsWith(val.toLowerCase())) ?? "")
        : ""
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" && suggestion && suggestion.toLowerCase() !== value.toLowerCase()) {
      e.preventDefault();
      setValue(suggestion);
      setSuggestion("");
    } else {
      table.options.meta?.handleCellKeyDown(e, identifier, column.id, inputRef.current);
    }
  };

  const onBlur = () => {
    table.options.meta?.updateData(identifier, column.id, value);
    setSuggestion("");
  };

  return (
    <div className="h-10 w-full flex items-center px-2 relative overflow-hidden">
      {suggestion && suggestion.toLowerCase().startsWith(value.toLowerCase()) && value.length > 0 && (
        <div className="absolute inset-x-2 pointer-events-none text-slate-400 dark:text-slate-600 z-10 bg-transparent truncate">
          <span className="opacity-0">{value}</span>
          <span>{suggestion.slice(value.length)}</span>
        </div>
      )}
      <Input
        id={`cell-${identifier}-${column.id}`}
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        className={`w-full h-8 px-2 bg-slate-800/60 dark:bg-slate-800/40 border border-white/10 rounded-lg outline-none text-sm text-slate-100 placeholder:text-slate-500 transition-colors duration-100 ${error
          ? "ring-1 ring-inset ring-red-500 bg-red-500/10 focus:ring-red-500"
          : "focus:ring-1 focus:ring-blue-500/40 focus:bg-slate-800/80"
          }`}
      />
      <FieldError message={error} />
    </div>
  );
};

// ───────────────────────────────────────────
// EditableCell — generic text / number / date / select
// ───────────────────────────────────────────
const EditableCell = ({ getValue, row, column, table }: any) => {
  const initialValue = String(getValue() ?? "");
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  const identifier: string = row.original.tempId || row.original.id;
  // Read errors from ref for zero-lag rendering (ref never triggers re-render)
  const error: string | undefined = table.options.meta?.errorsRef?.current?.[identifier]?.[column.id];

  useEffect(() => {
    setValue(String(getValue() ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.original.tempId, row.original.id]);

  const onBlur = () => table.options.meta?.updateData(identifier, column.id, value);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) =>
    table.options.meta?.handleCellKeyDown(e, identifier, column.id, inputRef.current);

  // ── Select (status / mode) ──
  if (column.id === "status" || column.id === "mode") {
    const options =
      column.id === "status"
        ? ["Cash", "Account", "Pending", "Delivered"]
        : ["Surface", "Air", "Cargo", "V Fast"];
    return (
      <div className="h-10 w-full flex items-center px-2 relative overflow-hidden">
        <Select
          value={String(value)}
          onValueChange={(v) => {
            setValue(v ?? "");
            table.options.meta?.updateData(identifier, column.id, v ?? "");
          }}
        >
          <SelectTrigger
            id={`cell-${identifier}-${column.id}`}
            ref={inputRef as any}
            className={`w-full h-8 px-2 bg-slate-800/60 dark:bg-slate-800/40 border border-white/10 rounded-lg appearance-none text-sm text-slate-100 hover:bg-slate-800/80 focus:ring-1 focus:ring-blue-500/40 focus:bg-slate-800/80 focus-visible:ring-offset-0`}
            onKeyDown={(e: React.KeyboardEvent<any>) => {
              if (e.key === "Tab")
                table.options.meta?.handleCellKeyDown(e as any, identifier, column.id, inputRef.current);
            }}
          >
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent className="rounded-lg shadow-lg">
            {options.map((o) => (
              <SelectItem key={o} value={o} className="rounded-md">{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // ── Date ──
  if (column.id === "date") {
    return (
      <div className="h-10 w-full flex items-center px-2 relative overflow-hidden">
        <Input
          id={`cell-${identifier}-${column.id}`}
          ref={inputRef}
          type="date"
          value={value ? new Date(value).toISOString().split("T")[0] : ""}
          onChange={(e) => setValue(e.target.value)}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          className={`w-full h-8 px-2 bg-slate-800/60 dark:bg-slate-800/40 border border-white/10 rounded-lg outline-none text-sm text-slate-100 placeholder:text-slate-500 transition-colors duration-100 focus:ring-1 focus:ring-blue-500/40 focus:bg-slate-800/80`}
        />
      </div>
    );
  }

  // ── Generic text / number ──
  return (
    <div className="h-10 w-full flex items-center px-2 relative overflow-hidden">
      <Input
        id={`cell-${identifier}-${column.id}`}
        ref={inputRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) table.options.meta?.clearFieldError?.(identifier, column.id);
        }}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        className={`w-full h-8 px-2 bg-slate-800/60 dark:bg-slate-800/40 border border-white/10 rounded-lg outline-none text-sm text-slate-100 placeholder:text-slate-500 transition-colors duration-100 ${error
          ? "ring-1 ring-inset ring-red-500 bg-red-500/10 focus:ring-red-500"
          : "focus:ring-1 focus:ring-blue-500/40 focus:bg-slate-800/80"
          }`}
      />
      <FieldError message={error} />
    </div>
  );
};

// ───────────────────────────────────────────
// WeightCell — numeric + kg/g unit selector
// ───────────────────────────────────────────
const WeightCell = ({ getValue, row, column, table }: any) => {
  const rawValue = String(getValue() ?? "100g");

  const parseWeight = (v: string) => {
    const lower = v.toLowerCase().trim();
    if (lower.endsWith("kg")) return { num: lower.replace("kg", "").trim(), unit: "kg" };
    if (lower.endsWith("g")) return { num: lower.replace(/g$/, "").trim(), unit: "g" };
    return { num: v, unit: "kg" };
  };

  const toDisplayGrams = (raw: string) => {
    if (!raw.endsWith("g") || raw.endsWith("kg")) return parseWeight(raw);
    const g = parseFloat(raw);
    if (isNaN(g)) return parseWeight(raw);
    return g >= 1000 ? { num: String(g / 1000), unit: "kg" } : { num: String(g), unit: "g" };
  };

  const init = toDisplayGrams(rawValue);
  const [num, setNum] = useState(init.num);
  const [unit, setUnit] = useState(init.unit);
  const inputRef = useRef<HTMLInputElement>(null);

  const identifier: string = row.original.tempId || row.original.id;
  // Read errors from ref for zero-lag rendering (ref never triggers re-render)
  const error: string | undefined = table.options.meta?.errorsRef?.current?.[identifier]?.[column.id];

  useEffect(() => {
    const d = toDisplayGrams(String(getValue() ?? "100g"));
    setNum(d.num);
    setUnit(d.unit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.original.tempId, row.original.id]);

  const buildStored = (n: string, u: string) => {
    const parsed = parseFloat(n);
    if (isNaN(parsed)) return `${n}g`;
    return `${u === "kg" ? parsed * 1000 : parsed}g`;
  };

  const onBlur = () =>
    table.options.meta?.updateData(identifier, column.id, buildStored(num, unit));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) =>
    table.options.meta?.handleCellKeyDown(e, identifier, column.id, inputRef.current);

  return (
    <div className="h-10 w-full flex items-center px-2 gap-1 relative overflow-hidden">
      <Input
        id={`cell-${identifier}-${column.id}`}
        ref={inputRef}
        value={num}
        onChange={(e) => {
          setNum(e.target.value);
          if (error) table.options.meta?.clearFieldError?.(identifier, column.id);
        }}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        placeholder="0.00"
        className={`w-full h-8 px-2 bg-slate-800/60 dark:bg-slate-800/40 border border-white/10 rounded-lg outline-none text-right text-sm text-slate-100 placeholder:text-slate-500 transition-colors duration-100 ${error
          ? "ring-1 ring-inset ring-red-500 bg-red-500/10 focus:ring-red-500"
          : "focus:ring-1 focus:ring-blue-500/40 focus:bg-slate-800/80"
          }`}
      />
      <Select
        value={unit}
        onValueChange={(v) => {
          const u = v || "kg";
          setUnit(u);
          table.options.meta?.updateData(identifier, column.id, buildStored(num, u));
        }}
      >
        <SelectTrigger className="w-[48px] h-8 px-1 bg-slate-800/60 dark:bg-slate-800/40 border border-white/10 rounded-md appearance-none text-xs text-slate-400 hover:bg-slate-800/80 focus:ring-1 focus:ring-blue-500/40 focus:bg-slate-800/80 focus-visible:ring-offset-0 text-center">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-lg shadow-lg">
          <SelectItem value="kg" className="rounded-md">kg</SelectItem>
          <SelectItem value="g" className="rounded-md">g</SelectItem>
        </SelectContent>
      </Select>
      <FieldError message={error} />
    </div>
  );
};

// ───────────────────────────────────────────
// Column definitions
// ───────────────────────────────────────────
export const columns: ColumnDef<CourierEntry>[] = [
  {
    accessorKey: "srNo",
    header: "Sr.No",
    size: 50,
    cell: ({ row }) => {
      const val = row.getValue("srNo") as number | string;
      return (
        <div className="h-10 w-full flex items-center px-2 text-sm text-slate-300 truncate overflow-hidden whitespace-nowrap">
          {val === 999999999 ? "NEW" : val || "-"}
        </div>
      );
    },
  },
  {
    accessorKey: "date",
    header: "Date",
    size: 145,
    cell: EditableCell
  },
  {
    accessorKey: "challanNo",
    header: "Challan No",
    size: 90,
    cell: EditableCell
  },
  {
    accessorKey: "fromParty",
    header: "From Party",
    size: 200,
    cell: AutocompleteCell
  },
  {
    accessorKey: "toParty",
    header: "To Party",
    size: 200,
    cell: AutocompleteCell
  },
  {
    accessorKey: "weight",
    header: "Weight",
    size: 100,
    cell: WeightCell
  },
  {
    accessorKey: "destination",
    header: "Destination",
    size: 120,
    cell: AutocompleteCell
  },
  {
    accessorKey: "amount",
    header: "Amount",
    size: 60,
    cell: EditableCell
  },
  {
    accessorKey: "status",
    header: "Status",
    size: 100,
    cell: EditableCell
  },
  {
    accessorKey: "mode",
    header: "Mode",
    size: 100,
    cell: EditableCell
  },
  {
    id: "actions",
    size: 70,
    cell: ({ row, table }) => {
      const entry = row.original as any;
      const identifier = entry.tempId || entry.id;
      const isNew = !!entry.isNew;
      const isEdited = !!entry.isEdited;
      const hasErrors = Object.keys(table.options.meta?.errorsRef?.current?.[identifier] || {}).length > 0;

      if (isNew || isEdited) {
        return (
          <div className="flex w-full h-10 items-center px-2 gap-1">

            {/* 🗑 DELETE BUTTON */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => table.options.meta?.deleteRow(entry.id, identifier)}
              className="h-8 w-1/2 rounded-lg text-xs px-2 text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Trash2 className="h-4 w-4" />
            </Button>

            {/* 💾 SAVE BUTTON */}
            <Button
              id={`save-btn-${identifier}`}
              size="sm"
              disabled={hasErrors}
              onClick={async () => {
                if (isNew) {
                  const res = await table.options.meta?.saveNewRow(identifier, true);
                  if (res?.success && res.nextTempId) {
                    setTimeout(() => {
                      document.getElementById(`cell-${res.nextTempId}-fromParty`)?.focus();
                    }, 50);
                  }
                } else {
                  table.options.meta?.saveEditedRow(identifier);
                }
              }}
              className={`h-8 w-1/2 rounded-lg text-xs px-2 flex items-center justify-center transition-transform hover:scale-[1.02] active:scale-[0.98] ${hasErrors
                ? "bg-transparent text-slate-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
            >
              <Save className="h-3 w-3 mr-1" />
              {isNew ? "Save" : "Update"}
            </Button>
          </div>
        );
      }

      return (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => table.options.meta?.deleteRow(entry.id, identifier)}
          className="h-8 w-full rounded-lg text-xs px-2 text-red-500 hover:bg-red-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      );
    },
  },
];
