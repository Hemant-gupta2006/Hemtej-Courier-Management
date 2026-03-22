"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Download, Settings2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";


interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** When true, only visible rows are rendered — essential for 100+ rows. */
  virtualize?: boolean;
  /** Height of the virtualised scroll container. Default: "560px" */
  tableHeight?: string;
  /**
   * "entry" mode includes batch settings and add row UI.
   * "all" mode is purely for viewing and editing existing rows.
   * Default: "entry"
   */
  mode?: "entry" | "all";
}

type ValidationErrors = Record<string, Record<string, string>>;

// Auto-capitalize first letter of each word, lowercase the rest, trim spaces
const capitalizeWords = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

// ─────────────────────────────────────────────
// MemoizedRow — skips re-render unless this row's data or error changes.
// Defined at module level so it is never re-created on DataTable re-renders.
// ─────────────────────────────────────────────
interface MemoizedRowProps {
  row: any;
  rowErrorVersion: number;
  errorsRef: React.MutableRefObject<ValidationErrors>;
  saveNewRow: (identifier: string, addNextRow: boolean) => Promise<{ success: boolean; nextTempId?: string }>;
  saveEditedRow: (identifier: string) => void;
}

const MemoizedRow = React.memo(
  function MemoRow({ row, rowErrorVersion, errorsRef, saveNewRow, saveEditedRow }: MemoizedRowProps) {
    const identifier: string = row.original.tempId || row.original.id;
    const isNew: boolean = !!row.original.isNew;
    const isEdited: boolean = !!row.original.isEdited;
    // Read latest error state from ref — always fresh on each render
    const hasErrors = Object.keys(errorsRef.current[identifier] || {}).length > 0;

    return (
      <tr
        className={`group border-b border-white/5 transition-all duration-150 ${isEdited && !isNew
          ? "bg-amber-500/10 hover:bg-amber-500/20"
          : "hover:bg-white/5"
          }`}
      >
        {row.getVisibleCells().map((cell: any) => (
          <TableCell
            key={cell.id}
            className="p-0 align-middle relative focus-within:z-10 truncate overflow-hidden whitespace-nowrap"
            style={{ width: cell.column.columnDef.size }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </tr>
    );
  },
  // Custom comparator: only re-render when this row's data or error version changes.
  // saveNewRow / saveEditedRow / errorsRef are stable references.
  (prev, next) =>
    prev.row.original === next.row.original &&
    prev.rowErrorVersion === next.rowErrorVersion
);

export function DataTable<TData, TValue>({
  columns,
  data: initialData,
  virtualize = false,
  tableHeight = "560px",
  mode = "entry",
}: DataTableProps<TData, TValue>) {
  const router = useRouter();
  // Ref for the virtualised scroll container (also used in non-virtual mode, harmlessly)
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [data, setData] = React.useState<any[]>(initialData);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "srNo", desc: true }]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [autocompleteData, setAutocompleteData] = React.useState<any>({});
  const [errors, setErrors] = React.useState<ValidationErrors>({});
  // Stable ref so tableMeta never rebuilds when errors change
  const errorsRef = React.useRef<ValidationErrors>(errors);
  errorsRef.current = errors;
  // Per-row error version — only the affected row re-renders on error changes
  const [rowErrorVersions, setRowErrorVersions] = React.useState<Record<string, number>>({});
  const bumpRowErrorVersion = React.useCallback((id: string) => {
    setRowErrorVersions((v) => ({ ...v, [id]: (v[id] || 0) + 1 }));
  }, []);

  // Snapshot of originally-loaded data for per-row tracking
  const originalDataRef = React.useRef<Record<string, any>>({});

  // Always-current ref — avoids stale closures in setTimeout callbacks
  const dataRef = React.useRef<any[]>(data);
  dataRef.current = data;

  // Guard: prevent double-save when Save button is clicked rapidly
  const isSavingRef = React.useRef(false);

  // Batch Defaults State
  const [batchDefaults, setBatchDefaults] = React.useState({
    date: new Date().toISOString().split("T")[0],
    fromParty: "",
    destination: "",
    weightNum: "100",
    weightUnit: "g",
    status: "Cash",
    mode: "Surface",
  });
  const [useBatchDefaults, setUseBatchDefaults] = React.useState(true);

  React.useEffect(() => {
    setData(initialData);
    // Snapshot original data on initial load
    const snapshot: Record<string, any> = {};
    (initialData as any[]).forEach((r) => {
      if (r.id) snapshot[r.id] = { ...r };
    });
    originalDataRef.current = snapshot;
  }, [initialData]);

  React.useEffect(() => {
    const fetchAutocomplete = async () => {
      try {
        const res = await fetch("/api/couriers/autocomplete");
        if (res.ok) {
          const json = await res.json();
          setAutocompleteData(json.data || json);
        }
      } catch (err) {
        console.error("Failed to fetch autocomplete", err);
      }
    };
    fetchAutocomplete();
  }, []);

  // ─────────────────────────────────────────────
  // Validation helpers
  // ─────────────────────────────────────────────

  const setFieldError = React.useCallback(
    (id: string, col: string, msg: string) => {
      setErrors((p) => {
        const next = { ...p, [id]: { ...(p[id] || {}), [col]: msg } };
        errorsRef.current = next;
        return next;
      });
      bumpRowErrorVersion(id);
    },
    [bumpRowErrorVersion]
  );

  const clearFieldError = React.useCallback(
    (id: string, col: string) => {
      setErrors((p) => {
        const e = { ...(p[id] || {}) };
        delete e[col];
        const next = { ...p, [id]: e };
        errorsRef.current = next;
        return next;
      });
      bumpRowErrorVersion(id);
    },
    [bumpRowErrorVersion]
  );

  // Bulk error helpers used by save functions
  const setRowErrors = React.useCallback(
    (id: string, rowErrs: Record<string, string>) => {
      setErrors((p) => {
        const next = { ...p, [id]: rowErrs };
        errorsRef.current = next;
        return next;
      });
      bumpRowErrorVersion(id);
    },
    [bumpRowErrorVersion]
  );

  const clearRowErrors = React.useCallback(
    (id: string) => {
      setErrors((p) => {
        const u = { ...p };
        delete u[id];
        errorsRef.current = u;
        return u;
      });
      bumpRowErrorVersion(id);
    },
    [bumpRowErrorVersion]
  );

  const validateField = (
    columnId: string,
    value: any,
    rowIdentifier: string,
    allData: any[]
  ): string => {
    if (columnId === "weight") {
      const n = String(value ?? "")
        .replace(/g|kg/gi, "")
        .trim();
      if (n !== "" && isNaN(Number(n)))
        return "Weight must be numeric. Only numbers allowed.";
    }
    if (columnId === "amount") {
      const v = String(value ?? "").trim();
      if (v !== "" && isNaN(Number(v))) return "Invalid amount. Only numbers are allowed.";
    }
    if (columnId === "challanNo") {
      const c = String(value ?? "").trim();
      if (c !== "") {
        const dup = allData.some((r) => {
          // Only compare against SAVED rows (have an id, no tempId)
          // Ignore other new/unsaved rows and the current row itself
          const rIdentifier = r.tempId || r.id;
          if (rIdentifier === rowIdentifier) return false; // skip self
          if (r.isNew) return false; // skip other unsaved rows
          return String(r.challanNo ?? "").trim() === c;
        });
        if (dup)
          return "This challan number already exists. Please enter a unique number.";
      }
    }
    return "";
  };

  const validateRow = (row: any, allData: any[]): Record<string, string> => {
    const errs: Record<string, string> = {};
    const id = row.tempId || row.id;
    if (!row.isNew && !String(row.challanNo ?? "").trim()) errs.challanNo = "Challan Number is required.";
    if (!String(row.fromParty ?? "").trim()) errs.fromParty = "From Party is required.";
    if (!String(row.toParty ?? "").trim()) errs.toParty = "To Party is required.";
    if (!String(row.destination ?? "").trim()) errs.destination = "Destination is required.";

    ["weight", "amount", "challanNo"].forEach((col) => {
      if (!errs[col]) {
        const m = validateField(col, row[col], id, allData);
        if (m) errs[col] = m;
      }
    });
    return errs;
  };

  // ─────────────────────────────────────────────
  // updateData — in-memory only; no auto-PATCH
  // For saved rows this marks them as isEdited = true.
  // API calls happen only via saveNewRow or saveEditedRow.
  // ─────────────────────────────────────────────

  const updateData = React.useCallback(
    (identifier: string, columnId: string, value: any) => {
      const finalValue =
        (columnId === "fromParty" || columnId === "toParty" || columnId === "destination") &&
          typeof value === "string"
          ? capitalizeWords(value)
          : value;

      // Field-level validation
      const errMsg = validateField(columnId, finalValue, identifier, dataRef.current);
      if (errMsg) {
        setFieldError(identifier, columnId, errMsg);
      } else {
        clearFieldError(identifier, columnId);
      }

      // Granular update — only mutate the specific row, not the whole array
      setData((old) => {
        const idx = old.findIndex(
          (r) => (r.tempId && r.tempId === identifier) || (r.id && r.id === identifier)
        );
        if (idx === -1) return old;
        const updated = { ...old[idx], [columnId]: finalValue };
        if (old[idx].id && !old[idx].isNew) updated.isEdited = true;
        const next = old.slice();
        next[idx] = updated;
        return next;
      });
    },
    [setFieldError, clearFieldError]
  );

  const deleteRow = React.useCallback(
    async (id: string, identifier: string) => {
      if (!id) {
        setData((old) => old.filter((r) => (r.tempId || r.id) !== identifier));
        return;
      }
      if (!confirm("Delete this entry?")) return;
      try {
        const res = await fetch(`/api/couriers/${id}`, { method: "DELETE" });
        if (res.ok) {
          toast.success("Deleted");
          setData((old) => old.filter((r) => r.id !== id));
          router.refresh();
        } else toast.error("Failed to delete");
      } catch {
        toast.error("Network error");
      }
    },
    [router]
  );

  // ─────────────────────────────────────────────
  // New row helpers
  // ─────────────────────────────────────────────



  /**
   * Pure factory — builds a completely clean new row object.
   * NEVER copies from the previous row. Challan is passed in from outside
   * so it is always calculated from committed state.
   */
  const createCleanRow = React.useCallback((nextChallan: string) => ({
    tempId: `new-${Date.now()}-${Math.random()}`,
    srNo: 999999999,
    date: useBatchDefaults ? batchDefaults.date : new Date().toISOString().split("T")[0],
    challanNo: nextChallan,
    fromParty: useBatchDefaults ? batchDefaults.fromParty : "",
    toParty: "",
    weight: useBatchDefaults
      ? `${batchDefaults.weightNum}${batchDefaults.weightUnit}`
      : "100g",
    destination: useBatchDefaults ? batchDefaults.destination : "",
    amount: "",
    status: useBatchDefaults ? batchDefaults.status : "Cash",
    mode: useBatchDefaults ? batchDefaults.mode : "Surface",
    isNew: true,
  }), [useBatchDefaults, batchDefaults]);

  /**
   * Pure helper — computes the next challan number from a locally available snapshot for UI prediction.
   */
  const getNextChallan = React.useCallback((d: any[]): string => {
    const validRows = d.filter((r) => !r.isNew && String(r.challanNo).toLowerCase() !== "auto");
    if (validRows.length === 0) return "1001";
    
    // d is already sorted newest-first, so the first valid row is the most recently created.
    const lastChallan = Number(validRows[0].challanNo);
    return !isNaN(lastChallan) && lastChallan > 0 ? String(lastChallan + 1) : "1001";
  }, []);

  const addEmptyRow = React.useCallback(async (): Promise<string | undefined> => {
    // Read errors from ref to avoid stale deps
    const hasErrors = Object.values(errorsRef.current).some((e) => Object.keys(e).length > 0);
    if (hasErrors) {
      toast.warning("Please fix validation errors before adding a new row.");
      return;
    }
    if (dataRef.current.some((r) => r.isNew)) {
      toast.warning("Please save the current new row before adding another.");
      return;
    }

    const tempId = `new-${Date.now()}-${Math.random()}`;
    // Zero-lag instant prediction to eliminate Vercel serverless cold starts
    const nextChallan = getNextChallan(dataRef.current);

    setData((committed) => {
      const newRow = {
        ...createCleanRow(nextChallan),
        tempId,
      };
      return [newRow, ...committed];
    });

    return tempId;
  }, [createCleanRow, getNextChallan]);

  // ─────────────────────────────────────────────
  // Save a brand-new row (POST)
  // Returns the tempId of the newly added follow-on row, or null on failure.
  // ─────────────────────────────────────────────

  const saveNewRow = React.useCallback(
    async (
      identifier: string,
      addNextRow = false
    ): Promise<{ success: boolean; nextTempId?: string }> => {
      // Guard: prevent double-save
      if (isSavingRef.current) return { success: false };
      isSavingRef.current = true;

      const currentData = dataRef.current;
      const rowData = currentData.find(
        (r) => (r.tempId && r.tempId === identifier) || (r.id && r.id === identifier)
      );
      if (!rowData) {
        isSavingRef.current = false;
        return { success: false };
      }

      const rowErrors = validateRow(rowData, currentData);
      if (Object.keys(rowErrors).length > 0) {
        setRowErrors(identifier, rowErrors);
        toast.warning("Please fill all required fields before saving.");
        isSavingRef.current = false;
        return { success: false };
      }
      clearRowErrors(identifier);

      const cleanedNew = {
        ...rowData,
        fromParty: capitalizeWords(rowData.fromParty || ""),
        toParty: capitalizeWords(rowData.toParty || ""),
        destination: capitalizeWords(rowData.destination || ""),
        challanNo: String(rowData.challanNo).trim(),
        amount: parseFloat(String(rowData.amount)) || 0,
        tempId: undefined,
        isNew: undefined,
        isEdited: undefined,
      };

      // ── OPTIMISTIC UI: Instant visual update + spawn new row ──
      const nextTempId = addNextRow ? `new-${Date.now()}-${Math.random()}` : undefined;
      const predictedChallan = !isNaN(Number(rowData.challanNo))
        ? String(Number(rowData.challanNo) + 1)
        : getNextChallan(currentData);

      setData((committed) => {
        let updated = committed.map((r) => {
          if ((r.tempId && r.tempId === identifier) || (r.id && r.id === identifier)) {
            // Fake that it's saved to unblock UI interaction instantly
            return { ...r, isNew: false, tempId: r.tempId || identifier, isEdited: false };
          }
          return r;
        });

        if (addNextRow && nextTempId) {
          const freshRow = { ...createCleanRow(predictedChallan), tempId: nextTempId };
          return [freshRow, ...updated];
        }
        return updated;
      });

      // Release guard lock early so they can save the *next* row instantly
      setTimeout(() => { isSavingRef.current = false; }, 50);

      // ── BACKGROUND SAVE ──
      (async () => {
        try {
          const res = await fetch("/api/couriers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cleanedNew),
          });

          if (!res.ok) {
            toast.error((await res.text()) || "Error saving row");
            return;
          }

          const jsonBody = await res.json();
          const saved = jsonBody.data || jsonBody;

          setData((committed) =>
            committed.map((r) => {
              if (r.tempId === identifier || r.id === identifier) {
                // Apply final real backend DB row values silently
                return { ...r, id: saved.id, srNo: saved.srNo, challanNo: String(saved.challanNo), tempId: undefined };
              }
              return r;
            })
          );
          originalDataRef.current[saved.id] = { ...saved };
        } catch (err) {
          toast.error("Network error while saving");
        }
      })();

      // Return instantly to UI for rapid auto-focusing without waiting for the server
      return { success: true, nextTempId };
    },
    [createCleanRow, getNextChallan, setRowErrors, clearRowErrors]
  );

  // ─────────────────────────────────────────────
  // Save edits to an existing row (PATCH all fields)
  // ─────────────────────────────────────────────

  const saveEditedRow = React.useCallback(
    async (identifier: string) => {
      const rowData = dataRef.current.find((r) => r.id === identifier);
      if (!rowData) return;

      const rowErrors = validateRow(rowData, dataRef.current);
      if (Object.keys(rowErrors).length > 0) {
        setRowErrors(identifier, rowErrors);
        toast.warning("Please fix validation errors before saving.");
        return;
      }
      clearRowErrors(identifier);

      try {
        const res = await fetch(`/api/couriers/${rowData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: rowData.date,
            challanNo: String(rowData.challanNo).trim(),
            fromParty: capitalizeWords(rowData.fromParty || ""),
            toParty: capitalizeWords(rowData.toParty || ""),
            weight: rowData.weight,
            destination: capitalizeWords(rowData.destination || ""),
            amount: Number(rowData.amount),
            status: rowData.status,
            mode: rowData.mode,
          }),
        });
        if (res.ok) {
          toast.success("Changes saved!");
          setData((old) => old.map((r) => (r.id === identifier ? { ...r, isEdited: false } : r)));
          originalDataRef.current[identifier] = { ...rowData, isEdited: false };
        } else {
          toast.error((await res.text()) || "Failed to save changes");
        }
      } catch {
        toast.error("Network error");
      }
    },
    [setRowErrors, clearRowErrors]
  );

  // ─────────────────────────────────────────────
  // Keyboard navigation
  // ─────────────────────────────────────────────

  const handleCellKeyDown = React.useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      identifier: string,
      columnId: string,
      inputElement: HTMLInputElement | null
    ) => {
      const colOrder = [
        "date", "challanNo", "fromParty", "toParty",
        "weight", "destination", "amount", "status", "mode",
      ];
      const idx = colOrder.indexOf(columnId);
      const row = dataRef.current.find(
        (r) => (r.tempId && r.tempId === identifier) || (r.id && r.id === identifier)
      );
      if (!row) return;

      if (e.key === "Enter") {
        e.preventDefault();
        const nextCol = colOrder[idx + 1];
        if (nextCol) {
          const el = document.getElementById(`cell-${identifier}-${nextCol}`);
          if (el) { el.focus(); return; }
        }
        const saveBtn = document.getElementById(`save-btn-${identifier}`);
        if (saveBtn) { saveBtn.focus(); return; }
        inputElement
          ?.closest("td")
          ?.nextElementSibling?.querySelector<HTMLElement>("input, button[role='combobox'], button")
          ?.focus();
      }

      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        if (row.isNew) void saveNewRow(identifier, false);
        else if (row.isEdited) saveEditedRow(identifier);
      }
    },
    [saveNewRow, saveEditedRow]
  );

  // ─────────────────────────────────────────────
  // Table instance
  // ─────────────────────────────────────────────

  // tableMeta is stable — errorsVersion intentionally excluded.
  // Cells read errors via errorsRef; MemoizedRow re-renders per row via rowErrorVersions.
  const tableMeta = React.useMemo(
    () => ({
      updateData,
      deleteRow,
      autocompleteData,
      handleCellKeyDown,
      errorsRef,
      clearFieldError,
      saveNewRow,
      saveEditedRow,
    }),
    [updateData, deleteRow, autocompleteData, handleCellKeyDown, clearFieldError, saveNewRow, saveEditedRow]
  );

  const table = useReactTable({
    data,
    columns,
    defaultColumn: {
      size: 140,
      minSize: 60,
      maxSize: 500,
    },
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, globalFilter },
    meta: tableMeta,
  });

  // ── Virtualizer — declared AFTER table so rows is available ──────────────
  const rows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: virtualize ? rows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 42,
    overscan: 5,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalVirtualSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalVirtualSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  // ─────────────────────────────────────────────
  // Excel Export
  // ─────────────────────────────────────────────

  const formatExportWeight = (w: string) => {
    if (!w) return "";
    const lower = String(w).toLowerCase().trim();
    
    if (lower.includes("kg")) {
      const num = parseFloat(lower);
      return !isNaN(num) ? `${num} kg` : lower.replace(/\s+/g, "");
    }
    
    const g = parseFloat(lower);
    if (isNaN(g)) return lower;
    
    if (g >= 1000) {
      return `${Number((g / 1000).toFixed(3))} kg`;
    }
    
    // Reverted logic for grams to original format
    return `${(g / 1000).toFixed(3)}gm`;
  };

  const exportExcel = () => {
    // Navigate to the API route to download ALL entries without pagination
    window.location.href = "/api/export/excel";
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Batch Default Settings */}
      {mode !== "all" && (
        <div className="rounded-[20px] bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
              Batch Default Settings
            </h3>
            <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full ml-2">
              Applies to new rows
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-600 dark:text-slate-300">Date</Label>
              <Input
                type="date"
                value={batchDefaults.date}
                onChange={(e) => setBatchDefaults({ ...batchDefaults, date: e.target.value })}
                className="bg-white/50 dark:bg-slate-800/50 border-white/30 dark:border-white/10 w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 dark:text-slate-300">From Party</Label>
              <Input
                value={batchDefaults.fromParty}
                onChange={(e) => setBatchDefaults({ ...batchDefaults, fromParty: e.target.value })}
                placeholder="Sender Name"
                className="bg-white/50 dark:bg-slate-800/50 border-white/30 dark:border-white/10 w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 dark:text-slate-300">Destination</Label>
              <Input
                value={batchDefaults.destination}
                onChange={(e) =>
                  setBatchDefaults({ ...batchDefaults, destination: e.target.value })
                }
                placeholder="City / Hub"
                className="bg-white/50 dark:bg-slate-800/50 border-white/30 dark:border-white/10 w-full"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 dark:text-slate-300">Weight</Label>
              <div className="flex bg-white/50 dark:bg-slate-800/50 border border-white/30 dark:border-white/10 rounded-md">
                <Input
                  value={batchDefaults.weightNum}
                  onChange={(e) => setBatchDefaults({ ...batchDefaults, weightNum: e.target.value })}
                  className="border-0 bg-transparent w-full text-right"
                  placeholder="0.100"
                />
                <select
                  value={batchDefaults.weightUnit}
                  onChange={(e) =>
                    setBatchDefaults({ ...batchDefaults, weightUnit: e.target.value })
                  }
                  className="bg-transparent px-2 outline-none border-l border-white/30 dark:border-white/10 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 dark:text-slate-300">Status</Label>
              <Select
                value={batchDefaults.status}
                onValueChange={(v) => setBatchDefaults({ ...batchDefaults, status: v || "Cash" })}
              >
                <SelectTrigger className="w-full bg-white/50 dark:bg-slate-800/50 border-white/30 dark:border-white/10 shadow-sm rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Cash", "Account"].map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 dark:text-slate-300">Mode</Label>
              <Select
                value={batchDefaults.mode}
                onValueChange={(v) => setBatchDefaults({ ...batchDefaults, mode: v || "Surface" })}
              >
                <SelectTrigger className="w-full bg-white/50 dark:bg-slate-800/50 border-white/30 dark:border-white/10 shadow-sm rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Surface", "Air", "Cargo", "V Fast"].map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <Button
              onClick={() => setUseBatchDefaults(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-none shadow-md"
            >
              Apply Defaults
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setBatchDefaults({
                  date: new Date().toISOString().split("T")[0],
                  fromParty: "",
                  destination: "",
                  weightNum: "100",
                  weightUnit: "g",
                  status: "Cash",
                  mode: "Surface",
                })
              }
              className="rounded-none border-slate-300 dark:border-slate-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Reset
            </Button>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Input
          placeholder="Global search (Challan, Party, Destination)..."
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(String(e.target.value))}
          className="max-w-sm bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-none"
        />
        <div className="flex gap-2">
          <Button
            onClick={exportExcel}
            variant="outline"
            className="rounded-none bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/40 dark:border-white/10 hover:bg-white/60 dark:hover:bg-slate-800"
          >
            <Download className="mr-2 h-4 w-4" /> Export Excel
          </Button>
          {mode !== "all" && (
            <Button
              onClick={async () => {
                const tempId = await addEmptyRow();
                if (tempId) {
                  // Focus the fromParty field of the new row after DOM settles
                  setTimeout(() => {
                    document.getElementById(`cell-${tempId}-fromParty`)?.focus();
                  }, 50);
                }
              }}
              className="rounded-none bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg text-white"
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Add Courier
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-none overflow-hidden bg-slate-900/40 backdrop-blur-xl border border-white/10 shadow-lg scrollbar-thin scrollbar-thumb-slate-700/50 scrollbar-track-transparent">
        <div
          ref={parentRef}
          className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700/50 scrollbar-track-transparent"
          style={virtualize ? { height: tableHeight, overflowY: "auto" } : undefined}
        >
          <Table className="w-full min-w-[1000px] table-fixed border-collapse">
            <TableHeader className="bg-white/5 dark:bg-slate-800/40 sticky top-0 z-10 backdrop-blur-md">
              {table.getHeaderGroups().map((hg) => (
                <TableRow
                  key={hg.id}
                  className="border-b border-white/5 hover:bg-transparent"
                >
                  {hg.headers.map((h) => (
                    <TableHead
                      key={h.id}
                      className="text-slate-300 text-xs font-semibold uppercase tracking-wide h-11 whitespace-nowrap overflow-hidden text-ellipsis px-1 select-none"
                      style={{ width: h.column.columnDef.size }}
                    >
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length ? (
                virtualize ? (
                  // ── Virtualised rows (only in-viewport rows rendered) ──
                  <>
                    {paddingTop > 0 && (
                      <tr><td style={{ height: paddingTop }} colSpan={columns.length + 1} /></tr>
                    )}
                    {virtualItems.map((vr) => {
                      const row = rows[vr.index];
                      const identifier = row.original.tempId || row.original.id;
                      return (
                        <MemoizedRow
                          key={row.id}
                          row={row}
                          rowErrorVersion={rowErrorVersions[identifier] || 0}
                          errorsRef={errorsRef}
                          saveNewRow={saveNewRow}
                          saveEditedRow={saveEditedRow}
                        />
                      );
                    })}
                    {paddingBottom > 0 && (
                      <tr><td style={{ height: paddingBottom }} colSpan={columns.length + 1} /></tr>
                    )}
                  </>
                ) : (
                  // ── Normal rows (used when virtualize=false, e.g. 20-row entry page) ──
                  rows.map((row) => {
                    const identifier = row.original.tempId || row.original.id;
                    return (
                      <MemoizedRow
                        key={row.id}
                        row={row}
                        rowErrorVersion={rowErrorVersions[identifier] || 0}
                        errorsRef={errorsRef}
                        saveNewRow={saveNewRow}
                        saveEditedRow={saveEditedRow}
                      />
                    );
                  })
                )
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-48 text-center text-slate-500"
                  >
                    No courier entries found. Try adding a new row.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between py-4">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          <strong>TAB</strong> — next field &nbsp;|&nbsp; <strong>ENTER on Save</strong> — save &amp; add row
          &nbsp;|&nbsp; <strong>CTRL+S</strong> — save row
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {table.getRowModel().rows.length} entries
        </div>
      </div>
    </div>
  );
}
