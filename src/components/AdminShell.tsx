"use client";

import { useState, useEffect, Suspense } from "react";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminNavbar } from "@/components/AdminNavbar";
import { motion, AnimatePresence } from "framer-motion";

function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 px-3 py-3 sm:px-6 sm:py-6">
      {children}
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  return (
    <div className="flex h-screen w-full relative z-10 overflow-hidden bg-slate-50 dark:bg-[#0a0f1c]">

      {/* ✅ DESKTOP SIDEBAR */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.div
            key="admin-sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="hidden md:flex md:flex-col h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shrink-0 overflow-hidden"
          >
            <AdminSidebar />
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
                       bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 shadow-xl"
          >
            <AdminSidebar />
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
        className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0a0f1c] relative min-w-0 overflow-x-hidden"
      >
        <div className="flex-shrink-0">
          <AdminNavbar
            onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
            isSidebarOpen={isSidebarOpen}
          />
        </div>

        <Suspense fallback={
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
            </div>
          </div>
        }>
          <MainContent>{children}</MainContent>
        </Suspense>
      </motion.main>

    </div>
  );
}
