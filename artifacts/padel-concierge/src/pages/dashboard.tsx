import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGetPlayerStats, useListBookings, getGetPlayerStatsQueryKey, getListBookingsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ARCHETYPE_META, type Archetype } from "@/lib/archetypes";

function levelLabel(level: string) {
  const n = parseFloat(level);
  if (isNaN(n)) return level;
  if (n < 2.0) return "Beginner";
  if (n < 3.0) return "Intermediate";
  if (n < 4.0) return "Advanced";
  return "Elite";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const userId = user?.id ?? 0;

  const { data: stats } = useGetPlayerStats(userId, {
    query: { queryKey: getGetPlayerStatsQueryKey(userId), enabled: !!userId },
  });

  const { data: bookings } = useListBookings(
    { userId },
    { query: { queryKey: getListBookingsQueryKey({ userId }), enabled: !!userId } }
  );

  const upcoming = (bookings ?? [])
    .filter((b) => b.paymentStatus !== "cancelled" && b.match)
    .sort((a, b) => {
      const da = a.match?.date ?? "";
      const db2 = b.match?.date ?? "";
      return da < db2 ? -1 : 1;
    })
    .slice(0, 3);

  const winRatePct = stats ? Math.round((stats.winRate ?? 0) * 100) : 0;
  const archetype = user?.archetype as Archetype | undefined;
  const archetypeMeta = archetype ? ARCHETYPE_META[archetype] : null;

  const firstName = user?.name?.split(" ")[0] || t("dashboard.player");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  return (
    <AppLayout>
      <div
        className="max-w-2xl mx-auto px-6 animate-fade-up"
        style={{ paddingTop: "28px" }}
      >
        {/* ── GREETING ── */}
        <header className="mb-8">
          <p className="text-muted-foreground mb-1" style={{ fontSize: "15px" }}>
            Padel Concierge
          </p>
          <h1
            className="font-serif font-bold text-white"
            style={{ fontSize: "28px", lineHeight: "1.2" }}
          >
            {t("dashboard.greeting")}, {firstName} 👋
          </h1>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span
              className="px-3 py-1 rounded-full border font-mono font-semibold"
              style={{
                fontSize: "13px",
                background: "rgba(212,175,55,0.12)",
                borderColor: "rgba(212,175,55,0.3)",
                color: "#D4AF37",
              }}
            >
              WPT {user?.level ?? "—"}
            </span>
            <span className="text-muted-foreground" style={{ fontSize: "13px" }}>
              {levelLabel(user?.level ?? "")}
            </span>
            {user?.verified && (
              <span
                className="px-3 py-1 rounded-full border"
                style={{ fontSize: "13px", background: "rgba(0,212,255,0.1)", borderColor: "rgba(0,212,255,0.25)", color: "#00d4ff" }}
              >
                ✓ {t("common.certified")}
              </span>
            )}
          </div>
        </header>

        {/* ── 3 BIG STACKED CARDS ── */}
        <div className="space-y-4 mb-8">

          {/* Card 1: Find a Match */}
          <Link href={`/find-match?date=${tomorrowStr}`}>
            <div
              className="rounded-[20px] p-6 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.06) 100%)",
                border: "1px solid rgba(212,175,55,0.3)",
                minHeight: "200px",
              }}
            >
              <div className="flex items-start justify-between h-full">
                <div className="flex-1">
                  <div className="text-3xl mb-3">🎯</div>
                  <h2
                    className="font-serif font-bold text-white mb-1"
                    style={{ fontSize: "20px" }}
                  >
                    {t("dashboard.findAMatch")}
                  </h2>
                  <p className="text-muted-foreground" style={{ fontSize: "14px" }}>
                    {t("dashboard.findPartnerHint")}
                  </p>
                </div>
                <div
                  className="rounded-full flex items-center justify-center ml-4 flex-shrink-0 mt-1"
                  style={{ width: "44px", height: "44px", background: "#D4AF37", color: "#000" }}
                >
                  <span style={{ fontSize: "20px" }}>→</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Card 2: Upcoming Sessions */}
          <div
            className="rounded-[20px] p-6"
            style={{
              background: "hsl(220 20% 6%)",
              border: "1px solid rgba(255,255,255,0.07)",
              minHeight: "200px",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📅</span>
                <h2 className="font-serif font-semibold text-white" style={{ fontSize: "18px" }}>
                  {t("dashboard.upcomingMatches")}
                </h2>
              </div>
              <Link href="/bookings">
                <span className="text-primary cursor-pointer hover:opacity-80" style={{ fontSize: "14px" }}>
                  {t("common.viewAll")}
                </span>
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <div>
                <p className="text-muted-foreground mb-4" style={{ fontSize: "15px" }}>
                  {t("dashboard.noUpcomingMatches")}
                </p>
                <Link href="/matches/suggest">
                  <button
                    className="w-full rounded-[12px] border border-white/12 text-white/70 font-medium transition-all hover:border-white/20 hover:text-white"
                    style={{ height: "44px", fontSize: "15px" }}
                  >
                    {t("dashboard.findAMatch")}
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((b) => (
                  <Link key={b.id} href={`/matches/${b.matchId}`}>
                    <div
                      className="flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <div>
                        <div className="text-white font-medium" style={{ fontSize: "15px" }}>
                          {b.match?.clubName}
                        </div>
                        <div className="text-muted-foreground" style={{ fontSize: "13px" }}>
                          {b.match?.date} · {b.match?.time}
                        </div>
                      </div>
                      <span
                        className="rounded-full px-3 py-1"
                        style={{
                          fontSize: "12px",
                          background: "rgba(255,255,255,0.06)",
                          color: "rgba(255,255,255,0.5)",
                        }}
                      >
                        {b.match?.format}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: Player Card */}
          <div
            className="rounded-[20px] p-6"
            style={{
              background: archetypeMeta
                ? `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)`
                : "hsl(220 20% 6%)",
              border: archetypeMeta ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.07)",
              minHeight: "200px",
            }}
          >
            {archetypeMeta ? (
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-3xl mb-3">{archetypeMeta.icon}</div>
                  <div className="text-muted-foreground mb-1" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    {t("dashboard.playerCard")}
                  </div>
                  <h2 className={`font-serif font-semibold mb-1 ${archetypeMeta.color}`} style={{ fontSize: "18px" }}>
                    {archetypeMeta.nameRu}
                  </h2>
                  <p className="text-muted-foreground" style={{ fontSize: "14px", maxWidth: "260px" }}>
                    {archetypeMeta.desc}
                  </p>
                  {user?.warmUpPreference && (
                    <div className="text-orange-400 mt-2" style={{ fontSize: "13px" }}>
                      🔥 {t("dashboard.preferWarmup")}
                    </div>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0 text-center">
                  <div className="font-mono font-bold text-white" style={{ fontSize: "28px" }}>
                    {winRatePct}<span className="text-muted-foreground" style={{ fontSize: "16px" }}>%</span>
                  </div>
                  <div className="text-muted-foreground" style={{ fontSize: "11px" }}>
                    {t("dashboard.winRate")}
                  </div>
                  <Link href="/quiz">
                    <button
                      className="mt-3 rounded-xl border border-white/12 text-white/60 transition-all hover:border-white/20 hover:text-white"
                      style={{ fontSize: "12px", padding: "6px 12px" }}
                    >
                      {t("dashboard.retake")}
                    </button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-3xl mb-3">🧠</div>
                  <h2 className="font-serif font-semibold text-white mb-1" style={{ fontSize: "18px" }}>
                    {t("dashboard.knowYourArchetype")}
                  </h2>
                  <p className="text-muted-foreground" style={{ fontSize: "14px" }}>
                    {t("dashboard.archetypeDesc")}
                  </p>
                </div>
                <Link href="/quiz">
                  <button
                    className="ml-4 flex-shrink-0 rounded-[12px] font-semibold text-black bg-primary transition-all"
                    style={{ fontSize: "14px", padding: "10px 18px" }}
                  >
                    {t("dashboard.takeQuiz")}
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── STATS ROW ── */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: t("dashboard.matchesPlayed"), value: user?.matchesPlayed ?? 0 },
            { label: t("dashboard.wins"), value: user?.wins ?? 0 },
            { label: t("dashboard.winRate"), value: `${winRatePct}%` },
            { label: t("dashboard.wptLevel"), value: user?.level ?? "—" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-[16px] p-3 text-center"
              style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div
                className="font-mono font-semibold text-primary"
                style={{ fontSize: "22px" }}
              >
                {s.value}
              </div>
              <div
                className="text-muted-foreground mt-1 leading-tight"
                style={{ fontSize: "13px" }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── QUICK ACTIONS ── */}
        <div className="mb-8">
          <h3 className="font-serif font-semibold text-white mb-4" style={{ fontSize: "18px" }}>
            {t("dashboard.quickActions")}
          </h3>
          <div className="space-y-2">
            {[
              { href: "/matches/suggest", label: t("dashboard.findAMatch"), icon: "🎾" },
              { href: "/courts", label: t("dashboard.bookACourt"), icon: "🏟️" },
              { href: "/match-requests", label: t("dashboard.matchRequests"), icon: "📨" },
              { href: "/assessment", label: t("dashboard.skillAssessment"), icon: "📊" },
              { href: "/video-analysis", label: t("dashboard.videoAnalysis"), icon: "🎬" },
            ].map((a) => (
              <Link key={a.href} href={a.href}>
                <div
                  className="flex items-center gap-4 px-4 py-3 rounded-[14px] cursor-pointer hover:bg-white/5 transition-colors"
                  style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <span style={{ fontSize: "22px" }}>{a.icon}</span>
                  <span className="text-white/80 flex-1" style={{ fontSize: "16px" }}>{a.label}</span>
                  <span className="text-muted-foreground">›</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── ASSESSMENT CTA ── */}
        {!user?.verified && (
          <div
            className="rounded-[20px] p-6 mb-8"
            style={{
              background: "linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(0,212,255,0.05) 100%)",
              border: "1px solid rgba(212,175,55,0.2)",
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-serif font-semibold text-white mb-1" style={{ fontSize: "17px" }}>
                  {t("dashboard.getCertifiedLevel")}
                </div>
                <div className="text-muted-foreground" style={{ fontSize: "14px" }}>
                  {t("dashboard.certifiedDesc")}
                </div>
              </div>
              <Link href="/assessment">
                <button
                  className="flex-shrink-0 rounded-[12px] border border-primary text-primary font-medium hover:bg-primary/10 transition-colors"
                  style={{ fontSize: "14px", padding: "10px 16px" }}
                >
                  {t("dashboard.takeAssessment")}
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
