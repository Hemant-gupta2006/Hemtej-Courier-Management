"use client";

import React, { useState, useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Filter,
  X,
  Search,
  Calendar,
  User,
  Users,
  MapPin,
  Truck,
  RotateCcw,
  Check
} from "lucide-react";

export interface RegisterFilters {
  dateType: "all" | "exact" | "range";
  exactDate: string;
  startDate: string;
  endDate: string;
  fromParties: string[];
  toParties: string[];
  destinations: string[];
  statuses: string[];
  modes: string[];
}

export const DEFAULT_REGISTER_FILTERS: RegisterFilters = {
  dateType: "all",
  exactDate: "",
  startDate: "",
  endDate: "",
  fromParties: [],
  toParties: [],
  destinations: [],
  statuses: [],
  modes: [],
};

export interface FilterOptions {
  fromParties: { name: string; count: number }[];
  toParties: { name: string; count: number }[];
  destinations: { name: string; count: number }[];
  statuses: { name: string; count: number }[];
  modes: { name: string; count: number }[];
}

interface RegisterFilterPopoverProps {
  filters: RegisterFilters;
  onChange: (filters: RegisterFilters) => void;
  options: FilterOptions;
  activeCount: number;
}

type TabType = "date" | "fromParty" | "toParty" | "destination" | "statusMode";

export function RegisterFilterPopover({
  filters,
  onChange,
  options,
  activeCount,
}: RegisterFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("fromParty");

  // Local search inputs inside tabs
  const [fromPartySearch, setFromPartySearch] = useState("");
  const [toPartySearch, setToPartySearch] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");

  const filteredFromParties = useMemo(() => {
    if (!fromPartySearch.trim()) return options.fromParties;
    const q = fromPartySearch.toLowerCase();
    return options.fromParties.filter((p) => p.name.toLowerCase().includes(q));
  }, [options.fromParties, fromPartySearch]);

  const filteredToParties = useMemo(() => {
    if (!toPartySearch.trim()) return options.toParties;
    const q = toPartySearch.toLowerCase();
    return options.toParties.filter((p) => p.name.toLowerCase().includes(q));
  }, [options.toParties, toPartySearch]);

  const filteredDestinations = useMemo(() => {
    if (!destinationSearch.trim()) return options.destinations;
    const q = destinationSearch.toLowerCase();
    return options.destinations.filter((d) => d.name.toLowerCase().includes(q));
  }, [options.destinations, destinationSearch]);

  const toggleArrayItem = (key: "fromParties" | "toParties" | "destinations" | "statuses" | "modes", item: string) => {
    const list = filters[key];
    const exists = list.includes(item);
    const updated = exists ? list.filter((i) => i !== item) : [...list, item];
    onChange({ ...filters, [key]: updated });
  };

  const handleClearAll = () => {
    onChange(DEFAULT_REGISTER_FILTERS);
    setFromPartySearch("");
    setToPartySearch("");
    setDestinationSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={`inline-flex items-center justify-center rounded-xl border transition-all text-xs font-semibold px-3 h-9 gap-1.5 cursor-pointer outline-none ${
          activeCount > 0
            ? "bg-blue-500/15 border-blue-500/30 text-blue-400 hover:bg-blue-500/25"
            : "bg-white/10 dark:bg-slate-900/50 border-white/20 dark:border-white/10 text-slate-300 hover:bg-white/15"
        }`}
      >
        <Filter className="h-3.5 w-3.5" />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-blue-600 text-white">
            {activeCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[420px] max-w-[95vw] p-0 bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200 z-50"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Filter Register Entries</h3>
            {activeCount > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-blue-500/20 text-blue-300 border-none">
                {activeCount} active
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="h-7 text-[11px] text-slate-400 hover:text-red-400 hover:bg-red-500/10 gap-1 px-2"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-white/10 bg-slate-950/40 px-2 pt-2 gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("fromParty")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors relative ${
              activeTab === "fromParty"
                ? "text-blue-400 bg-slate-900 border-t border-x border-white/10"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>From</span>
            {filters.fromParties.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center font-bold">
                {filters.fromParties.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("toParty")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors relative ${
              activeTab === "toParty"
                ? "text-blue-400 bg-slate-900 border-t border-x border-white/10"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>To</span>
            {filters.toParties.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center font-bold">
                {filters.toParties.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("destination")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors relative ${
              activeTab === "destination"
                ? "text-blue-400 bg-slate-900 border-t border-x border-white/10"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>Destination</span>
            {filters.destinations.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center font-bold">
                {filters.destinations.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("date")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors relative ${
              activeTab === "date"
                ? "text-blue-400 bg-slate-900 border-t border-x border-white/10"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Date</span>
            {filters.dateType !== "all" && (
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("statusMode")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors relative ${
              activeTab === "statusMode"
                ? "text-blue-400 bg-slate-900 border-t border-x border-white/10"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Truck className="h-3.5 w-3.5" />
            <span>Status</span>
            {(filters.statuses.length > 0 || filters.modes.length > 0) && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center font-bold">
                {filters.statuses.length + filters.modes.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="p-4 min-h-[220px] max-h-[280px] overflow-y-auto">
          {/* 1. From Party Tab */}
          {activeTab === "fromParty" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Filter sender parties..."
                  value={fromPartySearch}
                  onChange={(e) => setFromPartySearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-slate-800/80 border-white/10 rounded-lg text-white"
                />
              </div>

              <div className="space-y-1 max-h-[190px] overflow-y-auto pr-1">
                {filteredFromParties.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No parties found</p>
                ) : (
                  filteredFromParties.map((p) => {
                    const selected = filters.fromParties.includes(p.name);
                    return (
                      <div
                        key={p.name}
                        onClick={() => toggleArrayItem("fromParties", p.name)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                          selected
                            ? "bg-blue-600/20 text-blue-300 font-semibold"
                            : "hover:bg-slate-800/60 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${
                              selected
                                ? "bg-blue-600 border-blue-500 text-white"
                                : "border-slate-600 bg-slate-800"
                            }`}
                          >
                            {selected && <Check className="w-2.5 h-2.5" />}
                          </div>
                          <span className="truncate">{p.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 ml-2 font-mono">
                          {p.count}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 2. To Party Tab */}
          {activeTab === "toParty" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Filter consignee parties..."
                  value={toPartySearch}
                  onChange={(e) => setToPartySearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-slate-800/80 border-white/10 rounded-lg text-white"
                />
              </div>

              <div className="space-y-1 max-h-[190px] overflow-y-auto pr-1">
                {filteredToParties.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No consignees found</p>
                ) : (
                  filteredToParties.map((p) => {
                    const selected = filters.toParties.includes(p.name);
                    return (
                      <div
                        key={p.name}
                        onClick={() => toggleArrayItem("toParties", p.name)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                          selected
                            ? "bg-blue-600/20 text-blue-300 font-semibold"
                            : "hover:bg-slate-800/60 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${
                              selected
                                ? "bg-blue-600 border-blue-500 text-white"
                                : "border-slate-600 bg-slate-800"
                            }`}
                          >
                            {selected && <Check className="w-2.5 h-2.5" />}
                          </div>
                          <span className="truncate">{p.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 ml-2 font-mono">
                          {p.count}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 3. Destination Tab */}
          {activeTab === "destination" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Filter destinations..."
                  value={destinationSearch}
                  onChange={(e) => setDestinationSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-slate-800/80 border-white/10 rounded-lg text-white"
                />
              </div>

              <div className="space-y-1 max-h-[190px] overflow-y-auto pr-1">
                {filteredDestinations.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No destinations found</p>
                ) : (
                  filteredDestinations.map((d) => {
                    const selected = filters.destinations.includes(d.name);
                    return (
                      <div
                        key={d.name}
                        onClick={() => toggleArrayItem("destinations", d.name)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                          selected
                            ? "bg-blue-600/20 text-blue-300 font-semibold"
                            : "hover:bg-slate-800/60 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${
                              selected
                                ? "bg-blue-600 border-blue-500 text-white"
                                : "border-slate-600 bg-slate-800"
                            }`}
                          >
                            {selected && <Check className="w-2.5 h-2.5" />}
                          </div>
                          <span className="truncate">{d.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 ml-2 font-mono">
                          {d.count}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 4. Date Tab */}
          {activeTab === "date" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => onChange({ ...filters, dateType: "all" })}
                  className={`py-1 text-xs font-semibold rounded-lg transition-colors ${
                    filters.dateType === "all"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  All Dates
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...filters, dateType: "exact" })}
                  className={`py-1 text-xs font-semibold rounded-lg transition-colors ${
                    filters.dateType === "exact"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Single Date
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...filters, dateType: "range" })}
                  className={`py-1 text-xs font-semibold rounded-lg transition-colors ${
                    filters.dateType === "range"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Date Range
                </button>
              </div>

              {filters.dateType === "exact" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-medium">Specific Date</label>
                  <Input
                    type="date"
                    value={filters.exactDate}
                    onChange={(e) => onChange({ ...filters, exactDate: e.target.value })}
                    className="h-9 text-xs bg-slate-800 border-white/10 rounded-xl text-white"
                  />
                </div>
              )}

              {filters.dateType === "range" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400 font-medium">From Date</label>
                    <Input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
                      className="h-9 text-xs bg-slate-800 border-white/10 rounded-xl text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400 font-medium">To Date</label>
                    <Input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
                      className="h-9 text-xs bg-slate-800 border-white/10 rounded-xl text-white"
                    />
                  </div>
                </div>
              )}

              {filters.dateType === "all" && (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Showing all dates within the currently active register.
                </p>
              )}
            </div>
          )}

          {/* 5. Status & Mode Tab */}
          {activeTab === "statusMode" && (
            <div className="space-y-4">
              {/* Status Section */}
              <div className="space-y-2">
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  Status
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {["Account", "Cash"].map((st) => {
                    const selected = filters.statuses.includes(st);
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => toggleArrayItem("statuses", st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          selected
                            ? "bg-purple-600/20 border-purple-500/50 text-purple-300 shadow-sm"
                            : "bg-slate-800/60 border-white/10 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mode Section */}
              <div className="space-y-2">
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  Transport Mode
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {["Surface", "Air", "Cargo", "V Fast"].map((m) => {
                    const selected = filters.modes.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleArrayItem("modes", m)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          selected
                            ? "bg-blue-600/20 border-blue-500/50 text-blue-300 shadow-sm"
                            : "bg-slate-800/60 border-white/10 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-white/10 bg-slate-950/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {activeCount > 0 ? `${activeCount} filter criteria active` : "No filters applied"}
          </span>
          <Button
            size="sm"
            onClick={() => setOpen(false)}
            className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-3"
          >
            Apply & Close
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
