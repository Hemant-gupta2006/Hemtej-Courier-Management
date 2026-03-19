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
import { Trash2 } from "lucide-react";
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
    <p className="text-[11px] text-red-500 font-medium px-2 pt-0.5 pb-1 leading-tight">
      {message}
    </p>
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
    <div className="flex flex-col w-full">
      <div className="relative flex items-center">
        {suggestion && suggestion.toLowerCase().startsWith(value.toLowerCase()) && value.length > 0 && (
          <div className="absolute inset-x-2 pointer-events-none text-slate-400 dark:text-slate-600">
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
          className={`h-8 border-transparent bg-transparent px-2 w-full transition-all text-slate-900 dark:text-slate-100 ${error
            ? "ring-1 ring-inset ring-red-500 border-red-400 focus-visible:ring-red-500"
            : "hover:border-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-500"
            }`}
        />
      </div>
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
          className="h-8 border-transparent focus:ring-2 focus:ring-blue-500 bg-transparent px-2 w-[110px] text-sm text-slate-900 dark:text-slate-100 hover:bg-white/40 dark:hover:bg-slate-800/40 shadow-none focus-visible:ring-offset-0"
          onKeyDown={(e: React.KeyboardEvent<any>) => {
            // Only handle Tab — ENTER on a Select should NOT trigger saves
            if (e.key === "Tab")
              table.options.meta?.handleCellKeyDown(e as any, identifier, column.id, inputRef.current);
          }}
        >
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // ── Date ──
  if (column.id === "date") {
    return (
      <Input
        id={`cell-${identifier}-${column.id}`}
        ref={inputRef}
        type="date"
        value={value ? new Date(value).toISOString().split("T")[0] : ""}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        className="h-8 border-transparent hover:border-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-500 bg-transparent px-2 w-[130px] transition-all text-slate-900 dark:text-slate-100"
      />
    );
  }

  // ── Generic text / number ──
  return (
    <div className="flex flex-col w-full">
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
        className={`h-8 border-transparent bg-transparent px-2 transition-all w-full text-slate-900 dark:text-slate-100 ${error
          ? "ring-1 ring-inset ring-red-500 border-red-400 focus-visible:ring-red-500"
          : "hover:border-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-500"
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
    <div className="flex flex-col w-full min-w-[130px]">
      <div className="flex flex-row items-center gap-1">
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
          className={`h-8 border-transparent bg-transparent px-2 w-full transition-all text-right font-mono text-slate-900 dark:text-slate-100 ${error
            ? "ring-1 ring-inset ring-red-500 border-red-400 focus-visible:ring-red-500"
            : "hover:border-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-500"
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
          <SelectTrigger className="h-8 w-[58px] border-transparent hover:border-blue-500/50 bg-transparent px-1 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="kg">kg</SelectItem>
            <SelectItem value="g">g</SelectItem>
          </SelectContent>
        </Select>
      </div>
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
    cell: ({ row }) => {
      const val = row.getValue("srNo") as number | string;
      return (
        <div className="px-3 py-2 text-slate-500 dark:text-slate-400 font-medium">
          {val === 999999999 ? "NEW" : val || "-"}
        </div>
      );
    },
  },
  { accessorKey: "date", header: "Date", cell: EditableCell },
  { accessorKey: "challanNo", header: "Challan No", cell: EditableCell },
  { accessorKey: "fromParty", header: "From Party", cell: AutocompleteCell },
  { accessorKey: "toParty", header: "To Party", cell: AutocompleteCell },
  { accessorKey: "weight", header: "Weight", cell: WeightCell },
  { accessorKey: "destination", header: "Destination", cell: AutocompleteCell },
  { accessorKey: "amount", header: "Amount", cell: EditableCell },
  { accessorKey: "status", header: "Status", cell: EditableCell },
  { accessorKey: "mode", header: "Mode", cell: EditableCell },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const entry = row.original as any;
      const identifier = entry.tempId || entry.id;
      return (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => table.options.meta?.deleteRow(entry.id, identifier)}
          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      );
    },
  },
];
