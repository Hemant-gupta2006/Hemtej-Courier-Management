"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { PlusCircle, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { clearAutocompleteCache } from "@/lib/autocomplete";

type FormData = {
  date: string;
  challanNo: string;
  fromParty: string;
  toParty: string;
  weightNum: string;
  weightUnit: string;
  destination: string;
  amount: string;
  status: string;
  mode: string;
};

type Errors = Partial<Record<keyof FormData | "weight", string>>;

const STATUS_OPTIONS = ["Cash", "Account"];
const MODE_OPTIONS = ["Surface", "Air", "Cargo", "V Fast"];

// ── Helper: auto-capitalize first letter of each word ──
const capitalizeWords = (s: string) =>
  s
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

// ── Mobile-only: Excel-style inline suggestion input ──
// No dropdowns, portals, or overlays — suggestion appears as faded ghost text.
function MobileAutoInput({
  id,
  label,
  value,
  onChange,
  suggestions,
  error,
  placeholder,
  onKeyDown: externalKeyDown,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  error?: string;
  placeholder?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute the first suggestion that starts with the typed value (case-insensitive)
  const suggestion = useMemo(() => {
    if (!value.trim()) return "";
    const lower = value.toLowerCase();
    return suggestions.find((s) => s.toLowerCase().startsWith(lower)) ?? "";
  }, [value, suggestions]);

  // The ghost suffix: the part of the suggestion that hasn't been typed yet
  const ghostSuffix = useMemo(() => {
    if (!suggestion || suggestion.toLowerCase() === value.toLowerCase()) return "";
    return suggestion.slice(value.length);
  }, [suggestion, value]);

  const acceptSuggestion = () => {
    if (suggestion) {
      onChange(suggestion);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Tab" || e.key === "Enter") && ghostSuffix) {
      e.preventDefault();
      acceptSuggestion();
      // After accepting, defer focus to next field if Enter was pressed
      if (e.key === "Enter" && externalKeyDown) {
        // Let the external handler run first on next tick
        setTimeout(() => {
          const synth = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
          // We just move focus manually via the parent's onKeyDown
        }, 0);
        // Call external with a synthetic-like ref
        externalKeyDown(e);
      }
      return;
    }
    externalKeyDown?.(e);
  };

  const handleBlur = () => {
    if (ghostSuffix) {
      acceptSuggestion();
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </Label>
      {/* Relative container for ghost overlay */}
      <div className="relative">
        {/* Ghost suggestion layer — absolutely positioned behind the real input text */}
        {ghostSuffix && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center px-3 h-12 text-base rounded-xl overflow-hidden"
            style={{ zIndex: 0 }}
          >
            {/* Invisible spacer matching typed text width so ghost aligns correctly */}
            <span className="invisible whitespace-pre">{value}</span>
            <span
              className="whitespace-pre"
              style={{ color: "var(--muted-foreground, #94a3b8)", opacity: 0.6 }}
            >
              {ghostSuffix}
            </span>
          </div>
        )}

        <Input
          ref={inputRef}
          id={id}
          value={value}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          placeholder={placeholder ?? `Enter ${label}`}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={`h-12 text-base rounded-xl bg-slate-50/50 dark:bg-slate-900/50 focus-visible:ring-2 focus-visible:ring-blue-500/40 transition-all relative z-10 bg-transparent ${error
            ? "border-red-500 ring-1 ring-red-500 focus-visible:ring-red-500"
            : "border-slate-200 dark:border-slate-700 focus-visible:ring-blue-500"
            }`}
          style={{ backgroundColor: "transparent" }}
        />
      </div>
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}

// ── Select buttons (status / mode) ──
function SegmentedSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${value === opt
              ? "bg-blue-600 border-blue-600 text-white shadow-sm"
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400"
              }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main MobileEntryForm ──
export function MobileEntryForm({
  existingChallans,
  autocompleteData,
  onSaved,
  mobileDefaultDate,
  activeRegisterId,
  isReadOnly = false,
  editingEntry = null,
  isOpen,
  onOpenChange,
}: {
  existingChallans: string[];
  autocompleteData: { fromParties: string[]; toParties: string[]; destinations: string[] };
  onSaved: (savedEntry: any, isEdit: boolean) => void;
  mobileDefaultDate?: string | null;
  activeRegisterId?: string;
  isReadOnly?: boolean;
  editingEntry?: any | null;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = (val: boolean) => {
    setInternalOpen(val);
    onOpenChange?.(val);
  };
  const [loading, setSaving] = useState(false);

  // Predict the next challan based on the most recent entry
  const getNextChallan = () => {
    if (!existingChallans || existingChallans.length === 0) return "1001";

    // existingChallans is already sorted by newest first (descending createdAt)
    const lastCreatedChallan = parseInt(existingChallans[0], 10);

    if (isNaN(lastCreatedChallan) || lastCreatedChallan <= 0) return "1001";
    return String(lastCreatedChallan + 1);
  };

  const defaultForm = (): FormData => ({
    date: mobileDefaultDate || new Date().toISOString().split("T")[0],
    challanNo: getNextChallan(),
    fromParty: "",
    toParty: "",
    weightNum: "100",
    weightUnit: "gm",
    destination: "",
    amount: "",
    status: "Account",
    mode: "Surface",
  });

  const [form, setForm] = useState<FormData>(defaultForm());
  const [errors, setErrors] = useState<Errors>({});

  // Recompute form when it opens (new or edit entry)
  useEffect(() => {
    if (open) {
      if (editingEntry) {
        let dateStr = mobileDefaultDate || new Date().toISOString().split("T")[0];
        if (editingEntry.date) {
          try {
            dateStr = new Date(editingEntry.date).toISOString().split("T")[0];
          } catch {
            // fallback
          }
        }
        setForm({
          date: dateStr,
          challanNo: String(editingEntry.challanNo ?? ""),
          fromParty: editingEntry.fromParty ?? "",
          toParty: editingEntry.toParty ?? "",
          weightNum: String(editingEntry.weightValue ?? editingEntry.weight ?? ""),
          weightUnit: editingEntry.weightUnit || "gm",
          destination: editingEntry.destination ?? "",
          amount: editingEntry.amount != null && editingEntry.amount !== undefined ? String(editingEntry.amount) : "",
          status: editingEntry.status || "Account",
          mode: editingEntry.mode || "Surface",
        });
      } else {
        setForm(defaultForm());
      }
      setErrors({});
    }
  }, [open, editingEntry]);

  // Update background form if default date changes while closed
  useEffect(() => {
    if (!open) {
      setForm((f) => ({ ...f, date: mobileDefaultDate || new Date().toISOString().split("T")[0] }));
    }
  }, [mobileDefaultDate, open]);

  const set = (key: keyof FormData, val: string) => {
    setForm((f) => {
      const next = { ...f, [key]: val };
      
      // Auto-calculate amount when weight changes
      if (key === "weightNum" || key === "weightUnit") {
        const wVal = Number(next.weightNum) || 0;
        const wUnit = next.weightUnit;
        const weightInGrams = wUnit === "kg" ? wVal * 1000 : wVal;
        
        if (weightInGrams > 0) {
          const calculatedAmount = weightInGrams >= 1000 
            ? Math.ceil(weightInGrams / 1000) * 50 
            : Math.max(30, Math.ceil(weightInGrams / 100) * 10);
          next.amount = String(calculatedAmount);
        }
      }
      
      return next;
    });
    
    setErrors((e) => {
      const n = { ...e };
      delete n[key as keyof Errors];
      if (key === "weightNum" || key === "weightUnit") {
        delete n.amount;
      }
      return n;
    });
  };

  const validate = (): Errors => {
    const e: Errors = {};
    const challanVal = form.challanNo.trim();
    if (!challanVal) {
      e.challanNo = "Challan Number is required.";
    } else {
      const isSameChallan = editingEntry && String(editingEntry.challanNo) === challanVal;
      if (!isSameChallan && existingChallans.includes(challanVal)) {
        e.challanNo = "This challan number already exists.";
      }
    }
    if (!form.fromParty.trim()) e.fromParty = "From Party is required.";
    if (!form.toParty.trim()) e.toParty = "To Party is required.";
    if (!form.destination.trim()) e.destination = "Destination is required.";
    if (form.weightNum && isNaN(Number(form.weightNum))) e.weight = "Weight must be a number.";
    if (form.amount && isNaN(Number(form.amount))) e.amount = "Amount must be a number.";
    return e;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, nextFieldId: string | null) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (nextFieldId) {
        document.getElementById(nextFieldId)?.focus();
      } else {
        e.currentTarget.blur();
      }
    }
  };

  const handleSave = async () => {
    if (isReadOnly) {
      toast.error("Cannot modify entries in a locked or archived register.");
      return;
    }

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // Trim + auto-capitalize text fields
    const cleaned = {
      ...form,
      fromParty: capitalizeWords(form.fromParty),
      toParty: capitalizeWords(form.toParty),
      destination: capitalizeWords(form.destination),
      challanNo: form.challanNo.trim(),
    };

    // Build weight as separate value and unit
    const weightValue = Number(cleaned.weightNum) || 0;
    const weightUnit = cleaned.weightUnit;

    setSaving(true);
    try {
      const isEdit = Boolean(editingEntry && editingEntry.id);
      const url = isEdit ? `/api/couriers/${editingEntry.id}` : "/api/couriers";
      const method = isEdit ? "PATCH" : "POST";

      const payload: any = {
        date: cleaned.date,
        challanNo: cleaned.challanNo,
        fromParty: cleaned.fromParty,
        toParty: cleaned.toParty,
        weightValue,
        weightUnit,
        destination: cleaned.destination,
        amount: parseFloat(cleaned.amount) || 0,
        status: cleaned.status,
        mode: cleaned.mode,
      };

      if (!isEdit) {
        payload.registerId = activeRegisterId;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json().catch(() => null);

      if (res.ok && resJson) {
        const savedData = resJson.data || resJson;
        toast.success(isEdit ? "Entry updated successfully!" : "Entry saved!");
        clearAutocompleteCache();
        setForm(defaultForm());
        setErrors({});
        setOpen(false);
        onSaved(savedData, isEdit);
      } else {
        const errorMessage = resJson?.error || (typeof resJson === "string" ? resJson : "Failed to save");
        toast.error(errorMessage);
      }
    } catch (err) {
      console.error("Save entry error:", err);
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  if (isReadOnly) return null;

  return (
    <>
      {/* Floating action button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-3.5 rounded-full shadow-2xl shadow-blue-500/30 text-sm font-semibold"
      >
        <PlusCircle className="h-5 w-5" />
        Add Entry
      </motion.button>

      {/* Bottom sheet */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-950 rounded-t-[28px] shadow-2xl overflow-hidden"
              style={{ maxHeight: "92dvh" }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingEntry ? "Edit Courier Entry" : "New Courier Entry"}
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>

              {/* Scrollable form body */}
              <div
                className="overflow-y-auto px-6 py-4 space-y-5"
                style={{ maxHeight: "calc(92dvh - 160px)" }}
              >
                {/* Date */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="m-date"
                    className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Date
                  </Label>
                  <Input
                    id="m-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => set("date", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, "m-challan")}
                    className="h-12 text-base rounded-xl bg-slate-50/50 dark:bg-slate-900/50 focus-visible:ring-2 focus-visible:ring-blue-500/40 transition-all border-slate-200 dark:border-slate-700"
                  />
                </div>

                {/* Challan No */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="m-challan"
                    className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Challan No (Predicted)
                  </Label>
                  <Input
                    id="m-challan"
                    value={form.challanNo}
                    onChange={(e) => set("challanNo", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, "m-from")}
                    placeholder="e.g. 1042"
                    className={`h-12 text-base rounded-xl bg-slate-50/50 dark:bg-slate-900/50 focus-visible:ring-2 focus-visible:ring-blue-500/40 transition-all ${errors.challanNo
                      ? "border-red-500 ring-1 ring-red-500"
                      : "border-slate-200 dark:border-slate-700"
                      }`}
                  />
                  {errors.challanNo && (
                    <p className="text-xs text-red-500 font-medium">{errors.challanNo}</p>
                  )}
                </div>

                {/* From Party */}
                <MobileAutoInput
                  id="m-from"
                  label="From Party *"
                  value={form.fromParty}
                  onChange={(v) => set("fromParty", v)}
                  onKeyDown={(e) => handleKeyDown(e, "m-to")}
                  suggestions={autocompleteData.fromParties}
                  error={errors.fromParty}
                  placeholder="Sender name"
                />

                {/* To Party */}
                <MobileAutoInput
                  id="m-to"
                  label="To Party *"
                  value={form.toParty}
                  onChange={(v) => set("toParty", v)}
                  onKeyDown={(e) => handleKeyDown(e, "m-weight")}
                  suggestions={autocompleteData.toParties}
                  error={errors.toParty}
                  placeholder="Receiver name"
                />

                {/* Weight */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Weight
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="m-weight"
                      type="text"
                      inputMode="decimal"
                      value={form.weightNum}
                      onChange={(e) => set("weightNum", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, "m-dest")}
                      placeholder="100"
                      className={`h-12 text-base rounded-xl flex-1 bg-slate-50/50 dark:bg-slate-900/50 focus-visible:ring-2 focus-visible:ring-blue-500/40 transition-all ${errors.weight
                        ? "border-red-500 ring-1 ring-red-500"
                        : "border-slate-200 dark:border-slate-700"
                        }`}
                    />
                    <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                      {["gm", "kg"].map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => set("weightUnit", u)}
                          className={`px-5 h-12 text-sm font-semibold transition-colors ${form.weightUnit === u
                            ? "bg-blue-600 text-white"
                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                            }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                  {errors.weight && (
                    <p className="text-xs text-red-500 font-medium">{errors.weight}</p>
                  )}
                </div>

                {/* Destination */}
                <MobileAutoInput
                  id="m-dest"
                  label="Destination *"
                  value={form.destination}
                  onChange={(v) => set("destination", v)}
                  onKeyDown={(e) => handleKeyDown(e, "m-amount")}
                  suggestions={autocompleteData.destinations}
                  error={errors.destination}
                  placeholder="City / Hub"
                />

                {/* Amount */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="m-amount"
                    className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Amount
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base font-medium">
                      ₹
                    </span>
                    <Input
                      id="m-amount"
                      type="text"
                      inputMode="decimal"
                      value={form.amount}
                      onChange={(e) => set("amount", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, null)}
                      placeholder="0"
                      className={`h-12 text-base rounded-xl pl-8 bg-slate-50/50 dark:bg-slate-900/50 focus-visible:ring-2 focus-visible:ring-blue-500/40 transition-all ${errors.amount
                        ? "border-red-500 ring-1 ring-red-500"
                        : "border-slate-200 dark:border-slate-700"
                        }`}
                    />
                  </div>
                  {errors.amount && (
                    <p className="text-xs text-red-500 font-medium">{errors.amount}</p>
                  )}
                </div>

                {/* Status */}
                <SegmentedSelect
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={form.status}
                  onChange={(v) => set("status", v)}
                />

                {/* Mode */}
                <SegmentedSelect
                  label="Mode"
                  options={MODE_OPTIONS}
                  value={form.mode}
                  onChange={(v) => set("mode", v)}
                />

                {/* Bottom spacer */}
                <div className="h-4" />
              </div>

              {/* Footer save button */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
                <Button
                  onClick={handleSave}
                  disabled={loading}
                  className="w-full h-14 text-base font-semibold rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25 gap-2"
                >
                  <Save className="h-5 w-5" />
                  {loading
                    ? editingEntry
                      ? "Updating..."
                      : "Saving..."
                    : editingEntry
                    ? "Update Entry"
                    : "Save Entry"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
