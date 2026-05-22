import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGetPlayerStats, getGetPlayerStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ARCHETYPE_META, archetypeCompatibility, type Archetype } from "@/lib/archetypes";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  reliabilityColor,
  reliabilityBarColor,
  reliabilityLabel,
  reliabilityDotClass,
  CompatBadge,
} from "@/components/ReliabilityBadge";

const COLORS = ['#2d7dff', '#00d4ff', '#6b7a99'];

interface PlayerProfile {
  userId: number;
  reliabilityScore: number;
  noShowCount: number;
  sessionStreak: number;
  behavioralFlags: string[];
  source: string;
}

interface TopMatch {
  id: number;
  name: string;
  level: string;
  archetype: string | null;
  verified: boolean;
  compatibilityScore: number;
  archetypeMatch: boolean;
}

interface FindMatchesResponse {
  matches: TopMatch[];
  noMatchesMessage: string | null;
}

function ArchetypePill({ archetype }: { archetype: string }) {
  const meta = ARCHETYPE_META[archetype as Archetype];
  if (!meta) return null;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border", meta.color, meta.bg, meta.border)}>
      {meta.icon} {meta.nameRu}
    </span>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data: stats, isLoading } = useGetPlayerStats(user?.id || 0, {
    query: { enabled: !!user?.id, queryKey: getGetPlayerStatsQueryKey(user?.id || 0) }
  });

  const { data: reliability, isLoading: reliabilityLoading } = useQuery({
    queryKey: ["player-profile", user?.id],
    queryFn: () => apiFetch<PlayerProfile>(`/players/${user!.id}/profile`),
    enabled: !!user?.id,
    retry: false,
  });

  const { data: topMatches, isLoading: matchesLoading } = useQuery({
    queryKey: ["find-matches", user?.id],
    queryFn: () => apiFetch<FindMatchesResponse>(`/users/find-matches?userId=${user!.id}`),
    enabled: !!user?.id,
    retry: false,
  });

  if (isLoading) return <AppLayout><div className="p-8">{t("profile.loadingProfile")}</div></AppLayout>;

  const archetype = user?.archetype as Archetype | undefined;
  const archetypeMeta = archetype ? ARCHETYPE_META[archetype] : null;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-5 sm:space-y-8">
        <header className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif text-3xl border border-primary/30">
            {user?.name?.[0]}
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-serif">{user?.name}</h1>
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-sm px-3">{user?.level}</Badge>
              {user?.verified && (
                <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 text-sm px-3">✓ {t("common.certified")}</Badge>
              )}
              {archetypeMeta && (
                <Badge variant="outline" className={`text-sm px-3 ${archetypeMeta.color} ${archetypeMeta.bg} ${archetypeMeta.border}`}>
                  {archetypeMeta.icon} {archetypeMeta.nameRu}
                </Badge>
              )}
              {user?.warmUpPreference && (
                <Badge variant="outline" className="text-sm px-3 text-orange-400 bg-orange-500/10 border-orange-500/20">{t("profile.warmupBadge")}</Badge>
              )}
              {reliability && !reliabilityLoading && (
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", reliabilityDotClass(reliability.reliabilityScore))} />
                  <span className={cn("text-sm font-semibold tabular-nums", reliabilityColor(reliability.reliabilityScore))}>
                    {reliability.reliabilityScore} · {reliabilityLabel(reliability.reliabilityScore)}
                  </span>
                </span>
              )}
              {user?.locationName && <span className="text-muted-foreground text-sm">{user.locationName}</span>}
            </div>
            {!archetype && (
              <Link href="/quiz">
                <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10 mt-1">
                  {t("profile.takeArchetypeQuiz")}
                </Button>
              </Link>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card border-white/5 md:col-span-2">
            <CardHeader>
              <CardTitle>{t("profile.levelProgression")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>{t("profile.currentLevel")} {user?.level}</span>
                <span className="text-muted-foreground">{stats?.winsToNextLevel} {t("profile.winsToNext")}</span>
              </div>
              <Progress value={stats?.levelProgress || 0} className="h-3 bg-white/5" />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>D-</span><span>D</span><span>D+</span><span>C-</span><span>C</span><span>C+</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("profile.levelConfidence")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-mono text-accent">{stats?.levelConfidence || 0}%</div>
              <p className="text-xs text-muted-foreground mt-2">{t("profile.confidenceDesc")}</p>
            </CardContent>
          </Card>
        </div>

        {(user?.levelSelf != null || user?.levelQuiz || user?.physicalSelf != null || user?.warmupFormat) && (
          <Card className="bg-card border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("profile.playStyle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {user?.levelSelf != null && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{t("profile.selfAssessed")}</div>
                    <div className="text-2xl font-mono text-primary font-bold">{user.levelSelf}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">/ 5.0</div>
                  </div>
                )}
                {user?.levelQuiz && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{t("profile.quizLevel")}</div>
                    <div className="text-2xl font-mono text-accent font-bold">{user.levelQuiz}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t("profile.certified")}</div>
                  </div>
                )}
                {user?.physicalSelf != null && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{t("profile.physical")}</div>
                    <div className="text-2xl font-mono text-foreground font-bold">{user.physicalSelf}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">/ 10</div>
                  </div>
                )}
                {user?.warmupFormat && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                    <div className="text-xs text-muted-foreground mb-1">{t("profile.warmup")}</div>
                    <div className="text-sm font-medium text-foreground capitalize mt-1">{user.warmupFormat}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t("profile.format")}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Reliability */}
          <Card className="bg-card border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                {t("profile.reliability")}
                {reliability && (
                  <span className={cn("text-sm font-normal", reliabilityColor(reliability.reliabilityScore))}>
                    · {reliability.source === "mongodb" ? t("profile.live") : t("profile.estimated")}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reliabilityLoading ? (
                <div className="text-sm text-muted-foreground animate-pulse">{t("common.loading")}</div>
              ) : !reliability ? (
                <div className="text-sm text-muted-foreground italic">{t("profile.behavioralUnavailable")}</div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">{t("profile.reliabilityScore")}</span>
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
                      <div className="text-xs text-muted-foreground mb-1">{t("profile.noShows")}</div>
                      <div className={cn("text-2xl font-bold tabular-nums", reliability.noShowCount > 0 ? "text-red-400" : "text-emerald-400")}>
                        {reliability.noShowCount}
                      </div>
                      <div className="text-xs text-muted-foreground">{t("profile.totalMissed")}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                      <div className="text-xs text-muted-foreground mb-1">{t("profile.sessionStreak")}</div>
                      <div className={cn("text-2xl font-bold tabular-nums", reliability.sessionStreak >= 3 ? "text-emerald-400" : "text-foreground")}>
                        {reliability.sessionStreak}
                        {reliability.sessionStreak >= 3 && <span className="text-base ml-1">🔥</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{t("profile.consecutive")}</div>
                    </div>
                  </div>
                  {reliability.behavioralFlags.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">{t("profile.flags")}</div>
                      <div className="flex flex-wrap gap-2">
                        {reliability.behavioralFlags.map((flag) => (
                          <Badge key={flag} variant="outline" className="text-xs border-amber-500/30 text-amber-400 bg-amber-500/10">
                            ⚑ {flag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Compatibility */}
          <Card className="bg-card border-white/5">
            <CardHeader className="pb-3">
              <CardTitle>{t("profile.topCompatibility")}</CardTitle>
            </CardHeader>
            <CardContent>
              {!archetype ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t("profile.takeQuizUnlock")}</p>
                  <Link href="/quiz">
                    <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">
                      {t("profile.takeQuiz")}
                    </Button>
                  </Link>
                </div>
              ) : matchesLoading ? (
                <div className="text-sm text-muted-foreground animate-pulse">{t("common.loading")}</div>
              ) : !topMatches?.matches?.length ? (
                <div className="text-sm text-muted-foreground italic">
                  {topMatches?.noMatchesMessage ?? t("profile.noCompatible")}
                </div>
              ) : (
                <div className="space-y-3">
                  {topMatches.matches.map((match) => {
                    const compatNote = archetype && match.archetype
                      ? archetypeCompatibility(archetype, match.archetype as Archetype)
                      : null;
                    return (
                      <div key={match.id} className={cn(
                        "flex items-start gap-3 p-3 rounded-xl border",
                        match.archetypeMatch ? "border-primary/25 bg-primary/5" : "border-white/5 bg-white/[0.02]"
                      )}>
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center text-sm font-serif flex-shrink-0",
                          match.archetypeMatch ? "bg-primary/20 text-primary" : "bg-white/10 text-foreground"
                        )}>
                          {match.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{match.name}</span>
                            {match.verified && <span className="text-accent text-xs">✓</span>}
                            {match.archetypeMatch && (
                              <span className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-full px-1.5 py-0.5">{t("profile.archetypeMatch")}</span>
                            )}
                            <CompatBadge pct={match.compatibilityScore} />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-muted-foreground font-mono">{match.level}</span>
                            {match.archetype && <ArchetypePill archetype={match.archetype} />}
                          </div>
                          {compatNote && (
                            <div className="text-xs text-muted-foreground/60 mt-0.5 truncate">{compatNote}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card border-white/5">
            <CardHeader><CardTitle>{t("profile.winTrend")}</CardTitle></CardHeader>
            <CardContent className="h-64">
              {stats?.winTrend && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.winTrend}>
                    <XAxis dataKey="date" stroke="#6b7a99" fontSize={12} />
                    <YAxis stroke="#6b7a99" fontSize={12} />
                    <Tooltip contentStyle={{backgroundColor: '#0d1420', border: '1px solid rgba(255,255,255,0.1)'}} />
                    <Line type="monotone" dataKey="winRate" stroke="#2d7dff" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-white/5">
            <CardHeader><CardTitle>{t("profile.formatBreakdown")}</CardTitle></CardHeader>
            <CardContent className="h-64 flex items-center justify-center">
              {stats?.formatBreakdown && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.formatBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="count" nameKey="format">
                      {stats.formatBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{backgroundColor: '#0d1420', border: '1px solid rgba(255,255,255,0.1)'}} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
