"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface PartyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (party: any) => void;
  initialData?: any;
}

export function PartyFormModal({ isOpen, onClose, onSave, initialData }: PartyFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    officialInvoiceName: initialData?.officialInvoiceName || "",
    aliases: initialData?.aliases ? initialData.aliases.join(", ") : "",
    addressLine1: initialData?.addressLine1 || "",
    addressLine2: initialData?.addressLine2 || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    pincode: initialData?.pincode || "",
    contactNumber: initialData?.contactNumber || "",
    gstNumber: initialData?.gstNumber || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.officialInvoiceName) {
      toast.error("Official Invoice Name is required");
      return;
    }
    
    setIsLoading(true);
    try {
      const payload = {
        ...formData,
        aliases: formData.aliases ? formData.aliases.split(",").map((a: string) => a.trim()).filter(Boolean) : [formData.officialInvoiceName]
      };

      const url = initialData?.id 
        ? `/api/billing/parties/${initialData.id}` 
        : `/api/billing/parties`;
        
      const method = initialData?.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        toast.success(`Party ${initialData?.id ? "updated" : "created"} successfully`);
        onSave(data.data);
        onClose();
      } else {
        toast.error(data.error || "Failed to save party");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {initialData ? "Edit Billing Party" : "Add New Billing Party"}
          </DialogTitle>
          <DialogDescription>
            {initialData ? "Update the master details for this party." : "Create a new party for billing."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="officialInvoiceName">Official Invoice Name *</Label>
                <Input 
                  id="officialInvoiceName"
                  name="officialInvoiceName"
                  value={formData.officialInvoiceName} 
                  onChange={handleChange} 
                  placeholder="e.g. Reliance Industries Ltd"
                  className="rounded-xl"
                  required
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="aliases">Booking Aliases (Comma separated)</Label>
                <Input 
                  id="aliases"
                  name="aliases"
                  value={formData.aliases} 
                  onChange={handleChange} 
                  placeholder="e.g. RIL, Reliance, Reliance Ind"
                  className="rounded-xl"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input 
                  id="addressLine1"
                  name="addressLine1"
                  value={formData.addressLine1} 
                  onChange={handleChange} 
                  placeholder="Shop No / Building"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input 
                  id="addressLine2"
                  name="addressLine2"
                  value={formData.addressLine2} 
                  onChange={handleChange} 
                  placeholder="Area / Road"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input 
                  id="city"
                  name="city"
                  value={formData.city} 
                  onChange={handleChange} 
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input 
                  id="state"
                  name="state"
                  value={formData.state} 
                  onChange={handleChange} 
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input 
                  id="pincode"
                  name="pincode"
                  value={formData.pincode} 
                  onChange={handleChange} 
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactNumber">Contact Number</Label>
                <Input 
                  id="contactNumber"
                  name="contactNumber"
                  value={formData.contactNumber} 
                  onChange={handleChange} 
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="gstNumber">GST Number</Label>
                <Input 
                  id="gstNumber"
                  name="gstNumber"
                  value={formData.gstNumber} 
                  onChange={handleChange} 
                  className="rounded-xl uppercase"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialData ? "Save Changes" : "Create Party"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
