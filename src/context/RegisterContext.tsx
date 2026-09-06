"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export interface Register {
  id: string;
  name: string;
  month: number;
  year: number;
  status: "Active" | "Locked" | "Archived";
  createdAt: string;
  updatedAt: string;
  entryCount: number;
  totalAmount: number;
  pendingCount: number;
}

export interface RegisterFilterMetrics {
  filteredCount: number;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  isFiltered: boolean;
  onPageChange?: (page: number) => void;
}

interface RegisterContextType {
  registers: Register[];
  activeRegister: Register | null;
  setActiveRegister: (register: Register | null) => void;
  isLoading: boolean;
  filterMetrics: RegisterFilterMetrics | null;
  setFilterMetrics: (metrics: RegisterFilterMetrics | null) => void;
  refreshRegisters: () => Promise<void>;
  createRegister: (month: number, year: number, name?: string) => Promise<boolean>;
  updateRegisterStatus: (id: string, status: "Active" | "Locked" | "Archived") => Promise<boolean>;
  deleteRegister: (id: string) => Promise<boolean>;
}

const RegisterContext = createContext<RegisterContextType | undefined>(undefined);

export const RegisterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: session } = useSession();
  const [registers, setRegisters] = useState<Register[]>([]);
  const [activeRegister, setActiveRegisterState] = useState<Register | null>(null);
  const [filterMetrics, setFilterMetrics] = useState<RegisterFilterMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Set active register and persist to localStorage
  const setActiveRegister = useCallback((register: Register | null) => {
    setActiveRegisterState(register);
    setFilterMetrics(null);
    if (register) {
      localStorage.setItem("hemtej_active_register_id", register.id);
    } else {
      localStorage.removeItem("hemtej_active_register_id");
    }
  }, []);

  const refreshRegisters = useCallback(async () => {
    if (!session?.user) {
      setRegisters([]);
      setActiveRegisterState(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/registers");
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        const fetchedRegisters: Register[] = result.data;
        setRegisters(fetchedRegisters);

        // Try to restore the active register from localStorage
        const savedId = localStorage.getItem("hemtej_active_register_id");
        const found = fetchedRegisters.find(r => r.id === savedId);

        if (found) {
          // Update details from database in case status or entryCount changed
          setActiveRegisterState(found);
        } else if (fetchedRegisters.length > 0) {
          // Default to the newest register
          setActiveRegister(fetchedRegisters[0]);
        } else {
          setActiveRegisterState(null);
        }
      } else {
        console.error("Failed to load registers:", result.error);
      }
    } catch (error) {
      console.error("Error fetching registers:", error);
    } finally {
      setIsLoading(false);
    }
  }, [session, setActiveRegister]);

  // Fetch registers on session load
  useEffect(() => {
    if (session?.user) {
      setIsLoading(true);
      refreshRegisters();
    } else {
      setRegisters([]);
      setActiveRegisterState(null);
      setIsLoading(false);
    }
  }, [session, refreshRegisters]);

  const createRegister = async (month: number, year: number, name?: string) => {
    try {
      const response = await fetch("/api/registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, name })
      });
      const result = await response.json();

      if (result.success) {
        toast.success("Register created successfully!");
        await refreshRegisters();
        // Set the newly created register as active
        if (result.data) {
          setActiveRegister(result.data);
        }
        return true;
      } else {
        toast.error(result.error || "Failed to create register");
        return false;
      }
    } catch (error) {
      toast.error("Error creating register");
      console.error(error);
      return false;
    }
  };

  const updateRegisterStatus = async (id: string, status: "Active" | "Locked" | "Archived") => {
    try {
      const response = await fetch(`/api/registers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const result = await response.json();

      if (result.success) {
        toast.success(`Register status updated to ${status}`);
        await refreshRegisters();
        return true;
      } else {
        toast.error(result.error || "Failed to update register status");
        return false;
      }
    } catch (error) {
      toast.error("Error updating register status");
      console.error(error);
      return false;
    }
  };

  const deleteRegister = async (id: string) => {
    try {
      const response = await fetch(`/api/registers/${id}`, {
        method: "DELETE"
      });
      const result = await response.json();

      if (result.success) {
        toast.success("Register and its entries deleted successfully");

        // If the deleted register was active, remove it
        const savedId = localStorage.getItem("hemtej_active_register_id");
        if (savedId === id) {
          localStorage.removeItem("hemtej_active_register_id");
          setActiveRegisterState(null);
        }

        await refreshRegisters();
        return true;
      } else {
        toast.error(result.error || "Failed to delete register");
        return false;
      }
    } catch (error) {
      toast.error("Error deleting register");
      console.error(error);
      return false;
    }
  };

  return (
    <RegisterContext.Provider
      value={{
        registers,
        activeRegister,
        setActiveRegister,
        isLoading,
        filterMetrics,
        setFilterMetrics,
        refreshRegisters,
        createRegister,
        updateRegisterStatus,
        deleteRegister
      }}
    >
      {children}
    </RegisterContext.Provider>
  );
};

export const useRegisters = () => {
  const context = useContext(RegisterContext);
  if (context === undefined) {
    throw new Error("useRegisters must be used within a RegisterProvider");
  }
  return context;
};
