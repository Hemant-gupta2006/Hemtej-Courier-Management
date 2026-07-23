"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User as UserIcon, Shield, Settings } from "lucide-react";
import Link from "next/link";

export function UserDropdown() {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !session?.user) {
    return (
      <div className="h-9 w-9 rounded-full bg-slate-200/60 dark:bg-slate-800/60 animate-pulse border border-slate-200 dark:border-slate-800" />
    );
  }

  const name = session.user.name || "Staff";
  const email = session.user.email || "";
  const role = (session.user as any).role || "Staff";
  const initials = name.charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger id="user-dropdown-trigger" suppressHydrationWarning className="outline-none">
        <div className="flex items-center gap-2.5 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <Avatar className="h-8 w-8 border border-slate-200 dark:border-slate-800 shadow-sm">
            <AvatarFallback className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-semibold text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-xl border-slate-200/80 dark:border-slate-800">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal p-2">
            <div className="flex flex-col space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold leading-none text-slate-900 dark:text-white truncate">
                  {name}
                </p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  role === "Admin" 
                    ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                }`}>
                  {role}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1" />
          
          {role === "Admin" ? (
            <DropdownMenuItem className="rounded-xl cursor-pointer p-0">
              <Link href="/admin/settings" className="flex items-center w-full px-2 py-1.5">
                <Settings className="mr-2 h-4 w-4 text-slate-500" />
                <span>Admin Settings</span>
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="rounded-xl cursor-pointer p-0">
              <Link href="/dashboard/settings" className="flex items-center w-full px-2 py-1.5">
                <Settings className="mr-2 h-4 w-4 text-slate-500" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem 
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-xl text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30 cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
