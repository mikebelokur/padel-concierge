import { useState, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ToastAction } from "@/components/ui/toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  reliabilityColor,
  reliabilityBarColor,
  reliabilityLabel,
} from "@/components/ReliabilityBadge";
import { translateError } from "@/lib/errorMessages";

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
    onError: (err: unknown) => {
      toast({ title: "Ошибка", description: translateError(err).message, variant: "destructive" });
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
    onError: (err: unknown) => {
      toast({ title: "Ошибка", description: translateError(err).message, variant: "destructive" });
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
    onError: (err: unknown) => {
      toast({ title: "Ошибка", description: translateError(err).message, variant: "destructive" });
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
              <div className="text-muted-foreground mb-1.5" style={{ fontSize: "12px" }}>
                Override Reliability Score (0–100)
              </div>
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
              <div className="text-muted-foreground mb-2" style={{ fontSize: "12px" }}>Behavioral Flags</div>
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

  const [activeTab, setActiveTab] = useState<"sessions" | "progress" | "notes" | "chat">("sessions");
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sessionTime, setSessionTime] = useState("09:30");
  const [sessionTopic, setSessionTopic] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [sessionDrills, setSessionDrills] = useState<string[]>([]);
  const [sessionFocus, setSessionFocus] = useState("");
  const [newDrill, setNewDrill] = useState("");
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

  const addSession = useMutation({
    mutationFn: () => {
      const nextNumber = (sessions?.length ?? 0) + 1;
      return apiFetch("/coaching/sessions", {
        method: "POST",
        body: JSON.stringify({
          clientId: parseInt(id!),
          sessionNumber: nextNumber,
          topic: sessionTopic.trim(),
          date: sessionDate,
          time: sessionTime,
          coachNotes: sessionNotes.trim(),
          drillsCovered: sessionDrills,
          nextSessionFocus: sessionFocus.trim(),
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-profile", id] });
      setShowSessionForm(false);
      setSessionTopic(""); setSessionNotes(""); setSessionDrills([]); setSessionFocus(""); setNewDrill("");
      toast({ title: "Session logged ✓" });
    },
    onError: (e: unknown) => toast({ title: "Ошибка", description: translateError(e).message, variant: "destructive" }),
  });

  const allSessions: any[] = (data as any)?.sessions ?? [];

  const sessionsByMonth = useMemo(() => {
    const map = new Map<string, number>();
    allSessions.forEach((s) => {
      const key = s.date?.slice(0, 7);
      if (key) map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        count,
      }));
  }, [allSessions]);

  const topicFrequency = useMemo(() => {
    const map = new Map<string, number>();
    allSessions.forEach((s) => {
      const t = s.topic?.trim();
      if (t) map.set(t, (map.get(t) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort(([, a], [, b]) => b - a).slice(0, 6);
  }, [allSessions]);

  const allDrills = useMemo(() => {
    const set = new Set<string>();
    allSessions.forEach((s) => (s.drillsCovered ?? []).forEach((d: string) => set.add(d)));
    return Array.from(set).slice(0, 8);
  }, [allSessions]);

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

        {/* Native tab pills */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {(["sessions", "progress", "notes", "chat"] as const).map((t) => {
            const labels: Record<string, string> = {
              sessions: `Sessions (${sessions.length})`,
              progress: "Progress",
              notes: `Notes (${notes.length})`,
              chat: `Chat (${messages.length})`,
            };
            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className="flex-shrink-0 rounded-full font-medium transition-all"
                style={{
                  height: "36px",
                  paddingLeft: "16px",
                  paddingRight: "16px",
                  fontSize: "13px",
                  background: activeTab === t ? "#D4AF37" : "rgba(255,255,255,0.06)",
                  color: activeTab === t ? "#000" : "rgba(255,255,255,0.6)",
                  border: activeTab === t ? "none" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

          {/* SESSIONS */}
          {activeTab === "sessions" && (<>
            {/* Log Session button / form */}
            <div className="mb-4">
              {!showSessionForm ? (
                <button
                  onClick={() => setShowSessionForm(true)}
                  className="w-full inline-flex items-center justify-center rounded-[20px] font-semibold text-black transition-all active:scale-[0.97]"
                  style={{ background: "#D4AF37", height: "48px", fontSize: "15px" }}
                >
                  + Log Session
                </button>
              ) : (
                <div
                  className="rounded-[20px] p-5 space-y-4"
                  style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(212,175,55,0.25)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white" style={{ fontSize: "15px" }}>Log Session #{sessions.length + 1}</span>
                    <button
                      onClick={() => setShowSessionForm(false)}
                      className="text-muted-foreground hover:text-white transition-colors"
                      style={{ fontSize: "18px", lineHeight: 1 }}
                    >×</button>
                  </div>

                  {/* Date + Time */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-muted-foreground mb-1.5" style={{ fontSize: "12px" }}>Date</div>
                      <input
                        type="date"
                        value={sessionDate}
                        onChange={(e) => setSessionDate(e.target.value)}
                        className="w-full text-white outline-none rounded-xl"
                        style={{
                          height: "44px", paddingLeft: "12px", paddingRight: "12px",
                          background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.10)", fontSize: "14px",
                          colorScheme: "dark",
                        }}
                      />
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1.5" style={{ fontSize: "12px" }}>Time</div>
                      <input
                        type="time"
                        value={sessionTime}
                        onChange={(e) => setSessionTime(e.target.value)}
                        className="w-full text-white outline-none rounded-xl"
                        style={{
                          height: "44px", paddingLeft: "12px", paddingRight: "12px",
                          background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.10)", fontSize: "14px",
                          colorScheme: "dark",
                        }}
                      />
                    </div>
                  </div>

                  {/* Topic */}
                  <div>
                    <div className="text-muted-foreground mb-1.5" style={{ fontSize: "12px" }}>Topic / Focus Area</div>
                    <input
                      type="text"
                      placeholder="e.g. Forehand technique, Net play…"
                      value={sessionTopic}
                      onChange={(e) => setSessionTopic(e.target.value)}
                      className="w-full text-white placeholder-muted-foreground outline-none rounded-xl"
                      style={{
                        height: "44px", paddingLeft: "14px", paddingRight: "14px",
                        background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.10)", fontSize: "14px",
                      }}
                    />
                  </div>

                  {/* Coach Notes */}
                  <div>
                    <div className="text-muted-foreground mb-1.5" style={{ fontSize: "12px" }}>Session Notes</div>
                    <textarea
                      placeholder="What happened in this session? Progress observed, areas to improve…"
                      value={sessionNotes}
                      onChange={(e) => setSessionNotes(e.target.value)}
                      rows={3}
                      className="w-full text-white placeholder-muted-foreground outline-none rounded-xl resize-none"
                      style={{
                        padding: "12px 14px",
                        background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.10)", fontSize: "14px",
                      }}
                    />
                  </div>

                  {/* Drills covered */}
                  <div>
                    <div className="text-muted-foreground mb-1.5" style={{ fontSize: "12px" }}>Drills Covered</div>
                    {sessionDrills.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {sessionDrills.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setSessionDrills((prev) => prev.filter((x) => x !== d))}
                            className="rounded-full border border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400 transition-colors"
                            style={{ fontSize: "12px", padding: "4px 10px" }}
                          >
                            {d} ×
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Quick-add from past drills */}
                    {allDrills.filter((d) => !sessionDrills.includes(d)).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {allDrills.filter((d) => !sessionDrills.includes(d)).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setSessionDrills((prev) => [...prev, d])}
                            className="rounded-full border border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 transition-colors"
                            style={{ fontSize: "12px", padding: "3px 9px" }}
                          >
                            + {d}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add drill (e.g. cross-court rally)…"
                        value={newDrill}
                        onChange={(e) => setNewDrill(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newDrill.trim()) {
                            setSessionDrills((prev) => [...prev, newDrill.trim()]);
                            setNewDrill("");
                          }
                        }}
                        className="flex-1 text-white placeholder-muted-foreground outline-none rounded-xl"
                        style={{
                          height: "44px", paddingLeft: "14px", paddingRight: "14px",
                          background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.10)", fontSize: "14px",
                        }}
                      />
                      <button
                        onClick={() => { if (newDrill.trim()) { setSessionDrills((prev) => [...prev, newDrill.trim()]); setNewDrill(""); } }}
                        disabled={!newDrill.trim()}
                        className="inline-flex items-center justify-center rounded-xl text-white disabled:opacity-40 transition-all hover:bg-white/[0.08]"
                        style={{ border: "1px solid rgba(255,255,255,0.12)", height: "44px", paddingLeft: "16px", paddingRight: "16px", fontSize: "14px", background: "transparent" }}
                      >Add</button>
                    </div>
                  </div>

                  {/* Next session focus */}
                  <div>
                    <div className="text-muted-foreground mb-1.5" style={{ fontSize: "12px" }}>Next Session Focus</div>
                    <input
                      type="text"
                      placeholder="e.g. Work on backhand off the glass…"
                      value={sessionFocus}
                      onChange={(e) => setSessionFocus(e.target.value)}
                      className="w-full text-white placeholder-muted-foreground outline-none rounded-xl"
                      style={{
                        height: "44px", paddingLeft: "14px", paddingRight: "14px",
                        background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.10)", fontSize: "14px",
                      }}
                    />
                  </div>

                  <button
                    onClick={() => addSession.mutate()}
                    disabled={!sessionTopic.trim() || addSession.isPending}
                    className="w-full inline-flex items-center justify-center rounded-xl font-semibold text-black transition-all active:scale-[0.97] disabled:opacity-40"
                    style={{ background: "#D4AF37", height: "48px", fontSize: "15px" }}
                  >
                    {addSession.isPending ? "Saving…" : "Save Session"}
                  </button>
                </div>
              )}
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground" style={{ fontSize: "14px" }}>No sessions yet — log the first one above</div>
            ) : (
              <div
                className="rounded-[20px] overflow-hidden"
                style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                {[...sessions].reverse().map((s: any, i: number) => (
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
                            #{s.sessionNumber}
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
                    {s.drillsCovered?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {s.drillsCovered.map((d: string) => (
                          <span
                            key={d}
                            className="text-muted-foreground rounded"
                            style={{ fontSize: "11px", padding: "2px 8px", background: "rgba(255,255,255,0.05)" }}
                          >
                            {d}
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
          </>)}

          {/* PROGRESS */}
          {activeTab === "progress" && (
            <div className="space-y-5">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Sessions", value: sessions.length },
                  {
                    label: "Avg / Month",
                    value: sessionsByMonth.length > 0
                      ? (sessions.length / sessionsByMonth.length).toFixed(1)
                      : "—",
                  },
                  {
                    label: "Top Topic",
                    value: topicFrequency[0]?.[0] ?? "—",
                    small: true,
                  },
                ].map(({ label, value, small }) => (
                  <div
                    key={label}
                    className="rounded-[20px] p-4 flex flex-col"
                    style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="text-muted-foreground mb-1" style={{ fontSize: "11px" }}>{label}</div>
                    <div
                      className="font-bold text-white leading-tight"
                      style={{ fontSize: small ? "13px" : "22px", fontVariantNumeric: "tabular-nums" }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Session frequency bar chart */}
              <div
                className="rounded-[20px] p-5"
                style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="text-muted-foreground uppercase tracking-wider mb-4" style={{ fontSize: "11px" }}>
                  📅 Session Frequency
                </div>
                {sessionsByMonth.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" style={{ fontSize: "14px" }}>No session data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={sessionsByMonth} barSize={24} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        contentStyle={{
                          background: "hsl(220 20% 8%)",
                          border: "1px solid rgba(255,255,255,0.10)",
                          borderRadius: "12px",
                          fontSize: "13px",
                          color: "white",
                        }}
                        formatter={(v: number) => [v, "Sessions"]}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {sessionsByMonth.map((_, idx) => (
                          <Cell
                            key={idx}
                            fill={idx === sessionsByMonth.length - 1 ? "#D4AF37" : "rgba(212,175,55,0.40)"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Topic frequency */}
              {topicFrequency.length > 0 && (
                <div
                  className="rounded-[20px] p-5"
                  style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="text-muted-foreground uppercase tracking-wider mb-4" style={{ fontSize: "11px" }}>
                    🎯 Topics Covered
                  </div>
                  <div className="space-y-3">
                    {topicFrequency.map(([topic, count]) => {
                      const maxCount = topicFrequency[0][1];
                      const pct = Math.round((count / maxCount) * 100);
                      return (
                        <div key={topic}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white" style={{ fontSize: "13px" }}>{topic}</span>
                            <span className="text-muted-foreground tabular-nums" style={{ fontSize: "12px" }}>
                              {count} session{count !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="w-full rounded-full overflow-hidden" style={{ height: "5px", background: "rgba(255,255,255,0.08)" }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: "#D4AF37", transition: "width 0.5s ease" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All drills ever run */}
              {allDrills.length > 0 && (
                <div
                  className="rounded-[20px] p-5"
                  style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="text-muted-foreground uppercase tracking-wider mb-3" style={{ fontSize: "11px" }}>
                    🏸 Drills in Rotation
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allDrills.map((d) => (
                      <span
                        key={d}
                        className="rounded-full"
                        style={{
                          fontSize: "12px", padding: "4px 12px",
                          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)",
                          color: "rgba(255,255,255,0.7)",
                        }}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* POST-MATCH NOTES */}
          {activeTab === "notes" && (
            <div className="space-y-4">
            <div
              className="rounded-[20px] p-5 space-y-3"
              style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="font-medium text-white" style={{ fontSize: "14px" }}>Record Post-Match Question</div>
              <textarea
                placeholder="Question asked on court (e.g. How to improve volley technique?)"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                rows={2}
                className="w-full text-white placeholder-muted-foreground outline-none rounded-xl resize-none"
                style={{
                  padding: "10px 14px",
                  background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.10)", fontSize: "14px",
                }}
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
                        <textarea
                          placeholder="Add your coaching response…"
                          value={noteResponse[note.id] ?? ""}
                          onChange={(e) => setNoteResponse(prev => ({ ...prev, [note.id]: e.target.value }))}
                          rows={2}
                          className="w-full text-white placeholder-muted-foreground outline-none rounded-xl resize-none"
                          style={{
                            padding: "10px 14px",
                            background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.10)", fontSize: "14px",
                          }}
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
            </div>
          )}

          {/* CHAT HISTORY */}
          {activeTab === "chat" && (
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
          )}
      </div>
    </AppLayout>
  );
}
