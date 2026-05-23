import { AppLayout } from "@/components/layout/AppLayout";
import { useGetMatch, useCreateBooking, getGetMatchQueryKey } from "@workspace/api-client-react";
import { useLocation, useParams, Link } from "wouter";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const phases = [
  { title: "Baseline Defence", duration: 180, desc: "Depth, sending ball deep" },
  { title: "Glass Defence",    duration: 180, desc: "Rebounds, high ball control" },
  { title: "Volley Play",      duration: 120, desc: "Clean strikes, soft hands" },
  { title: "Smash / Bandeja", duration: 120, desc: "Aggressive overhead shots" },
];

const FORMAT_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  classic:    { bg: "rgba(212,175,55,0.12)",  border: "rgba(212,175,55,0.35)",  color: "#D4AF37" },
  simplified: { bg: "rgba(100,180,255,0.10)", border: "rgba(100,180,255,0.30)", color: "#64b4ff" },
  rotation:   { bg: "rgba(160,120,255,0.10)", border: "rgba(160,120,255,0.30)", color: "#a078ff" },
};

function formatStyle(fmt: string) {
  const key = fmt?.toLowerCase() as keyof typeof FORMAT_COLORS;
  return FORMAT_COLORS[key] ?? { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" };
}

export default function MatchDetail() {
  const params = useParams();
  const matchId = Number(params.id);
  const { data: match, isLoading } = useGetMatch(matchId, {
    query: {
      enabled: !!matchId,
      queryKey: getGetMatchQueryKey(matchId),
      refetchInterval: 10_000,
    },
  });
  const [phase, setPhase] = useState(0);
  const [timeLeft, setTimeLeft] = useState(phases[0].duration);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const createBooking = useCreateBooking();
  const { toast } = useToast();

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
      return () => clearTimeout(timer);
    } else if (phase < phases.length - 1) {
      const next = phase + 1;
      setPhase(next);
      setTimeLeft(phases[next].duration);
    }
    return undefined;
  }, [timeLeft, phase]);

  const handleBook = () => {
    if (!user) return;
    createBooking.mutate({ data: { userId: user.id, matchId } }, {
      onSuccess: (booking) => {
        toast({ title: "Booking created", description: "Redirecting to payment…" });
        setLocation(`/bookings/${booking.id}`);
      },
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-6 space-y-4" style={{ paddingTop: "28px" }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-[20px] animate-pulse" style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)", minHeight: "96px" }} />
          ))}
        </div>
      </AppLayout>
    );
  }

  if (!match) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-6 text-center" style={{ paddingTop: "80px" }}>
          <div className="text-3xl mb-3">🎾</div>
          <div className="text-white font-medium">Match not found</div>
        </div>
      </AppLayout>
    );
  }

  const fStyle = formatStyle(match.format);
  const playerCount = match.players.length;
  const spotsLeft = 4 - playerCount;
  const isFull = playerCount >= 4;
  const isCoachOrAdmin = user?.role === "coach" || user?.role === "admin" || user?.role === "owner";
  const mins = Math.floor(timeLeft / 60);
  const secs = (timeLeft % 60).toString().padStart(2, "0");

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 animate-fade-up" style={{ paddingTop: "28px", paddingBottom: "40px" }}>

        {/* ── HEADER ── */}
        <header className="mb-6">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="font-serif font-bold text-white leading-tight" style={{ fontSize: "26px" }}>
              {match.clubName}
            </h1>
            <span
              className="rounded-full px-3 py-1 font-semibold flex-shrink-0"
              style={{ fontSize: "13px", background: "#D4AF37", color: "#000", marginTop: "4px" }}
            >
              {match.price} AED
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground" style={{ fontSize: "14px" }}>{match.date} · {match.time}</span>
            <span
              className="rounded-full px-2.5 py-0.5 font-medium"
              style={{ fontSize: "12px", background: fStyle.bg, border: `1px solid ${fStyle.border}`, color: fStyle.color }}
            >
              {match.format}
            </span>
          </div>
        </header>

        {/* ── PLAYERS ── */}
        <section className="mb-4">
          <div
            className="uppercase font-semibold mb-3"
            style={{ fontSize: "11px", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}
          >
            Players ({playerCount}/4) {spotsLeft > 0 && `· ${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
          </div>

          <div
            className="rounded-[20px] overflow-hidden"
            style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {match.players.map((player, i) => (
              <div
                key={player.userId}
                className="flex items-center gap-3 px-5"
                style={{
                  minHeight: "64px",
                  borderBottom: i < match.players.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}
              >
                <div
                  className="flex items-center justify-center flex-shrink-0 font-serif"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "rgba(212,175,55,0.15)",
                    color: "#D4AF37",
                    fontSize: "17px",
                  }}
                >
                  {player.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate" style={{ fontSize: "15px" }}>{player.name}</div>
                  <div className="text-muted-foreground font-mono" style={{ fontSize: "12px" }}>{player.level}</div>
                </div>
                {player.confirmed && (
                  <span
                    className="rounded-full px-2.5 py-0.5 flex-shrink-0"
                    style={{ fontSize: "11px", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)", color: "#4ade80" }}
                  >
                    Confirmed
                  </span>
                )}
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: spotsLeft }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 px-5"
                style={{
                  minHeight: "64px",
                  borderBottom: i < spotsLeft - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}
              >
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    border: "1.5px dashed rgba(255,255,255,0.15)",
                  }}
                />
                <div className="text-muted-foreground" style={{ fontSize: "14px", opacity: 0.5 }}>Open slot</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── WARM-UP PROTOCOL ── */}
        <section className="mb-4">
          <div
            className="uppercase font-semibold mb-3"
            style={{ fontSize: "11px", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}
          >
            Warm-up Protocol
          </div>
          <div
            className="rounded-[20px] p-5"
            style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(212,175,55,0.15)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div style={{ fontSize: "15px", color: "#D4AF37", fontWeight: 600 }}>{phases[phase].title}</div>
                <div className="text-muted-foreground" style={{ fontSize: "12px" }}>{phases[phase].desc}</div>
              </div>
              <div
                className="font-mono font-bold"
                style={{ fontSize: "32px", color: "#D4AF37", letterSpacing: "-0.02em" }}
              >
                {mins}:{secs}
              </div>
            </div>
            <div className="flex gap-1.5">
              {phases.map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-all duration-500"
                  style={{
                    height: "4px",
                    background: i < phase ? "#D4AF37" : i === phase ? "#D4AF37" : "rgba(255,255,255,0.12)",
                    opacity: i === phase ? 1 : i < phase ? 0.7 : 1,
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── LATECOMERS RULE ── */}
        <section className="mb-6">
          <div
            className="rounded-[20px] p-5"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span style={{ fontSize: "16px" }}>⏱</span>
              <span style={{ fontSize: "14px", color: "#f87171", fontWeight: 600 }}>Latecomers Rule</span>
            </div>
            <p className="text-muted-foreground leading-relaxed" style={{ fontSize: "13px" }}>
              Strict 5-minute grace period. After 5 minutes, you must join without warm-up. This ensures the quality and intensity of the match for all confirmed players.
            </p>
          </div>
        </section>

        {/* ── PRIMARY CTA ── */}
        <button
          className="w-full rounded-[20px] font-semibold transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
          style={{
            minHeight: "56px",
            fontSize: "17px",
            background: isFull ? "rgba(255,255,255,0.08)" : "#D4AF37",
            color: isFull ? "rgba(255,255,255,0.5)" : "#000",
            cursor: isFull ? "not-allowed" : "pointer",
          }}
          onClick={handleBook}
          disabled={createBooking.isPending || isFull}
        >
          {createBooking.isPending
            ? "Confirming…"
            : isFull
            ? "Match Full"
            : "Confirm Booking"}
        </button>

        {/* ── SECONDARY ACTIONS ── */}
        <div
          className="rounded-[20px] overflow-hidden mt-4"
          style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {isCoachOrAdmin && (
            <Link href={`/match-log/${matchId}`}>
              <div
                className="flex items-center justify-between px-5 cursor-pointer transition-colors hover:bg-white/[0.03]"
                style={{ minHeight: "52px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: "18px" }}>📋</span>
                  <span style={{ fontSize: "15px", color: "rgba(255,255,255,0.85)" }}>Fill match results</span>
                </div>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "20px", lineHeight: 1 }}>›</span>
              </div>
            </Link>
          )}
          <Link href={`/match-feedback/${matchId}`}>
            <div
              className="flex items-center justify-between px-5 cursor-pointer transition-colors hover:bg-white/[0.03]"
              style={{ minHeight: "52px" }}
            >
              <div className="flex items-center gap-3">
                <span style={{ fontSize: "18px" }}>⭐</span>
                <span style={{ fontSize: "15px", color: "rgba(255,255,255,0.85)" }}>Leave partner feedback</span>
              </div>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "20px", lineHeight: 1 }}>›</span>
            </div>
          </Link>
        </div>

      </div>
    </AppLayout>
  );
}
