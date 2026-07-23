"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Package, Mail } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
        toast.error("Invalid email or password.");
      }
      setLoading(false);
    } else {
      // Fetch session data to determine role
      try {
        const res = await fetch("/api/auth/session");
        const sessionData = await res.json();
        const userRole = sessionData?.user?.role;

        toast.success("Logged in successfully!");

        if (userRole === "Admin") {
          router.push("/admin");
        } else {
          router.push("/dashboard");
        }
        router.refresh();
      } catch (e) {
        router.push("/dashboard");
        router.refresh();
      }
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900 relative overflow-hidden">
      {/* Background Decorative Blur Elements */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-blue-500/20 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-500/20 blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <div className="backdrop-blur-xl bg-white/40 dark:bg-slate-900/40 border border-white/40 dark:border-white/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] rounded-3xl p-8 rounded-2xl relative overflow-hidden">
          <div className="flex flex-col items-center mb-8 space-y-4">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="group flex flex-col items-center justify-center mb-2 drop-shadow-md"
            >
              <img src="/icon.png" alt="HemTej Co Logo" className="w-16 h-16 md:w-20 md:h-20 object-contain transition-transform duration-300 group-hover:scale-110" />
            </motion.div>
            <div className="text-center space-y-1">
              <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-purple-700 dark:from-blue-400 dark:to-purple-400">
                Welcome Back
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Sign in to manage your couriers
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2 relative group">
                <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 ml-1">Email</Label>
                <div className="relative">
                   <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="pl-10 bg-white/50 dark:bg-slate-800/50 border-white/30 dark:border-white/10 focus:ring-2 focus:ring-blue-500/50 backdrop-blur-sm transition-all shadow-sm rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 ml-1">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="bg-white/50 dark:bg-slate-800/50 border-white/30 dark:border-white/10 focus:ring-2 focus:ring-blue-500/50 backdrop-blur-sm transition-all shadow-sm rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-4">
              <Button 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg transition-all rounded-xl py-6" 
                type="submit" 
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In with Email"}
              </Button>
            </div>

            <div className="text-center text-sm text-slate-600 dark:text-slate-400">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                Sign up
              </Link>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
