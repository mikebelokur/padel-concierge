import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { ARCHETYPE_META, type Archetype } from "@/lib/archetypes";
import { cn } from "@/lib/utils";
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

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "", 10);

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

  if (isNaN(id)) {
    return (
      <AppLayout>
        <div className="p-8 text-muted-foreground">Invalid player ID.</div>
      </AppLayout>
    );
  }

  if (playerLoading) {
    return (
      <AppLayout>
        <div className="p-8 text-muted-foreground animate-pulse">Loading profile…</div>
      </AppLayout>
    );
  }

  if (!player) {
    return (
      <AppLayout>
        <div className="p-8 text-muted-foreground">Player not found.</div>
      </AppLayout>
    );
  }

  const archetype = player.archetype as Archetype | undefined;
  const archetypeMeta = archetype ? ARCHETYPE_META[archetype] : null;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        {/* Back */}
        <Link href="/members">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
            ← Members
          </Button>
        </Link>

        {/* Header */}
        <header className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif text-3xl border border-primary/30 flex-shrink-0">
            {player.name[0]}
          </div>
          <div className="space-y-2 min-w-0">
            <h1 className="text-2xl font-serif truncate">{player.name}</h1>
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-sm px-3">
                {player.levelQuiz ?? player.level}
              </Badge>
              {player.verified && (
                <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 text-sm px-3">
                  ✓ Certified
                </Badge>
              )}
              {archetypeMeta && (
                <Badge
                  variant="outline"
                  className={`text-sm px-3 ${archetypeMeta.color} ${archetypeMeta.bg} ${archetypeMeta.border}`}
                >
                  {archetypeMeta.icon} {archetypeMeta.nameRu}
                </Badge>
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
            <div className="text-xs text-muted-foreground mb-1">Matches</div>
            <div className="text-3xl font-mono font-bold text-foreground">{player.matchesPlayed}</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
            <div className="text-xs text-muted-foreground mb-1">Wins</div>
            <div className="text-3xl font-mono font-bold text-accent">{player.wins}</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
            <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
            <div className="text-3xl font-mono font-bold text-foreground">
              {player.matchesPlayed > 0 ? Math.round((player.wins / player.matchesPlayed) * 100) : 0}%
            </div>
          </div>
        </div>

        {/* Play Style */}
        {(player.levelSelf != null || player.levelQuiz || player.physicalSelf != null || player.warmupFormat) && (
          <Card className="bg-card border-white/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Play Style</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {player.levelSelf != null && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Self-assessed</div>
                    <div className="text-2xl font-mono text-primary font-bold">{player.levelSelf}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">/ 5.0</div>
                  </div>
                )}
                {player.levelQuiz && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Quiz level</div>
                    <div className="text-2xl font-mono text-accent font-bold">{player.levelQuiz}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">certified</div>
                  </div>
                )}
                {player.physicalSelf != null && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Physical</div>
                    <div className="text-2xl font-mono text-foreground font-bold">{player.physicalSelf}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">/ 10</div>
                  </div>
                )}
                {player.warmupFormat && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Warmup</div>
                    <div className="text-sm font-medium text-foreground capitalize mt-1">{player.warmupFormat}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">format</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reliability */}
        <Card className="bg-card border-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              Reliability
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reliabilityLoading ? (
              <div className="text-sm text-muted-foreground animate-pulse">Loading…</div>
            ) : !reliability ? (
              <div className="text-sm text-muted-foreground italic">No behavioral data available.</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Reliability Score</span>
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
                    <div className="text-xs text-muted-foreground mb-1">No-shows</div>
                    <div className={cn("text-2xl font-bold tabular-nums", reliability.noShowCount > 0 ? "text-red-400" : "text-emerald-400")}>
                      {reliability.noShowCount}
                    </div>
                    <div className="text-xs text-muted-foreground">total missed</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                    <div className="text-xs text-muted-foreground mb-1">Session streak</div>
                    <div className={cn("text-2xl font-bold tabular-nums", reliability.sessionStreak >= 3 ? "text-emerald-400" : "text-foreground")}>
                      {reliability.sessionStreak}
                      {reliability.sessionStreak >= 3 && <span className="text-base ml-1">🔥</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">consecutive</div>
                  </div>
                </div>
                {reliability.behavioralFlags.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Flags</div>
                    <div className="flex flex-wrap gap-2">
                      {reliability.behavioralFlags.map((flag) => (
                        <Badge
                          key={flag}
                          variant="outline"
                          className="text-xs border-amber-500/30 text-amber-400 bg-amber-500/10"
                        >
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

        {/* Play info */}
        <Card className="bg-card border-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Goal</span>
                <div className="font-medium mt-0.5">{player.goal}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Intensity</span>
                <div className="font-medium mt-0.5">{player.intensity}</div>
              </div>
              {player.warmUpPreference && (
                <div>
                  <span className="text-muted-foreground">Warm-up</span>
                  <div className="font-medium mt-0.5 text-orange-400">🔥 Prefers warm-up</div>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Member since</span>
                <div className="font-medium mt-0.5">
                  {new Date(player.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
