import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch } from "@/lib/api";

type ParticipantStats = {
  total: number;
  byCategory: Record<string, number>;
  threshold: number;
};

const CATEGORY_ORDER = ["D-", "D", "D+", "C-", "C", "C+", "B-"];

export default function Home() {
  const { t } = useLanguage();
  const { data } = useQuery<ParticipantStats>({
    queryKey: ["stats-participants"],
    queryFn: () => apiFetch<ParticipantStats>("/stats/participants"),
    staleTime: 60_000,
  });

  const total = data?.total ?? 0;
  const threshold = data?.threshold ?? 100;
  const pct = Math.min(100, Math.round((total / threshold) * 100));
  const breakdown = data
    ? CATEGORY_ORDER
        .filter((c) => (data.byCategory[c] ?? 0) > 0)
        .map((c) => `${c}: ${data.byCategory[c]}`)
        .join(" · ")
    : "";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at center, rgba(45, 125, 255, 0.1) 0%, transparent 60%)" }} />

      <div className="z-10 text-center max-w-3xl">
        <h1 className="text-5xl md:text-7xl font-serif mb-6 tracking-tight">Padel Concierge</h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed">
          {t("home.tagline")}
        </p>

        {data && (
          <div
            className="mx-auto mb-10 max-w-md rounded-2xl px-5 py-4 group relative"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            title={t("home.participantsTooltip")}
            data-testid="participants-counter"
          >
            <div className="flex items-baseline justify-center gap-2 mb-2 flex-wrap">
              <span className="text-sm text-muted-foreground">{t("home.participantsLabel")}</span>
              <span className="font-mono font-semibold text-white text-lg">
                {t("home.participantsCount", { count: total })}
              </span>
            </div>
            {breakdown && (
              <div className="text-xs font-mono text-muted-foreground mb-3 tracking-wide">
                {breakdown}
              </div>
            )}
            <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: "#D4AF37" }}
              />
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground font-mono">
              {total} / {threshold}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/register">
            <button className="w-full sm:w-auto inline-flex items-center justify-center rounded-[14px] bg-primary text-black font-semibold text-lg px-8 h-14 transition-all hover:bg-primary/90">
              {t("home.getStarted")}
            </button>
          </Link>
          <Link href="/login">
            <button className="w-full sm:w-auto inline-flex items-center justify-center rounded-[14px] border border-white/10 bg-transparent font-medium text-lg px-8 h-14 text-foreground transition-all hover:bg-white/5">
              {t("home.login")}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
