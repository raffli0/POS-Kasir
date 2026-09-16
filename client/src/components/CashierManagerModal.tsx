import { useState } from "react";
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  Eye,
  EyeOff,
  UserCheck,
  AlertCircle,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, type StaffUser } from "./AuthContext";
import { Button } from "./ui/Button";
import { cn } from "../lib/cn";

const AVATAR_COLOR_OPTIONS = [
  { id: "primary", label: "Karamel", class: "bg-primary text-ink" },
  { id: "emerald", label: "Hijau", class: "bg-emerald-600 text-white" },
  { id: "teal", label: "Toska", class: "bg-teal-600 text-white" },
  { id: "sky", label: "Biru Langit", class: "bg-sky-600 text-white" },
  { id: "ink", label: "Hitam Tinta", class: "bg-ink text-mineral" },
  { id: "coral", label: "Koral", class: "bg-coral text-white" },
  { id: "amber", label: "Kuning Kunyit", class: "bg-amber-500 text-ink" },
  { id: "purple", label: "Ungu", class: "bg-purple-600 text-white" },
];

export function CashierManagerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { staffList, currentStaff, addStaff, updateStaff, deleteStaff } = useAuth();

  // Mode: "list" | "add" | "edit"
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formPin, setFormPin] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formColor, setFormColor] = useState(AVATAR_COLOR_OPTIONS[0].class);
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  // Delete Confirmation State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (!open) return null;

  const togglePinReveal = (id: string) => {
    setRevealedPins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const startAdd = () => {
    const nextNumber = staffList.length + 1;
    setFormName("");
    setFormPin("");
    setFormDesc(`Kasir ${nextNumber} · Shift`);
    const colorIndex = staffList.length % AVATAR_COLOR_OPTIONS.length;
    setFormColor(AVATAR_COLOR_OPTIONS[colorIndex].class);
    setEditingStaffId(null);
    setMode("add");
  };

  const startEdit = (staff: StaffUser) => {
    setFormName(staff.name);
    setFormPin(staff.pin);
    setFormDesc(staff.description || "");
    setFormColor(staff.avatarColor);
    setEditingStaffId(staff.id);
    setMode("edit");
  };

  const handleCancelForm = () => {
    setMode("list");
    setEditingStaffId(null);
    setDeleteConfirmId(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = formName.trim();
    const cleanPin = formPin.trim();
    const cleanDesc = formDesc.trim();

    if (!cleanName) {
      toast.error("Nama kasir wajib diisi");
      return;
    }

    if (!/^\d{4}$/.test(cleanPin)) {
      toast.error("PIN harus tepat 4 digit angka (0-9)");
      return;
    }

    // Check PIN collision with other cashiers
    const isPinDuplicate = staffList.some(
      (s) => s.pin === cleanPin && s.id !== editingStaffId,
    );
    if (isPinDuplicate) {
      toast.error(`PIN "${cleanPin}" sudah digunakan oleh kasir lain! Silakan pilih PIN unik.`);
      return;
    }

    if (mode === "add") {
      addStaff({
        name: cleanName,
        role: "kasir_admin",
        pin: cleanPin,
        avatarColor: formColor,
        initials: "",
        title: "Kasir & Admin",
        description: cleanDesc || "Kasir Bertugas",
      });
    } else if (mode === "edit" && editingStaffId) {
      const existing = staffList.find((s) => s.id === editingStaffId);
      if (existing) {
        updateStaff({
          ...existing,
          name: cleanName,
          pin: cleanPin,
          avatarColor: formColor,
          description: cleanDesc || "Kasir Bertugas",
        });
      }
    }

    setMode("list");
    setEditingStaffId(null);
  };

  const handleDelete = (staffId: string) => {
    deleteStaff(staffId);
    setDeleteConfirmId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/65 p-4 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink/10 bg-mineral/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-ink shadow-xs">
              <UserCheck size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                Kelola Akun Kasir
              </h2>
              <p className="text-xs text-ink/60">
                Tambah, ubah, atau hapus profil kasir & PIN otorisasi (Semua bertindak sebagai Kasir & Admin)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink/50 hover:bg-ink/5 hover:text-ink transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {mode === "list" ? (
            <>
              {/* Action Bar */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-ink/60">
                    Daftar Akun Kasir ({staffList.length})
                  </span>
                </div>
                <Button size="sm" onClick={startAdd} className="gap-1.5 font-bold shadow-xs">
                  <Plus size={15} />
                  Tambah Kasir Baru
                </Button>
              </div>

              {staffList.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-ink/15 p-8 text-center bg-mineral/20 space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-ink">
                    <UserCheck size={24} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-display text-base font-bold text-ink">
                      Belum Ada Akun Kasir
                    </h4>
                    <p className="text-xs text-ink/60 max-w-sm mx-auto">
                      Daftar akun kasir masih kosong. Tambahkan akun kasir pertama Anda agar nama kasir tercetak otomatis pada struk pembayaran.
                    </p>
                  </div>
                  <Button onClick={startAdd} variant="primary" size="sm" className="font-bold shadow-xs gap-1.5">
                    <Plus size={15} />
                    Tambah Akun Kasir Pertama
                  </Button>
                </div>
              ) : (
                /* Cashiers List */
                <div className="divide-y divide-ink/8 rounded-xl border border-ink/10 bg-white">
                  {staffList.map((staff) => {
                    const isCurrent = currentStaff.id === staff.id;
                    const isDeleting = deleteConfirmId === staff.id;
                    const pinVisible = revealedPins[staff.id];

                    return (
                      <div
                        key={staff.id}
                        className={cn(
                          "flex items-center justify-between gap-3 p-3.5 transition-colors",
                          isCurrent && "bg-primary/5",
                        )}
                      >
                        {/* Left: Avatar & Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold shadow-2xs",
                              staff.avatarColor,
                            )}
                          >
                            {staff.initials}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-display text-sm font-bold text-ink truncate">
                                {staff.name}
                              </p>
                              {isCurrent && (
                                <span className="rounded bg-primary/20 px-1.5 py-0.2 text-[10px] font-bold text-ink">
                                  Bertugas Sekarang
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-ink/55 truncate">
                              {staff.description || "Kasir & Admin"}
                            </p>
                          </div>
                        </div>

                        {/* Right: PIN & Actions */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          {/* PIN Pill */}
                          <div
                            className="flex items-center gap-1.5 rounded-lg border border-ink/10 bg-mineral/40 px-2.5 py-1 text-xs"
                            title="PIN Akses Kasir"
                          >
                            <KeyRound size={12} className="text-ink/50" />
                            <span className="font-mono font-bold tracking-widest text-ink">
                              {pinVisible ? staff.pin : "••••"}
                            </span>
                            <button
                              type="button"
                              onClick={() => togglePinReveal(staff.id)}
                              className="text-ink/40 hover:text-ink transition-colors ml-0.5"
                              title={pinVisible ? "Sembunyikan PIN" : "Tampilkan PIN"}
                            >
                              {pinVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          </div>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => startEdit(staff)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/10 text-ink/60 hover:bg-ink/5 hover:text-ink transition-colors"
                            title="Ubah Profil Kasir"
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(staff.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-coral/20 text-coral hover:bg-coral/10 transition-colors"
                            title="Hapus Akun Kasir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Delete Confirmation Alert (Modal) */}
                        {isDeleting && (
                          <div className="fixed inset-0 z-60 flex items-center justify-center bg-ink/60 p-4">
                            <div className="w-full max-w-sm rounded-2xl border border-coral/30 bg-white p-5 shadow-2xl space-y-3">
                              <div className="flex items-center gap-2.5 text-coral">
                                <AlertCircle size={20} />
                                <h3 className="font-display font-bold text-base text-ink">
                                  Hapus Akun Kasir?
                                </h3>
                              </div>
                              <p className="text-xs text-ink/70 leading-relaxed">
                                Apakah Anda yakin ingin menghapus akun <strong>"{staff.name}"</strong>? Kasir ini tidak akan dapat login lagi.
                              </p>
                              <div className="flex justify-end gap-2 pt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  Batal
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleDelete(staff.id)}
                                >
                                  Ya, Hapus Akun
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Role Info Notice */}
              <div className="flex items-start gap-2 rounded-xl bg-mineral/50 border border-ink/8 p-3 text-xs text-ink/70">
                <ShieldCheck size={16} className="text-primary mt-0.5 shrink-0" />
                <p>
                  Seluruh akun kasir secara otomatis bertindak sebagai <strong>Kasir & Admin</strong>, memiliki akses lengkap untuk operasional penjualan, ubah menu produk, lihat laporan, dan pengaturan sistem.
                </p>
              </div>
            </>
          ) : (
            /* Mode: Add or Edit Form */
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-center justify-between border-b border-ink/8 pb-2">
                <h3 className="font-display text-base font-bold text-ink">
                  {mode === "add" ? "Tambah Akun Kasir Baru" : `Ubah Akun: ${formName}`}
                </h3>
                <span className="text-xs text-ink/50 font-medium">Peran: Kasir & Admin</span>
              </div>

              {/* Cashier Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                  Nama Kasir <span className="text-coral">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Artur Morgan"
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3.5 py-2 text-sm font-semibold text-ink placeholder:text-ink/35 focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
              </div>

              {/* 4-Digit PIN */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                  PIN 4 Digit Otorisasi <span className="text-coral">*</span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={formPin}
                  onChange={(e) => setFormPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="Contoh: 1234"
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3.5 py-2 font-mono text-base font-bold tracking-widest text-ink placeholder:font-normal placeholder:tracking-normal placeholder:text-ink/35 focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
                <p className="mt-1 text-[11px] text-ink/50">
                  Digunakan untuk verifikasi cepat saat ganti kasir bertugas.
                </p>
              </div>

              {/* Shift / Keterangan */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
                  Keterangan Shift / Mesin
                </label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Contoh: Shift Pagi · Mesin Depan"
                  className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3.5 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
              </div>

              {/* Avatar Color Palette */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-ink/70 mb-1.5">
                  Warna Avatar
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLOR_OPTIONS.map((opt) => {
                    const isSelected = formColor === opt.class;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFormColor(opt.class)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all",
                          isSelected
                            ? "border-ink ring-2 ring-primary/60 shadow-xs"
                            : "border-ink/15 bg-white hover:bg-mineral/30",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-md font-display text-[10px]",
                            opt.class,
                          )}
                        >
                          {isSelected && <Check size={12} />}
                        </span>
                        <span className="text-ink">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-ink/8">
                <Button type="button" variant="outline" onClick={handleCancelForm}>
                  Batal
                </Button>
                <Button type="submit" variant="primary" className="font-bold">
                  {mode === "add" ? "Simpan Kasir Baru" : "Perbarui Akun Kasir"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
