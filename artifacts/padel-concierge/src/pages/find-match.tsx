import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  if (score >= 80) return { stroke: "#D4AF37", text: "#D4AF37", glow: "drop-shadow(0 0 8px rgba(212,175,55,0.8))" };
  if (score >= 60) return { stroke: "#cbd5e1", text: "#cbd5e1", glow: "none" };
  return { stroke: "#6b7280", text: "#6b7280", glow: "none" };
}

function CompatRing({ score }: { score: number }) {
  const { stroke, text, glow } = ringColor(score);
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;
  return (
    <div className="relative flex-shrink-0" style={{ width: "88px", height: "88px" }}>
      <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90" style={{ filter: glow }}>
        <circle cx="44" cy="44" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth="7" fill="none" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          stroke={stroke}
          strokeWidth="7"
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease-out" }}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ color: text }}
      >
        <span className="font-mono font-bold" style={{ fontSize: "22px" }}>{score}</span>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "-2px" }}>match</span>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function formatSharedDates(slots: { start: string }[], language: string): string {
  if (slots.length === 0) return "";
  const seen = new Set<string>();
  const dates: Date[] = [];
  for (const s of slots) {
    const d = new Date(s.start);
    const key = d.toISOString().slice(0, 10);
    if (!seen.has(key)) { seen.add(key); dates.push(d); }
  }
  dates.sort((a, b) => a.getTime() - b.getTime());
  if (language === "ru") {
    const byMonth = new Map<string, number[]>();
    for (const d of dates) {
      const month = d.toLocaleDateString("ru-RU", { month: "long" });
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(d.getDate());
    }
    return [...byMonth.entries()].map(([m, days]) => `${days.join(", ")} ${m}`).join("; ");
  }
  return dates.map((d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })).join(", ");
}

function SkeletonCard() {
  return (
    <div
      className="rounded-[20px] p-6 animate-pulse"
      style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center gap-4 mb-5">
        <div className="w-14 h-14 rounded-full bg-white/5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-white/5 rounded-full" />
          <div className="h-3 w-24 bg-white/5 rounded-full" />
        </div>
        <div className="w-20 h-20 rounded-full bg-white/5" />
      </div>
      <div className="h-3 w-full bg-white/5 rounded-full" />
    </div>
  );
}

const COUNT_OPTIONS = [3, 5, 10];

export default function FindMatch() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const initialDate = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("date") ?? toDateInput(new Date());
  }, []);

  const [date, setDate] = useState(initialDate);
  const [count, setCount] = useState(5);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestingId, setSuggestingId] = useState<number | null>(null);

  async function handleSuggest(candidateUserId: number) {
    if (!user?.id || suggestingId !== null) return;
    setSuggestingId(candidateUserId);
    try {
      await apiFetch("/match-requests", {
        method: "POST",
        body: JSON.stringify({
          toUserId: candidateUserId,
          message: null,
          proposedDate: date || null,
          proposedTime: null,
        }),
      });
      toast({
        title: t("findMatch.suggestSent"),
        description: t("findMatch.suggestSentDesc"),
      });
      navigate("/match-requests");
    } catch (e: any) {
      toast({
        title: t("findMatch.suggestError"),
        description: e.message || "Network error",
        variant: "destructive",
      });
    } finally {
      setSuggestingId(null);
    }
  }

  const maxDate = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 14); return toDateInput(d); }, []);
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
      const sorted = [...res.candidates].sort((a, b) => b.compatibility_score - a.compatibility_score);
      setCandidates(sorted);
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.id) void load();
  }, [user?.id]);

  const showEmpty = !loading && !error && candidates !== null && candidates.length === 0;
  const showResults = !loading && !error && candidates !== null && candidates.length > 0;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-8 animate-fade-up" style={{ paddingTop: "20px" }}>

        {/* ── HEADER ── */}
        <header className="mb-6">
          <h1 className="font-serif font-bold text-white mb-1" style={{ fontSize: "26px" }}>
            {t("findMatch.title")}
          </h1>
          <p className="text-muted-foreground" style={{ fontSize: "15px" }}>
            {t("findMatch.subtitle")}
          </p>
        </header>

        {/* ── FILTER CHIPS ── */}
        <div className="flex gap-3 overflow-x-auto pb-2 mb-6 scrollbar-none" style={{ WebkitOverflowScrolling: "touch" }}>
          {/* Date chip */}
          <div
            className="flex-shrink-0 rounded-full border flex items-center gap-2 px-4"
            style={{
              height: "44px",
              background: "hsl(220 20% 6%)",
              borderColor: "rgba(255,255,255,0.12)",
            }}
          >
            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)" }}>📅</span>
            <input
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent text-white border-none outline-none"
              style={{ fontSize: "14px", minWidth: "120px", colorScheme: "dark" }}
            />
          </div>

          {/* Count chips */}
          {COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className="flex-shrink-0 rounded-full border font-medium transition-all"
              style={{
                height: "44px",
                padding: "0 18px",
                fontSize: "14px",
                background: count === n ? "rgba(212,175,55,0.15)" : "hsl(220 20% 6%)",
                borderColor: count === n ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.12)",
                color: count === n ? "#D4AF37" : "rgba(255,255,255,0.7)",
              }}
            >
              {n} {t("findMatch.players")}
            </button>
          ))}

          {/* Apply chip */}
          <button
            onClick={load}
            disabled={loading}
            className="flex-shrink-0 rounded-full font-semibold transition-all disabled:opacity-60"
            style={{
              height: "44px",
              padding: "0 20px",
              fontSize: "14px",
              background: "#D4AF37",
              color: "#000",
            }}
          >
            {loading ? t("findMatch.searching") : t("findMatch.apply")}
          </button>
        </div>

        {/* ── LOADING ── */}
        {loading && (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* ── ERROR ── */}
        {error && !loading && (
          <div
            className="rounded-[20px] p-8 text-center"
            style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            <div className="text-4xl mb-3">⚠️</div>
            <div className="text-white font-medium mb-1" style={{ fontSize: "17px" }}>{t("findMatch.errorTitle")}</div>
            <div className="text-muted-foreground mb-5" style={{ fontSize: "15px" }}>{error}</div>
            <button
              onClick={load}
              className="rounded-[12px] border border-white/15 text-white font-medium px-6"
              style={{ height: "44px", fontSize: "15px" }}
            >
              {t("findMatch.retry")}
            </button>
          </div>
        )}

        {/* ── EMPTY ── */}
        {showEmpty && (
          <div
            className="rounded-[20px] p-8 text-center"
            style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="text-5xl mb-3">🔍</div>
            <div className="text-white font-medium mb-2" style={{ fontSize: "17px" }}>{t("findMatch.emptyTitle")}</div>
            <div className="text-muted-foreground" style={{ fontSize: "15px" }}>{t("findMatch.emptyHint")}</div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {showResults && (
          <div className="space-y-4">
            {candidates!.map((c, idx) => (
              <CandidateCard
                key={c.user.id}
                candidate={c}
                me={user}
                language={language}
                t={t}
                index={idx}
                onSuggest={() => handleSuggest(c.user.id)}
                isSuggesting={suggestingId === c.user.id}
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
  isSuggesting,
  onView,
}: {
  candidate: Candidate;
  me: any;
  language: string;
  t: (k: string) => string;
  index: number;
  onSuggest: () => void;
  isSuggesting: boolean;
  onView: () => void;
}) {
  const { user: u, compatibility_score: score, shared_availability_slots: slots } = candidate;

  const warnArchetype = !u.archetype;
  const physDiff = me?.physicalSelf != null && u.physical_self != null ? Math.abs(me.physicalSelf - u.physical_self) : 0;
  const warnPhysical = physDiff > 3;
  const warnGoal = me?.goal != null && u.goal != null && me.goal !== u.goal;

  const sharedText = formatSharedDates(slots, language);

  return (
    <div
      className="rounded-[20px] p-6 transition-all hover:border-primary/30"
      style={{
        background: "hsl(220 20% 6%)",
        border: "1px solid rgba(255,255,255,0.07)",
        animation: `fadeInUp 0.4s ease-out ${index * 0.07}s both`,
      }}
    >
      {/* Top: Avatar + Info + Ring */}
      <div className="flex items-start gap-4 mb-5">
        {/* Avatar */}
        <div
          className="rounded-full flex items-center justify-center font-serif font-bold text-primary flex-shrink-0"
          style={{
            width: "56px",
            height: "56px",
            background: "rgba(212,175,55,0.12)",
            fontSize: "20px",
          }}
        >
          {initials(u.name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-white font-semibold truncate" style={{ fontSize: "17px" }}>
              {u.name}
            </h3>
            <span
              className="rounded-full px-2.5 py-0.5 font-mono font-bold"
              style={{
                fontSize: "12px",
                background: "rgba(212,175,55,0.15)",
                color: "#D4AF37",
              }}
            >
              {u.level_quiz || u.level_self || "—"}
            </span>
          </div>
          <div className="text-muted-foreground" style={{ fontSize: "14px" }}>
            {u.archetype || t("findMatch.noArchetype")}
            {u.location_name && <span> · {u.location_name}</span>}
          </div>
          {sharedText && (
            <div className="mt-2" style={{ fontSize: "13px" }}>
              <span className="text-muted-foreground">{t("findMatch.availableTogether")}: </span>
              <span style={{ color: "#00d4ff" }}>{sharedText}</span>
            </div>
          )}
        </div>

        {/* Compatibility Ring */}
        <CompatRing score={score} />
      </div>

      {/* Physical level bar */}
      {u.physical_self != null && (
        <div className="flex items-center gap-3 mb-4">
          <span className="text-muted-foreground flex-shrink-0" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {t("findMatch.physical")}
          </span>
          <div className="flex items-center gap-1 flex-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-full"
                style={{
                  height: "4px",
                  background: i < (u.physical_self ?? 0)
                    ? (u.physical_self! >= 7 ? "#D4AF37" : u.physical_self! >= 4 ? "rgba(212,175,55,0.6)" : "rgba(255,255,255,0.3)")
                    : "rgba(255,255,255,0.08)",
                }}
              />
            ))}
          </div>
          <span className="text-muted-foreground font-mono" style={{ fontSize: "12px" }}>
            {u.physical_self}/10
          </span>
        </div>
      )}

      {/* Warnings */}
      {(warnArchetype || warnPhysical || warnGoal) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {warnArchetype && (
            <span
              className="rounded-full px-3 py-1"
              style={{ fontSize: "12px", background: "rgba(234,179,8,0.1)", color: "#eab308", border: "1px solid rgba(234,179,8,0.25)" }}
            >
              ⚠ {t("findMatch.warnArchetype")}
            </span>
          )}
          {warnPhysical && (
            <span
              className="rounded-full px-3 py-1"
              style={{ fontSize: "12px", background: "rgba(249,115,22,0.1)", color: "#f97316", border: "1px solid rgba(249,115,22,0.25)" }}
            >
              ⚠ {t("findMatch.warnPhysical")}
            </span>
          )}
          {warnGoal && (
            <span
              className="rounded-full px-3 py-1"
              style={{ fontSize: "12px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}
            >
              ⚠ {t("findMatch.warnGoal")}
            </span>
          )}
        </div>
      )}

      {/* Actions — single full-width primary button + secondary text link */}
      <div className="space-y-3">
        <button
          onClick={onSuggest}
          disabled={isSuggesting}
          className="w-full rounded-[14px] bg-primary text-black font-semibold transition-all disabled:opacity-60"
          style={{ height: "56px", fontSize: "17px" }}
        >
          {isSuggesting ? t("findMatch.suggesting") : t("findMatch.suggest")}
        </button>
        <button
          onClick={onView}
          className="w-full text-center hover:text-white transition-colors"
          style={{ fontSize: "15px", color: "rgba(255,255,255,0.45)", paddingBottom: "4px" }}
        >
          {t("findMatch.viewProfile")} →
        </button>
      </div>
    </div>
  );
}
