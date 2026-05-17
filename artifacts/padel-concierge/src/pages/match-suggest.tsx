import { AppLayout } from "@/components/layout/AppLayout";
import { useGetMatchSuggestions, getGetMatchSuggestionsQueryKey } from "@workspace/api-client-react";
import { useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ARCHETYPE_META, type Archetype } from "@/lib/archetypes";
import { apiFetch } from "@/lib/api";

interface PlayerProfile {
  userId: number;
  reliabilityScore: number;
  noShowCount: number;
  sessionStreak: number;
  behavioralFlags: string[];
}

function ArchetypePill({ archetype }: { archetype?: string | null }) {
  if (!archetype) return null;
  const meta = ARCHETYPE_META[archetype as Archetype];
  if (!meta) return null;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border text-xs px-2 py-0.5 font-medium",
      meta.bg, meta.border, meta.color
    )}>
      {meta.icon} {meta.nameRu}
    </span>
  );
}

function RiskWarning({ profile }: { profile?: PlayerProfile }) {
  if (!profile) return null;
  const isLowScore = profile.reliabilityScore < 60;
  const hasFlags = profile.behavioralFlags.length > 0;
  if (!isLowScore && !hasFlags) return null;

  const parts: string[] = [];
  if (isLowScore) parts.push(`надёжность ${profile.reliabilityScore}/100`);
  if (hasFlags) parts.push(profile.behavioralFlags.join(", "));

  return (
    <span
      title={`Предупреждение: ${parts.join(" · ")}`}
      className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5 cursor-help"
    >
      ⚠ Риск
    </span>
  );
}

export default function MatchSuggest() {
  const { user } = useAuth();
  const { data: suggestions, isLoading } = useGetMatchSuggestions(
    { userId: user?.id || 0 },
    { query: { enabled: !!user?.id, queryKey: getGetMatchSuggestionsQueryKey({ userId: user?.id || 0 }) } }
  );

  const allPlayerIds = Array.from(new Set([
    ...(suggestions?.best?.players ?? []).map((p: any) => p.userId),
    ...(suggestions?.balanced?.players ?? []).map((p: any) => p.userId),
    ...(suggestions?.challenging?.players ?? []).map((p: any) => p.userId),
    ...(suggestions?.easy?.players ?? []).map((p: any) => p.userId),
  ].filter(Boolean)));

  const profileQueries = useQueries({
    queries: allPlayerIds.map(id => ({
      queryKey: ["player-profile", id],
      queryFn: () => apiFetch<PlayerProfile>(`/players/${id}/profile`),
      enabled: !!id && allPlayerIds.length > 0,
      staleTime: 60_000,
    })),
  });

  const profileMap: Record<number, PlayerProfile> = {};
  allPlayerIds.forEach((id, i) => {
    const data = profileQueries[i]?.data;
    if (data) profileMap[id] = data;
  });

  const renderCard = (title: string, match: any, type: string) => {
    if (!match) return null;

    const isLocked = type === "best" && !user?.verified;

    return (
      <Card className="bg-card border-white/5 relative overflow-hidden h-full flex flex-col">
        {isLocked && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center border border-white/10">
            <Lock className="w-8 h-8 text-muted-foreground mb-4" />
            <h3 className="font-serif text-xl mb-2">Verification Required</h3>
            <p className="text-sm text-muted-foreground mb-6">Play 1 verification match to unlock Best Match suggestions.</p>
            <Button variant="outline">Learn More</Button>
          </div>
        )}

        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle className="flex justify-between items-center">
            <span>{title}</span>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {match.balanceScore}% Match
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-5">
          <div>
            <div className="font-serif text-xl mb-1">{match.clubName}</div>
            <div className="text-sm text-muted-foreground">{match.date} at {match.time}</div>
          </div>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground mb-1">Players</div>
            {match.players.map((p: any) => {
              const profile = profileMap[p.userId];
              return (
                <div key={p.userId} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-sm gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-medium">{p.name}</span>
                      <RiskWarning profile={profile} />
                    </div>
                    <span className="font-mono text-muted-foreground text-xs shrink-0">{p.level}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.archetype && <ArchetypePill archetype={p.archetype} />}
                    {p.warmUpPreference && (
                      <span className="text-xs text-orange-400/70">🔥 разминка</span>
                    )}
                    {profile && profile.behavioralFlags.length > 0 && (
                      <span className="text-xs text-amber-400/60 italic truncate">
                        {profile.behavioralFlags.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Link href={`/matches/${match.id}`}>
            <Button className="w-full">View Match</Button>
          </Link>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) return <AppLayout><div className="p-8">Analyzing player network...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 sm:space-y-8">
        <header>
          <h1 className="text-3xl font-serif mb-2">Smart Match Suggestions</h1>
          <p className="text-muted-foreground">Curated games based on your level, archetype, and history.</p>
        </header>

        {/* Archetype hint if not set */}
        {!user?.archetype && (
          <div className="bg-primary/8 border border-primary/15 rounded-xl p-4 flex items-center gap-4">
            <div className="text-2xl">🧩</div>
            <div className="flex-1">
              <div className="text-sm font-medium mb-0.5">Узнай свой архетип</div>
              <div className="text-xs text-muted-foreground">Пройди 4-минутный тест для более точного подбора партнёров по стилю игры.</div>
            </div>
            <Link href="/quiz">
              <Button size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 shrink-0">
                Пройти тест
              </Button>
            </Link>
          </div>
        )}

        {/* Show current archetype if set */}
        {user?.archetype && (
          <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground">Твой архетип:</div>
            <ArchetypePill archetype={user.archetype} />
            {user.warmUpPreference && (
              <span className="text-xs text-orange-400/70">🔥 предпочитает разминку</span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {renderCard("Best Match", suggestions?.best, "best")}
          {renderCard("Balanced", suggestions?.balanced, "balanced")}
          {renderCard("Challenging", suggestions?.challenging, "challenging")}
          {renderCard("Easy", suggestions?.easy, "easy")}
        </div>
      </div>
    </AppLayout>
  );
}
