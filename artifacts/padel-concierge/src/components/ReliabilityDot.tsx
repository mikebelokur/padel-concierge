import { cn } from "@/lib/utils";

export function ReliabilityDot({ score }: { score: number | undefined }) {
  if (score === undefined) return null;
  const isGreen = score >= 80;
  const isAmber = score >= 55;
  const label = isGreen
    ? `Надёжность: ${score}/100 — хорошая посещаемость и поведение на корте`
    : isAmber
    ? `Надёжность: ${score}/100 — случались пропуски или замечания`
    : `Надёжность: ${score}/100 — частые пропуски или нарушения`;
  const dot = isGreen
    ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]"
    : isAmber
    ? "bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.6)]"
    : "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]";
  return (
    <span title={label} className="inline-flex items-center gap-1 cursor-help">
      <span className={cn("w-2 h-2 rounded-full inline-block flex-shrink-0", dot)} />
      <span className={cn(
        "text-xs",
        isGreen ? "text-green-400" : isAmber ? "text-amber-400" : "text-red-400"
      )}>{score}</span>
    </span>
  );
}
