import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ARCHETYPE_META, archetypeCompatibility, type Archetype } from "@/lib/archetypes";
import { ReliabilityDot, CompatBadge } from "@/components/ReliabilityBadge";
import { translateError, type Lang } from "@/lib/errorMessages";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchRequest {
  id: number;
  fromUserId: number;
  toUserId: number;
  message: string | null;
  status: string;
  proposedDate: string | null;
  proposedTime: string | null;
  matchId: number | null;
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

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  pending:   { bg: "rgba(212,175,55,0.12)",  border: "rgba(212,175,55,0.3)",  color: "#D4AF37" },
  accepted:  { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)",   color: "#4ade80" },
  declined:  { bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.25)",  color: "#f87171" },
  cancelled: { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" },
  assigned:  { bg: "rgba(100,180,255,0.10)", border: "rgba(100,180,255,0.3)", color: "#64b4ff" },
};

function statusStyle(s: string) {
  return STATUS_STYLES[s] ?? STATUS_STYLES.pending;
}

const FORMATS = ["4v4", "3v3", "2v2"];

function useVenues(t: (k: string) => string) {
  return ["Padel Edition", "Al Qasr Padel", t("matchRequests.trainer.anywhere")];
}

function useTimeAgo() {
  const { t } = useLanguage();
  return (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("matchRequests.timeAgo.justNow");
    if (mins < 60) return t("matchRequests.timeAgo.minutes").replace("{{n}}", String(mins));
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t("matchRequests.timeAgo.hours").replace("{{n}}", String(hrs));
    return t("matchRequests.timeAgo.days").replace("{{n}}", String(Math.floor(hrs / 24)));
  };
}

function ArchetypePill({ archetype, size = "sm" }: { archetype: string | null; size?: "sm" | "xs" }) {
  const { language } = useLanguage();
  if (!archetype) return null;
  const meta = ARCHETYPE_META[archetype as Archetype];
  if (!meta) return null;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border font-medium",
      meta.bg, meta.border, meta.color,
      size === "xs" ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1"
    )}>
      {meta.icon} {language === "en" ? meta.name : meta.nameRu}
    </span>
  );
}

function CompatBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: pct >= 80 ? "#D4AF37" : pct >= 60 ? "rgba(100,180,255,0.8)" : "#f59e0b",
          }}
        />
      </div>
      <span
        className="text-xs font-mono font-semibold w-8 text-right"
        style={{ color: pct >= 80 ? "#D4AF37" : pct >= 60 ? "#94a3b8" : "#f59e0b" }}
      >
        {pct}%
      </span>
    </div>
  );
}

function RiskWarning({ profile }: { profile?: PlayerProfile }) {
  const { t } = useLanguage();
  if (!profile) return null;
  const isLowScore = profile.reliabilityScore < 60;
  const hasFlags = profile.behavioralFlags.length > 0;
  if (!isLowScore && !hasFlags) return null;

  const parts: string[] = [];
  if (isLowScore) parts.push(t("matchRequests.reliabilityScore").replace("{{score}}", String(profile.reliabilityScore)));
  if (hasFlags) parts.push(profile.behavioralFlags.join(", "));

  return (
    <span
      title={t("matchRequests.riskTitle").replace("{{details}}", parts.join(" · "))}
      className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 cursor-help"
      style={{ color: "#f59e0b", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}
    >
      {t("matchRequests.risk")}
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
  const { t } = useLanguage();
  const isArchetypeMatch = player.archetypeMatch;
  const compatNote = myArchetype && player.archetype
    ? archetypeCompatibility(myArchetype as Archetype, player.archetype as Archetype)
    : null;
  const compatPct = player.compatibilityScore;
  const reliabilityScore = reliability?.reliabilityScore;
  const isScoreOverridden = !!(reliability?.source && reliability.source.includes("pg-override"));

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-[14px] cursor-pointer transition-all"
      style={{
        border: `1px solid ${isArchetypeMatch ? "rgba(212,175,55,0.3)" : "rgba(255,255,255,0.07)"}`,
        background: isArchetypeMatch ? "rgba(212,175,55,0.06)" : "transparent",
      }}
      onClick={() => onSelect(player)}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-serif flex-shrink-0"
        style={{
          background: isArchetypeMatch ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.08)",
          color: isArchetypeMatch ? "#D4AF37" : "rgba(255,255,255,0.8)",
        }}
      >
        {player.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-white">{player.name}</span>
          {player.verified && <span style={{ color: "#D4AF37", fontSize: "12px" }}>✓</span>}
          {isArchetypeMatch && (
            <span
              className="text-xs rounded-full px-2 py-0.5"
              style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.3)", color: "#D4AF37" }}
            >
              {t("matchRequests.matchBadge")}
            </span>
          )}
          {(player as any).isBeta && (
            <span
              className="text-xs font-bold rounded-full px-2 py-0.5"
              style={{ background: "rgba(100,180,255,0.12)", border: "1px solid rgba(100,180,255,0.3)", color: "#64b4ff" }}
            >
              {t("userSegmentation.betaBadge")}
            </span>
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
                <span title="Score overridden by coach" className="text-xs font-mono" style={{ color: "rgba(100,180,255,0.7)" }}>✎</span>
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
  const { t, language } = useLanguage();
  const lang: Lang = language === "en" ? "en" : "ru";
  const { toast } = useToast();
  const timeAgo = useTimeAgo();
  const VENUES = useVenues(t);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const isCoach = user?.role === "coach" || user?.role === "admin" || user?.role === "owner";

  const [showLevelGate, setShowLevelGate] = useState(false);
  const hasLevel = !user || !!user.level;

  const [mainTab, setMainTab] = useState<"personal" | "trainer">("personal");
  const [personalTab, setPersonalTab] = useState<"received" | "sent">("received");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [trainerStatusFilter, setTrainerStatusFilter] = useState<string>("all");

  const [showSend, setShowSend] = useState(false);
  const [dialogTab, setDialogTab] = useState<"smart" | "search">("smart");
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<User | null>(null);
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [message, setMessage] = useState("");

  const [trFormat, setTrFormat] = useState("4v4");
  const [trVenue, setTrVenue] = useState("Padel Edition");
  const [trDate, setTrDate] = useState("");
  const [trTime, setTrTime] = useState("18:00");
  const [trNotes, setTrNotes] = useState("");

  const [assignTarget, setAssignTarget] = useState<TrainerRequest | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<number[]>([]);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    localStorage.setItem("matchRequestsLastVisit", new Date().toISOString());
    qc.invalidateQueries({ queryKey: ["pending-requests-count"] });
  }, []);

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

  const received = (requests as MatchRequest[]).filter(r => r.toUserId === user?.id);
  const sent = (requests as MatchRequest[]).filter(r => r.fromUserId === user?.id);

  const respondMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch<MatchRequest>(`/match-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: (data, vars) => {
      if (vars.status === "accepted" && (data as MatchRequest).matchId) {
        const matchId = (data as MatchRequest).matchId;
        toast({
          title: t("matchRequests.toasts.acceptedWithMatch"),
          description: t("matchRequests.toasts.acceptedWithMatchDesc"),
          action: (
            <button
              onClick={() => navigate(`/matches/${matchId}`)}
              className="rounded-full font-semibold px-3 py-1 text-xs"
              style={{ background: "#D4AF37", color: "#000" }}
            >
              {t("matchRequests.toasts.openMatch")}
            </button>
          ),
        });
      } else {
        toast({ title: vars.status === "accepted" ? t("matchRequests.toasts.accepted") : t("matchRequests.toasts.declined") });
      }
      qc.invalidateQueries({ queryKey: ["match-requests"] });
      qc.invalidateQueries({ queryKey: ["match"] });
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
      toast({
        title: t("matchRequests.toasts.sent"),
        description: t("matchRequests.toasts.sentDesc").replace("{{name}}", selectedPlayer?.name ?? ""),
      });
      qc.invalidateQueries({ queryKey: ["match-requests"] });
      setShowSend(false);
      setSelectedPlayer(null);
      setMessage(""); setProposedDate(""); setProposedTime("");
    },
    onError: (e: unknown) => toast({ title: t("matchRequests.toasts.error"), description: translateError(e, lang).message, variant: "destructive" }),
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
      toast({ title: t("matchRequests.toasts.trainerSent") });
      qc.invalidateQueries({ queryKey: ["trainer-match-requests"] });
      setTrDate(""); setTrNotes(""); setTrTime("18:00");
    },
    onError: (e: unknown) => toast({ title: t("matchRequests.toasts.error"), description: translateError(e, lang).message, variant: "destructive" }),
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
      toast({ title: t("matchRequests.toasts.matchCreated"), description: t("matchRequests.toasts.partnersAssigned") });
      qc.invalidateQueries({ queryKey: ["trainer-match-requests"] });
      qc.invalidateQueries({ queryKey: ["match"] });
      setAssignTarget(null);
      setSelectedCandidates([]);
    },
    onError: (e: unknown) => toast({ title: t("matchRequests.toasts.error"), description: translateError(e, lang).message, variant: "destructive" }),
  });

  function toggleCandidate(id: number) {
    setSelectedCandidates(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  }

  const pendingTrainer = (trainerRequests as TrainerRequest[]).filter(r => r.status === "pending");
  const myTrainerRequests = (trainerRequests as TrainerRequest[]).filter(() => !isCoach);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 animate-fade-up" style={{ paddingTop: "28px" }}>

        {/* ── HEADER ── */}
        <header className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-serif font-bold text-white mb-1" style={{ fontSize: "26px" }}>
              {t("matchRequests.title")}
            </h1>
            <p className="text-muted-foreground" style={{ fontSize: "15px" }}>
              {t("matchRequests.subtitle")}
            </p>
          </div>
          {mainTab === "personal" && (
            <button
              onClick={() => {
                if (!hasLevel) { setShowLevelGate(true); return; }
                setShowSend(true); setDialogTab("smart"); setSelectedPlayer(null); setSearch("");
              }}
              className="rounded-full font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] flex-shrink-0"
              style={{ height: "44px", padding: "0 20px", fontSize: "15px", background: "#D4AF37", color: "#000" }}
            >
              {t("matchRequests.invite")}
            </button>
          )}
        </header>

        {/* ── MAIN TABS ── */}
        <div
          className="flex gap-1 rounded-[14px] p-1 mb-6"
          style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {(["personal", "trainer"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              className="flex-1 rounded-[10px] font-medium transition-all"
              style={{
                height: "40px",
                fontSize: "14px",
                background: mainTab === tab ? "rgba(212,175,55,0.15)" : "transparent",
                border: mainTab === tab ? "1px solid rgba(212,175,55,0.3)" : "1px solid transparent",
                color: mainTab === tab ? "#D4AF37" : "rgba(255,255,255,0.5)",
              }}
            >
              {tab === "personal" ? (
                <>{t("matchRequests.tabs.personal")} <span style={{ opacity: 0.6, fontSize: "12px" }}>{received.length + sent.length}</span></>
              ) : (
                <>
                  {isCoach ? t("matchRequests.tabs.playerRequests") : t("matchRequests.tabs.trainer")}
                  {isCoach && pendingTrainer.length > 0 && (
                    <span
                      className="ml-1.5 rounded-full px-1.5 text-xs"
                      style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}
                    >
                      {pendingTrainer.length}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* ── PERSONAL TAB ── */}
        {mainTab === "personal" && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-2">
              {(["received", "sent"] as const).map(sub => (
                <button
                  key={sub}
                  onClick={() => { setPersonalTab(sub); setStatusFilter("all"); }}
                  className="rounded-full font-medium transition-all"
                  style={{
                    height: "34px",
                    padding: "0 16px",
                    fontSize: "13px",
                    background: personalTab === sub ? "rgba(255,255,255,0.1)" : "transparent",
                    border: `1px solid ${personalTab === sub ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"}`,
                    color: personalTab === sub ? "#fff" : "rgba(255,255,255,0.45)",
                  }}
                >
                  {sub === "received" ? t("matchRequests.subTabs.received") : t("matchRequests.subTabs.sent")}
                  <span style={{ marginLeft: "6px", opacity: 0.6, fontSize: "11px" }}>
                    {sub === "received" ? received.length : sent.length}
                  </span>
                </button>
              ))}
            </div>

            {/* Status filter chips */}
            {(() => {
              const pool = personalTab === "received" ? received : sent;
              const statuses = ["all", ...Array.from(new Set(pool.map(r => r.status)))];
              if (statuses.length <= 2) return null;
              return (
                <div className="flex gap-2 flex-wrap">
                  {statuses.map(s => {
                    const isActive = statusFilter === s;
                    const ss = s === "all" ? null : statusStyle(s);
                    return (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className="rounded-full font-medium capitalize transition-all"
                        style={{
                          height: "30px",
                          padding: "0 12px",
                          fontSize: "12px",
                          background: isActive
                            ? (ss ? ss.bg : "rgba(255,255,255,0.1)")
                            : "transparent",
                          border: `1px solid ${isActive ? (ss ? ss.border : "rgba(255,255,255,0.2)") : "rgba(255,255,255,0.07)"}`,
                          color: isActive ? (ss ? ss.color : "#fff") : "rgba(255,255,255,0.4)",
                        }}
                      >
                        {s === "all" ? t("matchRequests.filter.all") : (t(`matchRequests.status.${s}`) ?? s)}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="rounded-[20px] animate-pulse" style={{ height: "100px", background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const pool = personalTab === "received" ? received : sent;
                  const filtered = statusFilter === "all" ? pool : pool.filter(r => r.status === statusFilter);
                  return filtered;
                })().length === 0 ? (
                  <div
                    className="rounded-[20px] p-8 text-center"
                    style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <div className="text-muted-foreground" style={{ fontSize: "14px" }}>
                      {statusFilter !== "all"
                        ? t("matchRequests.empty.withStatus").replace("{{status}}", t(`matchRequests.status.${statusFilter}`) ?? statusFilter)
                        : personalTab === "received" ? t("matchRequests.empty.noIncoming") : t("matchRequests.empty.noSent")}
                    </div>
                  </div>
                ) : (
                  (() => {
                    const pool = personalTab === "received" ? received : sent;
                    return statusFilter === "all" ? pool : pool.filter(r => r.status === statusFilter);
                  })().map(r => {
                    const other = personalTab === "received" ? r.fromUser : r.toUser;
                    const ss = statusStyle(r.status);
                    return (
                      <div
                        key={r.id}
                        className="rounded-[20px] p-5"
                        style={{
                          background: "hsl(220 20% 6%)",
                          border: `1px solid ${r.status === "pending" ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.07)"}`,
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-serif flex-shrink-0"
                            style={{ background: "rgba(212,175,55,0.15)", color: "#D4AF37" }}
                          >
                            {other?.name?.[0] ?? "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium text-white flex items-center gap-2 flex-wrap" style={{ fontSize: "15px" }}>
                                  {other?.name}
                                  {other?.verified && <span style={{ color: "#D4AF37", fontSize: "12px" }}>✓</span>}
                                  <span
                                    className="rounded-full px-2 py-0.5 font-mono"
                                    style={{ fontSize: "11px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}
                                  >
                                    {other?.level}
                                  </span>
                                </div>
                                {r.proposedDate && (
                                  <div className="text-muted-foreground mt-0.5" style={{ fontSize: "13px" }}>
                                    {r.proposedDate}{r.proposedTime ? ` ${t("matchRequests.at")} ${r.proposedTime}` : ""}
                                  </div>
                                )}
                                {r.message && (
                                  <p className="text-muted-foreground mt-1 italic" style={{ fontSize: "13px" }}>"{r.message}"</p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <span
                                  className="rounded-full px-3 py-1 font-medium"
                                  style={{ fontSize: "12px", background: ss.bg, border: `1px solid ${ss.border}`, color: ss.color }}
                                >
                                  {t(`matchRequests.status.${r.status}`) ?? r.status}
                                </span>
                                <span className="text-muted-foreground" style={{ fontSize: "11px" }}>{timeAgo(r.createdAt)}</span>
                              </div>
                            </div>

                            {personalTab === "received" && r.status === "pending" && (
                              <div className="flex gap-2 mt-4">
                                <button
                                  onClick={() => respondMutation.mutate({ id: r.id, status: "accepted" })}
                                  disabled={respondMutation.isPending}
                                  className="rounded-full font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                  style={{ height: "40px", padding: "0 20px", fontSize: "14px", background: "#D4AF37", color: "#000" }}
                                >
                                  {t("matchRequests.actions.accept")}
                                </button>
                                <button
                                  onClick={() => respondMutation.mutate({ id: r.id, status: "declined" })}
                                  disabled={respondMutation.isPending}
                                  className="rounded-full font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                  style={{ height: "40px", padding: "0 20px", fontSize: "14px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}
                                >
                                  {t("matchRequests.actions.decline")}
                                </button>
                              </div>
                            )}
                            {r.status === "accepted" && r.matchId && (
                              <button
                                onClick={() => navigate(`/matches/${r.matchId}`)}
                                className="mt-3 rounded-full font-medium transition-all hover:scale-[1.02] active:scale-[0.98] inline-flex items-center gap-1.5"
                                style={{ height: "36px", padding: "0 16px", fontSize: "13px", background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.3)", color: "#D4AF37" }}
                              >
                                {t("matchRequests.actions.goToMatch")}
                              </button>
                            )}
                            {personalTab === "sent" && r.status === "pending" && (
                              <button
                                onClick={() => respondMutation.mutate({ id: r.id, status: "cancelled" })}
                                className="mt-3 rounded-full font-medium transition-all"
                                style={{ height: "36px", padding: "0 16px", fontSize: "13px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
                              >
                                {t("matchRequests.actions.cancel")}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
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

            {/* ─ PLAYER VIEW ─ */}
            {!isCoach && (
              <>
                {/* Request form */}
                <div
                  className="rounded-[20px] p-5"
                  style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div className="mb-4">
                    <div className="font-serif font-semibold text-white mb-0.5" style={{ fontSize: "16px" }}>
                      {t("matchRequests.trainer.title")}
                    </div>
                    <div className="text-muted-foreground" style={{ fontSize: "13px" }}>
                      {t("matchRequests.trainer.subtitle")}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Format */}
                    <div className="space-y-2">
                      <Label className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{t("matchRequests.trainer.format")}</Label>
                      <div className="flex gap-2">
                        {FORMATS.map(f => (
                          <button
                            key={f}
                            onClick={() => setTrFormat(f)}
                            className="flex-1 rounded-[12px] font-medium transition-all"
                            style={{
                              height: "44px",
                              fontSize: "14px",
                              background: trFormat === f ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.04)",
                              border: `1px solid ${trFormat === f ? "rgba(212,175,55,0.4)" : "rgba(255,255,255,0.1)"}`,
                              color: trFormat === f ? "#D4AF37" : "rgba(255,255,255,0.5)",
                            }}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Venue */}
                    <div className="space-y-2">
                      <Label className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{t("matchRequests.trainer.venue")}</Label>
                      <div className="flex flex-col gap-2">
                        {VENUES.map(v => (
                          <button
                            key={v}
                            onClick={() => setTrVenue(v)}
                            className="rounded-[12px] text-left px-4 font-medium transition-all"
                            style={{
                              height: "44px",
                              fontSize: "14px",
                              background: trVenue === v ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.04)",
                              border: `1px solid ${trVenue === v ? "rgba(212,175,55,0.4)" : "rgba(255,255,255,0.1)"}`,
                              color: trVenue === v ? "#D4AF37" : "rgba(255,255,255,0.5)",
                            }}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Date + Time */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{t("matchRequests.trainer.date")}</Label>
                        <Input type="date" min={today} value={trDate} onChange={e => setTrDate(e.target.value)} className="bg-background border-white/10 rounded-[12px]" style={{ height: "44px" }} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{t("matchRequests.trainer.time")}</Label>
                        <Input type="time" value={trTime} onChange={e => setTrTime(e.target.value)} className="bg-background border-white/10 rounded-[12px]" style={{ height: "44px" }} />
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{t("matchRequests.trainer.notesLabel")}</Label>
                      <Textarea
                        placeholder={t("matchRequests.trainer.notesPlaceholder")}
                        value={trNotes}
                        onChange={e => setTrNotes(e.target.value)}
                        rows={2}
                        className="bg-background border-white/10 resize-none text-sm rounded-[12px]"
                      />
                    </div>

                    <button
                      onClick={() => {
                        if (!hasLevel) { setShowLevelGate(true); return; }
                        trainerRequestMutation.mutate();
                      }}
                      disabled={trainerRequestMutation.isPending || !trDate}
                      className="w-full rounded-[14px] font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                      style={{ height: "52px", fontSize: "15px", background: "#D4AF37", color: "#000" }}
                    >
                      {trainerRequestMutation.isPending ? t("matchRequests.trainer.submitting") : t("matchRequests.trainer.submit")}
                    </button>
                  </div>
                </div>

                {/* My trainer requests */}
                {myTrainerRequests.length > 0 && (
                  <div className="space-y-3">
                    <div
                      className="uppercase font-semibold"
                      style={{ fontSize: "11px", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}
                    >
                      {t("matchRequests.trainer.myRequests")}
                    </div>
                    {myTrainerRequests.map(r => {
                      const ss = statusStyle(r.status);
                      return (
                        <div
                          key={r.id}
                          className="rounded-[20px] p-4"
                          style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-white" style={{ fontSize: "14px" }}>{r.format} · {r.venue}</div>
                              <div className="text-muted-foreground mt-0.5" style={{ fontSize: "12px" }}>{r.requestedDate} {t("matchRequests.at")} {r.requestedTime}</div>
                              {r.notes && <div className="text-muted-foreground/60 mt-1 italic" style={{ fontSize: "12px" }}>"{r.notes}"</div>}
                            </div>
                            <span
                              className="rounded-full px-3 py-1 font-medium shrink-0"
                              style={{ fontSize: "12px", background: ss.bg, border: `1px solid ${ss.border}`, color: ss.color }}
                            >
                              {r.status === "pending" ? t("matchRequests.trainerStatus.pending") : r.status === "assigned" ? t("matchRequests.trainerStatus.assigned") : r.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ─ COACH VIEW ─ */}
            {isCoach && (
              <div className="space-y-3">
                {/* Trainer status filter chips */}
                {(trainerRequests as TrainerRequest[]).length > 0 && (() => {
                  const statuses = ["all", ...Array.from(new Set((trainerRequests as TrainerRequest[]).map(r => r.status)))];
                  if (statuses.length <= 2) return null;
                  return (
                    <div className="flex gap-2 flex-wrap">
                      {statuses.map(s => {
                        const isActive = trainerStatusFilter === s;
                        const ss = s === "all" ? null : statusStyle(s);
                        return (
                          <button
                            key={s}
                            onClick={() => setTrainerStatusFilter(s)}
                            className="rounded-full font-medium transition-all"
                            style={{
                              height: "30px",
                              padding: "0 12px",
                              fontSize: "12px",
                              background: isActive ? (ss ? ss.bg : "rgba(255,255,255,0.1)") : "transparent",
                              border: `1px solid ${isActive ? (ss ? ss.border : "rgba(255,255,255,0.2)") : "rgba(255,255,255,0.07)"}`,
                              color: isActive ? (ss ? ss.color : "#fff") : "rgba(255,255,255,0.4)",
                            }}
                          >
                            {s === "all" ? t("matchRequests.filter.all") : s === "pending" ? t("matchRequests.trainerStatus.pending") : s === "assigned" ? t("matchRequests.trainerStatus.assigned") : s}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {(() => {
                  const filtered = trainerStatusFilter === "all"
                    ? (trainerRequests as TrainerRequest[])
                    : (trainerRequests as TrainerRequest[]).filter(r => r.status === trainerStatusFilter);
                  return filtered.length === 0 ? (
                    <div
                      className="rounded-[20px] p-8 text-center"
                      style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      <div className="text-muted-foreground" style={{ fontSize: "14px" }}>
                        {trainerStatusFilter !== "all"
                          ? t("matchRequests.empty.withStatus").replace("{{status}}", t(`matchRequests.trainerStatus.${trainerStatusFilter}`) ?? trainerStatusFilter)
                          : t("matchRequests.empty.noPlayerRequests")}
                      </div>
                    </div>
                  ) : null;
                })()}

                {(trainerStatusFilter === "all"
                  ? (trainerRequests as TrainerRequest[])
                  : (trainerRequests as TrainerRequest[]).filter(r => r.status === trainerStatusFilter)
                ).map(r => {
                    const ss = statusStyle(r.status);
                    return (
                      <div
                        key={r.id}
                        className="rounded-[20px] p-5"
                        style={{
                          background: "hsl(220 20% 6%)",
                          border: `1px solid ${r.status === "pending" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.07)"}`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-serif shrink-0"
                              style={{ background: "rgba(212,175,55,0.15)", color: "#D4AF37" }}
                            >
                              {r.player?.name?.[0] ?? "?"}
                            </div>
                            <div>
                              <div className="font-medium text-white" style={{ fontSize: "15px" }}>{r.player?.name ?? t("matchRequests.player")}</div>
                              <div className="font-mono text-muted-foreground" style={{ fontSize: "12px" }}>{r.player?.level}</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span
                              className="rounded-full px-3 py-1 font-medium"
                              style={{ fontSize: "12px", background: ss.bg, border: `1px solid ${ss.border}`, color: ss.color }}
                            >
                              {r.status === "pending" ? t("matchRequests.trainerStatus.pending") : r.status === "assigned" ? t("matchRequests.trainerStatus.assigned") : r.status}
                            </span>
                            <span className="text-muted-foreground" style={{ fontSize: "11px" }}>{timeAgo(r.createdAt)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-4">
                          {[
                            { label: t("matchRequests.trainer.format"), value: r.format },
                            { label: t("matchRequests.trainer.date"), value: r.requestedDate },
                            { label: t("matchRequests.trainer.time"), value: r.requestedTime },
                          ].map(({ label, value }) => (
                            <div key={label} className="rounded-[10px] px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                              <div className="text-muted-foreground" style={{ fontSize: "11px" }}>{label}</div>
                              <div className="font-medium text-white mt-0.5" style={{ fontSize: "13px" }}>{value}</div>
                            </div>
                          ))}
                        </div>

                        <div className="text-muted-foreground mb-3" style={{ fontSize: "13px" }}>📍 {r.venue}</div>
                        {r.notes && <div className="text-muted-foreground/70 italic mb-4" style={{ fontSize: "12px" }}>"{r.notes}"</div>}

                        {r.status === "pending" && (
                          <button
                            onClick={() => { setAssignTarget(r); setSelectedCandidates([]); }}
                            className="w-full rounded-[14px] font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
                            style={{ height: "48px", fontSize: "14px", background: "#D4AF37", color: "#000" }}
                          >
                            {t("matchRequests.actions.assignPartners")}
                          </button>
                        )}
                        {r.status === "assigned" && (
                          <div style={{ fontSize: "13px", color: "#64b4ff" }}>{t("matchRequests.matchCreated").replace("{{id}}", String(r.assignedMatchId))}</div>
                        )}
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>
        )}

        <div style={{ height: "32px" }} />
      </div>

      {/* ── SEND-TO-PLAYER DIALOG ── */}
      <Dialog open={showSend} onOpenChange={setShowSend}>
        <DialogContent className="bg-card border-white/10 text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{t("matchRequests.dialog.invitePlayer")}</DialogTitle>
          </DialogHeader>

          {!selectedPlayer ? (
            <div className="space-y-4 mt-1">
              <div
                className="flex gap-1 rounded-[12px] p-1"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {(["smart", "search"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setDialogTab(tab)}
                    className="flex-1 rounded-[9px] font-medium transition-all"
                    style={{
                      height: "36px",
                      fontSize: "13px",
                      background: dialogTab === tab ? "rgba(212,175,55,0.15)" : "transparent",
                      color: dialogTab === tab ? "#D4AF37" : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {tab === "smart" ? t("matchRequests.dialog.smartMatch") : t("matchRequests.dialog.search")}
                  </button>
                ))}
              </div>

              {dialogTab === "smart" && (
                <div className="space-y-3">
                  {!user?.archetype && (
                    <div
                      className="text-xs rounded-[12px] p-3"
                      style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", color: "rgba(255,255,255,0.7)" }}
                    >
                      {t("matchRequests.dialog.takeQuizHint")}
                    </div>
                  )}
                  {!smartMatches ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">{t("matchRequests.dialog.searching")}</div>
                  ) : smartMatches.noMatchesMessage ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">{smartMatches.noMatchesMessage}</div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs text-muted-foreground/60">{t("matchRequests.dialog.topThree")}</span>
                        <span
                          title={t("matchRequests.dialog.infoTooltip")}
                          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border text-muted-foreground/50 text-[10px] leading-none cursor-help hover:text-muted-foreground transition-colors"
                          style={{ borderColor: "rgba(255,255,255,0.2)" }}
                        >
                          ?
                        </span>
                      </div>
                      {smartMatches.matches.map(p => (
                        <PlayerCard key={p.id} player={p} onSelect={setSelectedPlayer} myArchetype={user?.archetype ?? null} reliability={profileMap[p.id]} />
                      ))}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 mt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                        {[
                          { color: "#4ade80", label: t("matchRequests.dialog.reliable") },
                          { color: "#facc15", label: t("matchRequests.dialog.average") },
                          { color: "#f87171", label: t("matchRequests.dialog.unreliable") },
                        ].map(({ color, label }) => (
                          <span key={label} className="flex items-center gap-1" style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                            <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                            {label}
                          </span>
                        ))}
                        <span className="ml-auto" style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{t("matchRequests.dialog.compatLegend")}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {dialogTab === "search" && (
                <div className="space-y-3">
                  <Input placeholder={t("matchRequests.dialog.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} className="bg-background border-white/10" />
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
              <div
                className="rounded-[14px] p-4"
                style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)" }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-serif"
                    style={{ background: "rgba(212,175,55,0.2)", color: "#D4AF37" }}
                  >
                    {selectedPlayer.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white" style={{ fontSize: "14px" }}>{selectedPlayer.name}</span>
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
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setSelectedPlayer(null)}
                  >
                    {t("matchRequests.dialog.change")}
                  </button>
                </div>
                {user?.archetype && selectedPlayer.archetype && (
                  <div className="text-xs text-muted-foreground/70 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    {archetypeCompatibility(user.archetype as Archetype, selectedPlayer.archetype as Archetype)}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">{t("matchRequests.dialog.date")}</Label>
                  <Input type="date" min={today} value={proposedDate} onChange={e => setProposedDate(e.target.value)} className="bg-background border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">{t("matchRequests.dialog.time")}</Label>
                  <Input type="time" value={proposedTime} onChange={e => setProposedTime(e.target.value)} className="bg-background border-white/10" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">{t("matchRequests.dialog.messageLabel")}</Label>
                <Input placeholder={t("matchRequests.dialog.messagePlaceholder")} value={message} onChange={e => setMessage(e.target.value)} className="bg-background border-white/10" />
              </div>

              <button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
                className="w-full rounded-[14px] font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                style={{ height: "52px", fontSize: "15px", background: "#D4AF37", color: "#000" }}
              >
                {sendMutation.isPending ? t("matchRequests.dialog.sending") : t("matchRequests.dialog.sendTo").replace("{{name}}", selectedPlayer.name)}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── ASSIGN PARTNERS MODAL (coach) ── */}
      <Dialog open={!!assignTarget} onOpenChange={open => !open && setAssignTarget(null)}>
        <DialogContent className="bg-card border-white/10 text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{t("matchRequests.assign.title")}</DialogTitle>
            {assignTarget && (
              <p className="text-sm text-muted-foreground">
                {assignTarget.player?.name} · {assignTarget.format} · {assignTarget.requestedDate} {assignTarget.requestedTime}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="text-xs text-muted-foreground">
              {t("matchRequests.assign.instructions").replace("{{name}}", assignTarget?.player?.name ?? "")}
            </div>

            {selectedCandidates.length > 0 && (
              <div
                className="p-3 rounded-[14px]"
                style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)" }}
              >
                <div className="text-xs text-muted-foreground mb-2">{t("matchRequests.assign.selected").replace("{{n}}", String(selectedCandidates.length))}</div>
                <div className="flex flex-wrap gap-1">
                  {selectedCandidates.map(id => {
                    const c = (candidates as Candidate[]).find(x => x.id === id);
                    return c ? (
                      <span
                        key={id}
                        className="text-xs rounded-full px-2 py-0.5"
                        style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.25)", color: "#D4AF37" }}
                      >
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
                    className="flex items-center gap-3 p-3 rounded-[14px] transition-all"
                    style={{
                      border: `1px solid ${selected ? "rgba(212,175,55,0.35)" : "rgba(255,255,255,0.07)"}`,
                      background: selected ? "rgba(212,175,55,0.08)" : "transparent",
                      opacity: maxReached ? 0.4 : 1,
                      cursor: maxReached ? "not-allowed" : "pointer",
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-serif shrink-0"
                      style={{
                        background: selected ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.08)",
                        color: selected ? "#D4AF37" : "rgba(255,255,255,0.7)",
                      }}
                    >
                      {c.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{c.name}</span>
                        {c.verified && <span style={{ color: "#D4AF37", fontSize: "12px" }}>✓</span>}
                        <span className="text-xs text-muted-foreground font-mono">{c.level}</span>
                        {c.archetype && <ArchetypePill archetype={c.archetype} size="xs" />}
                        <RiskWarning profile={cProfile} />
                      </div>
                      <CompatBar pct={c.compatibility} />
                      {cProfile && cProfile.behavioralFlags.length > 0 && (
                        <div className="text-xs italic mt-0.5 truncate" style={{ color: "rgba(245,158,11,0.6)" }}>
                          {cProfile.behavioralFlags.join(", ")}
                        </div>
                      )}
                    </div>
                    <div
                      className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                      style={{
                        background: selected ? "#D4AF37" : "transparent",
                        borderColor: selected ? "#D4AF37" : "rgba(255,255,255,0.2)",
                        color: "#000",
                      }}
                    >
                      {selected && <span className="text-xs leading-none font-bold">✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => assignMutation.mutate()}
              disabled={assignMutation.isPending || selectedCandidates.length === 0}
              className="w-full rounded-[14px] font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              style={{ height: "52px", fontSize: "15px", background: "#D4AF37", color: "#000" }}
            >
              {assignMutation.isPending ? t("matchRequests.assign.creating") : t("matchRequests.assign.createMatch").replace("{{n}}", String(1 + selectedCandidates.length))}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {/* ── NO LEVEL GATE ── */}
      <Dialog open={showLevelGate} onOpenChange={setShowLevelGate}>
        <DialogContent className="bg-card border-white/10 text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{t("dashboard.noLevelBannerTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground" style={{ fontSize: "14px" }}>
            {t("dashboard.noLevelBannerDesc")}
          </p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setShowLevelGate(false)}
              className="flex-1 rounded-[12px] font-medium transition-all"
              style={{
                height: "44px",
                fontSize: "14px",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {t("matchRequests.dialog.change")}
            </button>
            <Link href="/assessment" className="flex-1">
              <button
                onClick={() => setShowLevelGate(false)}
                className="w-full rounded-[12px] font-semibold transition-all hover:opacity-90"
                style={{ height: "44px", fontSize: "14px", background: "#D4AF37", color: "#000" }}
              >
                {t("dashboard.noLevelBannerCta")}
              </button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
