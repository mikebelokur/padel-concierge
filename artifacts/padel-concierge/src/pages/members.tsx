import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

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

function levelLabel(level: string) {
  const n = parseFloat(level);
  if (isNaN(n)) return level;
  if (n < 2.0) return "Beginner";
  if (n < 3.0) return "Intermediate";
  if (n < 4.0) return "Advanced";
  return "Elite";
}

export default function Members() {
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
                    <div key={u.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-serif flex-shrink-0">
                        {u.name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium flex items-center gap-1.5 truncate">
                          {u.name}
                          {u.verified && <span className="text-accent text-xs">✓</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.locationName ?? "Dubai"}</div>
                      </div>
                      <Badge variant="outline" className="text-xs border-white/10 font-mono">{u.level}</Badge>
                    </div>
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
                  <div key={u.id} className="flex items-center gap-3">
                    <div className="w-6 text-center text-sm font-mono text-muted-foreground">{i + 1}</div>
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-serif flex-shrink-0">
                      {u.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.matchesPlayed} matches · {u.wins}W</div>
                    </div>
                    <Badge variant="outline" className="text-xs border-white/10 font-mono">{u.level}</Badge>
                  </div>
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
      </div>
    </AppLayout>
  );
}
