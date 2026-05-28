import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { ARCHETYPE_META, type Archetype } from "@/lib/archetypes";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDubaiMonthYear, formatDubaiDate, formatDubaiTime } from "@/lib/datetime";

function formatMatchDateTime(date: string | undefined, time: string | undefined, locale: string): string {
  if (!date || !time) return [date, time].filter(Boolean).join(" · ");
  const iso = `${date}T${time}:00+04:00`;
  return `${formatDubaiDate(iso, locale)} · ${formatDubaiTime(iso, locale)}`;
}
import {
  reliabilityColor,
  reliabilityBarColor,
  reliabilityLabel,
  reliabilityDotClass,
} from "@/components/ReliabilityBadge";

interface PlayerUser {
  id: number;
  name: string;
  email: string;
  level: string;
  goal: string;
  intensity: string;
  locationName: string | null;
  verified: boolean;
  role: string;
  matchesPlayed: number;
  wins: number;
  archetype: string | null;
  warmUpPreference: boolean;
  levelSelf: number | null;
  levelQuiz: string | null;
  physicalSelf: number | null;
  warmupFormat: string | null;
  createdAt: string;
}

interface PlayerProfile {
  userId: number;
  reliabilityScore: number;
  noShowCount: number;
  sessionStreak: number;
  behavioralFlags: string[];
  source: string;
}

interface PlayerStats {
  userId: number;
  matchesPlayed: number;
  wins: number;
  winRate: number;
  levelProgress: number;
  winsToNextLevel: number;
  levelConfidence: number;
  formatBreakdown: { format: string; count: number }[];
  winTrend: { date: string; winRate: number }[];
}

interface Booking {
  id: number;
  userId: number;
  matchId: number;
  paymentStatus: string;
  warmUpCompleted: boolean;
  cancelledAt: string | null;
  createdAt: string;
  match: {
    id: number;
    date: string;
    time: string;
    clubName: string;
    format: string;
    status: string;
    players: { userId: number; name: string; level: string }[];
  } | null;
}

const FORMAT_COLORS: Record<string, string> = {
  Classic: "text-amber-400",
  Simplified: "text-sky-400",
  Rotation: "text-violet-400",
};

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "", 10);
  const { t, language } = useLanguage();

  const { data: player, isLoading: playerLoading } = useQuery({
    queryKey: ["user", id],
    queryFn: () => apiFetch<PlayerUser>(`/users/${id}`),
    enabled: !isNaN(id),
    retry: false,
  });

  const { data: reliability, isLoading: reliabilityLoading } = useQuery({
    queryKey: ["player-profile", id],
    queryFn: () => apiFetch<PlayerProfile>(`/players/${id}/profile`),
    enabled: !isNaN(id),
    retry: false,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["player-stats", id],
    queryFn: () => apiFetch<PlayerStats>(`/stats/player/${id}`),
    enabled: !isNaN(id),
    retry: false,
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["player-bookings", id],
    queryFn: () => apiFetch<Booking[]>(`/bookings?userId=${id}`),
    enabled: !isNaN(id),
    retry: false,
  });

  if (isNaN(id)) {
    return <AppLayout><div className="p-8 text-muted-foreground">{t("playerProfile.invalidId")}</div></AppLayout>;
  }

  if (playerLoading) {
    return <AppLayout><div className="p-8 text-muted-foreground animate-pulse">{t("playerProfile.loading")}</div></AppLayout>;
  }

  if (!player) {
    return <AppLayout><div className="p-8 text-muted-foreground">{t("playerProfile.notFound")}</div></AppLayout>;
  }

  const archetype = player.archetype as Archetype | undefined;
  const archetypeMeta = archetype ? ARCHETYPE_META[archetype] : null;

  const recentMatches = (bookings ?? [])
    .filter(b => b.match)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const winRate = player.matchesPlayed > 0
    ? Math.round((player.wins / player.matchesPlayed) * 100)
    : 0;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Link href="/members">
          <button className="text-muted-foreground hover:text-foreground text-sm transition-colors -ml-1">
            {t("playerProfile.back")}
          </button>
        </Link>

        <header className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif text-3xl border border-primary/30 flex-shrink-0">
            {player.name[0]}
          </div>
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-serif">{player.name}</h1>
              {player.verified && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-accent/10 text-accent border-accent/20">
                  {t("playerProfile.certifiedBadge")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm border bg-primary/10 text-primary border-primary/20">
                {player.levelQuiz ?? player.level}
              </span>
              {archetypeMeta && (
                <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-sm border ${archetypeMeta.color} ${archetypeMeta.bg} ${archetypeMeta.border}`}>
                  {archetypeMeta.icon} {archetypeMeta.nameRu}
                </span>
              )}
              {reliability && !reliabilityLoading && (
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", reliabilityDotClass(reliability.reliabilityScore))} />
                  <span className={cn("text-sm font-semibold tabular-nums", reliabilityColor(reliability.reliabilityScore))}>
                    {reliability.reliabilityScore} · {reliabilityLabel(reliability.reliabilityScore)}
                  </span>
                </span>
              )}
              {player.locationName && (
                <span className="text-muted-foreground text-sm">{player.locationName}</span>
              )}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
            <div className="text-xs text-muted-foreground mb-1">{t("playerProfile.matches")}</div>
            <div className="text-3xl font-mono font-bold">{player.matchesPlayed}</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
            <div className="text-xs text-muted-foreground mb-1">{t("playerProfile.wins")}</div>
            <div className="text-3xl font-mono font-bold text-accent">{player.wins}</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
            <div className="text-xs text-muted-foreground mb-1">{t("playerProfile.winRate")}</div>
            <div className="text-3xl font-mono font-bold">{winRate}%</div>
          </div>
        </div>

        <div className="rounded-[20px] bg-card border border-white/5">
          <div className="px-5 pt-5 pb-3">
            <div className="text-sm font-medium">{t("playerProfile.levelPerformance")}</div>
          </div>
          <div className="px-5 pb-5 space-y-4">
            {statsLoading ? (
              <div className="text-sm text-muted-foreground animate-pulse">{t("playerProfile.loadingStats")}</div>
            ) : !stats ? (
              <div className="text-sm text-muted-foreground italic">{t("playerProfile.noStats")}</div>
            ) : (
              <>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{t("playerProfile.levelProgress")}</span>
                    <span className="text-sm font-mono text-primary">{Math.round(stats.levelProgress)}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(100, stats.levelProgress))}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs text-muted-foreground">{t("playerProfile.winsToNextLevel", { count: stats.winsToNextLevel })}</span>
                    <span className="text-xs text-muted-foreground">{t("playerProfile.confidence", { percent: Math.round(stats.levelConfidence) })}</span>
                  </div>
                </div>
                {stats.formatBreakdown.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">{t("playerProfile.formatBreakdown")}</div>
                    <div className="flex flex-wrap gap-2">
                      {stats.formatBreakdown.map(({ format, count }) => (
                        <div
                          key={format}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/8 text-xs"
                        >
                          <span className={FORMAT_COLORS[format] ?? "text-foreground"}>{format}</span>
                          <span className="text-muted-foreground font-mono">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {(player.levelSelf != null || player.levelQuiz || player.physicalSelf != null || player.warmupFormat) && (
          <div className="rounded-[20px] bg-card border border-white/5">
            <div className="px-5 pt-5 pb-3">
              <div className="text-sm font-medium">{t("playerProfile.playStyle")}</div>
            </div>
            <div className="px-5 pb-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {player.levelSelf != null && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{t("playerProfile.selfAssessed")}</div>
                    <div className="text-2xl font-mono text-primary font-bold">{player.levelSelf}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">/ 5.0</div>
                  </div>
                )}
                {player.levelQuiz && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{t("playerProfile.quizLevel")}</div>
                    <div className="text-2xl font-mono text-accent font-bold">{player.levelQuiz}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t("playerProfile.certifiedLabel")}</div>
                  </div>
                )}
                {player.physicalSelf != null && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{t("playerProfile.physical")}</div>
                    <div className="text-2xl font-mono font-bold">{player.physicalSelf}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">/ 10</div>
                  </div>
                )}
                {player.warmupFormat && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{t("playerProfile.warmupLabel")}</div>
                    <div className="text-sm font-medium capitalize mt-1">{player.warmupFormat}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t("playerProfile.formatLabel")}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-[20px] bg-card border border-white/5">
          <div className="px-5 pt-5 pb-3">
            <div className="text-sm font-medium">{t("playerProfile.matchHistory")}</div>
          </div>
          <div className="px-5 pb-5">
            {bookingsLoading ? (
              <div className="text-sm text-muted-foreground animate-pulse">{t("playerProfile.loadingMatches")}</div>
            ) : recentMatches.length === 0 ? (
              <div
                className="rounded-[20px] p-10 text-center"
                style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="text-3xl mb-3">🎾</div>
                <div className="text-white font-medium mb-1" style={{ fontSize: "17px" }}>
                  {t("playerProfileExtras.noMatchesTitle")}
                </div>
                <div className="text-muted-foreground" style={{ fontSize: "14px" }}>
                  {t("playerProfileExtras.noMatchesHint")}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {recentMatches.map((booking) => {
                  const m = booking.match!;
                  const opponents = m.players.filter(p => p.userId !== id);
                  const statusColor =
                    m.status === "completed" ? "text-emerald-400" :
                    m.status === "cancelled" ? "text-red-400/60 line-through" :
                    "text-muted-foreground";
                  return (
                    <Link key={booking.id} href={`/matches/${m.id}`}>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/8 transition-colors cursor-pointer border border-white/5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{m.clubName}</span>
                            <span className={cn("text-xs", FORMAT_COLORS[m.format] ?? "text-muted-foreground")}>
                              {m.format}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{formatMatchDateTime(m.date, m.time, language)}</span>
                            {opponents.length > 0 && (
                              <span className="text-xs text-muted-foreground">{t("playerProfile.vs")} {opponents.map(p => p.name).join(", ")}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {booking.warmUpCompleted && (
                            <span title="Warm-up completed" className="text-orange-400 text-xs">🔥</span>
                          )}
                          <span className={cn("text-xs capitalize font-medium", statusColor)}>{m.status}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[20px] bg-card border border-white/5">
          <div className="px-5 pt-5 pb-3">
            <div className="text-sm font-medium">{t("playerProfile.reliability")}</div>
          </div>
          <div className="px-5 pb-5">
            {reliabilityLoading ? (
              <div className="text-sm text-muted-foreground animate-pulse">{t("playerProfile.loading")}</div>
            ) : !reliability ? (
              <div className="text-sm text-muted-foreground italic">{t("playerProfile.noReliabilityData")}</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{t("playerProfile.reliabilityScore")}</span>
                    <span className={cn("text-sm font-semibold tabular-nums", reliabilityColor(reliability.reliabilityScore))}>
                      {reliability.reliabilityScore}/100 · {reliabilityLabel(reliability.reliabilityScore)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", reliabilityBarColor(reliability.reliabilityScore))}
                      style={{ width: `${Math.max(0, Math.min(100, reliability.reliabilityScore))}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                    <div className="text-xs text-muted-foreground mb-1">{t("playerProfile.noShows")}</div>
                    <div className={cn("text-2xl font-bold tabular-nums", reliability.noShowCount > 0 ? "text-red-400" : "text-emerald-400")}>
                      {reliability.noShowCount}
                    </div>
                    <div className="text-xs text-muted-foreground">{t("playerProfile.totalMissed")}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                    <div className="text-xs text-muted-foreground mb-1">{t("playerProfile.sessionStreak")}</div>
                    <div className={cn("text-2xl font-bold tabular-nums", reliability.sessionStreak >= 3 ? "text-emerald-400" : "text-foreground")}>
                      {reliability.sessionStreak}
                      {reliability.sessionStreak >= 3 && <span className="text-base ml-1">🔥</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{t("playerProfile.consecutive")}</div>
                  </div>
                </div>
                {reliability.behavioralFlags.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">{t("playerProfile.flags")}</div>
                    <div className="flex flex-wrap gap-2">
                      {reliability.behavioralFlags.map((flag) => (
                        <span
                          key={flag}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border border-amber-500/30 text-amber-400 bg-amber-500/10"
                        >
                          ⚑ {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[20px] bg-card border border-white/5">
          <div className="px-5 pt-5 pb-3">
            <div className="text-sm font-medium">{t("playerProfile.details")}</div>
          </div>
          <div className="px-5 pb-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">{t("playerProfile.goal")}</span>
                <div className="font-medium mt-0.5">{player.goal}</div>
              </div>
              <div>
                <span className="text-muted-foreground">{t("playerProfile.intensity")}</span>
                <div className="font-medium mt-0.5">{player.intensity}</div>
              </div>
              {player.warmUpPreference && (
                <div>
                  <span className="text-muted-foreground">{t("playerProfile.warmupPref")}</span>
                  <div className="font-medium mt-0.5 text-orange-400">{t("playerProfile.prefersWarmup")}</div>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">{t("playerProfile.memberSince")}</span>
                <div className="font-medium mt-0.5">
                  {formatDubaiMonthYear(player.createdAt, language)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
