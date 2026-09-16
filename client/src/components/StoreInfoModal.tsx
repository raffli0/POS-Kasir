import { useState, useEffect } from "react";
import { Store, X, Save, Receipt } from "lucide-react";
import { Button } from "./ui/Button";
import { getStoreInfo, saveStoreInfo, type StoreInfo } from "../lib/storeInfo";
import { toast } from "sonner";

interface StoreInfoModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (info: StoreInfo) => void;
}

export function StoreInfoModal({ open, onClose, onSaved }: StoreInfoModalProps) {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (open) {
      const current = getStoreInfo();
      setName(current.name);
      setTagline(current.tagline);
      setAddress(current.address);
      setPhone(current.phone);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nama toko tidak boleh kosong");
      return;
    }

    const updated: StoreInfo = {
      name: name.trim(),
      tagline: tagline.trim() || "Sistem Kasir Kuliner",
      address: address.trim(),
      phone: phone.trim(),
    };

    saveStoreInfo(updated);
    if (onSaved) onSaved(updated);
    toast.success("Informasi toko & header struk berhasil disimpan!");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-[2px] overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-ink/10 bg-white p-6 shadow-2xl relative my-8"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-ink/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-counterlime/20 text-ink flex items-center justify-center border border-counterlime/40">
              <Store className="w-5 h-5 text-counterlime-dark" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-ink">
                Identitas Toko & Struk
              </h3>
              <p className="text-xs text-ink/55">
                Sesuaikan nama toko, alamat, dan nomor kontak yang tercetak di struk kasir.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink/50 hover:bg-ink/5"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Nama Toko */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70 mb-1">
              Nama Restoran / Toko <span className="text-coral">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Kedai Nusantara"
              className="w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2 text-sm font-bold text-ink focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-counterlime/60"
            />
          </div>

          {/* Slogan / Tagline */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70 mb-1">
              Slogan / Tagline Singkat
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Contoh: Cita Rasa Kuliner Otentik"
              className="w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2 text-sm font-semibold text-ink focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-counterlime/60"
            />
          </div>

          {/* Alamat */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70 mb-1">
              Alamat Toko (Tercetak di Struk)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Contoh: Jl. Rasa Kuliner No. 18, Jakarta"
              className="w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2 text-sm font-semibold text-ink focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-counterlime/60"
            />
          </div>

          {/* Nomor Telepon / WhatsApp */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink/70 mb-1">
              Nomor Telepon / WhatsApp
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Contoh: 0812-3456-7890"
              className="w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2 text-sm font-semibold text-ink focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-counterlime/60"
            />
          </div>

          {/* Live Receipt Header Preview */}
          <div className="rounded-xl border border-ink/10 bg-mineral/30 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-ink/60 mb-2">
              <Receipt size={13} className="text-counterlime-dark" />
              <span>Pratinjau Header Struk:</span>
            </div>
            <div className="rounded-lg border border-ink/10 bg-white p-3 text-center font-mono text-xs shadow-2xs">
              <p className="font-extrabold text-sm tracking-wider text-ink">
                {(name || "NAMA TOKO").toUpperCase()}
              </p>
              {tagline && <p className="text-[11px] text-ink/70">{tagline}</p>}
              {address && <p className="text-[10px] text-ink/50 mt-0.5">{address}</p>}
              {phone && <p className="text-[10px] text-ink/50">Telp: {phone}</p>}
            </div>
          </div>

          {/* Form Actions */}
          <div className="mt-6 flex justify-end gap-2 border-t border-ink/10 pt-4">
            <Button type="button" size="sm" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" size="sm" className="font-semibold gap-1.5">
              <Save size={14} />
              Simpan Info Toko
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
