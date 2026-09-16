import { useState } from "react";
import { ChevronDown, Maximize, Minimize } from "lucide-react";
import { t } from "../locales/en";
import { useAuth } from "./AuthContext";
import { cn } from "../lib/cn";

export function Header({
  title,
}: {
  title: string;
  showSavedStatus?: boolean;
}) {
  const { currentStaff, openSwitchModal } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => { });
      setIsFullscreen(false);
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 px-5 py-3.5 md:px-8 shrink-0 bg-mineral">
      <div>
        <p className="label-caps text-[10px] font-medium text-ink/50">
          {t.header.dateToday}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <h1 className="font-display text-xl font-bold tracking-tight text-ink md:text-2xl">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex items-center gap-1 rounded-xl border border-ink/12 bg-white px-3 py-2 text-xs font-bold text-ink shadow-2xs hover:border-ink/30 hover:bg-mineral/40 transition-all cursor-pointer"
          title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh (Fullscreen)"}
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>

        {/* Active Cashier Account & Switch Button */}
        <button
          type="button"
          onClick={openSwitchModal}
          className="group flex items-center gap-2 rounded-full border border-ink/12 bg-white pl-1 pr-3 py-1 shadow-2xs hover:border-ink/30 hover:bg-mineral/50 transition-all cursor-pointer"
          title={`Kasir aktif: ${currentStaff.name} (${currentStaff.title}). Klik untuk ganti kasir.`}
        >
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full font-display text-xs font-bold shadow-2xs transition-transform group-hover:scale-105",
              currentStaff.avatarColor,
            )}
          >
            {currentStaff.initials}
          </span>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-bold text-ink leading-none">
              {currentStaff.id === "unassigned" ? "+ Tambah Kasir" : currentStaff.name.split(" ")[0]}
            </p>
            <p className="text-[10px] font-semibold text-ink/50 uppercase leading-tight mt-0.5">
              Kasir & Admin
            </p>
          </div>
          <ChevronDown size={14} className="text-ink/40 group-hover:text-ink transition-colors ml-0.5" />
        </button>
      </div>
    </header>
  );
}
