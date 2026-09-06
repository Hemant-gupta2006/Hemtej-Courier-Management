"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Receipt, Calendar, User, Settings2, Loader2, AlertCircle, Database, Plus, X, Users, Package, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { getAutocompleteData } from "@/lib/autocomplete";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PartyFormModal } from "@/components/PartyFormModal";
import { calculateGstBillDateString } from "@/lib/billing-date";

export default function ReportsPage() {
  const [manifestDate, setManifestDate] = useState(new Date().toISOString().split('T')[0]);
  const [billingDateMode, setBillingDateMode] = useState<"month" | "range">("month");
  const [billingMonth, setBillingMonth] = useState((new Date().getMonth() + 1).toString());
  const [billingYear, setBillingYear] = useState(new Date().getFullYear().toString());
  const [billingFromDate, setBillingFromDate] = useState("");
  const [billingToDate, setBillingToDate] = useState("");
  
  const [billingParties, setBillingParties] = useState<string[]>([]);
  const [currentAlias, setCurrentAlias] = useState("");
  
  const [billingPartyName, setBillingPartyName] = useState("");
  const [saveAliases, setSaveAliases] = useState(false);
  const [parties, setParties] = useState<string[]>([]);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  
  // Party Master State
  const [masterParties, setMasterParties] = useState<any[]>([]);
  const [selectedParty, setSelectedParty] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const partySearchRef = useRef<HTMLDivElement>(null);
  const [advancedDetails, setAdvancedDetails] = useState({
    billNo: "",
    invoiceDate: calculateGstBillDateString(new Date().getMonth() + 1, new Date().getFullYear()),
    dueDate: "",
    partyAddress1: "",
    partyAddress2: "",
    partyCity: "",
    partyState: "",
    partyPincode: "",
    partyContact: "",
    partyGst: "",
    businessName: "SEETARAM ENTERPRISE",
    businessAddress: "Shop no.04, Dave Chawl, Near Kamu, Baba, SV Road, Opp. Patker College, Goregaon West, Mumbai 400104",
    businessContact: "+91 9892796228",
    businessGst: "27AYDPG0955B1ZV",
  });
  const [isManifestLoading, setIsManifestLoading] = useState(false);
  const [isBillingLoading, setIsBillingLoading] = useState(false);

  const [monthlyMonth, setMonthlyMonth] = useState((new Date().getMonth() + 1).toString());
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear().toString());
  const [isMonthlyLoading, setIsMonthlyLoading] = useState(false);

  const isValidParty = useMemo(() => 
    billingParties.length > 0 && billingPartyName.trim() !== "",
  [billingParties, billingPartyName]);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (billingDateMode === "month") {
      const m = parseInt(billingMonth, 10);
      const y = parseInt(billingYear, 10);
      const mStr = billingMonth.padStart(2, '0');
      const lastDay = new Date(y, m, 0).getDate();
      setBillingFromDate(`${billingYear}-${mStr}-01`);
      setBillingToDate(`${billingYear}-${mStr}-${String(lastDay).padStart(2, '0')}`);

      const calculatedInvoiceDate = calculateGstBillDateString(m, y);
      setAdvancedDetails(prev => ({ ...prev, invoiceDate: calculatedInvoiceDate }));
    }
  }, [billingDateMode, billingMonth, billingYear]);

  useEffect(() => {
    if (billingDateMode === "range" && billingToDate) {
      const parts = billingToDate.split('-');
      if (parts.length >= 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
          const calculatedInvoiceDate = calculateGstBillDateString(m, y);
          setAdvancedDetails(prev => ({ ...prev, invoiceDate: calculatedInvoiceDate }));
        }
      }
    }
  }, [billingDateMode, billingToDate]);

  const dateError = useMemo(() => {
    if (billingDateMode === "range") {
      if (!billingFromDate || !billingToDate) return "";
      if (billingFromDate > billingToDate) return "End date must be after start date";
      if (billingFromDate > today || billingToDate > today) return "Future dates are not allowed";
      return "";
    } else {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const m = parseInt(billingMonth, 10);
      const y = parseInt(billingYear, 10);
      if (y > currentYear || (y === currentYear && m > currentMonth)) {
        return "Future month cannot be selected";
      }
      return "";
    }
  }, [billingDateMode, billingFromDate, billingToDate, billingMonth, billingYear, today]);

  const isManifestValid = !!manifestDate && manifestDate <= today;
  const isBillingValid = useMemo(() => {
    if (billingDateMode === "range") {
      return !!billingFromDate && !!billingToDate && isValidParty && !dateError;
    }
    return !!billingMonth && !!billingYear && isValidParty && !dateError;
  }, [billingDateMode, billingFromDate, billingToDate, billingMonth, billingYear, isValidParty, dateError]);

  useEffect(() => {
    getAutocompleteData().then(data => {
      setParties(data.fromParties || []);
    });
    fetchParties();
  }, []);

  const fetchParties = async () => {
    try {
      const res = await fetch("/api/billing/parties");
      const data = await res.json();
      if (data.success) {
        const list = Array.isArray(data.data) ? data.data : (data.data?.parties || []);
        setMasterParties(Array.isArray(list) ? list : []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (partySearchRef.current && !partySearchRef.current.contains(event.target as Node)) {
        setShowPartyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const downloadFile = async (url: string, defaultFilename: string) => {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition');
    let filename = defaultFilename;
    if (disposition && disposition.includes('filename="')) {
      filename = disposition.split('filename="')[1].split('"')[0];
    }
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    a.remove();
  };

  const downloadManifest = async () => {
    if (!isManifestValid || isManifestLoading) return;
    
    setIsManifestLoading(true);
    try {
      await downloadFile(`/api/reports/manifest?date=${manifestDate}`, `Manifest_${manifestDate}.xlsx`);
    } catch (error: any) {
      toast.error(error.message || "Failed to generate manifest");
    } finally {
      setIsManifestLoading(false);
    }
  };

  const downloadBilling = async () => {
    if (!isBillingValid || isBillingLoading) return;

    setIsBillingLoading(true);
    try {
      const uniqueParties = Array.from(new Set(billingParties));

      if (saveAliases && uniqueParties.length > 0 && billingPartyName) {
        await fetch("/api/reports/aliases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            billingPartyName: billingPartyName.trim(),
            aliases: uniqueParties
          })
        });
      }

      const effectiveStartDate = billingDateMode === "month"
        ? `${billingYear}-${billingMonth.padStart(2, '0')}-01`
        : billingFromDate;

      const lastDayOfMonth = new Date(parseInt(billingYear, 10), parseInt(billingMonth, 10), 0).getDate();
      const effectiveEndDate = billingDateMode === "month"
        ? `${billingYear}-${billingMonth.padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`
        : billingToDate;

      const payload = {
        startDate: effectiveStartDate || undefined,
        endDate: effectiveEndDate || undefined,
        billingPartyName: billingPartyName.trim() || undefined,
        partyId: selectedParty?.id || undefined,
        partyNames: uniqueParties,
        billingMonth: billingDateMode === "month" ? parseInt(billingMonth, 10) : undefined,
        billingYear: billingDateMode === "month" ? parseInt(billingYear, 10) : undefined,
        ...advancedDetails
      };

      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate billing report");
      }

      // Decode base64 and trigger download
      const binaryString = window.atob(data.data.fileBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const fallbackPartyName = (billingPartyName.trim() || selectedParty?.officialInvoiceName || "Tax_Invoice").replace(/[/\\?%*:|"<>]/g, "").trim();
      const fallbackBillNo = (data.data?.billNo || advancedDetails.billNo || "").toString().replace(/[/\\?%*:|"<>]/g, "").trim();
      const fallbackFileName = fallbackBillNo ? `${fallbackPartyName} ${fallbackBillNo}.xlsx` : `${fallbackPartyName}.xlsx`;
      a.download = data.data?.fileName || fallbackFileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();
      
      toast.success("Bill generated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate billing report");
    } finally {
      setIsBillingLoading(false);
    }
  };

  const handleSelectMasterParty = (party: any) => {
    setSelectedParty(party);
    setBillingPartyName(party.officialInvoiceName);
    setShowPartyDropdown(false);
    setAdvancedDetails(prev => ({
      ...prev,
      partyAddress1: party.addressLine1 || "",
      partyAddress2: party.addressLine2 || "",
      partyCity: party.city || "",
      partyState: party.state || "",
      partyPincode: party.pincode || "",
      partyContact: party.contactNumber || "",
      partyGst: party.gstNumber || "",
    }));
  };

  const handlePartyModalSave = (party: any) => {
    fetchParties();
    handleSelectMasterParty(party);
  };

  useEffect(() => {
    if (!billingPartyName.trim() || selectedParty) return;
    
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`/api/reports/aliases?billingPartyName=${encodeURIComponent(billingPartyName.trim())}`);
        if (res.ok) {
          const data = await res.json();
          if (data.data?.aliases && data.data.aliases.length > 0) {
            setBillingParties(data.data.aliases);
          }
        }
      } catch (error) {
        console.error("Failed to load aliases", error);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [billingPartyName, selectedParty]);

  const addAlias = (alias: string) => {
    if (alias.trim() && !billingParties.includes(alias.trim())) {
      setBillingParties([...billingParties, alias.trim()]);
    }
    setCurrentAlias("");
  };

  const removeAlias = (index: number) => {
    const newParties = [...billingParties];
    newParties.splice(index, 1);
    setBillingParties(newParties);
  };

  const downloadMonthly = async () => {
    if (isMonthlyLoading) return;
    setIsMonthlyLoading(true);
    try {
      const monthIndex = parseInt(monthlyMonth, 10) - 1;
      const monthName = new Date(parseInt(monthlyYear, 10), monthIndex, 1).toLocaleString('default', { month: 'long' });
      await downloadFile(`/api/reports/monthly?month=${monthlyMonth}&year=${monthlyYear}`, `${monthName} ${monthlyYear}.xlsx`);
    } catch (error: any) {
      toast.error(error.message || "Failed to generate monthly report");
    } finally {
      setIsMonthlyLoading(false);
    }
  };

  const currentAliasFiltered = parties
    .filter(p => p.toLowerCase().includes(currentAlias.toLowerCase()))
    .slice(0, 5);

  const [activeTab, setActiveTab] = useState<"billing" | "manifest" | "monthly">("billing");

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10 px-4 md:px-0">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Reports
        </h2>
        <p className="text-muted-foreground">
          Generate exports, manifests and billing documents
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/60 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab("billing")}
          className={cn("flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all", activeTab === "billing" ? "bg-white dark:bg-slate-900 shadow-md text-purple-600 dark:text-purple-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/80")}
        >
          <Receipt className="h-4 w-4" /> Account Billing
        </button>
        <button 
          onClick={() => setActiveTab("manifest")}
          className={cn("flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all", activeTab === "manifest" ? "bg-white dark:bg-slate-900 shadow-md text-blue-600 dark:text-blue-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/80")}
        >
          <Package className="h-4 w-4" /> Daily Manifest
        </button>
        <button 
          onClick={() => setActiveTab("monthly")}
          className={cn("flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all", activeTab === "monthly" ? "bg-white dark:bg-slate-900 shadow-md text-emerald-600 dark:text-emerald-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/80")}
        >
          <Database className="h-4 w-4" /> Monthly Register
        </button>
      </div>

      <div className="grid gap-6">
        {/* Daily Manifest Card */}
        {activeTab === "manifest" && (
        <Card className="border-white/20 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl rounded-[24px] overflow-hidden flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-100 dark:bg-blue-900/30">
                <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Daily Manifest</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col">
            <div className="space-y-2 flex-1">
              <label className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Calendar className="h-4 w-4" /> Date
              </label>
              <Input
                type="date"
                max={today}
                value={manifestDate}
                onChange={(e) => setManifestDate(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && downloadManifest()}
                className={cn(
                  "rounded-xl h-11 transition-all bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800",
                  manifestDate > today && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {manifestDate > today && (
                <p className="text-[10px] font-bold text-destructive uppercase tracking-wider flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> Future date
                </p>
              )}
            </div>
            <div className="pt-2 mt-auto">
              <Button 
                onClick={downloadManifest} 
                disabled={!isManifestValid || isManifestLoading}
                variant="outline"
                className="w-full h-11 rounded-xl text-blue-600 border-blue-200 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                {isManifestLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download
              </Button>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Monthly Register Export Card */}
        {activeTab === "monthly" && (
        <Card className="border-white/20 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl rounded-[24px] overflow-hidden flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
                <Database className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Monthly Register Export</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col">
            <div className="grid grid-cols-2 gap-3 flex-1">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Month</label>
                <Select value={monthlyMonth} onValueChange={(val) => val && setMonthlyMonth(val)}>
                  <SelectTrigger className="rounded-xl h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Year</label>
                <Select value={monthlyYear} onValueChange={(val) => val && setMonthlyYear(val)}>
                  <SelectTrigger className="rounded-xl h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="pt-2 mt-auto">
              <Button 
                onClick={downloadMonthly} 
                disabled={isMonthlyLoading}
                variant="outline"
                className="w-full h-11 rounded-xl text-emerald-600 border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              >
                {isMonthlyLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download
              </Button>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Account Billing Card */}
        {activeTab === "billing" && (
        <Card className="md:col-span-2 border-white/20 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shadow-xl rounded-[24px] overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-purple-100 dark:bg-purple-900/30">
                <Receipt className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Account Billing</CardTitle>
                <CardDescription>Generate GST invoices</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Bill Number (Optional)</label>
              <Input 
                placeholder="e.g. 199" 
                value={advancedDetails.billNo}
                onChange={(e) => setAdvancedDetails({...advancedDetails, billNo: e.target.value})}
                className="rounded-xl h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-purple-500/30 max-w-sm"
              />
            </div>
            
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  {billingDateMode === "month" ? "Billing Period (By Month)" : "Billing Period (Custom Date Range)"}
                </label>
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-xl text-xs font-semibold w-fit border border-slate-200/50 dark:border-slate-800/50">
                  <button
                    type="button"
                    onClick={() => setBillingDateMode("month")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                      billingDateMode === "month"
                        ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    )}
                  >
                    Select Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingDateMode("range")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                      billingDateMode === "range"
                        ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    )}
                  >
                    Date Range
                  </button>
                </div>
              </div>

              {billingDateMode === "month" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Month</label>
                    <Select value={billingMonth} onValueChange={(val) => val && setBillingMonth(val)}>
                      <SelectTrigger className="rounded-xl h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <SelectItem key={m} value={m.toString()}>
                            {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Year</label>
                    <Select value={billingYear} onValueChange={(val) => val && setBillingYear(val)}>
                      <SelectTrigger className="rounded-xl h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                          <SelectItem key={y} value={y.toString()}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">From Date</label>
                    <Input
                      type="date"
                      max={today}
                      value={billingFromDate}
                      onChange={(e) => setBillingFromDate(e.target.value)}
                      className={cn(
                        "rounded-xl h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800",
                        (billingFromDate > today || (billingFromDate && billingToDate && billingFromDate > billingToDate)) && "border-destructive focus-visible:ring-destructive"
                      )}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">To Date</label>
                    <Input
                      type="date"
                      max={today}
                      value={billingToDate}
                      onChange={(e) => setBillingToDate(e.target.value)}
                      className={cn(
                        "rounded-xl h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800",
                        (billingToDate > today || (billingFromDate && billingToDate && billingFromDate > billingToDate)) && "border-destructive focus-visible:ring-destructive"
                      )}
                    />
                  </div>
                </div>
              )}

              {dateError && (
                <p className="text-[10px] font-bold text-destructive uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {dateError}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Booking Party Names</label>
              
              {/* Chips container */}
              {billingParties.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {billingParties.map((party, index) => (
                    <div key={index} className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm">
                      <span>{party}</span>
                      <button 
                        onClick={() => removeAlias(index)}
                        className="ml-1 text-slate-400 hover:text-destructive transition-colors rounded-full p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Alias Input */}
              <div className="relative max-w-sm">
                {currentAlias.length > 0 && currentAliasFiltered[0] && currentAliasFiltered[0].toLowerCase().startsWith(currentAlias.toLowerCase()) && (
                  <div className="absolute inset-0 flex items-center px-3 pointer-events-none text-slate-400 dark:text-slate-500 z-0 h-11 text-sm">
                    <span className="opacity-0">{currentAlias}</span>
                    <span>{currentAliasFiltered[0].slice(currentAlias.length)}</span>
                  </div>
                )}
                  <Input
                  placeholder="+ Add Alias (Press Enter)"
                  value={currentAlias}
                  onChange={(e) => setCurrentAlias(e.target.value)}
                  enterKeyHint="enter"
                  onKeyDown={(e) => {
                    const suggestion = currentAliasFiltered[0];
                    const isSuggestionVisible = suggestion && suggestion.toLowerCase().startsWith(currentAlias.toLowerCase()) && suggestion.toLowerCase() !== currentAlias.toLowerCase();
                    const isEnter = e.key === "Enter" || e.keyCode === 13;

                    if ((e.key === "Tab" || isEnter) && isSuggestionVisible) {
                      e.preventDefault();
                      setCurrentAlias(suggestion);
                    } else if (isEnter) {
                      e.preventDefault();
                      addAlias(currentAlias);
                    }
                  }}
                  className="rounded-xl h-11 relative z-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-purple-500/30"
                  style={{ backgroundColor: 'transparent' }}
                />
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  Select Billing Party (Master)
                </label>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedParty(null); setIsModalOpen(true); }} className="h-8 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20">
                  <Plus className="h-4 w-4 mr-1" /> Add New
                </Button>
              </div>
              <div className="relative bg-white dark:bg-slate-950 rounded-xl" ref={partySearchRef}>
                {(() => {
                  const partyList = Array.isArray(masterParties) ? masterParties : [];
                  const masterSuggestion = partyList.find(p => p.officialInvoiceName.toLowerCase().startsWith(billingPartyName.toLowerCase()))?.officialInvoiceName;
                  const isSuggestionVisible = billingPartyName.length > 0 && masterSuggestion && masterSuggestion.toLowerCase().startsWith(billingPartyName.toLowerCase()) && masterSuggestion.toLowerCase() !== billingPartyName.toLowerCase();

                  return (
                    <>
                      {isSuggestionVisible && (
                        <div className="absolute inset-0 flex items-center px-3 pointer-events-none text-slate-400 dark:text-slate-500 z-0 h-12 text-base font-medium">
                          <span className="opacity-0">{billingPartyName}</span>
                          <span>{masterSuggestion.slice(billingPartyName.length)}</span>
                        </div>
                      )}
                      <Input
                        placeholder="Search and select a party..."
                        value={billingPartyName}
                        enterKeyHint="enter"
                        onChange={(e) => {
                          setBillingPartyName(e.target.value);
                          if (selectedParty && e.target.value !== selectedParty.officialInvoiceName) {
                            setSelectedParty(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          const isEnter = e.key === "Enter" || e.keyCode === 13;
                          if ((e.key === "Tab" || isEnter) && isSuggestionVisible) {
                            e.preventDefault();
                            const matchingParty = partyList.find(p => p.officialInvoiceName === masterSuggestion);
                            if (matchingParty) {
                              handleSelectMasterParty(matchingParty);
                            }
                          }
                        }}
                        className="rounded-xl h-12 text-base font-medium border-slate-300 dark:border-slate-700 shadow-sm transition-colors focus-visible:ring-purple-500/30 relative z-10"
                        style={{ backgroundColor: 'transparent' }}
                      />
                    </>
                  );
                })()}
              </div>

              {selectedParty && (
                <div className="flex justify-end">
                  <Button variant="link" size="sm" onClick={() => setIsModalOpen(true)} className="h-auto p-0 text-xs text-slate-500 hover:text-purple-600">
                    Edit {selectedParty.officialInvoiceName} details
                  </Button>
                </div>
              )}

              <div className="flex items-center space-x-3 pt-2">
                <div className="flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    id="saveAliases"
                    checked={saveAliases}
                    onChange={(e) => setSaveAliases(e.target.checked)}
                    className="rounded-md border-slate-300 text-purple-600 focus:ring-purple-600 h-4 w-4 transition-all cursor-pointer shadow-sm"
                  />
                </div>
                <label htmlFor="saveAliases" className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                  Remember this alias mapping for future
                </label>
              </div>
            </div>

            {/* Collapsible Invoice Details */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white/50 dark:bg-slate-950/50 mt-4">
              <button 
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="w-full flex items-center justify-between p-4 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-purple-500" />
                  Additional Invoice Details (Optional)
                </div>
                {isAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              
              {isAdvancedOpen && (
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 space-y-6">
                  {/* Invoice Info */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Invoice Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Invoice Date</Label>
                        <Input 
                          type="date"
                          value={advancedDetails.invoiceDate}
                          onChange={(e) => setAdvancedDetails({...advancedDetails, invoiceDate: e.target.value})}
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Party Details */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Bill To (Party Details)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Address Line 1</Label>
                        <Input 
                          placeholder="Shop No / Building" 
                          value={advancedDetails.partyAddress1}
                          onChange={(e) => setAdvancedDetails({...advancedDetails, partyAddress1: e.target.value})}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Address Line 2</Label>
                        <Input 
                          placeholder="Area / Road" 
                          value={advancedDetails.partyAddress2}
                          onChange={(e) => setAdvancedDetails({...advancedDetails, partyAddress2: e.target.value})}
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input 
                          placeholder="City" 
                          value={advancedDetails.partyCity}
                          onChange={(e) => setAdvancedDetails({...advancedDetails, partyCity: e.target.value})}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>State</Label>
                        <Input 
                          placeholder="State" 
                          value={advancedDetails.partyState}
                          onChange={(e) => setAdvancedDetails({...advancedDetails, partyState: e.target.value})}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Pincode</Label>
                        <Input 
                          placeholder="400001" 
                          value={advancedDetails.partyPincode}
                          onChange={(e) => setAdvancedDetails({...advancedDetails, partyPincode: e.target.value})}
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Contact Number</Label>
                        <Input 
                          placeholder="+91" 
                          value={advancedDetails.partyContact}
                          onChange={(e) => setAdvancedDetails({...advancedDetails, partyContact: e.target.value})}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>GST Number</Label>
                        <Input 
                          placeholder="27XXXXX" 
                          value={advancedDetails.partyGst}
                          onChange={(e) => setAdvancedDetails({...advancedDetails, partyGst: e.target.value})}
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Business Info */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Your Business Details</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Business Name</Label>
                        <Input 
                          value={advancedDetails.businessName}
                          onChange={(e) => setAdvancedDetails({...advancedDetails, businessName: e.target.value})}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Business Address</Label>
                        <Input 
                          value={advancedDetails.businessAddress}
                          onChange={(e) => setAdvancedDetails({...advancedDetails, businessAddress: e.target.value})}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Contact No</Label>
                          <Input 
                            value={advancedDetails.businessContact}
                            onChange={(e) => setAdvancedDetails({...advancedDetails, businessContact: e.target.value})}
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>GST Number</Label>
                          <Input 
                            value={advancedDetails.businessGst}
                            onChange={(e) => setAdvancedDetails({...advancedDetails, businessGst: e.target.value})}
                            className="rounded-xl"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button 
              onClick={downloadBilling} 
              disabled={!isBillingValid || isBillingLoading}
              size="lg"
              className="w-full h-14 text-base font-bold rounded-2xl bg-purple-600 hover:bg-purple-700 text-white shadow-xl shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none mt-4"
            >
              {isBillingLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating Billing...
                </>
              ) : (
                <>
                  <Receipt className="mr-2 h-5 w-5" /> Generate Billing
                </>
              )}
            </Button>
          </CardContent>
        </Card>
        )}
      </div>

      <PartyFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handlePartyModalSave}
        initialData={selectedParty}
      />
    </div>
  );
}

