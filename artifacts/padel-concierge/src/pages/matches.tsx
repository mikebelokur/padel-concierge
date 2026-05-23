import { AppLayout } from "@/components/layout/AppLayout";
import { useListMatches } from "@workspace/api-client-react";
import { Link } from "wouter";

const FORMAT_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  classic:    { bg: "rgba(212,175,55,0.12)",  border: "rgba(212,175,55,0.35)",  color: "#D4AF37" },
  simplified: { bg: "rgba(100,180,255,0.10)", border: "rgba(100,180,255,0.30)", color: "#64b4ff" },
  rotation:   { bg: "rgba(160,120,255,0.10)", border: "rgba(160,120,255,0.30)", color: "#a078ff" },
};

function formatStyle(fmt: string) {
  const key = fmt?.toLowerCase() as keyof typeof FORMAT_COLORS;
  return FORMAT_COLORS[key] ?? { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" };
}

export default function Matches() {
  const { data: matches, isLoading } = useListMatches();

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 animate-fade-up" style={{ paddingTop: "28px" }}>

        {/* ── HEADER ── */}
        <header className="mb-6">
          <h1 className="font-serif font-bold text-white mb-1" style={{ fontSize: "26px" }}>
            Available Matches
          </h1>
          <p className="text-muted-foreground" style={{ fontSize: "15px" }}>
            Find the right game for your level.
          </p>
        </header>

        {/* ── SMART SUGGESTIONS CTA ── */}
        <Link href="/matches/suggest">
          <div
            className="rounded-[20px] p-5 mb-6 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.06) 100%)",
              border: "1px solid rgba(212,175,55,0.3)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl mb-1">🎯</div>
                <div className="font-serif font-semibold text-white" style={{ fontSize: "16px" }}>
                  Smart Suggestions
                </div>
                <div className="text-muted-foreground" style={{ fontSize: "13px" }}>
                  AI-matched by archetype &amp; level
                </div>
              </div>
              <div
                className="rounded-full flex items-center justify-center flex-shrink-0"
                style={{ width: "44px", height: "44px", background: "#D4AF37", color: "#000" }}
              >
                <span style={{ fontSize: "20px" }}>→</span>
              </div>
            </div>
          </div>
        </Link>

        {/* ── MATCH LIST ── */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="rounded-[20px] p-5 animate-pulse"
                style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)", minHeight: "120px" }}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {(matches ?? []).length === 0 && (
              <div
                className="rounded-[20px] p-10 text-center"
                style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="text-3xl mb-3">🎾</div>
                <div className="text-white font-medium mb-1">No matches yet</div>
                <div className="text-muted-foreground" style={{ fontSize: "14px" }}>
                  Check back soon or use Smart Suggestions.
                </div>
              </div>
            )}

            {(matches ?? []).map((match) => {
              const fStyle = formatStyle(match.format);
              const playerCount = match.players.length;
              const spotsLeft = 4 - playerCount;

              return (
                <Link key={match.id} href={`/matches/${match.id}`}>
                  <div
                    className="rounded-[20px] p-5 cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.99]"
                    style={{
                      background: "hsl(220 20% 6%)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-serif font-semibold text-white truncate" style={{ fontSize: "17px" }}>
                          {match.clubName}
                        </div>
                        <div className="text-muted-foreground mt-0.5" style={{ fontSize: "13px" }}>
                          {match.date} · {match.time}
                        </div>
                      </div>
                      <span
                        className="rounded-full px-3 py-1 font-medium flex-shrink-0"
                        style={{
                          fontSize: "12px",
                          background: fStyle.bg,
                          border: `1px solid ${fStyle.border}`,
                          color: fStyle.color,
                        }}
                      >
                        {match.format}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex-1">
                        <div className="text-muted-foreground mb-0.5" style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Level</div>
                        <div className="font-mono font-semibold text-white" style={{ fontSize: "14px" }}>
                          {match.levelMin} – {match.levelMax}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-muted-foreground mb-0.5" style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Price</div>
                        <div className="font-mono font-semibold text-white" style={{ fontSize: "14px" }}>
                          {match.price} AED
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-muted-foreground mb-0.5" style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Players</div>
                        <div className="font-mono font-semibold" style={{ fontSize: "14px", color: playerCount >= 4 ? "#ef4444" : "#D4AF37" }}>
                          {playerCount}/4
                        </div>
                      </div>
                    </div>

                    {/* Spots + chevron */}
                    <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontSize: "13px" }}>
                        {spotsLeft > 0 ? (
                          <span style={{ color: "#D4AF37" }}>{spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left</span>
                        ) : (
                          <span className="text-muted-foreground">Full</span>
                        )}
                      </div>
                      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "20px", lineHeight: 1 }}>›</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div style={{ height: "32px" }} />
      </div>
    </AppLayout>
  );
}
