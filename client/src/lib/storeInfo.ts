export interface StoreInfo {
  name: string;
  tagline: string;
  address: string;
  phone: string;
}

const STORAGE_KEY = "kasa_store_info";

export const DEFAULT_STORE_INFO: StoreInfo = {
  name: "Kedai Nusantara",
  tagline: "Sistem Kasir Kuliner",
  address: "Jl. Rasa Kuliner No. 18, Jakarta",
  phone: "0812-3456-7890",
};

export function getStoreInfo(): StoreInfo {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STORE_INFO;
    const parsed = JSON.parse(raw);
    return {
      name: parsed.name?.trim() || DEFAULT_STORE_INFO.name,
      tagline: parsed.tagline?.trim() || DEFAULT_STORE_INFO.tagline,
      address: parsed.address?.trim() || DEFAULT_STORE_INFO.address,
      phone: parsed.phone?.trim() || DEFAULT_STORE_INFO.phone,
    };
  } catch {
    return DEFAULT_STORE_INFO;
  }
}

export function saveStoreInfo(info: StoreInfo): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    window.dispatchEvent(new Event("kasa_store_info_updated"));
  } catch {
    /* storage unavailable */
  }
}
