import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export type StaffRole = "kasir_admin" | "kasir" | "admin";

export interface StaffUser {
  id: string;
  name: string;
  role: StaffRole;
  pin: string;
  avatarColor: string;
  initials: string;
  title: string;
  description: string;
}

export const GUEST_STAFF: StaffUser = {
  id: "unassigned",
  name: "Kasir (Belum Diatur)",
  role: "kasir_admin",
  pin: "1234",
  avatarColor: "bg-ink/15 text-ink",
  initials: "--",
  title: "Kasir & Admin",
  description: "Belum ada akun kasir",
};

export const DEFAULT_STAFF_LIST: StaffUser[] = [];

const STORAGE_STAFF_KEY = "kasa_cashier_list_v2";
const STORAGE_CURRENT_STAFF_KEY = "kasa_active_cashier_id_v2";

interface AuthContextType {
  currentStaff: StaffUser;
  staffList: StaffUser[];
  isSwitchModalOpen: boolean;
  openSwitchModal: () => void;
  closeSwitchModal: () => void;
  switchStaffByPin: (pin: string, targetStaffId?: string) => { success: boolean; staff?: StaffUser; error?: string };
  switchStaffDirect: (staffId: string) => void;
  hasAccessTo: (path: string) => boolean;
  getAllowedDefaultRoute: (role?: StaffRole) => string;
  updateStaff: (staff: StaffUser) => void;
  addStaff: (staff: Omit<StaffUser, "id">) => void;
  deleteStaff: (staffId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getInitialStaffList(): StaffUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_STAFF_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Auto-migrate any legacy roles into the single unified 'Kasir & Admin' role
        return parsed.map((s) => ({
          ...s,
          role: "kasir_admin" as StaffRole,
          title: "Kasir & Admin",
        }));
      }
    }
  } catch (err) {
    console.warn("Failed to load staff list from localStorage", err);
  }
  return DEFAULT_STAFF_LIST;
}

function getInitialCurrentStaff(list: StaffUser[]): StaffUser {
  try {
    const activeId = localStorage.getItem(STORAGE_CURRENT_STAFF_KEY);
    if (activeId) {
      const found = list.find((s) => s.id === activeId);
      if (found) {
        return {
          ...found,
          role: "kasir_admin",
          title: "Kasir & Admin",
        };
      }
    }
  } catch (err) {
    console.warn("Failed to load current staff", err);
  }
  return list[0] || GUEST_STAFF;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staffList, setStaffList] = useState<StaffUser[]>(getInitialStaffList);
  const [currentStaff, setCurrentStaff] = useState<StaffUser>(() => getInitialCurrentStaff(staffList));
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [, setLocation] = useLocation();

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_STAFF_KEY, JSON.stringify(staffList));
    } catch (err) {
      console.warn("Could not save staff list", err);
    }
  }, [staffList]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CURRENT_STAFF_KEY, currentStaff.id);
    } catch (err) {
      console.warn("Could not save current staff id", err);
    }
  }, [currentStaff]);

  const openSwitchModal = useCallback(() => setIsSwitchModalOpen(true), []);
  const closeSwitchModal = useCallback(() => setIsSwitchModalOpen(false), []);

  const getAllowedDefaultRoute = useCallback((_role?: StaffRole): string => {
    return "/";
  }, []);

  const hasAccessTo = useCallback((_path: string): boolean => {
    // Single unified 'Kasir & Admin' role has unrestricted access to all modules
    return true;
  }, []);

  const switchStaffByPin = useCallback(
    (pin: string, targetStaffId?: string) => {
      let matched: StaffUser | undefined;

      if (targetStaffId) {
        const candidate = staffList.find((s) => s.id === targetStaffId);
        if (candidate && candidate.pin === pin) {
          matched = candidate;
        }
      } else {
        matched = staffList.find((s) => s.pin === pin);
      }

      if (!matched) {
        return { success: false, error: "PIN salah! Silakan coba lagi." };
      }

      setCurrentStaff(matched);
      setIsSwitchModalOpen(false);
      setLocation("/");

      toast.success(`Kasir aktif: ${matched.name} (${matched.title})`);
      return { success: true, staff: matched };
    },
    [staffList, setLocation],
  );

  const switchStaffDirect = useCallback(
    (staffId: string) => {
      const found = staffList.find((s) => s.id === staffId);
      if (found) {
        setCurrentStaff(found);
        setIsSwitchModalOpen(false);
        setLocation("/");
        toast.info(`Beralih kasir ke: ${found.name}`);
      }
    },
    [staffList, setLocation],
  );

  const updateStaff = useCallback((updated: StaffUser) => {
    const formatted: StaffUser = {
      ...updated,
      role: "kasir_admin",
      title: "Kasir & Admin",
      initials:
        updated.name
          .trim()
          .split(/\s+/)
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase() || "KR",
    };
    setStaffList((prev) => prev.map((s) => (s.id === formatted.id ? formatted : s)));
    setCurrentStaff((curr) => (curr.id === formatted.id ? formatted : curr));
    toast.success(`Akun kasir "${formatted.name}" berhasil diperbarui`);
  }, []);

  const addStaff = useCallback((newStaffData: Omit<StaffUser, "id">) => {
    const initials =
      newStaffData.name
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "KR";

    const newStaff: StaffUser = {
      ...newStaffData,
      id: `staff-${Date.now()}`,
      role: "kasir_admin",
      title: "Kasir & Admin",
      initials,
    };
    setStaffList((prev) => [...prev, newStaff]);
    setCurrentStaff((curr) => (curr.id === "unassigned" ? newStaff : curr));
    toast.success(`Akun kasir baru "${newStaff.name}" berhasil ditambahkan`);
  }, []);

  const deleteStaff = useCallback((staffId: string) => {
    setStaffList((prev) => {
      const updated = prev.filter((s) => s.id !== staffId);
      if (currentStaff.id === staffId) {
        setCurrentStaff(updated[0] || GUEST_STAFF);
      }
      toast.success("Akun kasir berhasil dihapus");
      return updated;
    });
  }, [currentStaff.id]);

  return (
    <AuthContext.Provider
      value={{
        currentStaff,
        staffList,
        isSwitchModalOpen,
        openSwitchModal,
        closeSwitchModal,
        switchStaffByPin,
        switchStaffDirect,
        hasAccessTo,
        getAllowedDefaultRoute,
        updateStaff,
        addStaff,
        deleteStaff,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
