"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building,
  Image as ImageIcon,
  Mail,
  Phone,
  MapPin,
  Percent,
  CheckCircle,
  Save,
  Trash2,
  Upload,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings State
  const [settings, setSettings] = useState({
    companyName: "",
    companyLogo: "",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    companyGst: "",
    defaultStatus: "Cash",
    invoiceTerms: "",
    manifestTerms: ""
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      const resJson = await res.json();
      if (resJson.success) {
        setSettings(resJson.data);
      } else {
        setError(resJson.error || "Failed to load system settings");
      }
    } catch (err: any) {
      setError(err.message || "Failed to retrieve configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      const resJson = await res.json();
      if (resJson.success) {
        toast.success("Company settings saved successfully");
        setSettings(resJson.data);
      } else {
        toast.error(resJson.error || "Failed to save settings");
      }
    } catch {
      toast.error("Network error saving settings");
    } finally {
      setSaving(false);
    }
  };

  // Logo file upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo file size must be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSettings((prev) => ({
        ...prev,
        companyLogo: reader.result as string
      }));
      toast.success("Logo replaced. Click 'Save' to apply changes.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setSettings((prev) => ({
      ...prev,
      companyLogo: "/icon.png"
    }));
    toast.success("Logo reverted to default. Click 'Save' to apply changes.");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <Card className="h-96 animate-pulse bg-slate-100 dark:bg-slate-900 border-none" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-bold">Failed to load settings</h2>
        <p className="text-sm text-slate-500">{error}</p>
        <Button onClick={fetchSettings} className="rounded-xl">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">System Settings</h2>
        <p className="text-muted-foreground mt-1">
          Manage company metadata, logo files, and default system states.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Logo Upload Panel */}
          <Card className="md:col-span-1 border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Company Logo</CardTitle>
              <CardDescription>Upload, replace, or remove logo icon</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 text-center">
              <div className="h-28 w-28 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2 flex items-center justify-center overflow-hidden relative group">
                <img
                  src={settings.companyLogo || "/icon.png"}
                  alt="Company Logo Preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div className="w-full space-y-2">
                <Label
                  htmlFor="logo-input"
                  className="flex items-center justify-center gap-2 h-9 w-full rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer transition-all"
                >
                  <Upload className="h-4 w-4" /> Replace Logo
                </Label>
                <input
                  id="logo-input"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />

                {settings.companyLogo && settings.companyLogo !== "/icon.png" && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleRemoveLogo}
                    className="w-full text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl h-9"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" /> Remove Logo
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Details Forms Panel */}
          <Card className="md:col-span-2 border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Configuration Profile</CardTitle>
              <CardDescription>Company settings printed on manifest forms and invoices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 relative group">
                  <Label htmlFor="set-name" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Company Name
                  </Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="set-name"
                      value={settings.companyName}
                      onChange={(e) => setSettings((s) => ({ ...s, companyName: e.target.value }))}
                      required
                      className="pl-10 rounded-xl bg-white dark:bg-slate-950/40"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 relative group">
                  <Label htmlFor="set-gst" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    GST Registration No
                  </Label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="set-gst"
                      value={settings.companyGst}
                      onChange={(e) => setSettings((s) => ({ ...s, companyGst: e.target.value }))}
                      className="pl-10 rounded-xl bg-white dark:bg-slate-950/40 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 relative group">
                  <Label htmlFor="set-phone" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Company Phone
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="set-phone"
                      value={settings.companyPhone}
                      onChange={(e) => setSettings((s) => ({ ...s, companyPhone: e.target.value }))}
                      className="pl-10 rounded-xl bg-white dark:bg-slate-950/40 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 relative group">
                  <Label htmlFor="set-email" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Company Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="set-email"
                      type="email"
                      value={settings.companyEmail}
                      onChange={(e) => setSettings((s) => ({ ...s, companyEmail: e.target.value }))}
                      className="pl-10 rounded-xl bg-white dark:bg-slate-950/40"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 relative group">
                <Label htmlFor="set-addr" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Registered Address
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <textarea
                    id="set-addr"
                    rows={3}
                    value={settings.companyAddress}
                    onChange={(e) => setSettings((s) => ({ ...s, companyAddress: e.target.value }))}
                    className="flex w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5 relative group">
                <Label htmlFor="set-default-status" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Default Courier Status
                </Label>
                <div className="relative">
                  <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <select
                    id="set-default-status"
                    value={settings.defaultStatus}
                    onChange={(e) => setSettings((s) => ({ ...s, defaultStatus: e.target.value }))}
                    className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 text-sm focus:outline-none"
                  >
                    <option value="Cash">Cash (Default)</option>
                    <option value="Account">Account</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Document Terms & Legal Notes</h4>
                
                <div className="space-y-1.5">
                  <Label htmlFor="set-inv-terms" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Billing Invoice Terms & Conditions
                  </Label>
                  <textarea
                    id="set-inv-terms"
                    rows={2}
                    placeholder="Standard invoice payment terms..."
                    value={settings.invoiceTerms || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, invoiceTerms: e.target.value }))}
                    className="flex w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="set-man-terms" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Manifest Form Terms & Legal Disclaimer
                  </Label>
                  <textarea
                    id="set-man-terms"
                    rows={2}
                    placeholder="Manifest dispatch notes..."
                    value={settings.manifestTerms || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, manifestTerms: e.target.value }))}
                    className="flex w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form Action Buttons */}
        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800/80">
          <Button
            type="submit"
            disabled={saving}
            className="rounded-xl px-6 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-semibold shadow-md shadow-red-500/20"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving Changes..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
