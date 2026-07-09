"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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
  User,
  Mail,
  Lock,
  Save,
  Shield,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "sonner";

export default function AdminProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const [saving, setSaving] = useState(false);

  // Profile Details Form State
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: ""
  });

  // Password Fields Form State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [showPasswords, setShowPasswords] = useState(false);

  // Sync profile details when session is loaded
  useEffect(() => {
    if (session?.user) {
      setProfileForm({
        name: session.user.name || "",
        email: session.user.email || ""
      });
    }
  }, [session]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileForm.name,
          email: profileForm.email
        })
      });
      const resJson = await res.json();
      if (resJson.success) {
        toast.success("Profile details updated successfully");
        // Update local session state
        await updateSession({
          ...session,
          user: {
            ...session?.user,
            name: resJson.data.name,
            email: resJson.data.email
          }
        });
      } else {
        toast.error(resJson.error || "Failed to update profile details");
      }
    } catch {
      toast.error("Network error saving profile");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      const resJson = await res.json();
      if (resJson.success) {
        toast.success("Password changed successfully");
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        });
      } else {
        toast.error(resJson.error || "Failed to update password");
      }
    } catch {
      toast.error("Network error during password update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-10 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">Admin Profile</h2>
        <p className="text-muted-foreground mt-1">
          Manage your contact credentials and update account passwords.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Info Form */}
        <Card className="border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Personal Credentials</CardTitle>
            <CardDescription>Update your display name and email address</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1.5 relative group">
                <Label htmlFor="prof-name" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Full Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="prof-name"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    className="pl-10 rounded-xl bg-white dark:bg-slate-950/40"
                  />
                </div>
              </div>

              <div className="space-y-1.5 relative group">
                <Label htmlFor="prof-email" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="prof-email"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                    required
                    className="pl-10 rounded-xl bg-white dark:bg-slate-950/40"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md shadow-red-500/20"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Update Info
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Change Password Form */}
        <Card className="border-white/20 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div>
              <CardTitle className="text-base font-semibold">Change Security Password</CardTitle>
              <CardDescription>Verify current password to set a new key</CardDescription>
            </div>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-1.5 relative group">
                <Label htmlFor="pass-current" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Current Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="pass-current"
                    type={showPasswords ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
                    required
                    className="pl-10 rounded-xl bg-white dark:bg-slate-950/40"
                  />
                </div>
              </div>

              <div className="space-y-1.5 relative group">
                <Label htmlFor="pass-new" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="pass-new"
                    type={showPasswords ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                    required
                    className="pl-10 rounded-xl bg-white dark:bg-slate-950/40"
                  />
                </div>
              </div>

              <div className="space-y-1.5 relative group">
                <Label htmlFor="pass-confirm" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="pass-confirm"
                    type={showPasswords ? "text" : "password"}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    required
                    className="pl-10 rounded-xl bg-white dark:bg-slate-950/40"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="text-xs text-slate-500 hover:text-slate-900 rounded-lg h-8"
                >
                  {showPasswords ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5 mr-1" /> Hide Passwords
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Show Passwords
                    </>
                  )}
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md shadow-red-500/20"
                >
                  Change Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
