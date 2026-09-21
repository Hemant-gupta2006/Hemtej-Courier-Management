"use client";

import { useState, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Mail, Lock, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminLoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in as Admin, redirect directly to /admin
  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.role === "Admin") {
      router.push("/admin");
    }
  }, [session, status, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === "ACCOUNT_DISABLED") {
          toast.error("Your account has been disabled by an administrator.");
        } else if (result.error.startsWith("ACCOUNT_LOCKED")) {
          const mins = result.error.split(":")[1] || "15";
          toast.error(`Account temporarily locked due to failed login attempts. Try again in ${mins} minutes.`);
        } else {
          toast.error("Invalid administrator email or password.");
        }
        setLoading(false);
        return;
      }

      // Verify role from active session
      const res = await fetch("/api/auth/session");
      const sessionData = await res.json();
      const userRole = sessionData?.user?.role;

      if (userRole === "Admin") {
        toast.success("Welcome back, Administrator!");
        router.push("/admin");
        router.refresh();
      } else {
        // Sign out non-admin users immediately to prevent unauthorized access
        await signOut({ redirect: false });
        toast.error("Access denied. Administrator privileges required.");
        setLoading(false);
      }
    } catch (err: any) {
      toast.error("An unexpected error occurred during sign in.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900 relative overflow-hidden">
      {/* Background Decorative Blur Elements */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-red-500/15 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-amber-500/15 blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <div className="backdrop-blur-xl bg-white/50 dark:bg-slate-900/50 border border-red-200/40 dark:border-red-900/30 shadow-[0_8px_32px_0_rgba(239,68,68,0.1)] rounded-3xl p-8 relative overflow-hidden">
          {/* Admin Badge */}
          <div className="flex flex-col items-center mb-8 space-y-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="relative group flex items-center justify-center"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-600 flex items-center justify-center shadow-lg shadow-red-500/25">
                <ShieldCheck className="w-9 h-9 md:w-11 md:h-11 text-white" />
              </div>
            </motion.div>
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                Administrator Portal
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-red-700 to-amber-600 dark:from-red-400 dark:to-amber-400">
                Admin Sign In
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Authenticate with elevated admin credentials
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2 relative group">
                <Label htmlFor="admin-email" className="text-slate-700 dark:text-slate-300 ml-1 text-xs font-medium">
                  Admin Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@hemtej.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="pl-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-red-500/50 backdrop-blur-sm transition-all shadow-sm rounded-xl h-11"
                  />
                </div>
              </div>

              <div className="space-y-2 relative group">
                <Label htmlFor="admin-password" className="text-slate-700 dark:text-slate-300 ml-1 text-xs font-medium">
                  Admin Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="admin-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="pl-10 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-red-500/50 backdrop-blur-sm transition-all shadow-sm rounded-xl h-11"
                  />
                </div>
              </div>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white shadow-lg shadow-red-500/25 transition-all rounded-xl py-6 font-semibold"
              type="submit"
              disabled={loading}
            >
              {loading ? "Verifying Administrator..." : "Sign In to Admin Panel"}
            </Button>

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Staff Sign In
              </Link>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
