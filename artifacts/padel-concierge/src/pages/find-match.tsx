import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Candidate {
  user: {
    id: number;
    name: string;
    level_self: number | null;
    level_quiz: string | null;
    archetype: string | null;
    warmup_format: string | null;
    physical_self: number | null;
    location_name: string | null;
    goal: string | null;
  };
  compatibility_score: number;
  compatibility_breakdown: {
    level_match: number;
    physical_match: number;
    archetype_match: number;
    time_overlap: number;
  };
  shared_availability_slots: { start: string; end: string }[];
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function ringColor(score: number): { stroke: string; text: string; glow: string } {
  if (score >= 80) return { stroke: "#fbbf24", text: "text-yellow-400", glow: "drop-shadow(0 0 6px #fbbf24)" };
  if (score >= 60) return { stroke: "#cbd5e1", text: "text-slate-300", glow: "none" };
  return { stroke: "#6b7280", text: "text-gray-400", glow: "none" };
}

function CompatRing({ score }: { score: number }) {
  const { stroke, text, glow } = ringColor(score);
  const radius = 32;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;
  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90" style={{ filter: glow }}>
        <circle cx="40" cy="40" r={radius} stroke="#1f2937" strokeWidth="6" fill="none" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke={stroke}
          strokeWidth="6"
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease-out" }}
        />
      </svg>
      <div className={cn("absolute inset-0 flex items-center justify-center font-mono text-xl font-bold", text)}>
        {score}
      </div>
    </div>
  );
}

function PhysicalBar({ value }: { value: number | null }) {
  const v = value ?? 0;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 w-2 rounded-full",
            i < v ? (v >= 7 ? "bg-yellow-400" : v >= 4 ? "bg-primary" : "bg-slate-400") : "bg-white/10"
          )}
        />
      ))}
      <span className="ml-1.5 text-xs font-mono text-muted-foreground">{v}/10</span>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatSharedDates(slots: { start: string }[], language: string): string {
  if (slots.length === 0) return "";
  const seen = new Set<string>();
  const dates: Date[] = [];
  for (const s of slots) {
    const d = new Date(s.start);
    const key = d.toISOString().slice(0, 10);
    if (!seen.has(key)) {
      seen.add(key);
      dates.push(d);
    }
  }
  dates.sort((a, b) => a.getTime() - b.getTime());
  const locale = language === "ru" ? "ru-RU" : "en-US";
  if (language === "ru") {
    // Group by month for clean "23, 25, 27 мая" output
    const byMonth = new Map<string, number[]>();
    for (const d of dates) {
      const month = d.toLocaleDateString("ru-RU", { month: "long" });
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(d.getDate());
    }
    return [...byMonth.entries()].map(([m, days]) => `${days.join(", ")} ${m}`).join("; ");
  }
  return dates
    .map((d) => d.toLocaleDateString(locale, { month: "short", day: "numeric" }))
    .join(", ");
}

function SkeletonCard() {
  return (
    <Card className="bg-card border-white/5 p-5 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-white/5" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-white/5 rounded" />
          <div className="h-3 w-24 bg-white/5 rounded" />
        </div>
        <div className="w-20 h-20 rounded-full bg-white/5" />
      </div>
      <div className="mt-4 h-3 w-full bg-white/5 rounded" />
    </Card>
  );
}

export default function FindMatch() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [, navigate] = useLocation();

  // Parse ?date= from URL (used by dashboard CTA)
  const initialDate = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("date") ?? toDateInput(new Date());
  }, []);

  const [date, setDate] = useState(initialDate);
  const [count, setCount] = useState(5);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return toDateInput(d);
  }, []);
  const minDate = useMemo(() => toDateInput(new Date()), []);

  async function load() {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ candidates: Candidate[] }>("/matchmaking/suggest", {
        method: "POST",
        body: JSON.stringify({ date, count }),
      });
      const sorted = [...res.candidates].sort(
        (a, b) => b.compatibility_score - a.compatibility_score
      );
      setCandidates(sorted);
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load on first mount once the authenticated user is available
  useEffect(() => {
    if (user?.id) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function suggestMatch() {
    alert(t("findMatch.comingSoon"));
  }

  const showEmpty = !loading && !error && candidates !== null && candidates.length === 0;
  const showResults = !loading && !error && candidates !== null && candidates.length > 0;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 pt-20 lg:pt-8">
        {/* Header */}
        <header>
          <h1 className="text-2xl sm:text-3xl font-serif mb-1">{t("findMatch.title")}</h1>
          <p className="text-muted-foreground text-sm sm:text-base">{t("findMatch.subtitle")}</p>
        </header>

        {/* Filters */}
        <Card className="bg-card border-white/5 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 min-w-0">
              <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
                {t("findMatch.date")}
              </label>
              <input
                type="date"
                value={date}
                min={minDate}
                max={maxDate}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
                {t("findMatch.count")}
              </label>
              <div className="flex gap-1 bg-background border border-white/10 rounded-md p-1">
                {[3, 5, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={cn(
                      "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                      count === n
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={load} disabled={loading} className="sm:w-auto">
              {loading ? t("findMatch.searching") : t("findMatch.apply")}
            </Button>
          </div>
        </Card>

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <Card className="bg-card border-red-500/30 p-8 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <div className="text-foreground font-medium mb-1">{t("findMatch.errorTitle")}</div>
            <div className="text-sm text-muted-foreground mb-4">{error}</div>
            <Button onClick={load} variant="outline">{t("findMatch.retry")}</Button>
          </Card>
        )}

        {/* Empty */}
        {showEmpty && (
          <Card className="bg-card border-white/5 p-8 text-center">
            <div className="text-5xl mb-3">🔍</div>
            <div className="text-foreground font-medium text-lg mb-1">
              {t("findMatch.emptyTitle")}
            </div>
            <div className="text-sm text-muted-foreground">{t("findMatch.emptyHint")}</div>
          </Card>
        )}

        {/* Results */}
        {showResults && (
          <div className="space-y-3">
            {candidates!.map((c, idx) => (
              <CandidateCard
                key={c.user.id}
                candidate={c}
                me={user}
                language={language}
                t={t}
                index={idx}
                onSuggest={suggestMatch}
                onView={() => navigate(`/players/${c.user.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function CandidateCard({
  candidate,
  me,
  language,
  t,
  index,
  onSuggest,
  onView,
}: {
  candidate: Candidate;
  me: any;
  language: string;
  t: (k: string) => string;
  index: number;
  onSuggest: () => void;
  onView: () => void;
}) {
  const { user: u, compatibility_score: score, compatibility_breakdown: b, shared_availability_slots: slots } = candidate;

  // Warnings
  const warnArchetype = !u.archetype;
  const physDiff =
    me?.physicalSelf != null && u.physical_self != null
      ? Math.abs(me.physicalSelf - u.physical_self)
      : 0;
  const warnPhysical = physDiff > 3;
  const warnGoal =
    me?.goal != null && u.goal != null && me.goal !== u.goal;

  const sharedText = formatSharedDates(slots, language);

  return (
    <Card
      className="bg-card border-white/5 p-4 sm:p-5 hover:border-primary/20 transition-colors"
      style={{
        animation: `fadeInUp 0.4s ease-out ${index * 0.06}s both`,
      }}
    >
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full bg-primary/20 text-primary flex items-center justify-center font-serif text-lg flex-shrink-0">
          {initials(u.name)}
        </div>

        {/* Main column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-medium truncate">{u.name}</h3>
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-mono font-bold">
                  {u.level_quiz || u.level_self || "—"}
                </Badge>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {u.archetype || t("findMatch.noArchetype")}
                {u.location_name && <span> · {u.location_name}</span>}
              </div>
            </div>

            <CompatRing score={score} />
          </div>

          {/* Physical bar */}
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              {t("findMatch.physical")}
            </span>
            <PhysicalBar value={u.physical_self} />
          </div>

          {/* Breakdown */}
          <div className="mt-2 text-xs font-mono text-muted-foreground">
            {t("findMatch.breakdownLevel")} {b.level_match} · {t("findMatch.breakdownPhysical")} {b.physical_match} ·{" "}
            {t("findMatch.breakdownStyle")} {b.archetype_match} · {t("findMatch.breakdownTime")} {b.time_overlap}
          </div>

          {/* Shared availability */}
          {sharedText && (
            <div className="mt-3 text-sm">
              <span className="text-muted-foreground">{t("findMatch.availableTogether")}: </span>
              <span className="text-accent">{sharedText}</span>
            </div>
          )}

          {/* Warnings */}
          {(warnArchetype || warnPhysical || warnGoal) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {warnArchetype && (
                <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-xs">
                  ⚠ {t("findMatch.warnArchetype")}
                </Badge>
              )}
              {warnPhysical && (
                <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-xs">
                  ⚠ {t("findMatch.warnPhysical")}
                </Badge>
              )}
              {warnGoal && (
                <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-xs">
                  ⚠ {t("findMatch.warnGoal")}
                </Badge>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={onSuggest} className="flex-1 sm:flex-none">
              {t("findMatch.suggest")}
            </Button>
            <Button size="sm" variant="outline" onClick={onView}>
              {t("findMatch.viewProfile")}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
