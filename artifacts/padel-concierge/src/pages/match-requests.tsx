import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ARCHETYPE_META, archetypeCompatibility, type Archetype } from "@/lib/archetypes";

interface MatchRequest {
  id: number;
  fromUserId: number;
  toUserId: number;
  message: string | null;
  status: string;
  proposedDate: string | null;
  proposedTime: string | null;
  createdAt: string;
  fromUser: { id: number; name: string; level: string; verified: boolean } | null;
  toUser: { id: number; name: string; level: string; verified: boolean } | null;
}

interface User {
  id: number;
  name: string;
  level: string;
  verified: boolean;
  locationName: string | null;
  matchesPlayed: number;
  archetype: string | null;
  warmUpPreference: boolean;
  skillDiff?: number;
  archetypeMatch?: boolean;
  priority?: number;
}

const STATUS_STYLES: Record<string, string> = {
  pending:   "text-amber-400 bg-amber-400/10 border-amber-400/20",
  accepted:  "text-green-400 bg-green-400/10 border-green-400/20",
  declined:  "text-red-400 bg-red-400/10 border-red-400/20",
  cancelled: "text-muted-foreground bg-white/5 border-white/10",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ArchetypePill({ archetype, size = "sm" }: { archetype: string | null; size?: "sm" | "xs" }) {
  if (!archetype) return null;
  const meta = ARCHETYPE_META[archetype as Archetype];
  if (!meta) return null;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border font-medium",
      meta.bg, meta.border, meta.color,
      size === "xs" ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1"
    )}>
      {meta.icon} {meta.nameRu}
    </span>
  );
}

function PlayerCard({
  player,
  onSelect,
  myArchetype,
}: {
  player: User;
  onSelect: (p: User) => void;
  myArchetype: string | null;
}) {
  const isArchetypeMatch = player.archetypeMatch;
  const compatNote = myArchetype && player.archetype
    ? archetypeCompatibility(myArchetype as Archetype, player.archetype as Archetype)
    : null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border",
        isArchetypeMatch
          ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
          : "border-white/5 hover:bg-white/5 hover:border-white/10"
      )}
      onClick={() => onSelect(player)}
    >
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-serif flex-shrink-0",
        isArchetypeMatch ? "bg-primary/20 text-primary" : "bg-white/10 text-foreground"
      )}>
        {player.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{player.name}</span>
          {player.verified && <span className="text-accent text-xs">✓</span>}
          {isArchetypeMatch && (
            <span className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
              Совпадение
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-muted-foreground font-mono">{player.level}</span>
          {player.archetype && <ArchetypePill archetype={player.archetype} size="xs" />}
          {player.warmUpPreference && (
            <span className="text-xs text-orange-400/70">🔥 разминка</span>
          )}
        </div>
        {compatNote && (
          <div className="text-xs text-muted-foreground/60 mt-0.5 truncate">{compatNote}</div>
        )}
      </div>
    </div>
  );
}

export default function MatchRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"received" | "sent">("received");
  const [showSend, setShowSend] = useState(false);
  const [dialogTab, setDialogTab] = useState<"smart" | "search">("smart");
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<User | null>(null);
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [message, setMessage] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["match-requests", user?.id],
    queryFn: () => apiFetch<MatchRequest[]>(`/match-requests?userId=${user?.id}`),
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<User[]>("/users"),
  });

  const { data: smartMatches } = useQuery({
    queryKey: ["find-matches", user?.id],
    queryFn: () => apiFetch<{ matches: User[]; noMatchesMessage: string | null }>(`/users/find-matches?userId=${user?.id}`),
    enabled: !!user?.id && showSend,
  });

  const received = requests.filter((r) => r.toUserId === user?.id);
  const sent = requests.filter((r) => r.fromUserId === user?.id);

  const respondMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/match-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: (_data, vars) => {
      toast({ title: vars.status === "accepted" ? "Match request accepted!" : "Request declined" });
      qc.invalidateQueries({ queryKey: ["match-requests"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => apiFetch("/match-requests", {
      method: "POST",
      body: JSON.stringify({
        fromUserId: user?.id,
        toUserId: selectedPlayer?.id,
        message: message || null,
        proposedDate: proposedDate || null,
        proposedTime: proposedTime || null,
      }),
    }),
    onSuccess: () => {
      toast({ title: "Match request sent!", description: `Request sent to ${selectedPlayer?.name}` });
      qc.invalidateQueries({ queryKey: ["match-requests"] });
      setShowSend(false);
      setSelectedPlayer(null);
      setMessage("");
      setProposedDate("");
      setProposedTime("");
    },
    onError: (e: Error) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  const candidates = (allUsers as User[]).filter(
    (u) => u.id !== user?.id && u.name.toLowerCase().includes(search.toLowerCase())
  );

  const today = new Date().toISOString().split("T")[0];

  function handleOpenSend() {
    setShowSend(true);
    setDialogTab("smart");
    setSelectedPlayer(null);
    setSearch("");
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-5 sm:space-y-8">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-serif mb-2">Match Requests</h1>
            <p className="text-muted-foreground">Send, receive, and manage match invitations.</p>
          </div>
          <Button onClick={handleOpenSend} className="shadow-lg shadow-primary/20">
            Send Request
          </Button>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 bg-card border border-white/5 rounded-lg p-1 w-fit">
          {(["received", "sent"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
              <span className="ml-1.5 text-xs opacity-70">
                {t === "received" ? received.length : sent.length}
              </span>
            </button>
          ))}
        </div>

        {/* Request List */}
        {isLoading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-3">
            {(tab === "received" ? received : sent).length === 0 ? (
              <Card className="bg-card border-white/5">
                <CardContent className="p-8 text-center text-muted-foreground">
                  {tab === "received" ? "No match requests received yet." : "You haven't sent any requests yet."}
                </CardContent>
              </Card>
            ) : (
              (tab === "received" ? received : sent).map((r) => {
                const other = tab === "received" ? r.fromUser : r.toUser;
                return (
                  <Card key={r.id} className="bg-card border-white/5 hover:border-white/10 transition-colors">
                    <CardContent className="p-5 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-serif flex-shrink-0">
                        {other?.name?.[0] ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium flex items-center gap-2 flex-wrap">
                              {other?.name}
                              {other?.verified && <span className="text-accent text-xs">✓</span>}
                              <Badge variant="outline" className="text-xs border-white/10 font-mono">
                                {other?.level}
                              </Badge>
                            </div>
                            {r.proposedDate && (
                              <div className="text-sm text-muted-foreground mt-0.5">
                                Proposed: {r.proposedDate}{r.proposedTime ? ` at ${r.proposedTime}` : ""}
                              </div>
                            )}
                            {r.message && (
                              <p className="text-sm text-muted-foreground mt-1 italic">"{r.message}"</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <Badge variant="outline" className={`text-xs capitalize ${STATUS_STYLES[r.status]}`}>
                              {r.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                          </div>
                        </div>

                        {tab === "received" && r.status === "pending" && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              onClick={() => respondMutation.mutate({ id: r.id, status: "accepted" })}
                              disabled={respondMutation.isPending}
                              className="shadow-sm shadow-primary/20"
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/10 text-muted-foreground hover:text-foreground"
                              onClick={() => respondMutation.mutate({ id: r.id, status: "declined" })}
                              disabled={respondMutation.isPending}
                            >
                              Decline
                            </Button>
                          </div>
                        )}

                        {tab === "sent" && r.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 border-white/10 text-muted-foreground"
                            onClick={() => respondMutation.mutate({ id: r.id, status: "cancelled" })}
                          >
                            Cancel Request
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* Send Request Modal */}
        <Dialog open={showSend} onOpenChange={setShowSend}>
          <DialogContent className="bg-card border-white/10 text-foreground max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Send Match Request</DialogTitle>
            </DialogHeader>

            {!selectedPlayer ? (
              <div className="space-y-4 mt-1">
                {/* Dialog tabs */}
                <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                  <button
                    onClick={() => setDialogTab("smart")}
                    className={cn(
                      "flex-1 py-1.5 rounded-md text-xs font-medium transition-colors",
                      dialogTab === "smart" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    🎯 Умный подбор
                  </button>
                  <button
                    onClick={() => setDialogTab("search")}
                    className={cn(
                      "flex-1 py-1.5 rounded-md text-xs font-medium transition-colors",
                      dialogTab === "search" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    🔍 Поиск
                  </button>
                </div>

                {/* Smart matches tab */}
                {dialogTab === "smart" && (
                  <div className="space-y-3">
                    {!user?.archetype && (
                      <div className="text-xs text-muted-foreground bg-yellow-500/8 border border-yellow-500/20 rounded-xl p-3">
                        💡 Пройди тест, чтобы получить подбор по архетипу — сейчас показаны ближайшие по уровню.
                      </div>
                    )}
                    {smartMatches?.noMatchesMessage ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        <div className="text-2xl mb-2">🔍</div>
                        {smartMatches.noMatchesMessage}
                      </div>
                    ) : !smartMatches ? (
                      <div className="text-center py-6 text-sm text-muted-foreground">Поиск игроков...</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground/60 mb-1">
                          Топ-3 игрока по совместимости
                        </div>
                        {smartMatches.matches.map((p) => (
                          <PlayerCard
                            key={p.id}
                            player={p}
                            onSelect={setSelectedPlayer}
                            myArchetype={user?.archetype ?? null}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Search tab */}
                {dialogTab === "search" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-sm">Поиск игроков</Label>
                      <Input
                        placeholder="Имя игрока..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-background border-white/10"
                      />
                    </div>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {candidates.map((p) => (
                        <PlayerCard
                          key={p.id}
                          player={p}
                          onSelect={setSelectedPlayer}
                          myArchetype={user?.archetype ?? null}
                        />
                      ))}
                      {candidates.length === 0 && search && (
                        <div className="text-center py-4 text-sm text-muted-foreground">Игроков не найдено</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 mt-1">
                {/* Selected player summary */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif">
                      {selectedPlayer.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{selectedPlayer.name}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">{selectedPlayer.level}</span>
                        {selectedPlayer.archetype && <ArchetypePill archetype={selectedPlayer.archetype} size="xs" />}
                      </div>
                    </div>
                    <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedPlayer(null)}>
                      Изменить
                    </button>
                  </div>

                  {/* Warmup compatibility note */}
                  {user?.archetype && selectedPlayer.archetype && (
                    <div className="text-xs text-muted-foreground/70 border-t border-white/8 pt-2">
                      {archetypeCompatibility(user.archetype as Archetype, selectedPlayer.archetype as Archetype)}
                    </div>
                  )}

                  {/* Warmup hint */}
                  {selectedPlayer.warmUpPreference && (
                    <div className="mt-2 text-xs text-orange-300/80 bg-orange-500/8 border border-orange-500/15 rounded-lg p-2">
                      🔥 Этот игрок предпочитает разминку перед матчем — учти это при планировании.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Дата</Label>
                    <Input
                      type="date"
                      min={today}
                      value={proposedDate}
                      onChange={(e) => setProposedDate(e.target.value)}
                      className="bg-background border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Время</Label>
                    <Input
                      type="time"
                      value={proposedTime}
                      onChange={(e) => setProposedTime(e.target.value)}
                      className="bg-background border-white/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Сообщение (необязательно)</Label>
                  <Input
                    placeholder="Сыграем в эти выходные?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="bg-background border-white/10"
                  />
                </div>

                <Button
                  className="w-full shadow-lg shadow-primary/20"
                  onClick={() => sendMutation.mutate()}
                  disabled={sendMutation.isPending}
                >
                  {sendMutation.isPending ? "Отправка..." : `Отправить запрос → ${selectedPlayer.name}`}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
