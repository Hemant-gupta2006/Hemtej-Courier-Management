"use client";

import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900 relative overflow-hidden">
      {/* Background Decorative Blur Elements */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-red-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-orange-500/10 blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10 text-center"
      >
        <div className="backdrop-blur-xl bg-white/40 dark:bg-slate-900/40 border border-white/40 dark:border-white/10 shadow-2xl rounded-3xl p-8 space-y-6 relative overflow-hidden">
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-red-100 dark:bg-red-950/30 rounded-full">
              <ShieldAlert className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Access Denied
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm">
              Your account does not have administrator privileges. If you believe this is an error, please contact your system manager.
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "rounded-xl border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800 py-5"
              )}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Link>
            <Link
              href="/admin/login"
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-md shadow-red-500/20 border-none py-5"
              )}
            >
              Sign In As Admin
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
