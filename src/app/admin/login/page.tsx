"use client";

import { useState, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Mail, Lock } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminLoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in as Admin, redirect to /admin
  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.role === "Admin") {
      router.push("/admin");
    }
  }, [session, status, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      toast.error("Invalid credentials.");
      setLoading(false);
    } else {
      // Fetch session to check role
      const res = await fetch("/api/auth/session");
      const sessionData = await res.json();

      if (sessionData?.user && sessionData.user.role === "Admin") {
        toast.success("Welcome to HemTej Admin Control Panel");
        router.push("/admin");
        router.refresh();
      } else {
        // Sign out non-admins immediately
        await signOut({ redirect: false });
        toast.error("Access denied. Admin account required.");
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900 relative overflow-hidden">
      {/* Background Decorative Blur Elements */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-red-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-orange-500/10 blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <div className="backdrop-blur-xl bg-white/40 dark:bg-slate-900/40 border border-white/40 dark:border-white/10 shadow-2xl rounded-3xl p-8 relative overflow-hidden">
          <div className="flex flex-col items-center mb-8 space-y-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="group flex flex-col items-center justify-center mb-2 drop-shadow-md"
            >
              <img
                src="/icon.png"
                alt="HemTej Co Logo"
                className="w-16 h-16 md:w-20 md:h-20 object-contain transition-transform duration-300 group-hover:scale-110"
              />
            </motion.div>
            <div className="text-center space-y-1">
              <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-red-700 to-orange-700 dark:from-red-400 dark:to-orange-400">
                HemTej Admin
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Sign in to manage the platform
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2 relative group">
                <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 ml-1">
                  Admin Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@hemtej.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="pl-10 bg-white/50 dark:bg-slate-800/50 border-white/30 dark:border-white/10 focus:ring-2 focus:ring-red-500/50 backdrop-blur-sm transition-all shadow-sm rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2 relative group">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 ml-1">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="pl-10 bg-white/50 dark:bg-slate-800/50 border-white/30 dark:border-white/10 focus:ring-2 focus:ring-red-500/50 backdrop-blur-sm transition-all shadow-sm rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Button
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg shadow-red-500/20 transition-all rounded-xl py-6 font-semibold"
                type="submit"
                disabled={loading}
              >
                {loading ? "Verifying..." : "Sign In As Admin"}
              </Button>
            </div>

            <div className="text-center text-sm text-slate-600 dark:text-slate-400">
              Not an administrator?{" "}
              <Link href="/login" className="font-medium text-red-600 dark:text-red-400 hover:underline">
                Staff Sign In
              </Link>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
