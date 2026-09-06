"use client";

import { useState, useEffect, Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";

function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const registerId = searchParams.get("registerId");
  const isRegisterView = pathname === "/dashboard/entries" && registerId;

  return (
    <div
      className={`flex-1 min-h-0 ${
        isRegisterView
          ? "flex flex-col h-full overflow-hidden px-2 py-1.5 sm:px-3 sm:py-1.5"
          : "overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
      }`}
    >
      {children}
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  // Start OPEN by default on desktop, closed on mobile
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
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="hidden md:flex md:flex-col h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shrink-0 overflow-hidden"
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
        className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0a0f1c] relative min-w-0 overflow-x-hidden"
      >
        <div className="flex-shrink-0">
          <Navbar
            onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
            isSidebarOpen={isSidebarOpen}
          />
        </div>

        <Suspense fallback={
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1.5 sm:px-3 sm:py-1.5">
            {children}
          </div>
        }>
          <MainContent>{children}</MainContent>
        </Suspense>
      </motion.main>

    </div>
  );
}