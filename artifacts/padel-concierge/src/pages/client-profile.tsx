import { useState } from "react";
import { useRoute, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ToastAction } from "@/components/ui/toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  reliabilityColor,
  reliabilityBarColor,
  reliabilityLabel,
} from "@/components/ReliabilityBadge";

type BehavioralProfile = {
  reliabilityScore: number;
  noShowCount: number;
  sessionStreak: number;
  behavioralFlags: string[];
  source: string;
};

const PRESET_FLAGS = [
  "Chronic no-show",
  "Late payer",
  "Cancels last minute",
  "Aggressive on court",
  "Poor sportsmanship",
  "Payment dispute",
];

function LevelBadge({ level }: { level: string }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border flex-shrink-0"
      style={{ color: "#D4AF37", borderColor: "rgba(212,175,55,0.30)", background: "rgba(212,175,55,0.08)" }}
    >
      Level {level}
    </span>
  );
}

function BehavioralStats({
  loading,
  data,
  playerId,
  canEdit,
  onUpdated,
}: {
  loading: boolean;
  data: BehavioralProfile | null;
  playerId: string;
  canEdit: boolean;
  onUpdated: (updated: BehavioralProfile) => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [scoreInput, setScoreInput] = useState("");
  const [customFlag, setCustomFlag] = useState("");
  const [pendingFlags, setPendingFlags] = useState<string[]>([]);

  function openEdit() {
    setScoreInput(data ? String(data.reliabilityScore) : "75");
    setPendingFlags(data ? [...data.behavioralFlags] : []);
    setCustomFlag("");
    setEditing(true);
  }

  function togglePreset(flag: string) {
    setPendingFlags(prev =>
      prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag]
    );
  }

  function addCustom() {
    const f = customFlag.trim();
    if (f && !pendingFlags.includes(f)) {
      setPendingFlags(prev => [...prev, f]);
    }
    setCustomFlag("");
  }

  const removeFlag = useMutation({
    mutationFn: (flag: string) =>
      apiFetch<BehavioralProfile>(`/players/${playerId}/profile/flags`, {
        method: "PATCH",
        body: JSON.stringify({ type: "coaching_client", removeFlags: [flag] }),
      }),
    onSuccess: (updated, flag) => {
      onUpdated(updated);
      toast({
        title: `Flag removed: "${flag}"`,
        description: "Tap Undo to restore it.",
        action: (
          <ToastAction altText="Undo" onClick={() => restoreFlag.mutate(flag)}>
            Undo
          </ToastAction>
        ),
      });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to remove flag", description: err.message, variant: "destructive" });
    },
  });

  const restoreFlag = useMutation({
    mutationFn: (flag: string) =>
      apiFetch<BehavioralProfile>(`/players/${playerId}/profile/flags`, {
        method: "PATCH",
        body: JSON.stringify({ type: "coaching_client", addFlags: [flag] }),
      }),
    onSuccess: (updated) => {
      onUpdated(updated);
      toast({ title: "Flag restored" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to restore flag", description: err.message, variant: "destructive" });
    },
  });

  const saveFlags = useMutation({
    mutationFn: () => {
      const current = data?.behavioralFlags ?? [];
      const addFlags = pendingFlags.filter(f => !current.includes(f));
      const removeFlags = current.filter(f => !pendingFlags.includes(f));
      const score = parseInt(scoreInput, 10);
      return apiFetch<BehavioralProfile>(`/players/${playerId}/profile/flags`, {
        method: "PATCH",
        body: JSON.stringify({
          type: "coaching_client",
          ...(addFlags.length > 0 && { addFlags }),
          ...(removeFlags.length > 0 && { removeFlags }),
          ...(!isNaN(score) && score !== data?.reliabilityScore && { reliabilityScore: score }),
        }),
      });
    },
    onSuccess: (updated) => {
      onUpdated(updated);
      setEditing(false);
      toast({ title: "Behavioral record updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div
      className="rounded-[20px] overflow-hidden"
      style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="px-5 pt-4 pb-2 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <span className="font-medium text-muted-foreground uppercase tracking-wider" style={{ fontSize: "11px" }}>
            📊 Behavioral Stats
          </span>
          {data?.source === "mongodb" && (
            <span style={{ fontSize: "11px", color: "#4ade80" }}>live</span>
          )}
          {data?.source === "default" && (
            <span style={{ fontSize: "11px", color: "#fbbf24" }}>estimated</span>
          )}
        </div>
        {canEdit && !loading && data && !editing && (
          <button
            className="inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-white transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.10)", height: "28px", paddingLeft: "10px", paddingRight: "10px", fontSize: "12px", background: "transparent" }}
            onClick={openEdit}
          >
            ✏ Edit / Flag
          </button>
        )}
        {editing && (
          <button
            className="inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-white transition-colors"
            style={{ height: "28px", paddingLeft: "10px", paddingRight: "10px", fontSize: "12px", background: "transparent" }}
            onClick={() => setEditing(false)}
          >
            ✕ Cancel
          </button>
        )}
      </div>
      <div className="px-5 pb-5 pt-4">
        {loading ? (
          <div className="text-muted-foreground animate-pulse" style={{ fontSize: "14px" }}>Loading…</div>
        ) : !data ? (
          <div className="text-muted-foreground italic" style={{ fontSize: "14px" }}>
            Analytics unavailable — behavioral data service is offline.
          </div>
        ) : editing ? (
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground mb-1.5 block" style={{ fontSize: "12px" }}>
                Override Reliability Score (0–100)
              </Label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={scoreInput}
                  onChange={e => setScoreInput(e.target.value)}
                  className="text-white outline-none tabular-nums rounded-xl"
                  style={{
                    width: "96px",
                    height: "44px",
                    paddingLeft: "12px",
                    paddingRight: "12px",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    fontSize: "14px",
                  }}
                />
                {scoreInput !== "" && !isNaN(parseInt(scoreInput, 10)) && (
                  <span className={cn("font-semibold tabular-nums", reliabilityColor(parseInt(scoreInput, 10)))} style={{ fontSize: "14px" }}>
                    {reliabilityLabel(parseInt(scoreInput, 10))}
                  </span>
                )}
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground mb-2 block" style={{ fontSize: "12px" }}>Behavioral Flags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PRESET_FLAGS.map(flag => (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => togglePreset(flag)}
                    className={cn(
                      "rounded-full border transition-colors",
                      pendingFlags.includes(flag)
                        ? "border-amber-500/60 bg-amber-500/15 text-amber-400"
                        : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20"
                    )}
                    style={{ fontSize: "12px", padding: "4px 10px" }}
                  >
                    {pendingFlags.includes(flag) ? "⚑ " : "+ "}{flag}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Custom flag…"
                  value={customFlag}
                  onChange={e => setCustomFlag(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCustom()}
                  className="flex-1 text-white placeholder-muted-foreground outline-none rounded-xl"
                  style={{
                    height: "44px",
                    paddingLeft: "14px",
                    paddingRight: "14px",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    fontSize: "14px",
                  }}
                />
                <button
                  className="inline-flex items-center justify-center rounded-xl text-white transition-colors hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ border: "1px solid rgba(255,255,255,0.12)", height: "44px", paddingLeft: "16px", paddingRight: "16px", fontSize: "14px", background: "transparent" }}
                  onClick={addCustom}
                  disabled={!customFlag.trim()}
                >
                  Add
                </button>
              </div>
              {pendingFlags.filter(f => !PRESET_FLAGS.includes(f)).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {pendingFlags.filter(f => !PRESET_FLAGS.includes(f)).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setPendingFlags(prev => prev.filter(p => p !== f))}
                      className="rounded-full border border-amber-500/60 bg-amber-500/15 text-amber-400 hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-400 transition-colors"
                      style={{ fontSize: "12px", padding: "4px 10px" }}
                    >
                      ⚑ {f} ×
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              className="w-full inline-flex items-center justify-center rounded-xl font-semibold text-black transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#D4AF37", height: "44px", fontSize: "15px" }}
              onClick={() => saveFlags.mutate()}
              disabled={saveFlags.isPending}
            >
              {saveFlags.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-muted-foreground" style={{ fontSize: "13px" }}>Reliability Score</span>
                <span className={cn("font-semibold tabular-nums", reliabilityColor(data.reliabilityScore))} style={{ fontSize: "13px" }}>
                  {data.reliabilityScore}/100 · {reliabilityLabel(data.reliabilityScore)}
                </span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: "6px", background: "rgba(255,255,255,0.10)" }}>
                <div
                  className={cn("h-full rounded-full transition-all duration-500", reliabilityBarColor(data.reliabilityScore))}
                  style={{ width: `${Math.max(0, Math.min(100, data.reliabilityScore))}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div
                className="p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="text-muted-foreground mb-1" style={{ fontSize: "12px" }}>No-shows</div>
                <div className={cn("font-bold tabular-nums", data.noShowCount > 0 ? "text-red-400" : "text-emerald-400")} style={{ fontSize: "22px" }}>
                  {data.noShowCount}
                </div>
                <div className="text-muted-foreground" style={{ fontSize: "11px" }}>total missed</div>
              </div>
              <div
                className="p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="text-muted-foreground mb-1" style={{ fontSize: "12px" }}>Session streak</div>
                <div className={cn("font-bold tabular-nums", data.sessionStreak >= 3 ? "text-emerald-400" : "text-white")} style={{ fontSize: "22px" }}>
                  {data.sessionStreak}
                  {data.sessionStreak >= 3 && <span style={{ fontSize: "18px" }} className="ml-1">🔥</span>}
                </div>
                <div className="text-muted-foreground" style={{ fontSize: "11px" }}>consecutive</div>
              </div>
            </div>

            {data.behavioralFlags.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-2" style={{ fontSize: "12px" }}>Flags</div>
                <div className="flex flex-wrap gap-2">
                  {data.behavioralFlags.map((flag) => (
                    <span
                      key={flag}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 text-amber-400"
                      style={{ fontSize: "12px", padding: "4px 10px", background: "rgba(245,158,11,0.10)" }}
                    >
                      ⚑ {flag}
                      {canEdit && (
                        <button
                          type="button"
                          aria-label={`Remove flag ${flag}`}
                          disabled={removeFlag.isPending}
                          onClick={() => removeFlag.mutate(flag)}
                          className="ml-0.5 leading-none text-amber-400/60 hover:text-red-400 transition-colors disabled:opacity-40"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ClientProfile() {
  const [, params] = useRoute("/clients/:id");
  const id = params?.id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canEditBehavior = user?.role === "coach" || user?.role === "admin" || user?.role === "owner";

  const [newQuestion, setNewQuestion] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [noteResponse, setNoteResponse] = useState<Record<number, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["client-profile", id],
    queryFn: () => apiFetch(`/coaching/clients/${id}`),
    enabled: !!id,
  });

  const { data: behavioralData, isLoading: behavioralLoading } = useQuery({
    queryKey: ["player-profile", id],
    queryFn: () => apiFetch<{
      reliabilityScore: number;
      noShowCount: number;
      sessionStreak: number;
      behavioralFlags: string[];
      source: string;
    }>(`/players/${id}/profile?type=coaching_client`),
    enabled: !!id,
    retry: false,
  });

  const addNote = useMutation({
    mutationFn: (question: string) => apiFetch("/coaching/notes", {
      method: "POST",
      body: JSON.stringify({ clientId: parseInt(id!), question, category: "technique" }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-profile", id] });
      setNewQuestion("");
      toast({ title: "Question recorded" });
    },
  });

  const updateNote = useMutation({
    mutationFn: ({ noteId, coachResponse }: { noteId: number; coachResponse: string }) =>
      apiFetch(`/coaching/notes/${noteId}`, { method: "PUT", body: JSON.stringify({ coachResponse }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-profile", id] });
      toast({ title: "Response saved" });
    },
  });

  const [justMarked, setJustMarked] = useState<number | null>(null);

  const markSession = useMutation({
    mutationFn: () => apiFetch(`/coaching/clients/${id}/mark-session`, { method: "POST" }),
    onSuccess: (updated: any) => {
      qc.setQueryData(["client-profile", id], (old: any) => old ? { ...old, client: updated } : old);
      setJustMarked(updated.sessionsUsed);
      setTimeout(() => setJustMarked(null), 3000);
    },
  });

  const sendMessage = useMutation({
    mutationFn: (content: string) => apiFetch("/coaching/messages", {
      method: "POST",
      body: JSON.stringify({ clientId: parseInt(id!), content, direction: "out", channel: "whatsapp" }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-profile", id] });
      setNewMessage("");
    },
  });

  if (isLoading) return <AppLayout><div className="p-8 text-muted-foreground">Loading…</div></AppLayout>;
  if (!data) return <AppLayout><div className="p-8 text-muted-foreground">Client not found</div></AppLayout>;

  const { client, sessions, notes, messages, recurring } = data as any;

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 max-w-4xl mx-auto" style={{ paddingTop: "24px", paddingBottom: "40px" }}>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div
              className="rounded-full flex items-center justify-center font-serif flex-shrink-0"
              style={{ width: "64px", height: "64px", background: "rgba(212,175,55,0.12)", color: "#D4AF37", fontSize: "24px" }}
            >
              {client.avatarInitials}
            </div>
            <div>
              <h1 className="font-serif font-bold text-white mb-1" style={{ fontSize: "24px" }}>{client.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
                  style={{ color: "#D4AF37", borderColor: "rgba(212,175,55,0.30)", background: "rgba(212,175,55,0.08)" }}
                >
                  Level {client.level}
                </span>
                {client.phone && <span className="text-muted-foreground" style={{ fontSize: "13px" }}>📱 {client.phone}</span>}
                {client.email && <span className="text-muted-foreground" style={{ fontSize: "13px" }}>✉ {client.email}</span>}
              </div>
              <div className="text-muted-foreground mt-1 capitalize" style={{ fontSize: "13px" }}>
                {client.bookingPattern.replace("_", " ")} · {client.pricePerSession} AED/session · {client.totalSessions} sessions total
              </div>
            </div>
          </div>
          <Link href="/clients">
            <button
              className="inline-flex items-center justify-center rounded-xl font-medium text-white transition-all hover:bg-white/[0.06] active:scale-[0.97] flex-shrink-0"
              style={{ border: "1px solid rgba(255,255,255,0.12)", height: "44px", paddingLeft: "16px", paddingRight: "16px", fontSize: "14px", background: "transparent" }}
            >
              ← Back
            </button>
          </Link>
        </div>

        {/* Recurring schedule */}
        {recurring.length > 0 && (
          <div
            className="rounded-[20px] mb-5 p-5"
            style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="text-muted-foreground uppercase tracking-wider mb-3" style={{ fontSize: "11px" }}>
              Recurring Slots
            </div>
            <div className="flex flex-wrap gap-2">
              {recurring.map((s: any) => (
                <span
                  key={s.id}
                  className="inline-flex items-center rounded-full border font-medium"
                  style={{
                    padding: "4px 12px",
                    fontSize: "13px",
                    color: "#D4AF37",
                    borderColor: "rgba(212,175,55,0.25)",
                    background: "rgba(212,175,55,0.08)",
                  }}
                >
                  {DAY_NAMES[s.dayOfWeek]} {s.startTime}–{s.endTime}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Package tracker */}
        {client.packageType === "package" && client.sessionsInPackage > 0 && (() => {
          const used = justMarked ?? client.sessionsUsed;
          const total = client.sessionsInPackage;
          const remaining = total - used;
          const pct = Math.min(100, (used / total) * 100);
          const exhausted = remaining <= 0;
          return (
            <div
              className="p-5 rounded-[20px] mb-5"
              style={{
                background: exhausted ? "rgba(245,158,11,0.06)" : "rgba(212,175,55,0.06)",
                border: exhausted ? "1px solid rgba(245,158,11,0.20)" : "1px solid rgba(212,175,55,0.20)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-muted-foreground uppercase tracking-wider mb-0.5" style={{ fontSize: "11px" }}>Пакет сессий</div>
                  <div className="font-semibold text-white" style={{ fontSize: "15px" }}>
                    Сессий использовано:{" "}
                    <span style={{ color: exhausted ? "#fbbf24" : "#D4AF37" }}>{used}</span> / {total}
                  </div>
                  {!exhausted && (
                    <div className="text-muted-foreground mt-0.5" style={{ fontSize: "12px" }}>Осталось: {remaining}</div>
                  )}
                </div>
                {!exhausted && (
                  <button
                    className="inline-flex items-center justify-center rounded-xl font-semibold text-black transition-all active:scale-[0.97] disabled:opacity-40 flex-shrink-0"
                    style={{ background: "#D4AF37", height: "44px", paddingLeft: "14px", paddingRight: "14px", fontSize: "13px" }}
                    onClick={() => markSession.mutate()}
                    disabled={markSession.isPending}
                  >
                    {markSession.isPending ? "…" : "+ Отметить тренировку"}
                  </button>
                )}
              </div>
              <div className="w-full rounded-full overflow-hidden mb-2" style={{ height: "8px", background: "rgba(255,255,255,0.10)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: exhausted ? "#f59e0b" : "#D4AF37" }}
                />
              </div>
              {justMarked !== null && (
                <div className="mt-2 font-medium" style={{ fontSize: "14px", color: "#4ade80" }}>
                  ✓ Тренировка {justMarked} отмечена
                </div>
              )}
              {exhausted && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-medium" style={{ fontSize: "14px", color: "#fbbf24" }}>
                    Пакет завершён. Предложить продление?
                  </span>
                  <button
                    className="inline-flex items-center justify-center rounded-xl font-medium transition-all hover:bg-amber-500/10 active:scale-[0.97] flex-shrink-0"
                    style={{ border: "1px solid rgba(245,158,11,0.30)", color: "#fbbf24", height: "44px", paddingLeft: "14px", paddingRight: "14px", fontSize: "13px", background: "transparent" }}
                    onClick={() => {
                      const msg = `Привет! Твой пакет из ${total} тренировок завершён. Готов продолжить? 💪`;
                      window.open(`https://wa.me/${client.phone?.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`);
                    }}
                  >
                    📲 WhatsApp
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Next session plan */}
        {client.nextSessionPlan && (
          <div
            className="p-4 rounded-[20px] mb-5"
            style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.18)", fontSize: "14px" }}
          >
            <span style={{ color: "#D4AF37", fontWeight: 600 }}>📋 Next Session Plan: </span>
            <span className="text-white">{client.nextSessionPlan}</span>
          </div>
        )}

        {/* Behavioral Stats */}
        <div className="mb-5">
          <BehavioralStats
            loading={behavioralLoading}
            data={behavioralData ?? null}
            playerId={id!}
            canEdit={canEditBehavior}
            onUpdated={(updated) => {
              qc.setQueryData(["player-profile", id], updated);
            }}
          />
        </div>

        <Tabs defaultValue="sessions">
          <TabsList className="bg-card border-white/5">
            <TabsTrigger value="sessions">Sessions ({sessions.length})</TabsTrigger>
            <TabsTrigger value="notes">Post-Match Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="chat">Chat ({messages.length})</TabsTrigger>
          </TabsList>

          {/* SESSIONS */}
          <TabsContent value="sessions" className="mt-4">
            {sessions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" style={{ fontSize: "14px" }}>No sessions yet</div>
            ) : (
              <div
                className="rounded-[20px] overflow-hidden"
                style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                {sessions.map((s: any, i: number) => (
                  <div
                    key={s.id}
                    className="px-5 py-4"
                    style={{ borderBottom: i < sessions.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="font-mono rounded font-medium"
                            style={{ fontSize: "11px", padding: "2px 8px", color: "#D4AF37", background: "rgba(212,175,55,0.10)" }}
                          >
                            Session {s.sessionNumber}
                          </span>
                          <span className="font-medium text-white" style={{ fontSize: "14px" }}>{s.topic}</span>
                        </div>
                        <div className="text-muted-foreground" style={{ fontSize: "12px" }}>
                          {s.date} · {s.time} · {s.durationMinutes} min{s.court ? ` · ${s.court}` : ""}
                        </div>
                      </div>
                      <span
                        className="inline-flex items-center rounded-full border capitalize text-muted-foreground flex-shrink-0"
                        style={{ fontSize: "11px", padding: "2px 8px", border: "1px solid rgba(255,255,255,0.10)" }}
                      >
                        {s.status}
                      </span>
                    </div>
                    {s.subtopics?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {s.subtopics.map((t: string) => (
                          <span
                            key={t}
                            className="text-muted-foreground rounded"
                            style={{ fontSize: "11px", padding: "2px 8px", background: "rgba(255,255,255,0.05)" }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {s.coachNotes && (
                      <p className="text-muted-foreground mt-2 pt-2" style={{ fontSize: "13px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        {s.coachNotes}
                      </p>
                    )}
                    {s.nextSessionFocus && (
                      <div className="mt-2" style={{ fontSize: "12px", color: "#D4AF37" }}>→ Next: {s.nextSessionFocus}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* POST-MATCH NOTES */}
          <TabsContent value="notes" className="mt-4 space-y-4">
            <div
              className="rounded-[20px] p-5 space-y-3"
              style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <Label className="font-medium text-white block" style={{ fontSize: "14px" }}>Record Post-Match Question</Label>
              <Textarea
                placeholder="Question asked on court (e.g. Как улучшить технику виоловки?)"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                className="bg-background border-white/10 resize-none"
                rows={2}
              />
              <button
                className="inline-flex items-center justify-center rounded-xl font-semibold text-black transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "#D4AF37", height: "44px", paddingLeft: "20px", paddingRight: "20px", fontSize: "14px" }}
                onClick={() => newQuestion.trim() && addNote.mutate(newQuestion.trim())}
                disabled={!newQuestion.trim() || addNote.isPending}
              >
                Record Question
              </button>
            </div>

            {notes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" style={{ fontSize: "14px" }}>No questions recorded yet</div>
            ) : (
              <div
                className="rounded-[20px] overflow-hidden"
                style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                {notes.map((note: any, i: number) => (
                  <div
                    key={note.id}
                    className="px-5 py-4 space-y-3"
                    style={{ borderBottom: i < notes.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                  >
                    <div>
                      <p className="font-medium text-white" style={{ fontSize: "14px" }}>❓ {note.question}</p>
                      <p className="text-muted-foreground mt-0.5" style={{ fontSize: "12px" }}>
                        {new Date(note.recordedAt).toLocaleDateString("en-GB")} · {note.category}
                      </p>
                    </div>
                    {note.coachResponse ? (
                      <div
                        className="rounded-xl p-3 text-white"
                        style={{ fontSize: "13px", background: "rgba(212,175,55,0.07)", border: "1px solid rgba(212,175,55,0.15)" }}
                      >
                        💡 {note.coachResponse}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Add your coaching response…"
                          value={noteResponse[note.id] ?? ""}
                          onChange={(e) => setNoteResponse(prev => ({ ...prev, [note.id]: e.target.value }))}
                          className="bg-background border-white/10 resize-none text-sm"
                          rows={2}
                        />
                        <button
                          className="inline-flex items-center justify-center rounded-xl font-medium text-white transition-all hover:bg-white/[0.06] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ border: "1px solid rgba(255,255,255,0.12)", height: "44px", paddingLeft: "16px", paddingRight: "16px", fontSize: "14px", background: "transparent" }}
                          onClick={() => updateNote.mutate({ noteId: note.id, coachResponse: noteResponse[note.id] ?? "" })}
                          disabled={!noteResponse[note.id] || updateNote.isPending}
                        >
                          Save Response
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* CHAT HISTORY */}
          <TabsContent value="chat" className="mt-4">
            <div
              className="rounded-[20px] overflow-hidden"
              style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="px-5 py-3 flex items-center gap-2"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="font-medium text-white" style={{ fontSize: "14px" }}>💬 WhatsApp History</span>
                <span
                  className="inline-flex items-center rounded-full border"
                  style={{ fontSize: "11px", padding: "2px 8px", color: "#4ade80", borderColor: "rgba(74,222,128,0.25)", background: "rgba(74,222,128,0.08)" }}
                >
                  WhatsApp
                </span>
              </div>
              <div className="p-4">
                <div className="space-y-2 overflow-y-auto mb-4" style={{ maxHeight: "320px" }}>
                  {messages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground" style={{ fontSize: "14px" }}>No messages yet</div>
                  ) : (
                    messages.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={cn("flex", msg.direction === "out" ? "justify-end" : "justify-start")}
                      >
                        <div
                          style={{
                            maxWidth: "260px",
                            padding: "8px 12px",
                            borderRadius: msg.direction === "out" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                            background: msg.direction === "out" ? "#D4AF37" : "rgba(255,255,255,0.08)",
                            color: msg.direction === "out" ? "#000" : "white",
                            fontSize: "13px",
                          }}
                        >
                          <p>{msg.content}</p>
                          <p style={{ fontSize: "11px", marginTop: "4px", color: msg.direction === "out" ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.4)" }}>
                            {msg.direction === "out" ? "Misha" : client.name} · {new Date(msg.sentAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type a message…"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && newMessage.trim() && sendMessage.mutate(newMessage.trim())}
                    className="flex-1 text-white placeholder-muted-foreground outline-none rounded-xl"
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      height: "44px",
                      paddingLeft: "14px",
                      paddingRight: "14px",
                      fontSize: "14px",
                    }}
                  />
                  <button
                    className="inline-flex items-center justify-center rounded-xl font-semibold text-black transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                    style={{ background: "#D4AF37", height: "44px", paddingLeft: "18px", paddingRight: "18px", fontSize: "14px" }}
                    onClick={() => newMessage.trim() && sendMessage.mutate(newMessage.trim())}
                    disabled={!newMessage.trim() || sendMessage.isPending}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
