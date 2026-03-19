"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  // 🔥 Start CLOSED on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full relative z-10 p-2 gap-4 overflow-hidden">

      {/* ✅ DESKTOP SIDEBAR */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.div
            key="sidebar"
            initial={{ width: 0, opacity: 0, marginRight: -16 }}
            animate={{ width: 280, opacity: 1, marginRight: 0 }}
            exit={{ width: 0, opacity: 0, marginRight: -16 }}
            transition={{ duration: 0.3 }}
            className="hidden md:flex md:flex-col h-full rounded-[24px] overflow-hidden backdrop-blur-3xl bg-white/60 dark:bg-[#111827]/70 border border-white/40 dark:border-white/10 shadow-lg shrink-0"
          >
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ✅ MOBILE SIDEBAR */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.3 }}
            className="fixed top-0 left-0 h-full w-64 z-50 md:hidden
                       bg-white dark:bg-slate-900 shadow-lg"
          >
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ✅ MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ✅ MAIN CONTENT */}
      <motion.main
        layout
        transition={{ duration: 0.3 }}
        className="flex-1 flex flex-col h-full rounded-[24px] overflow-hidden backdrop-blur-3xl bg-white/40 dark:bg-[#111827]/40 border border-white/40 dark:border-white/10 shadow-lg relative min-w-0"
      >
        <div className="flex-shrink-0">
          <Navbar
            onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
            isSidebarOpen={isSidebarOpen}
          />
        </div>

        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </motion.main>

    </div>
  );
}