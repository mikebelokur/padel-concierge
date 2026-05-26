import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGetDashboardStats, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { translateError } from "@/lib/errorMessages";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WPT_LEVELS = ["1.0","1.5","2.0","2.5","3.0","3.5","4.0","4.5","5.0"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин. назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч. назад`;
  return `${Math.floor(h / 24)} д. назад`;
}

const ROLE_BADGE_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  owner:  { color: "#D4AF37", bg: "rgba(212,175,55,0.10)", border: "rgba(212,175,55,0.30)" },
  admin:  { color: "#818cf8", bg: "rgba(129,140,248,0.10)", border: "rgba(129,140,248,0.25)" },
  coach:  { color: "#fb923c", bg: "rgba(251,146,60,0.10)", border: "rgba(251,146,60,0.25)" },
  player: { color: "rgba(255,255,255,0.50)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)" },
};

export default function Admin() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "registrations" | "incomplete">("overview");
  const [search, setSearch] = useState("");
  const [editingLevel, setEditingLevel] = useState<Record<number, string>>({});
  const [expandedReminders, setExpandedReminders] = useState<Record<number, boolean>>({});

  const { data: stats } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey(), refetchInterval: 30000 },
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/admin/users"),
  });

  const {
    data: registrations = [],
    isLoading: regsLoading,
    refetch: refetchRegs,
    isFetching: regsRefetching,
  } = useQuery({
    queryKey: ["registrations"],
    queryFn: () => apiFetch("/admin/registrations"),
    refetchInterval: 30000,
  });

  const pending = (registrations as any[]).filter((r: any) => r.approvalStatus === "pending");
  const rejected = (registrations as any[]).filter((r: any) => r.approvalStatus === "rejected");

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/registrations/${id}/approve`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      queryClient.invalidateQueries({ queryKey: ["pending-count"] });
      toast({ title: "✅ Игрок одобрен", description: "Теперь у него полный доступ." });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/registrations/${id}/reject`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      queryClient.invalidateQueries({ queryKey: ["pending-count"] });
      toast({ title: "Заявка отклонена" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/registrations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      toast({ title: "Заявка удалена" });
    },
  });

  const setLevelMutation = useMutation({
    mutationFn: ({ id, level }: { id: number; level: string }) =>
      apiFetch(`/admin/users/${id}/level`, { method: "PUT", body: JSON.stringify({ level }) }),
    onSuccess: (updated: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: `Уровень WPT ${updated.level} установлен для ${updated.name}` });
      setEditingLevel((prev) => { const n = { ...prev }; delete n[updated.id]; return n; });
    },
    onError: (e: unknown) => toast({ title: "Ошибка", description: translateError(e).message, variant: "destructive" }),
  });

  const setRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      apiFetch(`/admin/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "Роль обновлена" }); },
    onError: (e: unknown) => toast({ title: "Ошибка", description: translateError(e).message, variant: "destructive" }),
  });

  const userDeleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "Пользователь удалён" }); },
    onError: (e: unknown) => toast({ title: "Ошибка", description: translateError(e).message, variant: "destructive" }),
  });

  const { data: incompleteProfiles = [], isLoading: incompleteLoading } = useQuery({
    queryKey: ["admin-incomplete-profiles"],
    queryFn: () => apiFetch("/admin/incomplete-profiles"),
  });

  const remindMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/incomplete-profiles/${id}/remind`, { method: "POST" }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-incomplete-profiles"] });
      if (data?.sent) {
        toast({ title: "✅ Напоминание отправлено" });
      } else {
        toast({ title: "Письмо не доставлено", description: "Почтовый сервер недоступен. Повторите позже.", variant: "destructive" });
      }
    },
    onError: (e: unknown) => {
      queryClient.invalidateQueries({ queryKey: ["admin-incomplete-profiles"] });
      const msg = translateError(e).message;
      if (msg.includes("лимит напоминаний") || msg.includes("Слишком рано")) {
        toast({ title: "Слишком часто", description: msg, variant: "destructive" });
        return;
      }
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    },
  });

  const remindAllMutation = useMutation({
    mutationFn: () => apiFetch(`/admin/incomplete-profiles/remind-all`, { method: "POST" }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-incomplete-profiles"] });
      const sent = data?.sent ?? 0;
      const failed = data?.failed ?? 0;
      const skipped = data?.skipped ?? 0;
      const total = data?.total ?? 0;
      if (total === 0) {
        toast({ title: "Нет получателей", description: "Все игроки уже получили напоминание." });
      } else {
        toast({
          title: `✅ Отправлено ${sent} из ${total}`,
          description: `Пропущено: ${skipped}. Ошибок: ${failed}.`,
          variant: failed > 0 && sent === 0 ? "destructive" : undefined,
        });
      }
    },
    onError: (e: unknown) => toast({ title: "Ошибка", description: translateError(e).message, variant: "destructive" }),
  });

  const filteredUsers = (users as any[]).filter((u: any) =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const incompleteList = incompleteProfiles as Array<{
    id: number;
    name: string;
    email: string;
    createdAt: string;
    reminderSentAt: string | null;
    reminderCount: number;
    reminderHistory: Array<{
      id: number;
      sentAt: string;
      triggeredBy: string;
      senderUserId: number | null;
      senderName: string | null;
      delivered: boolean;
    }>;
    canRemind: boolean;
    remindBlockedReason: "cooldown" | "max_reached" | null;
    nextReminderAllowedAt: string | null;
    remindersRemaining: number;
    reminderMaxTotal: number;
    reminderCooldownHours: number;
  }>;

  const formatTimeUntil = (iso: string): string => {
    const diffMs = new Date(iso).getTime() - Date.now();
    if (diffMs <= 0) return "сейчас";
    const totalMin = Math.ceil(diffMs / 60000);
    if (totalMin < 60) return `через ${totalMin} мин`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h < 24) return m > 0 ? `через ${h} ч ${m} мин` : `через ${h} ч`;
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh > 0 ? `через ${d} д ${rh} ч` : `через ${d} д`;
  };

  const tabs = [
    { id: "overview", label: t("admin.overview") },
    {
      id: "registrations",
      label: t("admin.registrations"),
      badge: pending.length > 0 ? pending.length : null,
    },
    {
      id: "incomplete",
      label: "Незаполненные профили",
      badge: incompleteList.length > 0 ? incompleteList.length : null,
    },
  ] as const;

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 max-w-7xl mx-auto" style={{ paddingTop: "24px", paddingBottom: "40px" }}>

        <header className="mb-6">
          <h1 className="font-serif font-bold text-white mb-0.5" style={{ fontSize: "28px" }}>{t("admin.title")}</h1>
          <p className="text-muted-foreground" style={{ fontSize: "14px" }}>Обзор платформы и управление пользователями.</p>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: "rgba(255,255,255,0.05)" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-card text-white shadow-sm"
                  : "text-muted-foreground hover:text-white"
              )}
              style={{ padding: "8px 16px", fontSize: "14px", minHeight: "44px" }}
            >
              {tab.label}
              {"badge" in tab && tab.badge != null && (
                <span
                  className="inline-flex items-center justify-center rounded-full font-bold text-black"
                  style={{ minWidth: "20px", height: "20px", padding: "0 6px", fontSize: "11px", background: "#D4AF37" }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── OVERVIEW TAB ─── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: t("admin.totalUsers"),   value: stats?.totalUsers ?? "–",                  gold: false },
                { label: t("admin.onlineNow"),      value: stats?.onlineUsers ?? "–",                 gold: false },
                { label: t("admin.totalMatches"), value: stats?.totalMatches ?? "–",                gold: false },
                { label: t("admin.revenue"),      value: stats ? `${stats.dailyRevenue} AED` : "–", gold: true  },
              ].map(({ label, value, gold }) => (
                <div
                  key={label}
                  className="rounded-[20px]"
                  style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="px-5 pt-5 pb-1">
                    <div className="text-muted-foreground" style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {label}
                    </div>
                  </div>
                  <div className="px-5 pb-5">
                    <div
                      className="font-mono font-semibold"
                      style={{ fontSize: "26px", color: gold ? "#D4AF37" : "white" }}
                    >
                      {value}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Level chart */}
            {stats?.levelDistribution && (
              <div
                className="rounded-[20px]"
                style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="px-5 pt-5 pb-3">
                  <div className="font-medium text-white" style={{ fontSize: "15px" }}>{t("admin.wptLevelDistribution")}</div>
                </div>
                <div className="px-5 pb-5" style={{ height: "192px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.levelDistribution}>
                      <XAxis dataKey="level" stroke="#6b7a99" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#6b7a99" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        contentStyle={{ backgroundColor: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}
                      />
                      <Bar dataKey="count" fill="#D4AF37" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* User management */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif font-bold text-white" style={{ fontSize: "20px" }}>{t("admin.userManagement")}</h2>
                <span className="text-muted-foreground" style={{ fontSize: "13px" }}>{filteredUsers.length} польз.</span>
              </div>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder={t("admin.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="text-white placeholder-muted-foreground outline-none rounded-xl max-w-sm w-full"
                  style={{
                    background: "hsl(220 20% 6%)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    height: "44px",
                    paddingLeft: "16px",
                    paddingRight: "16px",
                    fontSize: "14px",
                  }}
                />
              </div>

              {usersLoading ? (
                <div className="text-center py-16 text-muted-foreground" style={{ fontSize: "14px" }}>Загрузка пользователей…</div>
              ) : (
                <div
                  className="rounded-[20px] overflow-hidden"
                  style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {filteredUsers.map((u: any, i: number) => {
                    const roleStyle = ROLE_BADGE_STYLE[u.role] ?? ROLE_BADGE_STYLE.player;
                    return (
                      <div
                        key={u.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4"
                        style={{ borderBottom: i < filteredUsers.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                      >
                        {/* User info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className="rounded-full flex items-center justify-center font-serif flex-shrink-0"
                            style={{ width: "40px", height: "40px", background: roleStyle.bg, color: roleStyle.color, fontSize: "14px", border: `1px solid ${roleStyle.border}` }}
                          >
                            {u.name?.[0] ?? "?"}
                            {u.role === "owner" && <span style={{ fontSize: "10px" }}>👑</span>}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-white truncate" style={{ fontSize: "14px" }}>{u.name}</span>
                              {u.verified && <span style={{ color: "#D4AF37", fontSize: "12px" }}>✓</span>}
                              {u.isOnline && <span style={{ color: "#4ade80", fontSize: "10px" }}>●</span>}
                            </div>
                            <div className="text-muted-foreground truncate" style={{ fontSize: "12px" }}>{u.email}</div>
                            <div className="text-muted-foreground" style={{ fontSize: "11px" }}>
                              {u.matchesPlayed} матчей · {u.wins} побед
                            </div>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                          {/* Role selector */}
                          <Select defaultValue={u.role} onValueChange={(role) => setRoleMutation.mutate({ id: u.id, role })}>
                            <SelectTrigger
                              className="text-xs w-28 border"
                              style={{ borderColor: roleStyle.border, color: roleStyle.color, background: roleStyle.bg, height: "44px" }}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["player","coach","admin","owner"].map((r) => (
                                <SelectItem key={r} value={r} className="text-xs capitalize">{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Level selector */}
                          <div className="flex items-center gap-1.5">
                            <Select
                              defaultValue={u.level}
                              value={editingLevel[u.id] ?? u.level}
                              onValueChange={(v) => setEditingLevel((prev) => ({ ...prev, [u.id]: v }))}
                            >
                              <SelectTrigger className="text-xs w-20 bg-transparent border-white/10" style={{ height: "44px" }}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {WPT_LEVELS.map((l) => (
                                  <SelectItem key={l} value={l} className="text-xs font-mono">{l}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {editingLevel[u.id] && editingLevel[u.id] !== u.level && (
                              <button
                                className="inline-flex items-center justify-center rounded-xl font-semibold text-black transition-all active:scale-[0.97] disabled:opacity-50"
                                style={{ background: "#D4AF37", height: "44px", paddingLeft: "14px", paddingRight: "14px", fontSize: "13px" }}
                                onClick={() => setLevelMutation.mutate({ id: u.id, level: editingLevel[u.id] })}
                                disabled={setLevelMutation.isPending}
                              >
                                Сохранить
                              </button>
                            )}
                          </div>

                          {/* Delete */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                className="inline-flex items-center justify-center rounded-xl transition-colors hover:bg-red-500/10"
                                style={{ color: "#f87171", height: "44px", paddingLeft: "14px", paddingRight: "14px", fontSize: "13px", background: "transparent" }}
                              >
                                Удалить
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border-white/10">
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("admin.deleteUserTitle", { name: u.name })}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("admin.deleteUserDesc")}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border-white/10">{t("common.cancel")}</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground"
                                  onClick={() => userDeleteMutation.mutate(u.id)}>
                                  {t("admin.deleteUserButton")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── REGISTRATIONS TAB ─── */}
        {activeTab === "registrations" && (
          <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {pending.length > 0 ? (
                  <span
                    className="inline-flex items-center rounded-full border"
                    style={{ padding: "4px 12px", fontSize: "13px", color: "#D4AF37", borderColor: "rgba(212,175,55,0.30)", background: "rgba(212,175,55,0.08)" }}
                  >
                    {pending.length} ожидают одобрения
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center rounded-full border"
                    style={{ padding: "4px 12px", fontSize: "13px", color: "#4ade80", borderColor: "rgba(74,222,128,0.25)", background: "rgba(74,222,128,0.08)" }}
                  >
                    ✅ Всё в порядке
                  </span>
                )}
                <span className="text-muted-foreground" style={{ fontSize: "12px" }}>{t("admin.updatesEvery30s")}</span>
              </div>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-xl font-medium text-white transition-all hover:bg-white/[0.06] active:scale-[0.97] disabled:opacity-50"
                style={{ border: "1px solid rgba(255,255,255,0.12)", height: "44px", paddingLeft: "16px", paddingRight: "16px", fontSize: "14px", background: "transparent" }}
                onClick={() => refetchRegs()}
                disabled={regsRefetching}
              >
                {regsRefetching ? "⟳ Обновление…" : "⟳ Обновить"}
              </button>
            </div>

            {regsLoading ? (
              <div className="text-center py-16 text-muted-foreground" style={{ fontSize: "14px" }}>Загрузка заявок…</div>
            ) : pending.length === 0 && rejected.length === 0 ? (
              <div
                className="rounded-[20px] text-center py-16"
                style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>✅</div>
                <div className="font-medium text-white mb-1" style={{ fontSize: "16px" }}>Всё обработано</div>
                <div className="text-muted-foreground" style={{ fontSize: "14px" }}>Нет ожидающих или отклонённых заявок.</div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* PENDING */}
                {pending.length > 0 && (
                  <div>
                    <div className="text-muted-foreground uppercase tracking-wider mb-3 px-1" style={{ fontSize: "11px" }}>
                      На рассмотрении ({pending.length})
                    </div>
                    <div
                      className="rounded-[20px] overflow-hidden"
                      style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(212,175,55,0.20)" }}
                    >
                      {pending.map((r: any, i: number) => (
                        <div
                          key={r.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4"
                          style={{ borderBottom: i < pending.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                        >
                          {/* Avatar + info */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className="rounded-full flex items-center justify-center font-serif flex-shrink-0"
                              style={{ width: "44px", height: "44px", background: "rgba(212,175,55,0.10)", color: "#D4AF37", fontSize: "16px", border: "1px solid rgba(212,175,55,0.20)" }}
                            >
                              {r.name?.[0] ?? "?"}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-white" style={{ fontSize: "15px" }}>{r.name}</div>
                              <div className="text-muted-foreground" style={{ fontSize: "12px" }}>{r.email}</div>
                              <div className="text-muted-foreground capitalize" style={{ fontSize: "12px" }}>
                                {r.phone && <span className="mr-2 font-mono">{r.phone}</span>}
                                {r.goal}
                              </div>
                            </div>
                          </div>

                          {/* Level + date + actions */}
                          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                            <span
                              className="inline-flex items-center rounded-full border font-mono"
                              style={{ fontSize: "12px", padding: "3px 10px", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}
                            >
                              {r.level}
                            </span>
                            <div className="text-muted-foreground text-right" style={{ fontSize: "11px" }}>
                              <div>{timeAgo(r.createdAt)}</div>
                            </div>
                            <button
                              className="inline-flex items-center justify-center rounded-xl font-medium text-white transition-all active:scale-[0.97] disabled:opacity-50"
                              style={{ background: "#16a34a", height: "44px", paddingLeft: "16px", paddingRight: "16px", fontSize: "14px" }}
                              onClick={() => approveMutation.mutate(r.id)}
                              disabled={approveMutation.isPending}
                            >
                              ✅ Одобрить
                            </button>
                            <button
                              className="inline-flex items-center justify-center rounded-xl font-medium transition-all hover:bg-red-500/10 active:scale-[0.97] disabled:opacity-50"
                              style={{ border: "1px solid rgba(239,68,68,0.30)", color: "#f87171", height: "44px", paddingLeft: "16px", paddingRight: "16px", fontSize: "14px", background: "transparent" }}
                              onClick={() => rejectMutation.mutate(r.id)}
                              disabled={rejectMutation.isPending}
                            >
                              ❌ Отклонить
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* REJECTED */}
                {rejected.length > 0 && (
                  <div className="opacity-70">
                    <div className="text-muted-foreground uppercase tracking-wider mb-3 px-1" style={{ fontSize: "11px" }}>
                      Отклонённые ({rejected.length})
                    </div>
                    <div
                      className="rounded-[20px] overflow-hidden"
                      style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      {rejected.map((r: any, i: number) => (
                        <div
                          key={r.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4"
                          style={{ borderBottom: i < rejected.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className="rounded-full flex items-center justify-center font-serif flex-shrink-0"
                              style={{ width: "40px", height: "40px", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", fontSize: "14px", border: "1px solid rgba(255,255,255,0.08)" }}
                            >
                              {r.name?.[0] ?? "?"}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-white" style={{ fontSize: "14px" }}>{r.name}</div>
                              <div className="text-muted-foreground" style={{ fontSize: "12px" }}>{r.email}</div>
                              <div className="text-muted-foreground" style={{ fontSize: "11px" }}>{fmtDate(r.createdAt)}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className="inline-flex items-center rounded-full border font-mono"
                              style={{ fontSize: "12px", padding: "3px 10px", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.5)" }}
                            >
                              {r.level}
                            </span>
                            <button
                              className="inline-flex items-center justify-center rounded-xl font-medium text-white transition-all active:scale-[0.97] disabled:opacity-50"
                              style={{ background: "#16a34a", height: "44px", paddingLeft: "16px", paddingRight: "16px", fontSize: "13px" }}
                              onClick={() => approveMutation.mutate(r.id)}
                              disabled={approveMutation.isPending}
                            >
                              Одобрить
                            </button>
                            <button
                              className="inline-flex items-center justify-center rounded-xl transition-all hover:bg-red-500/10 active:scale-[0.97] disabled:opacity-50"
                              style={{ color: "#f87171", height: "44px", paddingLeft: "14px", paddingRight: "14px", fontSize: "13px", background: "transparent" }}
                              onClick={() => deleteMutation.mutate(r.id)}
                              disabled={deleteMutation.isPending}
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── INCOMPLETE PROFILES TAB ─── */}
        {activeTab === "incomplete" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {incompleteList.length > 0 ? (
                <span
                  className="inline-flex items-center rounded-full border"
                  style={{ padding: "4px 12px", fontSize: "13px", color: "#fb923c", borderColor: "rgba(251,146,60,0.30)", background: "rgba(251,146,60,0.08)" }}
                >
                  {incompleteList.length} игроков без архетипа
                </span>
              ) : (
                <span
                  className="inline-flex items-center rounded-full border"
                  style={{ padding: "4px 12px", fontSize: "13px", color: "#4ade80", borderColor: "rgba(74,222,128,0.25)", background: "rgba(74,222,128,0.08)" }}
                >
                  ✅ Все профили заполнены
                </span>
              )}
              {(() => {
                const pendingReminderCount = incompleteList.filter(u => u.canRemind).length;
                return (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-xl font-medium transition-all active:scale-[0.97] disabled:opacity-50 ml-auto"
                    style={{
                      height: "36px",
                      paddingLeft: "14px",
                      paddingRight: "14px",
                      fontSize: "13px",
                      border: "1px solid rgba(251,146,60,0.35)",
                      color: "#fb923c",
                      background: "rgba(251,146,60,0.08)",
                    }}
                    onClick={() => {
                      if (pendingReminderCount === 0) {
                        toast({ title: "Нет получателей", description: "Все игроки уже получили напоминание." });
                        return;
                      }
                      if (window.confirm(`Отправить напоминание ${pendingReminderCount} игрокам?`)) {
                        remindAllMutation.mutate();
                      }
                    }}
                    disabled={remindAllMutation.isPending || pendingReminderCount === 0}
                    title={pendingReminderCount === 0 ? "Все игроки уже получили напоминание" : `Отправить напоминание ${pendingReminderCount} игрокам`}
                  >
                    {remindAllMutation.isPending ? "Отправка…" : `Напомнить всем (${pendingReminderCount})`}
                  </button>
                );
              })()}
            </div>

            {incompleteLoading ? (
              <div className="text-center py-16 text-muted-foreground" style={{ fontSize: "14px" }}>Загрузка…</div>
            ) : incompleteList.length === 0 ? (
              <div
                className="rounded-[20px] text-center py-16"
                style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎯</div>
                <div className="font-medium text-white mb-1" style={{ fontSize: "16px" }}>Всё в порядке</div>
                <div className="text-muted-foreground" style={{ fontSize: "14px" }}>Нет игроков с незаполненным профилем.</div>
              </div>
            ) : (
              <div
                className="rounded-[20px] overflow-hidden"
                style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                {/* Header row */}
                <div
                  className="hidden sm:grid px-5 py-3"
                  style={{
                    gridTemplateColumns: "1fr 160px 140px 140px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    fontSize: "11px",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  <span>Игрок</span>
                  <span>Дата регистрации</span>
                  <span>Напоминание</span>
                  <span />
                </div>
                {incompleteList.map((u, i) => (
                  <div
                    key={u.id}
                    style={{
                      borderBottom: i < incompleteList.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                    }}
                  >
                  <div
                    className="flex flex-col sm:grid items-center gap-3 px-5 py-4"
                    style={{
                      gridTemplateColumns: "1fr 160px 140px 140px",
                    }}
                  >
                    {/* Player info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="rounded-full flex items-center justify-center font-serif flex-shrink-0"
                        style={{ width: "36px", height: "36px", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: "13px", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        {u.name?.[0] ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-white truncate" style={{ fontSize: "14px" }}>{u.name}</div>
                        <div className="text-muted-foreground truncate" style={{ fontSize: "12px" }}>{u.email}</div>
                      </div>
                    </div>

                    {/* Registration date */}
                    <div className="text-muted-foreground" style={{ fontSize: "12px" }}>
                      {fmtDate(u.createdAt)}
                    </div>

                    {/* Reminder status */}
                    <div>
                      {u.reminderCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setExpandedReminders(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                          className="inline-flex items-center gap-1 rounded-full border transition-colors hover:bg-white/5"
                          style={{ padding: "3px 10px", fontSize: "11px", color: "#4ade80", borderColor: "rgba(74,222,128,0.25)", background: "rgba(74,222,128,0.06)" }}
                          title="Показать историю напоминаний"
                        >
                          <span>✓ Отправлено {u.reminderCount}×</span>
                          <span style={{ fontSize: "9px", opacity: 0.7 }}>{expandedReminders[u.id] ? "▲" : "▼"}</span>
                        </button>
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full border"
                          style={{ padding: "3px 10px", fontSize: "11px", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.10)", background: "transparent" }}
                        >
                          Не отправлено
                        </span>
                      )}
                      {u.reminderSentAt && (
                        <div className="text-muted-foreground mt-0.5" style={{ fontSize: "11px" }}>последнее: {timeAgo(u.reminderSentAt)}</div>
                      )}
                      {!u.canRemind && u.remindBlockedReason === "cooldown" && u.nextReminderAllowedAt && (
                        <div className="mt-0.5" style={{ fontSize: "11px", color: "rgba(251,146,60,0.7)" }}>
                          можно {formatTimeUntil(u.nextReminderAllowedAt)}
                        </div>
                      )}
                      {!u.canRemind && u.remindBlockedReason === "max_reached" && (
                        <div className="mt-0.5" style={{ fontSize: "11px", color: "rgba(248,113,113,0.8)" }}>
                          лимит {u.reminderMaxTotal} достигнут
                        </div>
                      )}
                      {u.canRemind && u.reminderCount > 0 && (
                        <div className="text-muted-foreground mt-0.5" style={{ fontSize: "11px" }}>
                          осталось: {u.remindersRemaining} из {u.reminderMaxTotal}
                        </div>
                      )}
                    </div>

                    {/* Remind button */}
                    <div className="flex justify-end">
                      <button
                        className="inline-flex items-center justify-center rounded-xl font-medium transition-all active:scale-[0.97] disabled:opacity-50"
                        style={{
                          height: "36px",
                          paddingLeft: "14px",
                          paddingRight: "14px",
                          fontSize: "13px",
                          border: "1px solid rgba(251,146,60,0.35)",
                          color: "#fb923c",
                          background: "rgba(251,146,60,0.08)",
                        }}
                        onClick={() => remindMutation.mutate(u.id)}
                        disabled={remindMutation.isPending || !u.canRemind}
                        title={
                          !u.canRemind && u.remindBlockedReason === "cooldown" && u.nextReminderAllowedAt
                            ? `Можно отправить ${formatTimeUntil(u.nextReminderAllowedAt)} (минимум ${u.reminderCooldownHours} ч между напоминаниями)`
                            : !u.canRemind && u.remindBlockedReason === "max_reached"
                              ? `Достигнут лимит в ${u.reminderMaxTotal} напоминаний для этого игрока`
                              : u.reminderSentAt ? "Отправить повторное напоминание" : "Отправить напоминание"
                        }
                      >
                        {u.reminderSentAt ? "Повторить" : "Напомнить"}
                      </button>
                    </div>
                  </div>

                  {expandedReminders[u.id] && u.reminderHistory.length > 0 && (
                    <div
                      className="px-5 pb-4"
                      style={{ background: "rgba(255,255,255,0.02)" }}
                    >
                      <div
                        className="rounded-lg overflow-hidden"
                        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <div
                          className="grid px-3 py-2"
                          style={{
                            gridTemplateColumns: "180px 100px 1fr 100px",
                            fontSize: "10px",
                            fontWeight: 500,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "rgba(255,255,255,0.35)",
                            borderBottom: "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <span>Когда</span>
                          <span>Источник</span>
                          <span>Кем</span>
                          <span>Статус</span>
                        </div>
                        {u.reminderHistory.map((h, hi) => (
                          <div
                            key={h.id}
                            className="grid px-3 py-2"
                            style={{
                              gridTemplateColumns: "180px 100px 1fr 100px",
                              fontSize: "12px",
                              color: "rgba(255,255,255,0.75)",
                              borderBottom: hi < u.reminderHistory.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                            }}
                          >
                            <span>{fmtDate(h.sentAt)} · {timeAgo(h.sentAt)}</span>
                            <span style={{ color: h.triggeredBy === "manual" ? "#fb923c" : "rgba(255,255,255,0.55)" }}>
                              {h.triggeredBy === "manual" ? "Вручную" : "Авто"}
                            </span>
                            <span className="text-muted-foreground truncate">
                              {h.triggeredBy === "manual" ? (h.senderName ?? "Админ") : "Система"}
                            </span>
                            <span style={{ color: h.delivered ? "#4ade80" : "#f87171" }}>
                              {h.delivered ? "Доставлено" : "Ошибка"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
