import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function LevelBadge({ level }: { level: string }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
      style={{ color: "#D4AF37", borderColor: "rgba(212,175,55,0.30)", background: "rgba(212,175,55,0.08)" }}
    >
      {level}
    </span>
  );
}

export default function CoachDashboard() {
  const { t } = useLanguage();
  const today = new Date();
  const dayName = DAY_NAMES[today.getDay()];
  const dateStr = today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const { data: clients = [] } = useQuery({
    queryKey: ["coaching-clients"],
    queryFn: () => apiFetch("/coaching/clients"),
  });

  const { data: todaySessions = [] } = useQuery({
    queryKey: ["coaching-today"],
    queryFn: () => apiFetch("/coaching/today"),
  });

  const { data: allSessions = [] } = useQuery({
    queryKey: ["coaching-sessions"],
    queryFn: () => apiFetch("/coaching/sessions"),
  });

  const { data: analyses = [] } = useQuery({
    queryKey: ["video-analyses-coach"],
    queryFn: () => apiFetch("/video-analysis?limit=20"),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["coaching-messages"],
    queryFn: () => apiFetch("/coaching/messages"),
  });

  const pendingVideos = (analyses as any[]).filter((a: any) => a.status === "pending" || a.status === "in_progress");
  const unreadMessages = (messages as any[]).filter((m: any) => !m.read && m.direction === "in");
  const activeClients = (clients as any[]).filter((c: any) => c.status === "active");
  const weekRevenue = (allSessions as any[]).filter((s: any) => {
    const d = new Date(s.date);
    const now = new Date();
    const weekAgo = new Date(now.setDate(now.getDate() - 7));
    return d >= weekAgo;
  }).length * 700;

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 max-w-5xl mx-auto" style={{ paddingTop: "24px", paddingBottom: "40px" }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-serif font-bold text-white mb-0.5" style={{ fontSize: "28px" }}>
              Добро пожаловать, Миша 👋
            </h1>
            <p className="text-muted-foreground" style={{ fontSize: "14px" }}>{dateStr}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/coach/group-trainings">
              <button
                className="inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold text-white transition-all active:scale-[0.97]"
                style={{ background: "rgba(212,175,55,0.12)", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.3)", height: "44px", paddingLeft: "16px", paddingRight: "16px", fontSize: "14px" }}
              >
                {t("nav.groupTrainings")}
              </button>
            </Link>
            <Link href="/clients/new">
              <button
                className="inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold text-black transition-all active:scale-[0.97]"
                style={{ background: "#D4AF37", height: "44px", paddingLeft: "16px", paddingRight: "16px", fontSize: "14px" }}
              >
                + Add Client
              </button>
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Active Clients", value: activeClients.length, icon: "👥", gold: false },
            { label: "Pending Videos", value: pendingVideos.length, icon: "🎬", gold: false },
            { label: "Unread Messages", value: unreadMessages.length, icon: "💬", gold: false },
            { label: "Revenue This Week", value: `${weekRevenue} AED`, icon: "💰", gold: true },
          ].map(({ label, value, icon, gold }) => (
            <div
              key={label}
              className="rounded-[20px]"
              style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <span style={{ fontSize: "16px" }}>{icon}</span>
                  <span className="text-muted-foreground" style={{ fontSize: "11px" }}>{label}</span>
                </div>
                <div
                  className="font-mono font-semibold"
                  style={{ fontSize: "22px", color: gold ? "#D4AF37" : "white" }}
                >
                  {value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Today's sessions */}
        <div
          className="rounded-[20px] mb-5 overflow-hidden"
          style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="font-medium text-white" style={{ fontSize: "16px" }}>Today — {dayName}</div>
            {(todaySessions as any[]).length === 0 && (
              <span className="text-muted-foreground" style={{ fontSize: "12px" }}>No sessions today</span>
            )}
          </div>

          {(todaySessions as any[]).length === 0 ? (
            <div className="text-center pb-8 text-muted-foreground" style={{ fontSize: "14px" }}>
              Free day — no scheduled sessions 🏖️
            </div>
          ) : (
            <div>
              {(todaySessions as any[]).map((session: any, i: number) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between px-5"
                  style={{
                    minHeight: "60px",
                    borderTop: i === 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                    borderBottom: i < (todaySessions as any[]).length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="rounded-full flex items-center justify-center font-serif flex-shrink-0"
                      style={{ width: "40px", height: "40px", background: "rgba(212,175,55,0.12)", color: "#D4AF37", fontSize: "14px" }}
                    >
                      {session.client?.avatarInitials ?? "?"}
                    </div>
                    <div>
                      <div className="font-medium text-white" style={{ fontSize: "14px" }}>{session.client?.name}</div>
                      <div className="text-muted-foreground" style={{ fontSize: "12px" }}>
                        {session.startTime} – {session.endTime} · {session.court || "Court TBD"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.client?.level && <LevelBadge level={session.client.level} />}
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border"
                      style={{ color: "#4ade80", borderColor: "rgba(74,222,128,0.25)", background: "rgba(74,222,128,0.08)" }}
                    >
                      Recurring
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Clients overview */}
        <div className="mb-2">
          <h2 className="font-medium text-muted-foreground uppercase tracking-wider mb-3" style={{ fontSize: "11px", paddingLeft: "4px" }}>
            Clients
          </h2>
        </div>
        <div
          className="rounded-[20px] overflow-hidden mb-5"
          style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {(clients as any[]).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground" style={{ fontSize: "14px" }}>No clients yet</div>
          ) : (
            (clients as any[]).map((client: any, i: number) => (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <div
                  className="flex items-center justify-between px-5 cursor-pointer transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
                  style={{
                    minHeight: "64px",
                    borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="rounded-full flex items-center justify-center font-serif flex-shrink-0"
                      style={{ width: "40px", height: "40px", background: "rgba(212,175,55,0.12)", color: "#D4AF37", fontSize: "15px" }}
                    >
                      {client.avatarInitials}
                    </div>
                    <div>
                      <div className="font-medium text-white" style={{ fontSize: "15px" }}>{client.name}</div>
                      <div className="text-muted-foreground" style={{ fontSize: "13px" }}>
                        {client.totalSessions} sessions · {client.totalRevenue} AED
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <LevelBadge level={client.level} />
                    <span className="text-muted-foreground" style={{ fontSize: "18px" }}>›</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Pending video queue */}
        {pendingVideos.length > 0 && (
          <div
            className="rounded-[20px] mb-5 overflow-hidden"
            style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2 px-5 pt-5 pb-3">
              <span className="font-medium text-white" style={{ fontSize: "15px" }}>🎬 Video Analysis Queue</span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ background: "rgba(212,175,55,0.15)", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.25)" }}
              >
                {pendingVideos.length}
              </span>
            </div>
            {pendingVideos.slice(0, 3).map((v: any, i: number) => (
              <Link key={v.id} href={`/video-analysis/${v.id}`}>
                <div
                  className="flex items-center justify-between px-5 cursor-pointer transition-colors hover:bg-white/[0.03]"
                  style={{
                    minHeight: "52px",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="font-medium text-white" style={{ fontSize: "14px" }}>Video #{v.id}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground capitalize" style={{ fontSize: "13px" }}>{v.status}</span>
                    <span className="text-muted-foreground" style={{ fontSize: "18px" }}>›</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Recent messages preview */}
        {unreadMessages.length > 0 && (
          <div
            className="rounded-[20px] overflow-hidden"
            style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white" style={{ fontSize: "15px" }}>💬 New Messages</span>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: "rgba(250,204,21,0.12)", color: "#facc15", border: "1px solid rgba(250,204,21,0.25)" }}
                >
                  {unreadMessages.length}
                </span>
              </div>
              <Link href="/messages">
                <span className="font-medium transition-opacity hover:opacity-70" style={{ fontSize: "14px", color: "#D4AF37" }}>
                  View all
                </span>
              </Link>
            </div>
            {unreadMessages.slice(0, 3).map((m: any, i: number) => (
              <div
                key={m.id}
                className="px-5 py-3 text-muted-foreground"
                style={{
                  fontSize: "14px",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {m.content}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
