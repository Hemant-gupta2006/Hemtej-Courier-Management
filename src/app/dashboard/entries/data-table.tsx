"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CourierEntry } from "@prisma/client";
import { PlusCircle, Download, Upload, Settings2, RefreshCw, Search, X, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import * as XLSX from "xlsx";
import { useRegisters } from "@/context/RegisterContext";
import { getAutocompleteData, clearAutocompleteCache } from "@/lib/autocomplete";
import { ImportPreviewModal, PreviewData } from "@/components/ImportPreviewModal";

interface BatchDefaults {
  date: string;
  fromParty: string;
  destination: string;
  weightNum: string;
  weightUnit: string;
  status: string;
  mode: string;
}

interface AppliedFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  totalCount?: number;
  pageIndex?: number;
  pageSize?: number;
  mode?: "entry" | "all";
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  startDate?: string;
  onStartDateChange?: (val: string) => void;
  endDate?: string;
  onEndDateChange?: (val: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (val: string) => void;
  appliedFilters?: AppliedFilters;
  onApplyFilters?: () => void;
  onApplyStatusFilter?: (status: string) => void;
  onClearDate?: () => void;
  onClearStatus?: () => void;
  onClearAll?: () => void;
  onExportExcel?: () => void;
  activeRegister?: any;
}

interface LocalRow {
  id: string;
  tempId?: string;
  srNo?: number;
  date: string;
  challanNo: number | string;
  fromParty: string;
  toParty: string;
  weightValue: number;
  weightUnit: string;
  destination: string;
  amount: number;
  status: string;
  mode: string;
  isNew?: boolean;
  isEdited?: boolean;
  registerId?: string | null;
}

type ValidationErrors = Record<string, Record<string, string>>;

const capitalizeWords = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

interface MemoizedRowProps {
  row: any;
  rowErrorVersion: number;
  errorsRef: React.MutableRefObject<ValidationErrors>;
  saveNewRow: (identifier: string, addNextRow?: boolean) => Promise<{ success: boolean; nextTempId?: string }>;
  saveEditedRow: (identifier: string) => void;
}

const MemoizedRow = React.memo(
  function MemoRow({ row, rowErrorVersion, errorsRef, saveNewRow, saveEditedRow }: MemoizedRowProps) {
    const identifier: string = row.original.tempId || row.original.id;

    return (
      <TableRow
        className="group border-b border-white/5 transition-all duration-150 hover:bg-white/5"
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
      </TableRow>
    );
  },
  (prevProps, nextProps) => {
    const prevData = prevProps.row.original;
    const nextData = nextProps.row.original;

    // Re-render if any of the data fields have changed
    const keys = [
      "date",
      "challanNo",
      "fromParty",
      "toParty",
      "weightValue",
      "weightUnit",
      "destination",
      "amount",
      "status",
      "mode",
      "isNew",
      "isEdited",
      "id",
      "tempId"
    ];
    for (const key of keys) {
      if (prevData[key] !== nextData[key]) {
        return false;
      }
    }

    // Re-render if the error version has changed
    if (prevProps.rowErrorVersion !== nextProps.rowErrorVersion) {
      return false;
    }

    return true;
  }
);

export function DataTable<TData, TValue>({
  columns,
  data: initialData,
  totalCount = 0,
  pageIndex = 0,
  pageSize = 50,
  mode = "entry",
  searchValue = "",
  onSearchChange,
  startDate = "",
  onStartDateChange,
  endDate = "",
  onEndDateChange,
  statusFilter = "all",
  onStatusFilterChange,
  appliedFilters,
  onApplyFilters,
  onClearDate,
  onClearStatus,
  onClearAll,
  onExportExcel,
  activeRegister,
}: DataTableProps<TData, TValue>) {
  const [data, setData] = useState<LocalRow[]>([]);
  const { refreshRegisters } = useRegisters();
  const dataRef = useRef<LocalRow[]>([]);
  const tableRef = useRef<any>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const [sorting, setSorting] = useState<SortingState>([
    { id: "srNo", desc: true }
  ]);

  const [autocompleteData, setAutocompleteData] = useState<{
    fromParties: string[];
    toParties: string[];
    destinations: string[];
  }>({ fromParties: [], toParties: [], destinations: [] });

  const [batchDefaults, setBatchDefaults] = useState<BatchDefaults>({
    date: new Date().toISOString().split("T")[0],
    fromParty: "",
    destination: "",
    weightNum: "100",
    weightUnit: "gm",
    status: "Account",
    mode: "Surface",
  });
  const [useBatchDefaults, setUseBatchDefaults] = useState(false);

  const errorsRef = useRef<ValidationErrors>({});
  const [rowErrorVersions, setRowErrorVersions] = useState<Record<string, number>>({});
  const nextChallanRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const lastActiveRegisterIdRef = useRef<string | null>(null);

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<PreviewData | null>(null);
  const [importFileName, setImportFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isReadOnly = activeRegister?.status === "Locked" || activeRegister?.status === "Archived";

  let minMaxProps: { min?: string; max?: string } = {};
  if (activeRegister) {
    const { month, year } = activeRegister;
    const pad = (num: number) => String(num).padStart(2, '0');
    const minDate = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const maxDate = `${year}-${pad(month)}-${pad(lastDay)}`;
    minMaxProps = { min: minDate, max: maxDate };
  }

  const triggerRowErrorUpdate = useCallback((identifier: string) => {
    setRowErrorVersions((prev) => ({
      ...prev,
      [identifier]: (prev[identifier] || 0) + 1,
    }));
  }, []);

  const clearFieldError = useCallback(
    (identifier: string, columnId: string) => {
      if (errorsRef.current[identifier]?.[columnId]) {
        delete errorsRef.current[identifier][columnId];
        if (Object.keys(errorsRef.current[identifier]).length === 0) {
          delete errorsRef.current[identifier];
        }
        triggerRowErrorUpdate(identifier);
      }
    },
    [triggerRowErrorUpdate]
  );

  const clearAllRowErrors = useCallback(
    (identifier: string) => {
      if (errorsRef.current[identifier]) {
        delete errorsRef.current[identifier];
        triggerRowErrorUpdate(identifier);
      }
    },
    [triggerRowErrorUpdate]
  );

  useEffect(() => {
    if (activeRegister) {
      if (activeRegister.id !== lastActiveRegisterIdRef.current) {
        lastActiveRegisterIdRef.current = activeRegister.id;
        const { month, year } = activeRegister;
        const pad = (num: number) => String(num).padStart(2, '0');
        const today = new Date();
        let defaultDay = pad(today.getDate());
        const lastDayInMonth = new Date(year, month, 0).getDate();
        if (today.getMonth() + 1 !== month || today.getFullYear() !== year) {
          defaultDay = "01";
        } else if (today.getDate() > lastDayInMonth) {
          defaultDay = pad(lastDayInMonth);
        }
        setBatchDefaults((prev) => ({
          ...prev,
          date: `${year}-${pad(month)}-${defaultDay}`,
        }));
      }
    } else {
      lastActiveRegisterIdRef.current = null;
    }
  }, [activeRegister]);

  useEffect(() => {
    const fetchNextChallan = async () => {
      try {
        const regParam = activeRegister?.id ? `?registerId=${activeRegister.id}` : "";
        const res = await fetch(`/api/couriers/next-challan${regParam}`);
        if (res.ok) {
          const json = await res.json();
          const val = json.data?.nextChallanNo ?? json.nextChallanNo ?? json.nextChallan;
          if (val && !isNaN(Number(val))) {
            nextChallanRef.current = Number(val);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchNextChallan();
  }, [activeRegister]);

  useEffect(() => {
    setData(initialData as unknown as LocalRow[]);
  }, [initialData]);

  useEffect(() => {
    const fetchAutocomplete = async () => {
      try {
        const data = await getAutocompleteData();
        setAutocompleteData(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchAutocomplete();
  }, []);

  const learnAutocompleteValues = useCallback((fromParty?: string, toParty?: string, destination?: string) => {
    setAutocompleteData((prev) => {
      const updateList = (list: string[], val?: string) => {
        if (!val || !val.trim()) return list;
        const trimmed = val.trim();
        const filtered = list.filter((i) => i.toLowerCase() !== trimmed.toLowerCase());
        return [trimmed, ...filtered];
      };
      return {
        fromParties: updateList(prev.fromParties || [], fromParty),
        toParties: updateList(prev.toParties || [], toParty),
        destinations: updateList(prev.destinations || [], destination),
      };
    });
  }, []);

  const getNextChallan = useCallback((d: LocalRow[]): number => {
    if (d && d.length > 0) {
      for (const r of d) {
        const num = Number(r.challanNo);
        if (!isNaN(num) && num > 0) {
          return num + 1;
        }
      }
    }
    return nextChallanRef.current || 1001;
  }, []);

  const addEmptyRow = useCallback(async (): Promise<string | null> => {
    if (activeRegister?.status === "Locked" || activeRegister?.status === "Archived") {
      toast.error(`Cannot add entries to a ${activeRegister.status.toLowerCase()} register.`);
      return null;
    }

    const hasUnsavedNewRow = dataRef.current.some((r) => r.isNew);
    if (hasUnsavedNewRow) {
      toast.error("Please save the current unsaved row before adding another one.");
      return null;
    }

    const nextChallan = getNextChallan(dataRef.current);
    const tempId = `temp-${Date.now()}`;
    let rowDate = new Date().toISOString().split("T")[0];
    if (activeRegister) {
      const { month, year } = activeRegister;
      const pad = (num: number) => String(num).padStart(2, '0');
      const today = new Date();
      if (today.getMonth() + 1 === month && today.getFullYear() === year) {
        rowDate = today.toISOString().split("T")[0];
      } else {
        rowDate = `${year}-${pad(month)}-01`;
      }
    }

    const newRow: LocalRow = {
      id: tempId,
      tempId,
      date: batchDefaults.date || rowDate,
      challanNo: nextChallan,
      fromParty: useBatchDefaults ? batchDefaults.fromParty : "",
      toParty: "",
      weightValue: useBatchDefaults ? parseFloat(batchDefaults.weightNum) || 100 : 100,
      weightUnit: useBatchDefaults ? batchDefaults.weightUnit : "gm",
      destination: useBatchDefaults ? batchDefaults.destination : "",
      amount: 30,
      status: useBatchDefaults ? batchDefaults.status : "Account",
      mode: useBatchDefaults ? batchDefaults.mode : "Surface",
      isNew: true,
      registerId: activeRegister?.id || null,
    };

    setData((prev) => [newRow, ...prev]);
    return tempId;
  }, [useBatchDefaults, batchDefaults, activeRegister, getNextChallan]);

  const updateData = useCallback(
    (identifier: string, columnId: string, value: unknown) => {
      const parsedValue = columnId === "amount" || columnId === "challanNo" ? (parseFloat(value as string) || 0) : value;
      const next = dataRef.current.map((row) => {
        const rowKey = row.tempId || row.id;
        if (rowKey === identifier) {
          const updated = {
            ...row,
            [columnId]: parsedValue,
            isEdited: !row.isNew ? true : row.isEdited,
          };

          if (columnId === "weightValue" || columnId === "weightUnit") {
            const wVal = columnId === "weightValue" ? (parsedValue as number) : row.weightValue;
            const wUnit = columnId === "weightUnit" ? (parsedValue as string) : row.weightUnit;
            const weightInGrams = wUnit === "kg" ? wVal * 1000 : wVal;
            if (weightInGrams > 0) {
              const calculatedAmount = weightInGrams >= 1000 
                ? Math.ceil(weightInGrams / 1000) * 50 
                : Math.max(30, Math.ceil(weightInGrams / 100) * 10);
              updated.amount = calculatedAmount;
            }
          }
          return updated;
        }
        return row;
      });
      dataRef.current = next;
      setData(next);
    },
    []
  );

  const deleteRow = useCallback(async (id: string, identifier: string) => {
    if (activeRegister?.status === "Locked" || activeRegister?.status === "Archived") {
      toast.error(`Cannot delete entries from a ${activeRegister.status.toLowerCase()} register.`);
      return;
    }

    if (identifier.startsWith("temp-")) {
      setData((prev) => prev.filter((r) => (r.tempId || r.id) !== identifier));
      clearAllRowErrors(identifier);
      toast.success("Row removed");
      return;
    }

    try {
      const res = await fetch(`/api/couriers/${id}`, { method: "DELETE" });
      if (res.ok) {
        setData((prev) => prev.filter((r) => r.id !== id));
        clearAllRowErrors(identifier);
        toast.success("Courier entry deleted");
        refreshRegisters();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete entry");
      }
    } catch (e) {
      toast.error("Network error while deleting entry");
    }
  }, [clearAllRowErrors, activeRegister]);

  const validateRow = useCallback((row: LocalRow): Record<string, string> => {
    const errs: Record<string, string> = {};

    // 1. Date
    if (!row.date || !String(row.date).trim()) {
      errs.date = "Required";
    }

    // 2. Challan No (Numeric, > 0, Unique)
    if (row.challanNo === undefined || row.challanNo === null || String(row.challanNo).trim() === "") {
      errs.challanNo = "Required";
    } else {
      const numChallan = Number(row.challanNo);
      if (isNaN(numChallan) || numChallan <= 0) {
        errs.challanNo = "Invalid";
      } else {
        const currentIdentifier = row.tempId || row.id;
        const isDuplicate = dataRef.current.some(
          (r) => (r.tempId || r.id) !== currentIdentifier && String(r.challanNo) === String(row.challanNo)
        );
        if (isDuplicate) {
          errs.challanNo = "Duplicate";
        }
      }
    }

    // 3. From Party
    if (!row.fromParty || !String(row.fromParty).trim()) {
      errs.fromParty = "Required";
    }

    // 4. To Party
    if (!row.toParty || !String(row.toParty).trim()) {
      errs.toParty = "Required";
    }

    // 5. Weight Value
    if (row.weightValue === undefined || row.weightValue === null || String(row.weightValue).trim() === "") {
      errs.weightValue = "Required";
    } else {
      const numWeight = Number(row.weightValue);
      if (isNaN(numWeight) || numWeight <= 0) {
        errs.weightValue = "Invalid";
      }
    }

    // 6. Weight Unit
    if (!row.weightUnit || !String(row.weightUnit).trim()) {
      errs.weightUnit = "Required";
    }

    // 7. Destination
    if (!row.destination || !String(row.destination).trim()) {
      errs.destination = "Required";
    }

    // 8. Status
    if (!row.status || !String(row.status).trim()) {
      errs.status = "Required";
    }

    // 9. Mode
    if (!row.mode || !String(row.mode).trim()) {
      errs.mode = "Required";
    }

    return errs;
  }, []);

  const saveNewRow = useCallback(
    async (identifier: string, addNextRow = false): Promise<{ success: boolean; nextTempId?: string }> => {
      if (activeRegister?.status === "Locked" || activeRegister?.status === "Archived") {
        toast.error(`Cannot save entries to a ${activeRegister.status.toLowerCase()} register.`);
        return { success: false };
      }

      if (isSavingRef.current) return { success: false };
      isSavingRef.current = true;

      const currentData = dataRef.current;
      const targetRow = currentData.find((r) => (r.tempId || r.id) === identifier);
      if (!targetRow) {
        isSavingRef.current = false;
        return { success: false };
      }

      const fieldErrs = validateRow(targetRow);
      if (Object.keys(fieldErrs).length > 0) {
        errorsRef.current[identifier] = fieldErrs;
        triggerRowErrorUpdate(identifier);
        toast.warning("Please fill all required fields before saving.");
        isSavingRef.current = false;
        return { success: false };
      }

      clearAllRowErrors(identifier);

      const payload = {
        date: targetRow.date,
        challanNo: targetRow.challanNo,
        fromParty: capitalizeWords(targetRow.fromParty || ""),
        toParty: capitalizeWords(targetRow.toParty || ""),
        weightValue: targetRow.weightValue,
        weightUnit: targetRow.weightUnit,
        destination: capitalizeWords(targetRow.destination || ""),
        amount: targetRow.amount,
        status: targetRow.status,
        mode: targetRow.mode,
        registerId: activeRegister?.id || targetRow.registerId || null,
      };

      // ── OPTIMISTIC UI: Instant visual update + spawn new row ──
      const nextTempId = addNextRow ? `temp-${Date.now()}` : undefined;
      const predictedChallan = !isNaN(Number(targetRow.challanNo))
        ? Number(targetRow.challanNo) + 1
        : getNextChallan(currentData);

      setData((committed) => {
        let updated = committed.map((r) => {
          if ((r.tempId || r.id) === identifier) {
            return {
              ...r,
              fromParty: payload.fromParty,
              toParty: payload.toParty,
              destination: payload.destination,
              isNew: false,
              isEdited: false
            };
          }
          return r;
        });

        if (addNextRow && nextTempId) {
          let rowDate = new Date().toISOString().split("T")[0];
          if (activeRegister) {
            const { month, year } = activeRegister;
            const pad = (num: number) => String(num).padStart(2, '0');
            const today = new Date();
            if (today.getMonth() + 1 === month && today.getFullYear() === year) {
              rowDate = today.toISOString().split("T")[0];
            } else {
              rowDate = `${year}-${pad(month)}-01`;
            }
          }

          const freshRow: LocalRow = {
            id: nextTempId,
            tempId: nextTempId,
            date: batchDefaults.date || rowDate,
            challanNo: predictedChallan,
            fromParty: useBatchDefaults ? batchDefaults.fromParty : "",
            toParty: "",
            weightValue: useBatchDefaults ? parseFloat(batchDefaults.weightNum) || 100 : 100,
            weightUnit: useBatchDefaults ? batchDefaults.weightUnit : "gm",
            destination: useBatchDefaults ? batchDefaults.destination : "",
            amount: 30,
            status: useBatchDefaults ? batchDefaults.status : "Account",
            mode: useBatchDefaults ? batchDefaults.mode : "Surface",
            isNew: true,
            registerId: activeRegister?.id || null,
          };
          return [freshRow, ...updated];
        }
        return updated;
      });

      // Synchronize dataRef.current immediately with the optimistic state
      setTimeout(() => {
        isSavingRef.current = false;
      }, 50);

      // ── BACKGROUND SAVE ──
      (async () => {
        try {
          const res = await fetch("/api/couriers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            const resJson = await res.json();
            const saved: CourierEntry = resJson.data || resJson;
            toast.success("Courier entry saved!");
            refreshRegisters();
            learnAutocompleteValues(payload.fromParty, payload.toParty, payload.destination);
            clearAutocompleteCache();
            
            // Update cached next challan
            nextChallanRef.current = Number(saved.challanNo) + 1;

            setData((committed) => {
              const next = committed.map((r) => {
                if (r.tempId === identifier || r.id === identifier) {
                  return {
                    ...r,
                    id: saved.id,
                    srNo: saved.srNo ?? undefined,
                    challanNo: saved.challanNo,
                    tempId: undefined,
                    isNew: false,
                    isEdited: false
                  };
                }
                return r;
              });
              dataRef.current = next;
              return next;
            });
          } else {
            const err = await res.json().catch(() => ({}));
            toast.error(err.error || `Failed to save entry (${res.status})`);
            // Rollback optimistic state on failure
            setData((committed) => {
              const next = committed.map((r) => {
                if (r.id === identifier || r.tempId === identifier) {
                  return { ...r, isNew: true };
                }
                return r;
              });
              dataRef.current = next;
              return next;
            });
          }
        } catch (e) {
          toast.error("Network error while saving entry");
          // Rollback optimistic state on failure
          setData((committed) => {
            const next = committed.map((r) => {
              if (r.id === identifier || r.tempId === identifier) {
                return { ...r, isNew: true };
              }
              return r;
            });
            dataRef.current = next;
            return next;
          });
        }
      })();

      return { success: true, nextTempId };
    },
    [validateRow, activeRegister, getNextChallan, useBatchDefaults, batchDefaults, refreshRegisters, learnAutocompleteValues]
  );

  const saveEditedRow = useCallback(
    async (identifier: string): Promise<boolean> => {
      if (activeRegister?.status === "Locked" || activeRegister?.status === "Archived") {
        toast.error(`Cannot modify entries in a ${activeRegister.status.toLowerCase()} register.`);
        return false;
      }

      const targetRow = dataRef.current.find((r) => (r.tempId || r.id) === identifier);
      if (!targetRow) return false;

      const fieldErrs = validateRow(targetRow);
      if (Object.keys(fieldErrs).length > 0) {
        errorsRef.current[identifier] = fieldErrs;
        triggerRowErrorUpdate(identifier);
        toast.error("Please fix validation errors before saving.");
        return false;
      }

      clearAllRowErrors(identifier);

      const payload = {
        date: targetRow.date,
        challanNo: targetRow.challanNo,
        fromParty: targetRow.fromParty,
        toParty: targetRow.toParty,
        weightValue: targetRow.weightValue,
        weightUnit: targetRow.weightUnit,
        destination: targetRow.destination,
        amount: targetRow.amount,
        status: targetRow.status,
        mode: targetRow.mode,
      };

      // ── OPTIMISTIC UI: Instantly mark as saved ──
      const previousData = dataRef.current;
      const next = dataRef.current.map((r) =>
        (r.tempId || r.id) === identifier ? { ...r, isEdited: false } : r
      );
      dataRef.current = next;
      setData(next);

      // ── BACKGROUND SAVE ──
      (async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const res = await fetch(`/api/couriers/${targetRow.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            toast.success("Courier entry updated!");
            refreshRegisters();
            learnAutocompleteValues(targetRow.fromParty, targetRow.toParty, targetRow.destination);
          } else {
            // Revert on error
            dataRef.current = previousData;
            setData(previousData);
            const err = await res.json().catch(() => ({}));
            if (res.status === 404) {
              toast.error("Entry not found.");
            } else if (res.status === 500) {
              toast.error("Server error while saving.");
            } else {
              toast.error(err.error || `Error updating entry (${res.status})`);
            }
          }
        } catch (e: any) {
          // Revert on error
          dataRef.current = previousData;
          setData(previousData);
          if (e.name === "AbortError") {
            toast.error("Request timed out. Please retry.");
          } else if (typeof navigator !== "undefined" && !navigator.onLine) {
            toast.error("You're offline. Please check your connection.");
          } else {
            toast.error("Network error while updating entry");
          }
        }
      })();

      return true;
    },
    [validateRow, clearAllRowErrors, triggerRowErrorUpdate, activeRegister, refreshRegisters, learnAutocompleteValues]
  );

  const handleCellKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      identifier: string,
      columnId: string,
      inputElement: HTMLInputElement | null,
      tableInstance?: any
    ) => {
      if (e.key !== "Enter") return;
      e.preventDefault();

      const currentData = dataRef.current;
      const targetRow = currentData.find((r) => (r.tempId || r.id) === identifier);
      if (!targetRow) return;

      // Check validation for the current field or row
      const fieldErrs = validateRow(targetRow);

      // If the currently edited field has a validation error (e.g. empty From Party), stop immediately
      if (fieldErrs[columnId]) {
        errorsRef.current[identifier] = {
          ...(errorsRef.current[identifier] || {}),
          [columnId]: fieldErrs[columnId],
        };
        triggerRowErrorUpdate(identifier);
        inputElement?.focus();
        const fieldLabel = columnId === "fromParty" ? "From Party" : columnId === "toParty" ? "To Party" : columnId === "challanNo" ? "Challan No" : columnId;
        toast.error(`${fieldLabel} is ${fieldErrs[columnId].toLowerCase()}`);
        return;
      }

      if (columnId === "amount") {
        if (Object.keys(fieldErrs).length > 0) {
          errorsRef.current[identifier] = fieldErrs;
          triggerRowErrorUpdate(identifier);
          const firstErrField = Object.keys(fieldErrs)[0];
          const errEl = document.getElementById(`cell-${identifier}-${firstErrField}`);
          if (errEl) {
            errEl.focus();
          } else if (inputElement) {
            inputElement.focus();
          }
          toast.error("Please fill in all required fields marked in red.");
          return;
        }

        clearAllRowErrors(identifier);

        let savePromise: Promise<{ success: boolean; nextTempId?: string }>;
        if (targetRow.isNew) {
          savePromise = saveNewRow(identifier, true);
        } else if (targetRow.isEdited) {
          savePromise = saveEditedRow(identifier).then((succ) => ({ success: succ }));
        } else {
          savePromise = Promise.resolve({ success: true });
        }

        savePromise.then((res: any) => {
          if (res.success) {
            const nextIdentifier = res.nextTempId;
            if (nextIdentifier) {
              setTimeout(() => {
                const nextFromPartyEl = document.getElementById(`cell-${nextIdentifier}-fromParty`) as HTMLInputElement | null;
                if (nextFromPartyEl) {
                  nextFromPartyEl.focus();
                  nextFromPartyEl.select?.();
                }
              }, 50);
            } else {
              const tbl = tableInstance || tableRef.current;
              const visibleRows = tbl ? tbl.getRowModel().rows : [];
              const rowIndex = visibleRows.findIndex((r: any) => (r.original.tempId || r.original.id) === identifier);
              if (rowIndex !== -1 && rowIndex + 1 < visibleRows.length) {
                const nextRow = visibleRows[rowIndex + 1];
                const nextId = (nextRow.original as any).tempId || (nextRow.original as any).id;
                setTimeout(() => {
                  const nextAmountEl = document.getElementById(`cell-${nextId}-amount`) as HTMLInputElement | null;
                  if (nextAmountEl) {
                    nextAmountEl.focus();
                    nextAmountEl.select?.();
                  }
                }, 50);
              }
            }
          } else {
            inputElement?.focus();
            inputElement?.select?.();
          }
        });
        return;
      }

      const columnOrder = [
        "date",
        "challanNo",
        "fromParty",
        "toParty",
        "weightValue",
        "destination",
        "amount",
        "status",
        "mode",
      ];

      const currentIndex = columnOrder.indexOf(columnId);

      if (currentIndex !== -1 && currentIndex < columnOrder.length - 1) {
        const nextCol = columnOrder[currentIndex + 1];
        const nextEl = document.getElementById(`cell-${identifier}-${nextCol}`);
        if (nextEl) {
          nextEl.focus();
        }
      } else {
        // Last field in row, validate full row before saving
        if (Object.keys(fieldErrs).length > 0) {
          errorsRef.current[identifier] = fieldErrs;
          triggerRowErrorUpdate(identifier);
          toast.error("Please fix validation errors before saving.");
          return;
        }
        const saveBtn = document.getElementById(`save-btn-${identifier}`);
        if (saveBtn) {
          saveBtn.click();
        }
      }
    },
    [validateRow, triggerRowErrorUpdate, clearAllRowErrors, saveNewRow, saveEditedRow]
  );

  const exportExcel = useCallback(() => {
    const exportRows = data.map((r, i) => ({
      "Sr.No": i + 1,
      Date: r.date ? new Date(r.date).toISOString().split("T")[0] : "",
      "Challan No": r.challanNo,
      "From Party": r.fromParty,
      "To Party": r.toParty,
      Weight: `${r.weightValue} ${r.weightUnit}`,
      Destination: r.destination,
      Amount: r.amount,
      Status: r.status,
      Mode: r.mode,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Courier Entries");
    XLSX.writeFile(workbook, `Courier_Entries_${new Date().toISOString().split("T")[0]}.xlsx`);
  }, [data]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRegister) return;
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws, { raw: true });

        if (!Array.isArray(rawData) || rawData.length === 0) {
          toast.error("The uploaded Excel file is empty.");
          return;
        }

        // Validate Headers
        const firstRow = rawData[0] as any;
        if (!("Challan No" in firstRow) || !("Amount" in firstRow)) {
          toast.error("Invalid Excel format. Must contain 'Challan No' and 'Amount' headers.");
          return;
        }

        const items = rawData.map((row: any) => {
          let parsedDate = "";
          const rawDate = row["Date"];
          if (typeof rawDate === "number") {
            const d = XLSX.SSF.parse_date_code(rawDate);
            parsedDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
          } else if (typeof rawDate === "string") {
            // Handle if it's already a string like "2026-10-01" or "01-10-2026"
            // For now just pass it as string, the backend can try to parse it if needed
            parsedDate = rawDate.trim();
          }

          return {
            challanNo: row["Challan No"],
            amount: row["Amount"],
            date: parsedDate,
            fromParty: row["From Party"],
            toParty: row["To Party"],
            destination: row["Destination"],
            weight: row["Weight"],
            status: row["Status"],
            mode: row["Mode"],
          };
        }).filter(item => item.challanNo != null && item.challanNo !== "");

        if (items.length === 0) {
          toast.error("No valid Challan Numbers found in the Excel file.");
          return;
        }

        // Call Preview API
        toast.loading("Analyzing Excel file...", { id: "excel-preview" });
        const res = await fetch("/api/couriers/import-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registerId: activeRegister.id, items })
        });
        
        const json = await res.json();
        toast.dismiss("excel-preview");

        if (json.success) {
          setImportPreviewData(json.data);
          setIsImportModalOpen(true);
        } else {
          toast.error(json.error || "Failed to generate import preview");
        }
      } catch (err) {
        console.error(err);
        toast.dismiss("excel-preview");
        toast.error("Error reading the Excel file.");
      }
    };
    reader.readAsBinaryString(file);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const confirmImport = async (insertions: any[] = []) => {
    if (!importPreviewData || !activeRegister) return;
    setIsImporting(true);

    try {
      const res = await fetch("/api/couriers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registerId: activeRegister.id,
          updates: importPreviewData.updates,
          insertions,
          fileName: importFileName,
          totalRows: importPreviewData.totalRows,
          notFoundCount: importPreviewData.notFound.length,
          duplicatesCount: importPreviewData.duplicates.length
        })
      });

      const json = await res.json();
      if (json.success) {
        toast.success(`Successfully updated ${json.data.updatedCount} and added ${json.data.insertedCount} couriers.`);
        setIsImportModalOpen(false);
        refreshRegisters();
        
        // Optimistically apply updates to the table
        let nextData = dataRef.current.map(row => {
          const update = importPreviewData.updates.find(u => Number(u.challanNo) === Number(row.challanNo));
          if (update) {
            const nextRow = { ...row };
            for (const change of update.changes) {
              if (change.internalKey === "date") {
                (nextRow as any).date = change.newValue ? new Date(change.newValue) : new Date();
              } else if (change.internalKey === "weight") {
                nextRow.weightValue = change.internalVal.value;
                nextRow.weightUnit = change.internalVal.unit;
              } else if (change.internalKey === "amount") {
                nextRow.amount = Number(change.newValue);
              } else if (["fromParty", "toParty", "destination", "status", "mode"].includes(change.internalKey)) {
                (nextRow as any)[change.internalKey] = change.newValue;
              }
            }
            return nextRow;
          }
          return row;
        });

        // Insert new rows returned from backend (so we have proper IDs and default fields)
        if (json.data.insertedRecords && Array.isArray(json.data.insertedRecords)) {
          nextData = [...json.data.insertedRecords, ...nextData];
        }

        dataRef.current = nextData;
        setData(nextData);
      } else {
        toast.error(json.error || "Failed to process import");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error during import");
    } finally {
      setIsImporting(false);
    }
  };

  const localRowOffset = useMemo(() => {
    return data.filter((r) => r.isNew).length;
  }, [data]);

  const effectiveTotalCount = useMemo(() => {
    const initialSavedCount = (initialData || []).length;
    const currentSavedCount = data.filter((r) => !r.isNew).length;
    const difference = currentSavedCount - initialSavedCount;
    return Math.max(0, totalCount + difference);
  }, [initialData, data, totalCount]);

  const tableMeta = useMemo(
    () => ({
      updateData,
      deleteRow,
      saveNewRow,
      saveEditedRow,
      autocompleteData,
      handleCellKeyDown,
      errorsRef,
      clearFieldError,
      mode,
      totalCount: effectiveTotalCount,
      pageIndex,
      pageSize,
      localRowOffset,
      activeRegister,
      filterProps: mode === "all" ? {
        startDate,
        onStartDateChange: onStartDateChange || (() => { }),
        endDate,
        onEndDateChange: onEndDateChange || (() => { }),
        statusFilter,
        onStatusFilterChange: onStatusFilterChange || (() => { }),
        onApplyFilters: onApplyFilters || (() => { }),
        onApplyStatusFilter: (status: string) => {
          onStatusFilterChange?.(status);
          onApplyFilters?.();
        }
      } : undefined,
      autoSaveRow: (id: string) => {
        saveEditedRow(id);
      }
    }),
    [
      updateData,
      deleteRow,
      saveNewRow,
      saveEditedRow,
      autocompleteData,
      handleCellKeyDown,
      clearFieldError,
      mode,
      effectiveTotalCount,
      pageIndex,
      pageSize,
      localRowOffset,
      activeRegister,
      startDate,
      onStartDateChange,
      endDate,
      onEndDateChange,
      statusFilter,
      onStatusFilterChange,
      onApplyFilters
    ]
  );

  const table = useReactTable({
    data: data as unknown as TData[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    meta: tableMeta,
  });

  tableRef.current = table;

  const parentRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const virtualize = mode === "all";

  const rowVirtualizer = useVirtualizer({
    count: virtualize ? rows.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const virtualItems = virtualize ? rowVirtualizer.getVirtualItems() : [];
  const totalSize = virtualize ? rowVirtualizer.getTotalSize() : 0;
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - virtualItems[virtualItems.length - 1].end
      : 0;

  const tableHeight = useMemo(() => {
    if (mode === "entry") {
      return "calc(100vh - 145px)";
    }
    return "calc(100vh - 210px)";
  }, [mode]);

  return (
    <div className="w-full space-y-1.5">
      {/* Entry mode: Single consolidated card containing Default Date, Export Excel, and Add Courier */}
      {mode !== "all" && (
        <div className="rounded-[14px] bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-sm px-3 py-1.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold text-slate-800 dark:text-white whitespace-nowrap">
                Default Date:
              </span>
            </div>
            <Input
              type="date"
              disabled={isReadOnly}
              value={batchDefaults.date}
              onChange={(e) => setBatchDefaults({ ...batchDefaults, date: e.target.value })}
              className="bg-white/50 dark:bg-slate-800/50 border-white/30 dark:border-white/10 h-9 w-40 text-sm focus-visible:ring-1 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              {...minMaxProps}
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              disabled={isReadOnly}
              className="h-9 rounded-xl bg-white/10 dark:bg-slate-900/50 backdrop-blur-xl border border-white/20 dark:border-white/10 hover:bg-white/20 text-sm font-medium shadow-sm px-3"
            >
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button
              onClick={onExportExcel || exportExcel}
              variant="outline"
              className="h-9 rounded-xl bg-white/10 dark:bg-slate-900/50 backdrop-blur-xl border border-white/20 dark:border-white/10 hover:bg-white/20 text-sm font-medium shadow-sm px-3"
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              disabled={isReadOnly}
              onClick={async () => {
                const tempId = await addEmptyRow();
                if (tempId) {
                  setTimeout(() => {
                    document.getElementById(`cell-${tempId}-fromParty`)?.focus();
                  }, 50);
                }
              }}
              className="h-9 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg shadow-blue-500/25 text-white font-semibold text-sm px-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Add Courier
            </Button>
          </div>
        </div>
      )}

      {/* Reports / All mode Action Bar */}
      {mode === "all" && (
        <div className="flex flex-col gap-3 mb-2">
          <div className="flex flex-row gap-2 w-full items-center">
            {/* Search */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onApplyFilters?.();
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
              }}
              className="relative flex-1 min-w-0 max-w-sm"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                type="search"
                enterKeyHint="search"
                placeholder="Search..."
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="pl-9 h-10 bg-white/10 dark:bg-slate-900/50 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl text-sm placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-blue-500 shadow-sm"
              />
            </form>

            {/* Export — pushed to far right */}
            <Button
              onClick={onExportExcel || exportExcel}
              variant="outline"
              className="ml-auto h-10 rounded-xl bg-white/10 dark:bg-slate-900/50 backdrop-blur-xl border border-white/20 dark:border-white/10 hover:bg-white/20 text-sm font-medium shadow-sm flex-shrink-0 px-3 sm:px-4"
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export Excel</span>
            </Button>
          </div>

          {/* Active Filter Chips */}
          {appliedFilters && ((appliedFilters.startDate && appliedFilters.endDate) || (appliedFilters.status && appliedFilters.status !== "all")) && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {appliedFilters.startDate && appliedFilters.endDate && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-full text-xs font-medium">
                  Date: {appliedFilters.startDate} – {appliedFilters.endDate}
                  <button onClick={onClearDate} className="hover:bg-blue-500/20 rounded-full p-0.5 transition-colors"><X className="w-3 h-3" /></button>
                </div>
              )}
              {appliedFilters.status && appliedFilters.status !== "all" && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-full text-xs font-medium">
                  Status: {appliedFilters.status}
                  <button onClick={onClearStatus} className="hover:bg-purple-500/20 rounded-full p-0.5 transition-colors"><X className="w-3 h-3" /></button>
                </div>
              )}
              <button
                onClick={onClearAll}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors ml-1"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-none overflow-hidden bg-slate-900/40 backdrop-blur-xl border border-white/10 shadow-lg scrollbar-thin scrollbar-thumb-slate-700/50 scrollbar-track-transparent flex flex-col">
        <div
          ref={parentRef}
          className="overflow-auto scrollbar-thin scrollbar-thumb-slate-700/50 scrollbar-track-transparent flex-1"
          style={{ height: tableHeight, maxHeight: tableHeight, overflowY: "auto" }}
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
                  <>
                    {paddingTop > 0 && (
                      <tr><td style={{ height: paddingTop }} colSpan={columns.length + 1} /></tr>
                    )}
                    {virtualItems.map((vr) => {
                      const row = rows[vr.index];
                      const identifier = (row.original as any).tempId || (row.original as any).id;
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
                  rows.map((row) => {
                    const identifier = (row.original as any).tempId || (row.original as any).id;
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

      <ImportPreviewModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        previewData={importPreviewData}
        onConfirm={confirmImport}
        isImporting={isImporting}
        fileName={importFileName}
      />
    </div>
  );
}
