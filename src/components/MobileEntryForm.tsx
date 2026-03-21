"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { PlusCircle, X, ChevronDown, Check, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";

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

// ── Autocomplete input with dropdown ──
function AutoInput({
  id,
  label,
  value,
  onChange,
  suggestions,
  error,
  placeholder,
  onKeyDown,
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  // Keep local in sync when value changes externally
  useEffect(() => setQuery(value), [value]);

  const filtered = query.length > 0
    ? suggestions.filter((s) => s.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : suggestions.slice(0, 8);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (item: string) => {
    setQuery(item);
    onChange(item);
    setOpen(false);
  };

  return (
    <div className="space-y-1.5" ref={ref}>
      <Label htmlFor={id} className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          value={query}
          autoComplete="off"
          placeholder={placeholder ?? `Enter ${label}`}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className={`h-12 text-base rounded-xl pr-10 bg-slate-50/50 dark:bg-slate-900/50 focus-visible:ring-2 focus-visible:ring-blue-500/40 transition-all ${error
              ? "border-red-500 ring-1 ring-red-500 focus-visible:ring-red-500"
              : "border-slate-200 dark:border-slate-700 focus-visible:ring-blue-500"
            }`}
        />
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <AnimatePresence>
          {open && filtered.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              {filtered.map((item) => (
                <li
                  key={item}
                  onMouseDown={() => select(item)}
                  className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <Check
                    className={`h-4 w-4 text-blue-500 shrink-0 ${value === item ? "opacity-100" : "opacity-0"
                      }`}
                  />
                  {item}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
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
}: {
  existingChallans: string[];
  autocompleteData: { fromParties: string[]; toParties: string[]; destinations: string[] };
  onSaved: () => void;
  mobileDefaultDate?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setSaving] = useState(false);

  const getNextChallan = () => {
    const nums = existingChallans.map(Number).filter(v => !isNaN(v) && v > 0);
    return nums.length > 0 ? String(Math.max(...nums) + 1) : "1001";
  };

  const defaultForm = (): FormData => ({
    date: mobileDefaultDate || new Date().toISOString().split("T")[0],
    challanNo: getNextChallan(),
    fromParty: "",
    toParty: "",
    weightNum: "100",
    weightUnit: "g",
    destination: "",
    amount: "",
    status: "Cash",
    mode: "Surface",
  });

  const [form, setForm] = useState<FormData>(defaultForm());
  const [errors, setErrors] = useState<Errors>({});

  // Recompute form when it opens to grab the latest challan number
  useEffect(() => {
    if (open) {
      setForm(defaultForm());
    }
  }, [open]);

  // Update background form if default date changes while closed
  useEffect(() => {
    if (!open) {
      setForm(f => ({ ...f, date: mobileDefaultDate || new Date().toISOString().split("T")[0] }));
    }
  }, [mobileDefaultDate, open]);

  const set = (key: keyof FormData, val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => { const n = { ...e }; delete n[key as keyof Errors]; return n; });
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!form.challanNo.trim()) e.challanNo = "Challan Number is required.";
    else if (existingChallans.includes(form.challanNo.trim()))
      e.challanNo = "This challan number already exists.";
    if (!form.fromParty.trim()) e.fromParty = "From Party is required.";
    if (!form.toParty.trim()) e.toParty = "To Party is required.";
    if (!form.destination.trim()) e.destination = "Destination is required.";
    if (form.weightNum && isNaN(Number(form.weightNum)))
      e.weight = "Weight must be a number.";
    if (form.amount && isNaN(Number(form.amount)))
      e.amount = "Amount must be a number.";
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
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    // Trim + auto-capitalize text fields
    const cleaned = {
      ...form,
      fromParty: capitalizeWords(form.fromParty),
      toParty: capitalizeWords(form.toParty),
      destination: capitalizeWords(form.destination),
      challanNo: form.challanNo.trim(),
    };

    // Build weight as grams string
    const gramsValue = Number(cleaned.weightNum) * (cleaned.weightUnit === "kg" ? 1000 : 1);
    const weight = `${gramsValue}g`;

    setSaving(true);
    try {
      const res = await fetch("/api/couriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: cleaned.date,
          challanNo: cleaned.challanNo,
          fromParty: cleaned.fromParty,
          toParty: cleaned.toParty,
          weight,
          destination: cleaned.destination,
          amount: parseFloat(cleaned.amount) || 0,
          status: cleaned.status,
          mode: cleaned.mode,
        }),
      });
      if (res.ok) {
        toast.success("Entry saved!");
        setForm(defaultForm());
        setErrors({});
        setOpen(false);
        onSaved();
      } else {
        toast.error((await res.text()) || "Failed to save");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

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
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Courier Entry</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>

              {/* Scrollable form body */}
              <div className="overflow-y-auto px-6 py-4 space-y-5" style={{ maxHeight: "calc(92dvh - 160px)" }}>

                {/* Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="m-date" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Date</Label>
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
                  <Label htmlFor="m-challan" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Challan No <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="m-challan"
                    value={form.challanNo}
                    onChange={(e) => set("challanNo", e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, "m-from")}
                    placeholder="e.g. 1042"
                    className={`h-12 text-base rounded-xl bg-slate-50/50 dark:bg-slate-900/50 focus-visible:ring-2 focus-visible:ring-blue-500/40 transition-all ${errors.challanNo ? "border-red-500 ring-1 ring-red-500" : "border-slate-200 dark:border-slate-700"
                      }`}
                  />
                  {errors.challanNo && <p className="text-xs text-red-500 font-medium">{errors.challanNo}</p>}
                </div>

                {/* From Party */}
                <AutoInput
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
                <AutoInput
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
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Weight</Label>
                  <div className="flex gap-2">
                    <Input
                      id="m-weight"
                      type="text"
                      inputMode="decimal"
                      value={form.weightNum}
                      onChange={(e) => set("weightNum", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, "m-dest")}
                      placeholder="100"
                      className={`h-12 text-base rounded-xl flex-1 bg-slate-50/50 dark:bg-slate-900/50 focus-visible:ring-2 focus-visible:ring-blue-500/40 transition-all ${errors.weight ? "border-red-500 ring-1 ring-red-500" : "border-slate-200 dark:border-slate-700"
                        }`}
                    />
                    <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                      {["g", "kg"].map((u) => (
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
                  {errors.weight && <p className="text-xs text-red-500 font-medium">{errors.weight}</p>}
                </div>

                {/* Destination */}
                <AutoInput
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
                  <Label htmlFor="m-amount" className="text-sm font-semibold text-slate-700 dark:text-slate-200">Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base font-medium">₹</span>
                    <Input
                      id="m-amount"
                      type="text"
                      inputMode="decimal"
                      value={form.amount}
                      onChange={(e) => set("amount", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, null)}
                      placeholder="0"
                      className={`h-12 text-base rounded-xl pl-8 bg-slate-50/50 dark:bg-slate-900/50 focus-visible:ring-2 focus-visible:ring-blue-500/40 transition-all ${errors.amount ? "border-red-500 ring-1 ring-red-500" : "border-slate-200 dark:border-slate-700"
                        }`}
                    />
                  </div>
                  {errors.amount && <p className="text-xs text-red-500 font-medium">{errors.amount}</p>}
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
                  {loading ? "Saving..." : "Save Entry"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
