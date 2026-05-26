import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { translateError } from "@/lib/errorMessages";
import { NoLevelGate } from "@/components/NoLevelGate";

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

  const [suggestTarget, setSuggestTarget] = useState<{ id: number; name: string } | null>(null);
  const [dialogDate, setDialogDate] = useState("");
  const [dialogTime, setDialogTime] = useState("");
  const [dialogMessage, setDialogMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const maxDate = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 14); return toDateInput(d); }, []);
  const minDate = useMemo(() => toDateInput(new Date()), []);

  function openSuggestDialog(candidateId: number, candidateName: string) {
    setSuggestTarget({ id: candidateId, name: candidateName });
    setDialogDate(date);
    setDialogTime("");
    setDialogMessage("");
  }

  async function confirmSuggest() {
    if (!suggestTarget || isSending) return;
    setIsSending(true);
    try {
      await apiFetch("/match-requests", {
        method: "POST",
        body: JSON.stringify({
          toUserId: suggestTarget.id,
          message: dialogMessage || null,
          proposedDate: dialogDate || null,
          proposedTime: dialogTime || null,
        }),
      });
      toast({
        title: t("findMatch.suggestSent"),
        description: t("findMatch.suggestSentDesc"),
      });
      setSuggestTarget(null);
      navigate("/match-requests");
    } catch (e: unknown) {
      toast({
        title: t("findMatch.suggestError"),
        description: translateError(e).message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  }

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
    } catch (e: unknown) {
      setError(translateError(e).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.id) void load();
  }, [user?.id]);

  const showEmpty = !loading && !error && candidates !== null && candidates.length === 0;
  const showResults = !loading && !error && candidates !== null && candidates.length > 0;

  if (user && !user.level) {
    return <NoLevelGate />;
  }

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
                onSuggest={() => openSuggestDialog(c.user.id, c.user.name)}
                isSuggesting={suggestTarget?.id === c.user.id}
                onView={() => navigate(`/players/${c.user.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── SUGGEST DIALOG ── */}
      {suggestTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !isSending) setSuggestTarget(null); }}
        >
          <div
            className="w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6"
            style={{
              background: "hsl(220 20% 10%)",
              border: "1px solid rgba(255,255,255,0.1)",
              paddingBottom: "max(24px, env(safe-area-inset-bottom))",
            }}
          >
            {/* Drag handle (mobile) */}
            <div className="w-10 h-1 rounded-full mx-auto mb-5 sm:hidden" style={{ background: "rgba(255,255,255,0.2)" }} />

            <h2 className="font-serif font-bold text-white mb-0.5" style={{ fontSize: "20px" }}>
              {t("findMatch.dialogTitle")}
            </h2>
            <p className="mb-5" style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
              → {suggestTarget.name}
            </p>

            <div className="space-y-4">
              {/* Proposed Date */}
              <div>
                <label className="block mb-2" style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {t("findMatch.dialogDate")}
                </label>
                <input
                  type="date"
                  value={dialogDate}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => setDialogDate(e.target.value)}
                  className="w-full rounded-[12px] border text-white outline-none px-4 bg-transparent"
                  style={{ height: "48px", fontSize: "16px", borderColor: "rgba(255,255,255,0.15)", colorScheme: "dark" }}
                />
              </div>

              {/* Proposed Time */}
              <div>
                <label className="block mb-2" style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {t("findMatch.dialogTime")}
                </label>
                <input
                  type="time"
                  value={dialogTime}
                  onChange={(e) => setDialogTime(e.target.value)}
                  className="w-full rounded-[12px] border text-white outline-none px-4 bg-transparent"
                  style={{ height: "48px", fontSize: "16px", borderColor: "rgba(255,255,255,0.15)", colorScheme: "dark" }}
                />
              </div>

              {/* Optional Message */}
              <div>
                <label className="block mb-2" style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {t("findMatch.dialogMessage")}
                </label>
                <textarea
                  value={dialogMessage}
                  onChange={(e) => setDialogMessage(e.target.value)}
                  placeholder={t("findMatch.dialogMessagePlaceholder")}
                  rows={3}
                  className="w-full rounded-[12px] border text-white outline-none px-4 py-3 resize-none bg-transparent placeholder:text-white/20"
                  style={{ fontSize: "15px", borderColor: "rgba(255,255,255,0.15)" }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSuggestTarget(null)}
                disabled={isSending}
                className="flex-1 rounded-[14px] font-medium transition-all disabled:opacity-50"
                style={{
                  height: "52px",
                  fontSize: "16px",
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                {t("findMatch.dialogCancel")}
              </button>
              <button
                onClick={confirmSuggest}
                disabled={isSending}
                className="flex-1 rounded-[14px] font-semibold transition-all disabled:opacity-60"
                style={{ height: "52px", fontSize: "16px", background: "#D4AF37", color: "#000" }}
              >
                {isSending ? t("findMatch.suggesting") : t("findMatch.dialogSend")}
              </button>
            </div>
          </div>
        </div>
      )}
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

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={onSuggest}
          disabled={isSuggesting}
          className="w-full rounded-[14px] bg-primary text-black font-semibold transition-all disabled:opacity-60"
          style={{ height: "56px", fontSize: "17px" }}
        >
          {isSuggesting ? "…" : t("findMatch.suggest")}
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
