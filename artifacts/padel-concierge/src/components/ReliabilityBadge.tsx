import { cn } from "@/lib/utils";
export { ReliabilityDot } from "@/components/ReliabilityDot";

export function reliabilityColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

export function reliabilityBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

export function reliabilityLabel(score: number): string {
  if (score >= 80) return "Reliable";
  if (score >= 60) return "Moderate";
  return "Unreliable";
}

export function reliabilityDotClass(score: number): string {
  if (score >= 80) return "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]";
  if (score >= 60) return "bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.6)]";
  return "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]";
}

export function CompatBadge({ pct }: { pct: number }) {
  const color =
    pct >= 80
      ? "text-green-400 bg-green-400/10 border-green-400/25"
      : pct >= 60
      ? "text-primary bg-primary/10 border-primary/25"
      : "text-amber-400 bg-amber-400/10 border-amber-400/25";
  return (
    <span
      title={`Совместимость: ${pct}% — учитывает уровень игры, архетип и историю совместных матчей`}
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-mono font-semibold px-1.5 py-0.5 rounded-md border cursor-help",
        color
      )}
    >
      {pct}%
    </span>
  );
}
