import { useAuth } from "@/contexts/AuthContext";
import { useGetPlayerStats, useListBookings, useGetActivityLog, getGetPlayerStatsQueryKey, getListBookingsQueryKey, getGetActivityLogQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "wouter";

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
              Welcome back, {user?.name?.split(" ")[0] || "Player"}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge className="bg-primary/20 text-primary border-primary/30 text-xs sm:text-sm px-2 sm:px-3 py-1">
                WPT {user?.level ?? "—"}
              </Badge>
              <span className="text-muted-foreground text-sm">{levelLabel(user?.level ?? "")}</span>
              {user?.verified && (
                <Badge className="bg-accent/20 text-accent border-accent/30 text-xs sm:text-sm">
                  ✓ Certified
                </Badge>
              )}
            </div>
          </div>
          <Link href="/matches/suggest">
            <Button size="sm" className="shadow-lg shadow-primary/20 shrink-0 text-sm sm:text-base sm:h-10">Find Match</Button>
          </Link>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Matches Played", value: user?.matchesPlayed ?? 0, color: "text-foreground" },
            { label: "Wins", value: user?.wins ?? 0, color: "text-accent" },
            { label: "Win Rate", value: `${winRatePct}%`, color: "text-primary" },
            { label: "WPT Level", value: user?.level ?? "—", color: "text-primary" },
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
              <CardTitle className="text-base font-medium">Win Rate Trend</CardTitle>
            </CardHeader>
            <CardContent className="h-52">
              {stats?.winTrend ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.winTrend}>
                    <XAxis
                      dataKey="date"
                      stroke="#6b7a99"
                      fontSize={11}
                      tickFormatter={(v) => v.slice(5)}
                    />
                    <YAxis stroke="#6b7a99" fontSize={11} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0d1420", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                      formatter={(v: number) => [`${Math.round(v * 100)}%`, "Win Rate"]}
                    />
                    <Line type="monotone" dataKey="winRate" stroke="#2d7dff" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Play more matches to see your trend
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-card border-white/5">
            <CardHeader>
              <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { href: "/matches/suggest", label: "Find a Match", icon: "🎾" },
                { href: "/courts", label: "Book a Court", icon: "🏟️" },
                { href: "/match-requests", label: "Match Requests", icon: "📨" },
                { href: "/assessment", label: "Skill Assessment", icon: "📊" },
                { href: "/video-analysis", label: "Video Analysis", icon: "🎬" },
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
              <CardTitle className="text-base font-medium">Upcoming Matches</CardTitle>
              <Link href="/bookings">
                <span className="text-xs text-primary hover:underline cursor-pointer">View all</span>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length === 0 ? (
                <div className="text-muted-foreground text-sm py-4 text-center">No upcoming matches</div>
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
                  <Button variant="outline" className="w-full border-white/10 text-sm mt-1">Find a Match</Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card className="bg-card border-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
              <Link href="/members">
                <span className="text-xs text-primary hover:underline cursor-pointer">See all</span>
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
                      <span className="text-muted-foreground">
                        {log.action?.replace(/_/g, " ")}
                      </span>
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

        {/* Quiz CTA */}
        <Card className="bg-gradient-to-r from-primary/10 via-accent/5 to-transparent border-primary/20">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div>
              <div className="text-xl mb-0.5">🎾</div>
              <div className="font-serif text-lg mb-1">Узнай свой честный уровень</div>
              <div className="text-muted-foreground text-sm">
                10 вопросов — тактика и психология. Честный результат без лишних комплиментов.
              </div>
            </div>
            <Link href="/quiz">
              <Button className="shrink-0 bg-primary shadow-lg shadow-primary/20">
                Пройти тест
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Assessment CTA */}
        {!user?.verified && (
          <Card className="bg-gradient-to-r from-primary/10 to-accent/5 border-primary/20">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <div className="font-serif text-lg mb-1">Get Your Certified Level</div>
                <div className="text-muted-foreground text-sm">
                  Complete the 10-question skill assessment to earn your official WPT rating badge.
                </div>
              </div>
              <Link href="/assessment">
                <Button variant="outline" className="border-primary text-primary hover:bg-primary/10 shrink-0 ml-4">
                  Take Assessment
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
