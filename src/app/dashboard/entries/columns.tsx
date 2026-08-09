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
import { useState, useEffect, useRef, useMemo } from "react";
import { CourierEntry } from "@prisma/client";
import { Trash2, Save, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    updateData: (identifier: string, columnId: string, value: unknown) => void;
    deleteRow: (id: string, identifier: string) => void;
    saveNewRow: (identifier: string, addNextRow?: boolean) => Promise<{ success: boolean; nextTempId?: string }>;
    saveEditedRow: (identifier: string) => Promise<boolean>;
    autocompleteData: any;
    handleCellKeyDown: (
      e: React.KeyboardEvent<HTMLInputElement>,
      identifier: string,
      columnId: string,
      inputElement: HTMLInputElement | null,
      table?: any
    ) => void;
    errorsRef?: React.MutableRefObject<Record<string, Record<string, string>>>;
    clearFieldError?: (identifier: string, columnId: string) => void;
    mode?: "entry" | "all";
    activeRegister?: any;
    filterProps?: {
      startDate: string;
      onStartDateChange: (val: string) => void;
      endDate: string;
      onEndDateChange: (val: string) => void;
      statusFilter: string;
      onStatusFilterChange: (val: string) => void;
      onApplyFilters: () => void;
      onApplyStatusFilter: (status: string) => void;
    };
    autoSaveRow?: (identifier: string) => void;
  }
}

// ───────────────────────────────────────────
// Shared error message component — in-flow, not absolute
// ───────────────────────────────────────────
const FieldError = ({ message }: { message?: string }) => {
  if (!message) return null;
  return (
    <span className="absolute bottom-1.5 right-2 text-[10px] text-red-500 font-medium z-20 pointer-events-none">
      {message}
    </span>
  );
};
// AutocompleteCell — fromParty, toParty, destination
// ───────────────────────────────────────────
const AutocompleteCell = ({ getValue, row, column, table }: any) => {
  const initialValue = String(getValue() ?? "");
  const [value, setValue] = useState(initialValue);
  const [suggestion, setSuggestion] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const identifier: string = row.original.tempId || row.original.id;
  const autocompleteData = table.options.meta?.autocompleteData || {};
  const acKeyMap: Record<string, string> = {
    fromParty: "fromParties",
    toParty: "toParties",
    destination: "destinations",
  };
  const acKey = acKeyMap[column.id] ?? `${column.id}s`;
  const acData: string[] = autocompleteData[acKey] ?? [];
  const error: string | undefined = table.options.meta?.errorsRef?.current?.[identifier]?.[column.id];
  const activeRegister = table.options.meta?.activeRegister;
  const isReadOnly = activeRegister?.status === "Locked" || activeRegister?.status === "Archived";

  const acDataObjects = useMemo(() => {
    return acData.map((item: string) => ({
      original: item,
      lower: item.toLowerCase()
    }));
  }, [acData]);

  const parentVal = String(getValue() ?? "");
  useEffect(() => {
    setValue(parentVal);
  }, [parentVal]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const raw = e.target.value;
    const capitalizeFields = ["fromParty", "toParty", "destination"];
    const val = capitalizeFields.includes(column.id)
      ? raw
        .split(" ")
        .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(" ")
      : raw;
    setValue(val);
    if (error) table.options.meta?.clearFieldError?.(identifier, column.id);

    if (val.length > 0) {
      const lowerVal = val.toLowerCase();
      const found = acDataObjects.find((i) => i.lower.startsWith(lowerVal));
      setSuggestion(found ? found.original : "");
    } else {
      setSuggestion("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    if (e.key === "Tab" && suggestion && suggestion.toLowerCase() !== value.toLowerCase()) {
      e.preventDefault();
      setValue(suggestion);
      table.options.meta?.updateData(identifier, column.id, suggestion);
      setSuggestion("");
    } else {
      table.options.meta?.handleCellKeyDown(e, identifier, column.id, inputRef.current);
    }
  };

  const onBlur = () => {
    if (isReadOnly) return;
    if (value !== parentVal) {
      table.options.meta?.updateData(identifier, column.id, value);
      if (!row.original.isNew) {
        setTimeout(() => {
          table.options.meta?.autoSaveRow?.(identifier);
        }, 50);
      }
    }
    setSuggestion("");
  };

  return (
    <div className="h-10 w-full flex items-center px-1 relative overflow-hidden">
      <div className="relative w-full h-8">
        {suggestion && value.length > 0 && (
          <div className="absolute inset-0 px-[9px] flex items-center pointer-events-none text-slate-400 dark:text-slate-500 z-10 bg-transparent truncate text-sm">
            <span className="opacity-0">{value}</span>
            <span>{suggestion.slice(value.length)}</span>
          </div>
        )}
        <Input
          id={`cell-${identifier}-${column.id}`}
          ref={inputRef}
          value={value}
          disabled={isReadOnly}
          onChange={handleChange}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          className={`w-full h-full px-2 bg-slate-800/60 dark:bg-slate-800/40 border border-white/10 rounded-lg outline-none text-sm text-slate-100 placeholder:text-slate-500 transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed ${error
            ? "ring-1 ring-inset ring-red-500 bg-red-500/10 focus:ring-red-500"
            : "focus:ring-1 focus:ring-blue-500/40 focus:bg-slate-800/80"
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
  const error: string | undefined = table.options.meta?.errorsRef?.current?.[identifier]?.[column.id];
  const activeRegister = table.options.meta?.activeRegister;
  const isReadOnly = activeRegister?.status === "Locked" || activeRegister?.status === "Archived";

  const parentVal = String(getValue() ?? "");
  useEffect(() => {
    setValue(parentVal);
  }, [parentVal]);

  const onBlur = () => {
    if (isReadOnly) return;
    const valToSave = column.id === "amount" || column.id === "challanNo" ? (parseFloat(value) || 0) : value;
    if (String(valToSave) !== String(parentVal)) {
      table.options.meta?.updateData(identifier, column.id, valToSave);
      if (!row.original.isNew) {
        setTimeout(() => {
          table.options.meta?.autoSaveRow?.(identifier);
        }, 50);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    if (e.key === "Enter") {
      const valToSave = column.id === "amount" || column.id === "challanNo" ? (parseFloat(value) || 0) : value;
      table.options.meta?.updateData(identifier, column.id, valToSave);
    }
    table.options.meta?.handleCellKeyDown(e, identifier, column.id, inputRef.current, table);
  };

  // ── Select (status / mode) ──
  if (column.id === "status" || column.id === "mode") {
    const options =
      column.id === "status"
        ? ["Account", "Cash"]
        : ["Surface", "Air", "Cargo", "V Fast"];
    return (
      <div className="h-10 w-full flex items-center px-1 relative overflow-hidden">
        <Select
          disabled={isReadOnly}
          value={String(value)}
          onValueChange={(v) => {
            if (isReadOnly) return;
            setValue(v ?? "");
            table.options.meta?.updateData(identifier, column.id, v ?? "");
            if (error) table.options.meta?.clearFieldError?.(identifier, column.id);
          }}
        >
          <SelectTrigger
            id={`cell-${identifier}-${column.id}`}
            ref={inputRef as any}
            className={`w-full h-8 px-2 bg-slate-800/60 dark:bg-slate-800/40 border border-white/10 rounded-lg appearance-none text-sm text-slate-100 hover:bg-slate-800/80 focus:ring-1 focus:ring-blue-500/40 focus:bg-slate-800/80 focus-visible:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed ${error
              ? "ring-1 ring-inset ring-red-500 bg-red-500/10 focus:ring-red-500"
              : ""
              }`}
            onKeyDown={(e: React.KeyboardEvent<any>) => {
              table.options.meta?.handleCellKeyDown(e as any, identifier, column.id, inputRef.current, table);
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
        <FieldError message={error} />
      </div>
    );
  }

  // ── Date ──
  if (column.id === "date") {
    let minMaxProps: { min?: string; max?: string } = {};
    if (activeRegister) {
      const { month, year } = activeRegister;
      const pad = (num: number) => String(num).padStart(2, '0');
      const minDate = `${year}-${pad(month)}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const maxDate = `${year}-${pad(month)}-${pad(lastDay)}`;
      minMaxProps = { min: minDate, max: maxDate };
    }

    return (
      <div className="h-10 w-full flex items-center px-1 relative overflow-hidden">
        <Input
          id={`cell-${identifier}-${column.id}`}
          ref={inputRef}
          type="date"
          disabled={isReadOnly}
          value={value ? new Date(value).toISOString().split("T")[0] : ""}
          onChange={(e) => {
            if (isReadOnly) return;
            const val = e.target.value;
            setValue(val);
            if (error) table.options.meta?.clearFieldError?.(identifier, column.id);
          }}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          className={`w-full h-8 px-2 bg-slate-800/60 dark:bg-slate-800/40 border border-white/10 rounded-lg outline-none text-sm text-slate-100 placeholder:text-slate-500 transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed ${error
            ? "ring-1 ring-inset ring-red-500 bg-red-500/10 focus:ring-red-500"
            : "focus:ring-1 focus:ring-blue-500/40 focus:bg-slate-800/80"
            }`}
          {...minMaxProps}
        />
        <FieldError message={error} />
      </div>
    );
  }

  // ── Generic text / number ──
  return (
    <div className="h-10 w-full flex items-center px-1 relative overflow-hidden">
      <Input
        id={`cell-${identifier}-${column.id}`}
        ref={inputRef}
        value={value}
        disabled={isReadOnly}
        onChange={(e) => {
          if (isReadOnly) return;
          const raw = e.target.value;
          setValue(raw);
          if (error) table.options.meta?.clearFieldError?.(identifier, column.id);
        }}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        className={`w-full h-8 px-2 bg-slate-800/60 dark:bg-slate-800/40 border border-white/10 rounded-lg outline-none text-sm text-slate-100 placeholder:text-slate-500 transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed ${error
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
  const value = getValue();
  const unitValue = row.original.weightUnit || "gm";

  const [num, setNum] = useState(String(value ?? ""));
  const [unit, setUnit] = useState(unitValue);
  const inputRef = useRef<HTMLInputElement>(null);

  const identifier: string = row.original.tempId || row.original.id;
  const error: string | undefined = table.options.meta?.errorsRef?.current?.[identifier]?.[column.id];
  const activeRegister = table.options.meta?.activeRegister;
  const isReadOnly = activeRegister?.status === "Locked" || activeRegister?.status === "Archived";

  const parentNum = String(getValue() ?? "");
  const parentUnit = row.original.weightUnit || "gm";
  useEffect(() => {
    setNum(parentNum);
    setUnit(parentUnit);
  }, [parentNum, parentUnit]);

  const onBlur = () => {
    if (isReadOnly) return;
    const val = parseFloat(num) || 0;
    if (val !== parseFloat(parentNum) || unit !== parentUnit) {
      table.options.meta?.updateData(identifier, "weightValue", val);
      table.options.meta?.updateData(identifier, "weightUnit", unit);
      if (!row.original.isNew) {
        setTimeout(() => {
          table.options.meta?.autoSaveRow?.(identifier);
        }, 50);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    table.options.meta?.handleCellKeyDown(e, identifier, column.id, inputRef.current);
  };

  return (
    <div className="h-10 w-full flex items-center px-1 gap-1 relative overflow-hidden">
      <Input
        id={`cell-${identifier}-${column.id}`}
        ref={inputRef}
        value={num}
        disabled={isReadOnly}
        onChange={(e) => {
          if (isReadOnly) return;
          const raw = e.target.value;
          setNum(raw);
          if (error) table.options.meta?.clearFieldError?.(identifier, column.id);
        }}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        placeholder="0.00"
        className={`w-full h-8 px-2 bg-slate-800/60 dark:bg-slate-800/40 border border-white/10 rounded-lg outline-none text-right text-sm text-slate-100 placeholder:text-slate-500 transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed ${error
          ? "ring-1 ring-inset ring-red-500 bg-red-500/10 focus:ring-red-500"
          : "focus:ring-1 focus:ring-blue-500/40 focus:bg-slate-800/80"
          }`}
      />
      <Select
        disabled={isReadOnly}
        value={unit}
        onValueChange={(v) => {
          if (isReadOnly) return;
          const u = v || "kg";
          setUnit(u);
          table.options.meta?.updateData(identifier, "weightUnit", u);
        }}
      >
        <SelectTrigger className="w-[48px] h-8 px-1 bg-slate-800/60 dark:bg-slate-800/40 border border-white/10 rounded-md appearance-none text-xs text-slate-400 hover:bg-slate-800/80 focus:ring-1 focus:ring-blue-500/40 focus:bg-slate-800/80 focus-visible:ring-offset-0 text-center disabled:opacity-50 disabled:cursor-not-allowed">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-lg shadow-lg">
          <SelectItem value="gm" className="rounded-md">gm</SelectItem>
          <SelectItem value="kg" className="rounded-md">kg</SelectItem>
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
    size: 45,
    cell: ({ row, table }) => {
      const meta = table.options.meta as any;
      const isDesc = table.getState().sorting.some((s) => s.desc);

      const pageIndex = meta?.pageIndex ?? 0;
      const pageSize = meta?.pageSize ?? 50;
      const staticTotalCount = meta?.totalCount ?? table.getRowModel().rows.length;
      const localRowOffset = meta?.localRowOffset ?? 0;
      const trueTotalCount = staticTotalCount + localRowOffset;

      const globalOrdinalIndex = pageIndex * pageSize + row.index;
      const displayNo = isDesc ? trueTotalCount - globalOrdinalIndex : globalOrdinalIndex + 1;

      return (
        <div className="h-10 w-full flex items-center px-1 text-sm text-slate-300 truncate overflow-hidden whitespace-nowrap">
          {displayNo}
        </div>
      );
    },
  },
  {
    accessorKey: "date",
    header: ({ table }) => {
      const meta = table.options.meta;
      if (meta?.mode === "all" && meta?.filterProps) {
        const filters = meta.filterProps;
        return (
          <div className="flex items-center gap-1">
            Date
            <Popover>
              <PopoverTrigger className={`h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-slate-800 ${(filters.startDate && filters.endDate) ? 'text-blue-400' : 'text-slate-400'} hover:text-white transition-colors`}>
                <Filter className="h-3 w-3" />
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 bg-slate-900 border-white/10" align="start">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-white">Filter by Date</h4>
                  <div className="grid gap-2">
                    <div className="grid items-center gap-1">
                      <label className="text-xs text-slate-400">Start Date</label>
                      <Input type="date" value={filters.startDate} onChange={(e) => filters.onStartDateChange(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="grid items-center gap-1">
                      <label className="text-xs text-slate-400">End Date</label>
                      <Input type="date" value={filters.endDate} onChange={(e) => filters.onEndDateChange(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>
                  <Button onClick={() => { filters.onApplyFilters(); }} className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">Apply</Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        );
      }
      return "Date";
    },
    size: 130,
    cell: EditableCell
  },
  {
    accessorKey: "challanNo",
    header: "Challan No",
    size: 80,
    cell: EditableCell
  },
  {
    accessorKey: "fromParty",
    header: "From Party",
    size: 180,
    cell: AutocompleteCell
  },
  {
    accessorKey: "toParty",
    header: "To Party",
    size: 180,
    cell: AutocompleteCell
  },
  {
    accessorKey: "weightValue",
    header: "Weight",
    size: 90,
    cell: WeightCell
  },
  {
    accessorKey: "destination",
    header: "Destination",
    size: 110,
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
    header: ({ table }) => {
      const meta = table.options.meta;
      if (meta?.mode === "all" && meta?.filterProps) {
        const filters = meta.filterProps;
        return (
          <div className="flex items-center gap-1">
            Status
            <Popover>
              <PopoverTrigger className={`h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-slate-800 ${(filters.statusFilter && filters.statusFilter !== "all") ? 'text-purple-400' : 'text-slate-400'} hover:text-white transition-colors`}>
                <Filter className="h-3 w-3" />
              </PopoverTrigger>
              <PopoverContent className="w-40 p-2 bg-slate-900 border-white/10" align="start">
                <div className="flex flex-col gap-1">
                  {["all", "Account", "Cash"].map(s => (
                    <Button
                      key={s}
                      variant="ghost"
                      size="sm"
                      className={`justify-start text-xs h-8 ${filters.statusFilter === s ? 'bg-purple-500/20 text-purple-400' : 'text-slate-300'} hover:bg-slate-800`}
                      onClick={() => {
                        const newStatus = (filters.statusFilter === s && s !== "all") ? "all" : s;
                        filters.onApplyStatusFilter(newStatus);
                      }}
                    >
                      {s === "all" ? "All Statuses" : s}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        );
      }
      return "Status";
    },
    size: 85,
    cell: EditableCell
  },
  {
    accessorKey: "mode",
    header: "Mode",
    size: 85,
    cell: EditableCell
  },
  {
    id: "actions",
    size: 110,
    cell: ({ row, table }) => {
      const entry = row.original as any;
      const identifier = entry.tempId || entry.id;
      const isNew = !!entry.isNew;
      const isEdited = !!entry.isEdited;
      const hasErrors = Object.keys(table.options.meta?.errorsRef?.current?.[identifier] || {}).length > 0;
      const activeRegister = table.options.meta?.activeRegister;
      const isReadOnly = activeRegister?.status === "Locked" || activeRegister?.status === "Archived";

      if (isNew || isEdited) {
        return (
          <div className="flex w-full h-10 items-center justify-center gap-[6px] px-1 overflow-hidden" style={{ minWidth: '110px', maxWidth: '130px' }}>
            <Button
              variant="ghost"
              size="icon"
              disabled={isReadOnly}
              onClick={() => {
                if (isReadOnly) return;
                table.options.meta?.deleteRow(entry.id, identifier);
              }}
              className="h-8 w-[40px] rounded-lg text-xs px-2 text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-transform hover:scale-[1.02] active:scale-[0.98] shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
            </Button>

            <Button
              id={`save-btn-${identifier}`}
              size="icon"
              disabled={hasErrors || isReadOnly}
              title={isNew ? "Save" : "Update"}
              onClick={async () => {
                if (isReadOnly) return;
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
              className={`h-8 w-[40px] rounded-lg text-xs flex items-center justify-center transition-transform hover:scale-[1.02] active:scale-[0.98] shrink-0 ${hasErrors || isReadOnly
                ? "bg-transparent text-slate-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        );
      }

      return (
        <div className="flex w-full h-10 items-center justify-center px-1 overflow-hidden" style={{ minWidth: '110px', maxWidth: '130px' }}>
          <Button
            variant="ghost"
            size="icon"
            disabled={isReadOnly}
            onClick={() => {
              if (isReadOnly) return;
              table.options.meta?.deleteRow(entry.id, identifier);
            }}
            className="h-8 w-full rounded-lg text-xs px-2 text-red-500 hover:bg-red-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    },
  },
];
