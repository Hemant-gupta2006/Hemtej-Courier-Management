"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useRegisters } from "@/context/RegisterContext";
import { toast } from "sonner";
import { Loader2, Merge, AlertTriangle } from "lucide-react";

interface CombineRegistersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CombineRegistersModal({ isOpen, onClose }: CombineRegistersModalProps) {
  const { registers, refreshRegisters } = useRegisters();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newRegisterName, setNewRegisterName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"SELECT" | "CONFIRM">("SELECT");

  // Only show active registers that share the same month/year as the first selected, or all if none selected
  const activeOnly = useMemo(() => registers.filter(r => r.status === "Active"), [registers]);
  
  const compatibleRegisters = useMemo(() => {
    if (selectedIds.length === 0) return activeOnly;
    const firstSelected = activeOnly.find(r => r.id === selectedIds[0]);
    if (!firstSelected) return activeOnly;
    return activeOnly.filter(r => r.month === firstSelected.month && r.year === firstSelected.year);
  }, [activeOnly, selectedIds]);

  const selectedRegisters = useMemo(() => {
    return activeOnly.filter(r => selectedIds.includes(r.id));
  }, [activeOnly, selectedIds]);

  const totalEntriesToMove = useMemo(() => {
    return selectedRegisters.reduce((sum, r) => sum + (r.entryCount || 0), 0);
  }, [selectedRegisters]);

  const handleToggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (selectedIds.length < 2) {
      toast.error("Please select at least 2 registers to combine.");
      return;
    }
    if (!newRegisterName.trim()) {
      toast.error("Please enter a name for the new combined register.");
      return;
    }
    if (registers.some(r => r.name.toLowerCase() === newRegisterName.trim().toLowerCase())) {
      toast.error("A register with this name already exists.");
      return;
    }
    setStep("CONFIRM");
  };

  const handleCombine = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/couriers/registers/combine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceRegisterIds: selectedIds,
          newRegisterName: newRegisterName.trim()
        })
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || "Failed to combine registers");
      }

      toast.success(`Successfully combined ${selectedIds.length} registers!`);
      await refreshRegisters();
      handleClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep("SELECT");
    setSelectedIds([]);
    setNewRegisterName("");
    onClose();
  };

  // Reset selection if modal closes unexpectedly
  React.useEffect(() => {
    if (!isOpen) {
      setStep("SELECT");
      setSelectedIds([]);
      setNewRegisterName("");
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px] bg-slate-950 border-white/10 text-slate-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-white">
            <Merge className="w-5 h-5 text-purple-400" />
            Combine Registers
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {step === "SELECT" 
              ? "Select multiple active registers from the same month to physically merge into one."
              : "Review the merge details before proceeding. This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>

        {step === "SELECT" && (
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <Label className="text-sm font-medium text-slate-300">Compatible Registers</Label>
              <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                {compatibleRegisters.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">No compatible active registers available.</div>
                ) : (
                  compatibleRegisters.map((reg) => (
                    <div key={reg.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors">
                      <Checkbox
                        id={`reg-${reg.id}`}
                        checked={selectedIds.includes(reg.id)}
                        onCheckedChange={() => handleToggle(reg.id)}
                        className="border-slate-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                      />
                      <label
                        htmlFor={`reg-${reg.id}`}
                        className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-slate-300"
                      >
                        {reg.name}
                      </label>
                      <span className="text-xs text-slate-500">{reg.entryCount || 0} entries</span>
                    </div>
                  ))
                )}
              </div>
              {selectedIds.length > 0 && selectedRegisters[0] && (
                <div className="text-xs text-purple-400/80 bg-purple-500/10 p-2 rounded border border-purple-500/20">
                  Filtering by {selectedRegisters[0].month}/{selectedRegisters[0].year}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newName" className="text-sm font-medium text-slate-300">New Register Name</Label>
              <Input
                id="newName"
                value={newRegisterName}
                onChange={(e) => setNewRegisterName(e.target.value)}
                placeholder="e.g. July 2026 Combined"
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {step === "CONFIRM" && (
          <div className="space-y-4 py-4 text-sm text-slate-300">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex gap-3 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Structural Merge Warning</p>
                <p className="text-xs text-yellow-500/80 leading-relaxed">
                  This will move all entries into <strong className="text-yellow-400">{newRegisterName}</strong> and archive the original registers. Original Challan and SR.No values will remain completely unchanged.
                </p>
              </div>
            </div>

            <div className="space-y-2 bg-slate-900/50 p-4 rounded-lg border border-white/5">
              <h4 className="font-medium text-slate-200 border-b border-white/10 pb-2 mb-3">Merging Registers:</h4>
              {selectedRegisters.map(r => (
                <div key={r.id} className="flex justify-between items-center text-xs">
                  <span>{r.name}</span>
                  <span className="text-slate-500">{r.entryCount || 0} entries</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3 mt-3 border-t border-white/10 font-medium text-slate-200">
                <span>Total entries to move:</span>
                <span className="text-purple-400 font-bold">{totalEntriesToMove}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 border-t border-white/5 pt-4">
          <Button
            variant="ghost"
            onClick={step === "SELECT" ? handleClose : () => setStep("SELECT")}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            {step === "SELECT" ? "Cancel" : "Back"}
          </Button>
          
          {step === "SELECT" ? (
            <Button
              onClick={handleNext}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Next Step
            </Button>
          ) : (
            <Button
              onClick={handleCombine}
              disabled={isSubmitting}
              className="bg-yellow-600 hover:bg-yellow-700 text-white border-none"
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Merging...</>
              ) : (
                "Confirm & Combine"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
