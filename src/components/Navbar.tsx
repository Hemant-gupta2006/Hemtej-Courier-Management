"use client";

import { UserButton } from "./UserButton";
import { ThemeToggle } from "./ThemeToggle";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "./ui/button";

interface NavbarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const Navbar = ({ onToggleSidebar, isSidebarOpen }: NavbarProps) => {
  return (
    <div className="flex items-center p-4 md:px-6 border-b border-white/40 dark:border-white/5 bg-white/20 dark:bg-slate-900/20 backdrop-blur-md gap-2">
      {/* Sidebar toggle — visible on desktop */}
      {onToggleSidebar && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors shrink-0"
          title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <PanelLeftOpen className="h-5 w-5" />
          )}
        </Button>
      )}

      {/* Mobile-only hamburger (original) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        className="md:hidden text-slate-700 dark:text-slate-300"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex w-full justify-end gap-x-4 items-center">
        <ThemeToggle />
        <UserButton />
      </div>
    </div>
  );
};
