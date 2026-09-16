import { cn } from "../../lib/cn";

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "primary" | "lime" | "success" | "warning" | "danger" | "coral" | "dark";
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-ink/8 text-ink/70",
    primary: "bg-primary text-ink font-bold",
    lime: "bg-primary text-ink font-bold",
    success: "bg-emerald-100 text-emerald-800 font-semibold",
    warning: "bg-amber-100 text-amber-900 font-semibold",
    danger: "bg-coral text-white font-bold",
    coral: "bg-coral text-white font-bold",
    dark: "bg-ink text-mineral",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
