import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGetPlayerStats, useListBookings, useGetActivityLog, getGetPlayerStatsQueryKey, getListBookingsQueryKey, getGetActivityLogQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "wouter";
import { ARCHETYPE_META, type Archetype } from "@/lib/archetypes";

function levelLabel(level: string, t: (k: string) => string) {
  const n = parseFloat(level);
  if (isNaN(n)) return level;
  if (n < 2.0) return t("quiz.levels.D");
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

  const { data: activity } = useGetActivityLog(
    { limit: 8 },
    { query: { queryKey: getGetActivityLogQueryKey({ limit: 8 }), refetchInterval: 30000 } }
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

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-5 sm:space-y-8">
        {/* Header */}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-serif mb-1 truncate">
              {t("dashboard.welcomeBack")}, {user?.name?.split(" ")[0] || t("dashboard.player")}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge className="bg-primary/20 text-primary border-primary/30 text-xs sm:text-sm px-2 sm:px-3 py-1">
                WPT {user?.level ?? "—"}
              </Badge>
              <span className="text-muted-foreground text-sm">{levelLabel(user?.level ?? "", t)}</span>
              {user?.verified && (
                <Badge className="bg-accent/20 text-accent border-accent/30 text-xs sm:text-sm">
                  ✓ {t("common.certified")}
                </Badge>
              )}
            </div>
          </div>
          <Link href="/matches/suggest">
            <Button size="sm" className="shadow-lg shadow-primary/20 shrink-0 text-sm sm:text-base sm:h-10">{t("dashboard.findMatch")}</Button>
          </Link>
        </header>

        {/* Find a Partner CTA */}
        {(() => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().slice(0, 10);
          return (
            <Link href={`/find-match?date=${tomorrowStr}`}>
              <Card className="bg-gradient-to-r from-yellow-500/10 via-primary/10 to-transparent border-yellow-500/30 hover:border-yellow-500/50 transition-colors cursor-pointer">
                <CardContent className="p-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-2xl flex-shrink-0">🎯</div>
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base font-medium truncate">
                        {t("dashboard.findPartnerTomorrow")}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {t("dashboard.findPartnerHint")}
                      </div>
                    </div>
                  </div>
                  <span className="text-yellow-400 text-xl">→</span>
                </CardContent>
              </Card>
            </Link>
          );
        })()}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t("dashboard.matchesPlayed"), value: user?.matchesPlayed ?? 0, color: "text-foreground" },
            { label: t("dashboard.wins"), value: user?.wins ?? 0, color: "text-accent" },
            { label: t("dashboard.winRate"), value: `${winRatePct}%`, color: "text-primary" },
            { label: t("dashboard.wptLevel"), value: user?.level ?? "—", color: "text-primary" },
          ].map((s) => (
            <Card key={s.label} className="bg-card border-white/5">
              <CardHeader className="pb-1 pt-4 px-5">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-5">
                <div className={`text-3xl font-mono font-light ${s.color}`}>{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Win Trend Chart */}
          <Card className="bg-card border-white/5 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-medium">{t("dashboard.winRateTrend")}</CardTitle>
            </CardHeader>
            <CardContent className="h-52">
              {stats?.winTrend ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.winTrend}>
                    <XAxis dataKey="date" stroke="#6b7a99" fontSize={11} tickFormatter={(v) => v.slice(5)} />
                    <YAxis stroke="#6b7a99" fontSize={11} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0d1420", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                      formatter={(v: number) => [`${Math.round(v * 100)}%`, t("dashboard.winRate")]}
                    />
                    <Line type="monotone" dataKey="winRate" stroke="#2d7dff" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  {t("dashboard.playMoreMatches")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-card border-white/5">
            <CardHeader>
              <CardTitle className="text-base font-medium">{t("dashboard.quickActions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { href: "/matches/suggest", label: t("dashboard.findAMatch"), icon: "🎾" },
                { href: "/courts", label: t("dashboard.bookACourt"), icon: "🏟️" },
                { href: "/match-requests", label: t("dashboard.matchRequests"), icon: "📨" },
                { href: "/assessment", label: t("dashboard.skillAssessment"), icon: "📊" },
                { href: "/video-analysis", label: t("dashboard.videoAnalysis"), icon: "🎬" },
              ].map((a) => (
                <Link key={a.href} href={a.href}>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 cursor-pointer transition-colors text-sm">
                    <span className="text-lg">{a.icon}</span>
                    <span className="text-foreground/80">{a.label}</span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Matches */}
          <Card className="bg-card border-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-medium">{t("dashboard.upcomingMatches")}</CardTitle>
              <Link href="/bookings">
                <span className="text-xs text-primary hover:underline cursor-pointer">{t("common.viewAll")}</span>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length === 0 ? (
                <div className="text-muted-foreground text-sm py-4 text-center">{t("dashboard.noUpcomingMatches")}</div>
              ) : (
                upcoming.map((b) => (
                  <Link key={b.id} href={`/matches/${b.matchId}`}>
                    <div className="flex items-center justify-between p-3 rounded-md bg-background/50 hover:bg-white/5 cursor-pointer transition-colors">
                      <div>
                        <div className="font-medium text-sm">{b.match?.clubName}</div>
                        <div className="text-xs text-muted-foreground">{b.match?.date} · {b.match?.time}</div>
                      </div>
                      <Badge variant="outline" className="text-xs border-white/10">{b.match?.format}</Badge>
                    </div>
                  </Link>
                ))
              )}
              {upcoming.length === 0 && (
                <Link href="/matches/suggest">
                  <Button variant="outline" className="w-full border-white/10 text-sm mt-1">{t("dashboard.findAMatch")}</Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card className="bg-card border-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-medium">{t("dashboard.recentActivity")}</CardTitle>
              <Link href="/members">
                <span className="text-xs text-primary hover:underline cursor-pointer">{t("common.seeAll")}</span>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {(activity ?? []).slice(0, 6).map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-serif flex-shrink-0 mt-0.5">
                    {log.userName?.[0] ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm">
                      <span className="font-medium">{log.userName}</span>{" "}
                      <span className="text-muted-foreground">{log.action?.replace(/_/g, " ")}</span>
                    </div>
                    {log.details && (
                      <div className="text-xs text-muted-foreground truncate">{log.details}</div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Archetype Card */}
        {(() => {
          const archetype = user?.archetype as Archetype | undefined;
          const meta = archetype ? ARCHETYPE_META[archetype] : null;
          if (meta) {
            return (
              <Card className={`border ${meta.border} ${meta.bg}`}>
                <CardContent className="p-6 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-2xl mb-1">{meta.icon}</div>
                    <div className={`font-serif text-lg mb-1 ${meta.color}`}>{meta.nameRu}</div>
                    <div className="text-muted-foreground text-sm max-w-md">{meta.desc}</div>
                    {user?.warmUpPreference && (
                      <div className="text-xs text-orange-400 mt-1.5">🔥 {t("dashboard.preferWarmup")}</div>
                    )}
                  </div>
                  <Link href="/quiz">
                    <Button variant="outline" className="shrink-0 border-white/10 text-muted-foreground hover:text-foreground">
                      {t("dashboard.retake")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          }
          return (
            <Card className="bg-gradient-to-r from-primary/10 via-accent/5 to-transparent border-primary/20">
              <CardContent className="p-6 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xl mb-0.5">🧠</div>
                  <div className="font-serif text-lg mb-1">{t("dashboard.knowYourArchetype")}</div>
                  <div className="text-muted-foreground text-sm">{t("dashboard.archetypeDesc")}</div>
                </div>
                <Link href="/quiz">
                  <Button className="shrink-0 bg-primary shadow-lg shadow-primary/20">{t("dashboard.takeQuiz")}</Button>
                </Link>
              </CardContent>
            </Card>
          );
        })()}

        {/* Assessment CTA */}
        {!user?.verified && (
          <Card className="bg-gradient-to-r from-primary/10 to-accent/5 border-primary/20">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <div className="font-serif text-lg mb-1">{t("dashboard.getCertifiedLevel")}</div>
                <div className="text-muted-foreground text-sm">{t("dashboard.certifiedDesc")}</div>
              </div>
              <Link href="/assessment">
                <Button variant="outline" className="border-primary text-primary hover:bg-primary/10 shrink-0 ml-4">
                  {t("dashboard.takeAssessment")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
