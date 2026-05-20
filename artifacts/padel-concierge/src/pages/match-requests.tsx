import { useState } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ARCHETYPE_META, archetypeCompatibility, type Archetype } from "@/lib/archetypes";
import { ReliabilityDot, CompatBadge } from "@/components/ReliabilityBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface TrainerRequest {
  id: number;
  playerId: number;
  format: string;
  venue: string;
  requestedDate: string;
  requestedTime: string;
  notes: string;
  status: string;
  assignedMatchId: number | null;
  createdAt: string;
  player: { id: number; name: string; level: string; archetype: string | null } | null;
}

interface Candidate {
  id: number;
  name: string;
  level: string;
  archetype: string | null;
  verified: boolean;
  matchesPlayed: number;
  compatibility: number;
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
  compatibilityScore?: number;
}

interface PlayerProfile {
  userId: number;
  reliabilityScore: number;
  noShowCount: number;
  sessionStreak: number;
  behavioralFlags: string[];
  source?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending:   "text-amber-400 bg-amber-400/10 border-amber-400/20",
  accepted:  "text-green-400 bg-green-400/10 border-green-400/20",
  declined:  "text-red-400 bg-red-400/10 border-red-400/20",
  cancelled: "text-muted-foreground bg-white/5 border-white/10",
  assigned:  "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

const VENUES = ["Padel Edition", "Al Qasr Padel", "Где угодно"];
const FORMATS = ["4v4", "3v3", "2v2"];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins}м назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}ч назад`;
  return `${Math.floor(hrs / 24)}д назад`;
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

function CompatBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-primary" : "bg-amber-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn(
        "text-xs font-mono font-semibold w-8 text-right",
        pct >= 80 ? "text-green-400" : pct >= 60 ? "text-primary" : "text-amber-400"
      )}>{pct}%</span>
    </div>
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

// ─── Player card for smart-match list ─────────────────────────────────────────

function PlayerCard({
  player,
  onSelect,
  myArchetype,
  reliability,
}: {
  player: User;
  onSelect: (p: User) => void;
  myArchetype: string | null;
  reliability?: PlayerProfile;
}) {
  const isArchetypeMatch = player.archetypeMatch;
  const compatNote = myArchetype && player.archetype
    ? archetypeCompatibility(myArchetype as Archetype, player.archetype as Archetype)
    : null;
  const compatPct = player.compatibilityScore;
  const reliabilityScore = reliability?.reliabilityScore;
  const isScoreOverridden = !!(reliability?.source && reliability.source.includes("pg-override"));

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
            <span className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">Совпадение</span>
          )}
          {compatPct !== undefined && <CompatBadge pct={compatPct} />}
          <RiskWarning profile={reliability} />
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-muted-foreground font-mono">{player.level}</span>
          {player.archetype && <ArchetypePill archetype={player.archetype} size="xs" />}
          {reliabilityScore !== undefined && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <span className="text-muted-foreground/50">·</span>
              <ReliabilityDot score={reliabilityScore} />
              {isScoreOverridden && (
                <span
                  title="Score overridden by coach"
                  className="text-xs text-blue-400/70 font-mono"
                >✎</span>
              )}
            </span>
          )}
        </div>
        {compatNote && <div className="text-xs text-muted-foreground/60 mt-0.5 truncate">{compatNote}</div>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MatchRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isCoach = user?.role === "coach" || user?.role === "admin" || user?.role === "owner";

  // ── Tab state ──
  const [mainTab, setMainTab] = useState<"personal" | "trainer">("personal");
  const [personalTab, setPersonalTab] = useState<"received" | "sent">("received");

  // ── Send-to-player dialog ──
  const [showSend, setShowSend] = useState(false);
  const [dialogTab, setDialogTab] = useState<"smart" | "search">("smart");
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<User | null>(null);
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [message, setMessage] = useState("");

  // ── Trainer request form (player side) ──
  const [trFormat, setTrFormat] = useState("4v4");
  const [trVenue, setTrVenue] = useState("Padel Edition");
  const [trDate, setTrDate] = useState("");
  const [trTime, setTrTime] = useState("18:00");
  const [trNotes, setTrNotes] = useState("");

  // ── Coach assignment modal ──
  const [assignTarget, setAssignTarget] = useState<TrainerRequest | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<number[]>([]);

  const today = new Date().toISOString().split("T")[0];

  // ── Queries ──
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

  const smartMatchIds = smartMatches?.matches.map(m => m.id) ?? [];
  const profileQueries = useQueries({
    queries: smartMatchIds.map(id => ({
      queryKey: ["player-profile", id],
      queryFn: () => apiFetch<PlayerProfile>(`/players/${id}/profile`),
      enabled: !!id,
      staleTime: 60_000,
    })),
  });
  const profileMap: Record<number, PlayerProfile> = {};
  smartMatchIds.forEach((id, i) => {
    const data = profileQueries[i]?.data;
    if (data) profileMap[id] = data;
  });

  const { data: trainerRequests = [] } = useQuery({
    queryKey: ["trainer-match-requests", user?.id, isCoach],
    queryFn: () => isCoach
      ? apiFetch<TrainerRequest[]>("/trainer-match-requests")
      : apiFetch<TrainerRequest[]>(`/trainer-match-requests?playerId=${user?.id}`),
    enabled: !!user?.id,
    refetchInterval: 20000,
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates", assignTarget?.playerId],
    queryFn: () => apiFetch<Candidate[]>(`/trainer-match-requests/candidates?playerId=${assignTarget?.playerId}`),
    enabled: !!assignTarget,
  });

  const candidateIds = (candidates as Candidate[]).map(c => c.id);
  const candidateProfileQueries = useQueries({
    queries: candidateIds.map(id => ({
      queryKey: ["player-profile", id],
      queryFn: () => apiFetch<PlayerProfile>(`/players/${id}/profile`),
      enabled: !!id && !!assignTarget,
      staleTime: 60_000,
    })),
  });
  const candidateProfileMap: Record<number, PlayerProfile> = {};
  candidateIds.forEach((id, i) => {
    const data = candidateProfileQueries[i]?.data;
    if (data) candidateProfileMap[id] = data;
  });

  // ── Mutations ──
  const received = (requests as MatchRequest[]).filter(r => r.toUserId === user?.id);
  const sent = (requests as MatchRequest[]).filter(r => r.fromUserId === user?.id);

  const respondMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/match-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: (_data, vars) => {
      toast({ title: vars.status === "accepted" ? "Запрос принят!" : "Запрос отклонён" });
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
      toast({ title: "Запрос отправлен!", description: `Запрос к ${selectedPlayer?.name}` });
      qc.invalidateQueries({ queryKey: ["match-requests"] });
      setShowSend(false);
      setSelectedPlayer(null);
      setMessage(""); setProposedDate(""); setProposedTime("");
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const trainerRequestMutation = useMutation({
    mutationFn: () => apiFetch("/trainer-match-requests", {
      method: "POST",
      body: JSON.stringify({
        playerId: user?.id,
        format: trFormat,
        venue: trVenue,
        requestedDate: trDate,
        requestedTime: trTime,
        notes: trNotes,
      }),
    }),
    onSuccess: () => {
      toast({ title: "Запрос отправлен тренеру ✓" });
      qc.invalidateQueries({ queryKey: ["trainer-match-requests"] });
      setTrDate(""); setTrNotes(""); setTrTime("18:00");
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignTarget) return;
      const allPlayerIds = [assignTarget.playerId, ...selectedCandidates];
      const match = await apiFetch("/matches", {
        method: "POST",
        body: JSON.stringify({
          date: assignTarget.requestedDate,
          time: assignTarget.requestedTime,
          clubName: assignTarget.venue,
          format: assignTarget.format,
          playerIds: allPlayerIds,
          matchType: "balanced",
        }),
      });
      await apiFetch(`/trainer-match-requests/${assignTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "assigned", assignedMatchId: (match as any).id }),
      });
      return match;
    },
    onSuccess: () => {
      toast({ title: "Матч создан ✓", description: "Партнёры назначены" });
      qc.invalidateQueries({ queryKey: ["trainer-match-requests"] });
      qc.invalidateQueries({ queryKey: ["match"] });
      setAssignTarget(null);
      setSelectedCandidates([]);
    },
    onError: (e: Error) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  function toggleCandidate(id: number) {
    setSelectedCandidates(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  }

  const pendingTrainer = (trainerRequests as TrainerRequest[]).filter(r => r.status === "pending");
  const myTrainerRequests = (trainerRequests as TrainerRequest[]).filter(r => !isCoach);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-5 sm:space-y-8">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-serif mb-2">Запросы на матч</h1>
            <p className="text-muted-foreground text-sm">Личные приглашения и запросы к тренеру</p>
          </div>
          {mainTab === "personal" && (
            <Button onClick={() => { setShowSend(true); setDialogTab("smart"); setSelectedPlayer(null); setSearch(""); }} className="shadow-lg shadow-primary/20">
              Пригласить
            </Button>
          )}
        </header>

        {/* Main tabs */}
        <div className="flex gap-1 bg-card border border-white/5 rounded-lg p-1 w-fit">
          <button
            onClick={() => setMainTab("personal")}
            className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              mainTab === "personal" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Личные
            <span className="ml-1.5 text-xs opacity-70">{received.length + sent.length}</span>
          </button>
          <button
            onClick={() => setMainTab("trainer")}
            className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              mainTab === "trainer" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isCoach ? "Запросы игроков" : "К тренеру"}
            {isCoach && pendingTrainer.length > 0 && (
              <span className="ml-1.5 text-xs bg-amber-400/20 text-amber-400 rounded-full px-1.5">{pendingTrainer.length}</span>
            )}
          </button>
        </div>

        {/* ── PERSONAL TAB ── */}
        {mainTab === "personal" && (
          <div className="space-y-4">
            <div className="flex gap-1 bg-card border border-white/5 rounded-lg p-1 w-fit">
              {(["received", "sent"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setPersonalTab(t)}
                  className={cn("px-3 py-1 rounded-md text-sm transition-colors capitalize",
                    personalTab === t ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "received" ? "Полученные" : "Отправленные"}
                  <span className="ml-1.5 text-xs opacity-70">{t === "received" ? received.length : sent.length}</span>
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="text-muted-foreground text-sm">Загрузка...</div>
            ) : (
              <div className="space-y-3">
                {(personalTab === "received" ? received : sent).length === 0 ? (
                  <Card className="bg-card border-white/5">
                    <CardContent className="p-8 text-center text-muted-foreground text-sm">
                      {personalTab === "received" ? "Нет входящих запросов" : "Нет отправленных запросов"}
                    </CardContent>
                  </Card>
                ) : (
                  (personalTab === "received" ? received : sent).map(r => {
                    const other = personalTab === "received" ? r.fromUser : r.toUser;
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
                                  <Badge variant="outline" className="text-xs border-white/10 font-mono">{other?.level}</Badge>
                                </div>
                                {r.proposedDate && (
                                  <div className="text-sm text-muted-foreground mt-0.5">
                                    {r.proposedDate}{r.proposedTime ? ` в ${r.proposedTime}` : ""}
                                  </div>
                                )}
                                {r.message && <p className="text-sm text-muted-foreground mt-1 italic">"{r.message}"</p>}
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <Badge variant="outline" className={cn("text-xs capitalize", STATUS_STYLES[r.status])}>{r.status}</Badge>
                                <span className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                              </div>
                            </div>

                            {personalTab === "received" && r.status === "pending" && (
                              <div className="flex gap-2 mt-3">
                                <Button size="sm" onClick={() => respondMutation.mutate({ id: r.id, status: "accepted" })} disabled={respondMutation.isPending}>Принять</Button>
                                <Button size="sm" variant="outline" className="border-white/10 text-muted-foreground" onClick={() => respondMutation.mutate({ id: r.id, status: "declined" })} disabled={respondMutation.isPending}>Отклонить</Button>
                              </div>
                            )}
                            {personalTab === "sent" && r.status === "pending" && (
                              <Button size="sm" variant="outline" className="mt-3 border-white/10 text-muted-foreground" onClick={() => respondMutation.mutate({ id: r.id, status: "cancelled" })}>
                                Отменить
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
          </div>
        )}

        {/* ── TRAINER TAB ── */}
        {mainTab === "trainer" && (
          <div className="space-y-4">
            {/* ─ PLAYER VIEW: request form + my requests ─ */}
            {!isCoach && (
              <>
                <Card className="bg-card border-white/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Запросить матч у тренера</CardTitle>
                    <p className="text-xs text-muted-foreground">Мы подберём для тебя подходящих партнёров</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Format */}
                    <div className="space-y-2">
                      <Label className="text-sm">Формат матча</Label>
                      <div className="flex gap-2">
                        {FORMATS.map(f => (
                          <button
                            key={f}
                            onClick={() => setTrFormat(f)}
                            className={cn(
                              "flex-1 py-2 rounded-xl border text-sm font-medium transition-colors",
                              trFormat === f ? "border-primary/40 bg-primary/10 text-primary" : "border-white/10 text-muted-foreground hover:border-white/20"
                            )}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Venue */}
                    <div className="space-y-2">
                      <Label className="text-sm">Место</Label>
                      <div className="flex flex-col gap-2">
                        {VENUES.map(v => (
                          <button
                            key={v}
                            onClick={() => setTrVenue(v)}
                            className={cn(
                              "py-2 px-4 rounded-xl border text-sm text-left transition-colors",
                              trVenue === v ? "border-primary/40 bg-primary/10 text-primary" : "border-white/10 text-muted-foreground hover:border-white/20"
                            )}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Date + Time */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-sm">Дата</Label>
                        <Input type="date" min={today} value={trDate} onChange={e => setTrDate(e.target.value)} className="bg-background border-white/10" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Время</Label>
                        <Input type="time" value={trTime} onChange={e => setTrTime(e.target.value)} className="bg-background border-white/10" />
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label className="text-sm">Пожелания (необязательно)</Label>
                      <Textarea
                        placeholder="Хочу интенсивную игру, ищу партнёров схожего уровня…"
                        value={trNotes}
                        onChange={e => setTrNotes(e.target.value)}
                        rows={2}
                        className="bg-background border-white/10 resize-none text-sm"
                      />
                    </div>

                    <Button
                      className="w-full shadow-lg shadow-primary/20"
                      onClick={() => trainerRequestMutation.mutate()}
                      disabled={trainerRequestMutation.isPending || !trDate}
                    >
                      {trainerRequestMutation.isPending ? "Отправка…" : "📩 Отправить запрос тренеру"}
                    </Button>
                  </CardContent>
                </Card>

                {/* My trainer requests */}
                {myTrainerRequests.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Мои запросы</div>
                    {myTrainerRequests.map(r => (
                      <Card key={r.id} className="bg-card border-white/5">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-sm">{r.format} · {r.venue}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{r.requestedDate} в {r.requestedTime}</div>
                              {r.notes && <div className="text-xs text-muted-foreground/60 mt-1 italic">"{r.notes}"</div>}
                            </div>
                            <Badge variant="outline" className={cn("text-xs capitalize shrink-0", STATUS_STYLES[r.status])}>
                              {r.status === "pending" ? "Ожидание" : r.status === "assigned" ? "Матч создан" : r.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ─ COACH VIEW: incoming player requests ─ */}
            {isCoach && (
              <div className="space-y-3">
                {pendingTrainer.length === 0 && (trainerRequests as TrainerRequest[]).filter(r => r.status === "assigned").length === 0 ? (
                  <Card className="bg-card border-white/5">
                    <CardContent className="p-8 text-center text-muted-foreground text-sm">
                      Нет входящих запросов от игроков
                    </CardContent>
                  </Card>
                ) : (
                  (trainerRequests as TrainerRequest[]).map(r => (
                    <Card key={r.id} className={cn("border transition-colors", r.status === "pending" ? "bg-card border-amber-500/10" : "bg-card border-white/5")}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif shrink-0">
                              {r.player?.name?.[0] ?? "?"}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{r.player?.name ?? "Игрок"}</div>
                              <div className="text-xs text-muted-foreground font-mono">{r.player?.level}</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant="outline" className={cn("text-xs", STATUS_STYLES[r.status])}>
                              {r.status === "pending" ? "Ожидает" : r.status === "assigned" ? "Назначен" : r.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                          <div className="rounded-lg bg-white/5 px-2 py-1.5">
                            <div className="text-muted-foreground">Формат</div>
                            <div className="font-medium mt-0.5">{r.format}</div>
                          </div>
                          <div className="rounded-lg bg-white/5 px-2 py-1.5">
                            <div className="text-muted-foreground">Дата</div>
                            <div className="font-medium mt-0.5">{r.requestedDate}</div>
                          </div>
                          <div className="rounded-lg bg-white/5 px-2 py-1.5">
                            <div className="text-muted-foreground">Время</div>
                            <div className="font-medium mt-0.5">{r.requestedTime}</div>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground mb-3">📍 {r.venue}</div>
                        {r.notes && <div className="text-xs text-muted-foreground/70 italic mb-3">"{r.notes}"</div>}

                        {r.status === "pending" && (
                          <Button
                            size="sm"
                            className="w-full shadow-sm shadow-primary/20"
                            onClick={() => { setAssignTarget(r); setSelectedCandidates([]); }}
                          >
                            🎯 Назначить партнёров
                          </Button>
                        )}
                        {r.status === "assigned" && (
                          <div className="text-xs text-blue-400">✓ Матч #{r.assignedMatchId} создан</div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SEND-TO-PLAYER DIALOG ── */}
      <Dialog open={showSend} onOpenChange={setShowSend}>
        <DialogContent className="bg-card border-white/10 text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Пригласить игрока</DialogTitle>
          </DialogHeader>

          {!selectedPlayer ? (
            <div className="space-y-4 mt-1">
              <div className="flex gap-1 bg-white/5 rounded-lg p-1">
                {(["smart", "search"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setDialogTab(t)}
                    className={cn("flex-1 py-1.5 rounded-md text-xs font-medium transition-colors",
                      dialogTab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t === "smart" ? "🎯 Умный подбор" : "🔍 Поиск"}
                  </button>
                ))}
              </div>

              {dialogTab === "smart" && (
                <div className="space-y-3">
                  {!user?.archetype && (
                    <div className="text-xs text-muted-foreground bg-yellow-500/8 border border-yellow-500/20 rounded-xl p-3">
                      💡 Пройди тест для подбора по архетипу — сейчас показаны ближайшие по уровню.
                    </div>
                  )}
                  {!smartMatches ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">Поиск игроков...</div>
                  ) : smartMatches.noMatchesMessage ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">{smartMatches.noMatchesMessage}</div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs text-muted-foreground/60">Топ-3 по совместимости</span>
                        <span
                          title={"● Совместимость (%) — учитывает уровень игры, архетип и историю матчей\n● Надёжность (точка) — зелёная ≥80, жёлтая ≥55, красная <55 — посещаемость и поведение на корте"}
                          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-muted-foreground/30 text-muted-foreground/50 text-[10px] leading-none cursor-help hover:border-muted-foreground/60 hover:text-muted-foreground transition-colors"
                        >
                          ?
                        </span>
                      </div>
                      {smartMatches.matches.map(p => (
                        <PlayerCard key={p.id} player={p} onSelect={setSelectedPlayer} myArchetype={user?.archetype ?? null} reliability={profileMap[p.id]} />
                      ))}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 border-t border-white/8 mt-1">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                          надёжный
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                          средний
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                          ненадёжный
                        </span>
                        <span className="text-[11px] text-muted-foreground/50 ml-auto">% — совместимость</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {dialogTab === "search" && (
                <div className="space-y-3">
                  <Input placeholder="Имя игрока..." value={search} onChange={e => setSearch(e.target.value)} className="bg-background border-white/10" />
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {(allUsers as User[]).filter(u => u.id !== user?.id && u.name.toLowerCase().includes(search.toLowerCase())).map(p => (
                      <PlayerCard key={p.id} player={p} onSelect={setSelectedPlayer} myArchetype={user?.archetype ?? null} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 mt-1">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif">{selectedPlayer.name[0]}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{selectedPlayer.name}</span>
                      {selectedPlayer.compatibilityScore !== undefined && (
                        <CompatBadge pct={selectedPlayer.compatibilityScore} />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">{selectedPlayer.level}</span>
                      {selectedPlayer.archetype && <ArchetypePill archetype={selectedPlayer.archetype} size="xs" />}
                      {selectedPlayer.id && profileMap[selectedPlayer.id] && (
                        <ReliabilityDot score={profileMap[selectedPlayer.id].reliabilityScore} />
                      )}
                    </div>
                  </div>
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedPlayer(null)}>Изменить</button>
                </div>
                {user?.archetype && selectedPlayer.archetype && (
                  <div className="text-xs text-muted-foreground/70 border-t border-white/8 pt-2">
                    {archetypeCompatibility(user.archetype as Archetype, selectedPlayer.archetype as Archetype)}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">Дата</Label>
                  <Input type="date" min={today} value={proposedDate} onChange={e => setProposedDate(e.target.value)} className="bg-background border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Время</Label>
                  <Input type="time" value={proposedTime} onChange={e => setProposedTime(e.target.value)} className="bg-background border-white/10" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Сообщение (необязательно)</Label>
                <Input placeholder="Сыграем на этих выходных?" value={message} onChange={e => setMessage(e.target.value)} className="bg-background border-white/10" />
              </div>

              <Button className="w-full shadow-lg shadow-primary/20" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
                {sendMutation.isPending ? "Отправка..." : `Отправить запрос → ${selectedPlayer.name}`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── ASSIGN PARTNERS MODAL (coach) ── */}
      <Dialog open={!!assignTarget} onOpenChange={open => !open && setAssignTarget(null)}>
        <DialogContent className="bg-card border-white/10 text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Назначить партнёров</DialogTitle>
            {assignTarget && (
              <p className="text-sm text-muted-foreground">
                {assignTarget.player?.name} · {assignTarget.format} · {assignTarget.requestedDate} {assignTarget.requestedTime}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="text-xs text-muted-foreground">
              Выбери до 3 партнёров для {assignTarget?.player?.name}. Отсортировано по совместимости.
            </div>

            {selectedCandidates.length > 0 && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                <div className="text-xs text-muted-foreground mb-2">Выбрано: {selectedCandidates.length}/3</div>
                <div className="flex flex-wrap gap-1">
                  {selectedCandidates.map(id => {
                    const c = (candidates as Candidate[]).find(x => x.id === id);
                    return c ? (
                      <span key={id} className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
                        {c.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {(candidates as Candidate[]).map(c => {
                const selected = selectedCandidates.includes(c.id);
                const maxReached = selectedCandidates.length >= 3 && !selected;
                const cProfile = candidateProfileMap[c.id];
                return (
                  <div
                    key={c.id}
                    onClick={() => !maxReached && toggleCandidate(c.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all",
                      maxReached ? "opacity-40 cursor-not-allowed border-white/5" :
                      selected ? "border-primary/40 bg-primary/8 cursor-pointer" : "border-white/5 hover:border-white/15 cursor-pointer"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-serif shrink-0",
                      selected ? "bg-primary/20 text-primary" : "bg-white/10"
                    )}>
                      {c.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{c.name}</span>
                        {c.verified && <span className="text-accent text-xs">✓</span>}
                        <span className="text-xs text-muted-foreground font-mono">{c.level}</span>
                        {c.archetype && <ArchetypePill archetype={c.archetype} size="xs" />}
                        <RiskWarning profile={cProfile} />
                      </div>
                      <CompatBar pct={c.compatibility} />
                      {cProfile && cProfile.behavioralFlags.length > 0 && (
                        <div className="text-xs text-amber-400/60 italic mt-0.5 truncate">
                          {cProfile.behavioralFlags.join(", ")}
                        </div>
                      )}
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                      selected ? "bg-primary border-primary text-white" : "border-white/20"
                    )}>
                      {selected && <span className="text-xs leading-none">✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              className="w-full shadow-lg shadow-primary/20"
              onClick={() => assignMutation.mutate()}
              disabled={assignMutation.isPending || selectedCandidates.length === 0}
            >
              {assignMutation.isPending ? "Создание матча…" : `⚡ Создать матч (${1 + selectedCandidates.length} игроков)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
