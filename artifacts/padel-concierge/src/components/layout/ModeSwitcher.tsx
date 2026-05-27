import { useState, useRef, useEffect } from "react";
import { useActiveMode, type Mode } from "@/hooks/useActiveMode";
import { cn } from "@/lib/utils";

const LABELS: Record<Mode, string> = {
  player: "Player",
  coach: "Coach",
  admin: "Admin",
  developer: "Developer",
};

const DOT: Record<Mode, string> = {
  player: "bg-emerald-400",
  coach: "bg-sky-400",
  admin: "bg-yellow-400",
  developer: "bg-fuchsia-400",
};

export function ModeSwitcher() {
  const { activeMode, setActiveMode, availableModes } = useActiveMode();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (availableModes.length < 2) return null;

  return (
    <div ref={ref} className="relative" data-testid="mode-switcher">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-foreground transition-colors"
        data-testid="mode-switcher-trigger"
      >
        <span className={cn("w-1.5 h-1.5 rounded-full", DOT[activeMode])} />
        <span>{LABELS[activeMode]}</span>
        <span className="opacity-50 text-[10px] leading-none">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 min-w-[140px] rounded-md border border-white/10 bg-card shadow-lg py-1 z-50">
          {availableModes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setActiveMode(m);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-white/5 transition-colors",
                m === activeMode ? "text-foreground" : "text-muted-foreground",
              )}
              data-testid={`mode-option-${m}`}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", DOT[m])} />
              <span className="flex-1">{LABELS[m]}</span>
              {m === activeMode && <span className="text-primary text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
