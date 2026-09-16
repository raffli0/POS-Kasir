import { useState, useEffect, useCallback } from "react";
import {
  X,
  KeyRound,
  Receipt,
  Sparkles,
  Delete,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { useAuth, type StaffUser, type StaffRole } from "./AuthContext";
import { cn } from "../lib/cn";
import { Button } from "./ui/Button";
import { CashierManagerModal } from "./CashierManagerModal";

export function QuickSwitchRoleModal() {
  const {
    isSwitchModalOpen,
    closeSwitchModal,
    currentStaff,
    staffList,
    switchStaffByPin,
    switchStaffDirect,
  } = useAuth();

  const [selectedStaff, setSelectedStaff] = useState<StaffUser>(currentStaff);
  const [pin, setPin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isShaking, setIsShaking] = useState(false);
  const [managerModalOpen, setManagerModalOpen] = useState(false);

  // Sync selected staff when modal opens
  useEffect(() => {
    if (isSwitchModalOpen) {
      setSelectedStaff(currentStaff);
      setPin("");
      setErrorMsg("");
      setIsShaking(false);
    }
  }, [isSwitchModalOpen, currentStaff]);

  const handleKeyPress = useCallback(
    (digit: string) => {
      if (pin.length < 4) {
        const nextPin = pin + digit;
        setPin(nextPin);
        setErrorMsg("");

        if (nextPin.length === 4) {
          // Auto submit PIN
          const res = switchStaffByPin(nextPin, selectedStaff.id);
          if (!res.success) {
            setErrorMsg(res.error || "PIN tidak sesuai!");
            setIsShaking(true);
            setTimeout(() => {
              setPin("");
              setIsShaking(false);
            }, 600);
          }
        }
      }
    },
    [pin, selectedStaff, switchStaffByPin],
  );

  const handleDelete = useCallback(() => {
    setPin((p) => p.slice(0, -1));
    setErrorMsg("");
  }, []);

  const handleClear = useCallback(() => {
    setPin("");
    setErrorMsg("");
  }, []);

  // Physical keyboard support
  useEffect(() => {
    if (!isSwitchModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleKeyPress(e.key);
      } else if (e.key === "Backspace") {
        handleDelete();
      } else if (e.key === "Escape") {
        closeSwitchModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSwitchModalOpen, handleKeyPress, handleDelete, closeSwitchModal]);

  if (!isSwitchModalOpen) return null;

  const getRoleIcon = (_role?: StaffRole) => {
    return <Receipt size={13} />;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/65 p-4 backdrop-blur-xs animate-in fade-in"
      onClick={closeSwitchModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink/10 bg-mineral/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-ink shadow-xs">
              <KeyRound size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink flex items-center gap-2">
                Ganti Akun Kasir
              </h2>
              <p className="text-xs text-ink/60">
                Pilih akun kasir bertugas dan masukkan PIN 4 digit untuk mencatat transaksi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSwitchModal}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink/50 hover:bg-ink/5 hover:text-ink transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Step 1: Select Staff Profile */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-ink/60">
                Pilih Akun Kasir:
              </label>
              <button
                type="button"
                onClick={() => setManagerModalOpen(true)}
                className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold text-ink/70 hover:text-ink hover:bg-ink/5 border border-ink/10 transition-colors cursor-pointer"
                title="Kelola akun kasir (Tambah, Ubah, Hapus)"
              >
                <Plus size={13} className="text-primary" />
                <span>Kelola Akun Kasir</span>
              </button>
            </div>

            {staffList.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-ink/15 p-6 text-center bg-white space-y-2.5">
                <p className="text-sm font-bold text-ink">Belum Ada Akun Kasir</p>
                <p className="text-xs text-ink/60 max-w-xs mx-auto">
                  Daftar akun kasir masih kosong. Tambahkan akun kasir pertama Anda untuk mulai mencatat transaksi.
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setManagerModalOpen(true)}
                  className="font-bold text-xs gap-1 shadow-xs"
                >
                  <Plus size={14} />
                  Tambah Akun Kasir Sekarang
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {staffList.map((staff) => {
                  const isSelected = selectedStaff.id === staff.id;
                  const isCurrent = currentStaff.id === staff.id;

                  return (
                    <button
                      key={staff.id}
                      type="button"
                      onClick={() => {
                        setSelectedStaff(staff);
                        setPin("");
                        setErrorMsg("");
                      }}
                      className={cn(
                        "flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all relative overflow-hidden",
                        isSelected
                          ? "bg-ink text-white border-ink shadow-md ring-2 ring-primary/50"
                          : "bg-mineral/30 text-ink border-ink/10 hover:bg-white hover:border-ink/30",
                      )}
                    >
                      <div
                        className={cn(
                          "h-9 w-9 shrink-0 rounded-xl flex items-center justify-center font-display font-bold text-xs shadow-2xs",
                          staff.avatarColor,
                        )}
                      >
                        {staff.initials}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold truncate">{staff.name}</p>
                          {isCurrent && (
                            <span
                              className={cn(
                                "text-[9px] px-1.5 py-0.2 rounded font-semibold",
                                isSelected ? "bg-primary text-ink" : "bg-emerald-100 text-emerald-800",
                              )}
                            >
                              Aktif
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-medium opacity-80 mt-0.5">
                          {getRoleIcon(staff.role)}
                          <span>{staff.title}</span>
                        </div>
                        <p className="text-[10px] opacity-60 line-clamp-1 mt-0.5">
                          {staff.description}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="absolute top-2 right-2 text-primary">
                          <CheckCircle2 size={15} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: PIN Pad (Only when staff exists) */}
          {staffList.length > 0 && (
            <div className="rounded-2xl bg-mineral/30 border border-ink/10 p-4 space-y-3">
            <div className="text-center space-y-0.5">
              <p className="text-xs font-bold text-ink/70">
                Masukkan PIN untuk <span className="text-ink font-bold">{selectedStaff.name}</span>
              </p>
              <p className="text-[11px] text-ink/40">
                (PIN Demo default: <strong className="text-ink font-mono">{selectedStaff.pin}</strong>)
              </p>
            </div>

            {/* PIN Dots Display */}
            <div
              className={cn(
                "flex justify-center items-center gap-2.5 py-1 transition-transform",
                isShaking && "animate-shake text-coral",
              )}
            >
              {[0, 1, 2, 3].map((idx) => {
                const filled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={cn(
                      "h-3.5 w-3.5 rounded-full border-2 transition-all flex items-center justify-center",
                      filled
                        ? "bg-ink border-ink scale-110 shadow-xs"
                        : "bg-white border-ink/25",
                      errorMsg && "border-coral bg-coral/15",
                    )}
                  >
                    {filled && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  </div>
                );
              })}
            </div>

            {errorMsg && (
              <p className="text-xs font-bold text-coral text-center animate-in fade-in">
                {errorMsg}
              </p>
            )}

            {/* Keypad Grid */}
            <div className="grid grid-cols-3 gap-1.5 max-w-xs mx-auto">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyPress(digit)}
                  className="h-10 rounded-xl bg-white border border-ink/10 font-display font-bold text-sm text-ink hover:bg-primary hover:border-ink/30 active:scale-95 shadow-2xs transition-all flex items-center justify-center"
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                onClick={handleClear}
                className="h-10 rounded-xl bg-white/70 border border-ink/10 text-xs font-bold text-ink/60 hover:bg-coral/10 hover:text-coral hover:border-coral/30 active:scale-95 transition-all flex items-center justify-center"
              >
                Hapus
              </button>

              <button
                type="button"
                onClick={() => handleKeyPress("0")}
                className="h-10 rounded-xl bg-white border border-ink/10 font-display font-bold text-sm text-ink hover:bg-primary hover:border-ink/30 active:scale-95 shadow-2xs transition-all flex items-center justify-center"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleDelete}
                className="h-10 rounded-xl bg-white/70 border border-ink/10 text-xs font-bold text-ink/60 hover:bg-ink/5 hover:text-ink active:scale-95 transition-all flex items-center justify-center"
                title="Hapus Satu Digit"
              >
                <Delete size={16} />
              </button>
            </div>
          </div>
        )}
        </div>

        {/* Footer / Quick Demo Switcher (Only when staff exists) */}
        {staffList.length > 0 && (
          <div className="border-t border-ink/10 bg-white px-6 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-ink/60">
              <Sparkles size={14} className="text-amber-500" />
              <span>Pintas Cepat (Tanpa Ketik PIN):</span>
            </div>
            <div className="flex items-center gap-1.5">
              {staffList.map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant="outline"
                  onClick={() => switchStaffDirect(s.id)}
                  className={cn(
                    "h-7 text-[11px] px-2.5 gap-1",
                    currentStaff.id === s.id && "border-ink bg-ink text-primary font-bold",
                  )}
                >
                  {s.name.split(" ")[0]}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal Pengelola Akun Kasir */}
      <CashierManagerModal
        open={managerModalOpen}
        onClose={() => setManagerModalOpen(false)}
      />
    </div>
  );
}
