"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { DataTable } from "../entries/data-table";
import { columns } from "../entries/columns";

export default function AllEntriesPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/couriers");
      if (res.ok) setEntries(await res.json());
      else toast.error("Failed to load entries.");
    } catch {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="h-full flex-1 flex-col space-y-6 flex">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/entries")}
          className="rounded-xl hover:bg-white/40 dark:hover:bg-slate-800/40"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">All Entries</h2>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : `${entries.length.toLocaleString()} entries — fully editable, virtualised scrolling`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
          Loading entries…
        </div>
      ) : (
        /* Reuse the full editable DataTable with virtualisation enabled */
        <DataTable
          columns={columns}
          data={entries}
          virtualize
          tableHeight="calc(100vh - 260px)"
          mode="all"
        />
      )}
    </div>
  );
}
