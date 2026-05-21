import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { ReliabilityDot } from "@/components/ReliabilityDot";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface ActivityLog {
  id: number;
  userId: number;
  userName: string;
  action: string;
  details: string | null;
  createdAt: string;
}

interface User {
  id: number;
  name: string;
  level: string;
  verified: boolean;
  role: string;
  matchesPlayed: number;
  wins: number;
  locationName: string | null;
  createdAt: string;
  levelSelf: number | null;
  levelQuiz: string | null;
  warmupFormat: string | null;
}

interface PlayerProfile {
  userId: number;
  reliabilityScore: number;
  noShowCount: number;
  sessionStreak: number;
  behavioralFlags: string[];
}

const ACTION_ICONS: Record<string, string> = {
  registered: "🆕",
  logged_in: "🔑",
  match_booked: "📅",
  match_created: "🎾",
  payment_completed: "💳",
  warmup_completed: "🔥",
  verified: "✅",
  video_uploaded: "🎬",
  assessment_completed: "📊",
  match_request_sent: "📨",
  match_request_accepted: "🤝",
  match_request_declined: "❌",
  court_booked: "🏟️",
  updated_availability: "📆",
};

const LEVEL_ORDER = ["D-", "D", "D+", "C-", "C", "C+", "1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];
const LEVEL_INDEX = Object.fromEntries(LEVEL_ORDER.map((l, i) => [l, i]));

type SortKey = "name" | "level" | "reliability" | "matches";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Members() {
  const { user: authUser } = useAuth();
  const isStaff = ["coach", "admin", "owner"].includes(authUser?.role ?? "");

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("reliability");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isVerifying, setIsVerifying] = useState(false);

  const queryClient = useQueryClient();

  const toggleSelect = useCallback((id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleVerify = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || isVerifying) return;
    setIsVerifying(true);
    try {
      await Promise.allSettled(
        ids.map(id => apiFetch(`/users/${id}/verify`, { method: "POST" }))
      );
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedIds(new Set());
    } finally {
      setIsVerifying(false);
    }
  }, [selectedIds, isVerifying, queryClient]);

  const { data: activity = [], isLoading: actLoading } = useQuery({
    queryKey: ["activity", 50],
    queryFn: () => apiFetch<ActivityLog[]>("/stats/activity?limit=50"),
    refetchInterval: 30000,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<User[]>("/users"),
  });

  const players = users.filter((u) => u.role === "player");
  const newMembers = [...players]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);
  const topPlayers = [...players]
    .sort((a, b) => b.matchesPlayed - a.matchesPlayed)
    .slice(0, 5);

  const sidebarIds = Array.from(new Set([...newMembers, ...topPlayers].map((u) => u.id)));
  const rosterIds = isStaff ? players.map((u) => u.id) : [];
  const allTrackedIds = Array.from(new Set([...sidebarIds, ...rosterIds]));

  const profileQueries = useQueries({
    queries: allTrackedIds.map((id) => ({
      queryKey: ["player-profile", id],
      queryFn: () => apiFetch<PlayerProfile>(`/players/${id}/profile`),
      staleTime: 60_000,
    })),
  });

  const profileMap: Record<number, PlayerProfile> = {};
  allTrackedIds.forEach((id, i) => {
    const data = profileQueries[i]?.data;
    if (data) profileMap[id] = data;
  });

  const levelOptions = useMemo(() => {
    const seen = new Set<string>();
    players.forEach(u => seen.add(u.levelQuiz ?? u.level));
    return Array.from(seen).sort((a, b) => (LEVEL_INDEX[a] ?? 99) - (LEVEL_INDEX[b] ?? 99));
  }, [players]);

  const filteredRoster = useMemo(() => {
    let list = [...players];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(u => u.name.toLowerCase().includes(q));
    if (levelFilter !== "all") list = list.filter(u => (u.levelQuiz ?? u.level) === levelFilter);
    list.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "level") {
        const la = LEVEL_INDEX[a.levelQuiz ?? a.level] ?? 99;
        const lb = LEVEL_INDEX[b.levelQuiz ?? b.level] ?? 99;
        return lb - la;
      }
      if (sortKey === "reliability") {
        const ra = profileMap[a.id]?.reliabilityScore ?? 80;
        const rb = profileMap[b.id]?.reliabilityScore ?? 80;
        return rb - ra;
      }
      if (sortKey === "matches") return b.matchesPlayed - a.matchesPlayed;
      return 0;
    });
    return list;
  }, [players, search, levelFilter, sortKey, profileMap]);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-5 sm:space-y-8">
        <header>
          <h1 className="text-3xl font-serif mb-2">Members</h1>
          <p className="text-muted-foreground">Activity from our private community of serious padel players.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Feed */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-medium">Live Activity Feed</h2>
            {actLoading ? (
              <div className="text-muted-foreground text-sm">Loading activity...</div>
            ) : (
              <div className="space-y-2">
                {activity.map((log) => (
                  <Card key={log.id} className="bg-card border-white/5 hover:border-white/10 transition-colors">
                    <CardContent className="p-4 flex items-start gap-4">
                      <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-serif text-sm flex-shrink-0">
                        {log.userName?.[0] ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-medium text-sm">{log.userName}</span>
                            <span className="text-muted-foreground text-sm">
                              {" "}
                              {log.action?.replace(/_/g, " ")}
                              {" "}
                              <span className="text-base">{ACTION_ICONS[log.action] ?? "•"}</span>
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{timeAgo(log.createdAt)}</span>
                        </div>
                        {log.details && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.details}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* New Members */}
            <Card className="bg-card border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">New Members</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {usersLoading ? (
                  <div className="text-muted-foreground text-sm">Loading...</div>
                ) : (
                  newMembers.map((u) => (
                    <Link key={u.id} href={`/players/${u.id}`}>
                      <div className="flex items-center gap-3 cursor-pointer rounded-lg hover:bg-white/5 transition-colors -mx-1 px-1 py-0.5">
                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-serif flex-shrink-0">
                          {u.name[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium flex items-center gap-1.5 truncate">
                            {u.name}
                            {u.verified && <span className="text-accent text-xs">✓</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-xs text-muted-foreground">{u.locationName ?? "Dubai"}</span>
                            {u.levelSelf != null && (
                              <span className="text-xs font-mono text-primary/70 bg-primary/10 border border-primary/15 rounded px-1">
                                {u.levelSelf}★
                              </span>
                            )}
                            {u.warmupFormat && (
                              <span className="text-xs text-muted-foreground/70 capitalize">{u.warmupFormat}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {profileMap[u.id] && profileMap[u.id].behavioralFlags.length > 0 && (
                            <span
                              title={profileMap[u.id].behavioralFlags.join(", ")}
                              className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-1.5 py-0.5 cursor-help"
                            >
                              ⚑ {profileMap[u.id].behavioralFlags.length}
                            </span>
                          )}
                          {profileMap[u.id] && (
                            <ReliabilityDot score={profileMap[u.id].reliabilityScore} />
                          )}
                          <Badge variant="outline" className="text-xs border-white/10 font-mono">{u.levelQuiz ?? u.level}</Badge>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Top Players */}
            <Card className="bg-card border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Top Players</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topPlayers.map((u, i) => (
                  <Link key={u.id} href={`/players/${u.id}`}>
                    <div className="flex items-center gap-3 cursor-pointer rounded-lg hover:bg-white/5 transition-colors -mx-1 px-1 py-0.5">
                      <div className="w-6 text-center text-sm font-mono text-muted-foreground">{i + 1}</div>
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-serif flex-shrink-0">
                        {u.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">{u.matchesPlayed} matches · {u.wins}W</span>
                          {u.levelSelf != null && (
                            <span className="text-xs font-mono text-primary/70 bg-primary/10 border border-primary/15 rounded px-1">
                              {u.levelSelf}★
                            </span>
                          )}
                          {u.warmupFormat && (
                            <span className="text-xs text-muted-foreground/70 capitalize">{u.warmupFormat}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {profileMap[u.id] && profileMap[u.id].behavioralFlags.length > 0 && (
                          <span
                            title={profileMap[u.id].behavioralFlags.join(", ")}
                            className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-1.5 py-0.5 cursor-help"
                          >
                            ⚑ {profileMap[u.id].behavioralFlags.length}
                          </span>
                        )}
                        {profileMap[u.id] && (
                          <ReliabilityDot score={profileMap[u.id].reliabilityScore} />
                        )}
                        <Badge variant="outline" className="text-xs border-white/10 font-mono">{u.levelQuiz ?? u.level}</Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Level Distribution */}
            <Card className="bg-card border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Level Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {["1.0","1.5","2.0","2.5","3.0","3.5","4.0","4.5","5.0"].map((lvl) => {
                  const count = players.filter((u) => u.level === lvl).length;
                  const pct = players.length > 0 ? (count / players.length) * 100 : 0;
                  return count > 0 ? (
                    <div key={lvl} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-8">{lvl}</span>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-4">{count}</span>
                    </div>
                  ) : null;
                })}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Full Roster — coach / admin / owner only */}
        {isStaff && (
          <section className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-medium">Full Roster</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {filteredRoster.length} of {players.length} players
                </p>
              </div>
            </div>

            {/* Floating action bar */}
            {selectedIds.size > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-card border border-white/15 shadow-2xl shadow-black/60 backdrop-blur-md">
                <span className="text-sm font-medium tabular-nums">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                    isVerifying
                      ? "bg-accent/40 text-accent/60 cursor-not-allowed"
                      : "bg-accent text-accent-foreground hover:bg-accent/90"
                  )}
                >
                  {isVerifying ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      Verifying…
                    </>
                  ) : (
                    <>✓ Verify selected</>
                  )}
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Controls */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name…"
                  className="pl-9 bg-white/5 border-white/10 focus:border-primary/50 h-9 text-sm"
                />
              </div>

              {/* Level filter */}
              <select
                value={levelFilter}
                onChange={e => setLevelFilter(e.target.value)}
                className="h-9 px-3 rounded-md bg-white/5 border border-white/10 text-sm text-foreground focus:outline-none focus:border-primary/50 cursor-pointer"
              >
                <option value="all">All levels</option>
                {levelOptions.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>

              {/* Sort */}
              <div className="flex gap-1 rounded-lg bg-white/5 border border-white/8 p-0.5">
                {(["reliability", "level", "matches", "name"] as SortKey[]).map(key => (
                  <button
                    key={key}
                    onClick={() => setSortKey(key)}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-md transition-colors capitalize",
                      sortKey === key
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {key === "reliability" ? "Reliability" :
                     key === "level" ? "Level" :
                     key === "matches" ? "Matches" : "Name"}
                  </button>
                ))}
              </div>
            </div>

            {/* Roster list */}
            {usersLoading ? (
              <div className="text-sm text-muted-foreground animate-pulse">Loading roster…</div>
            ) : filteredRoster.length === 0 ? (
              <div className="text-sm text-muted-foreground italic py-4 text-center">No players match your search.</div>
            ) : (
              <div className="rounded-xl border border-white/8 overflow-hidden">
                {/* Header row */}
                <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-2 bg-white/3 border-b border-white/5 text-xs text-muted-foreground uppercase tracking-wide items-center">
                  <span className="w-5" />
                  <span>Player</span>
                  <span className="text-right w-16">Level</span>
                  <span className="text-right w-20">Reliability</span>
                  <span className="text-right w-16">Matches</span>
                  <span className="text-right w-12">Flags</span>
                </div>

                <div className="divide-y divide-white/5">
                  {filteredRoster.map((u) => {
                    const profile = profileMap[u.id];
                    const isSelected = selectedIds.has(u.id);
                    const isAlreadyVerified = u.verified;
                    return (
                      <div key={u.id} className="relative group">
                        <Link href={`/players/${u.id}`}>
                          <div className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 gap-y-0.5 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer items-center">
                            {/* Checkbox */}
                            <div
                              onClick={e => toggleSelect(u.id, e)}
                              className="flex items-center justify-center w-5 flex-shrink-0"
                            >
                              {isAlreadyVerified ? (
                                <span
                                  title="Already verified"
                                  className="w-4 h-4 rounded flex items-center justify-center bg-accent/20 border border-accent/40 text-accent text-[10px] cursor-default"
                                >
                                  ✓
                                </span>
                              ) : (
                                <span
                                  className={cn(
                                    "w-4 h-4 rounded border transition-colors flex items-center justify-center text-[10px]",
                                    isSelected
                                      ? "bg-primary border-primary text-primary-foreground"
                                      : "border-white/20 hover:border-white/40 bg-white/5"
                                  )}
                                >
                                  {isSelected && "✓"}
                                </span>
                              )}
                            </div>

                            {/* Name + meta */}
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-serif flex-shrink-0">
                                {u.name[0]}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium flex items-center gap-1.5">
                                  <span className="truncate">{u.name}</span>
                                  {u.verified && <span className="text-accent text-xs flex-shrink-0">✓</span>}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {u.locationName && (
                                    <span className="text-xs text-muted-foreground">{u.locationName}</span>
                                  )}
                                  {u.warmupFormat && (
                                    <span className="text-xs text-muted-foreground/60 capitalize">{u.warmupFormat}</span>
                                  )}
                                  {u.levelSelf != null && (
                                    <span className="text-xs font-mono text-primary/60 bg-primary/8 border border-primary/12 rounded px-1">
                                      {u.levelSelf}★
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Mobile: right column summary */}
                            <div className="flex sm:hidden items-center gap-2 flex-shrink-0">
                              <Badge variant="outline" className="text-xs border-white/10 font-mono">
                                {u.levelQuiz ?? u.level}
                              </Badge>
                              {profile && <ReliabilityDot score={profile.reliabilityScore} />}
                            </div>

                            {/* Desktop columns */}
                            <div className="hidden sm:flex justify-end w-16">
                              <Badge variant="outline" className="text-xs border-white/10 font-mono">
                                {u.levelQuiz ?? u.level}
                              </Badge>
                            </div>

                            <div className="hidden sm:flex justify-end items-center gap-1.5 w-20">
                              {profile ? (
                                <>
                                  <ReliabilityDot score={profile.reliabilityScore} />
                                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                                    {profile.reliabilityScore}
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground/40">—</span>
                              )}
                            </div>

                            <div className="hidden sm:flex justify-end w-16">
                              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                                {u.matchesPlayed}
                              </span>
                            </div>

                            <div className="hidden sm:flex justify-end w-12">
                              {profile && profile.behavioralFlags.length > 0 ? (
                                <span
                                  title={profile.behavioralFlags.join(", ")}
                                  className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-1.5 py-0.5 cursor-help"
                                >
                                  ⚑ {profile.behavioralFlags.length}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/30">—</span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </AppLayout>
  );
}
