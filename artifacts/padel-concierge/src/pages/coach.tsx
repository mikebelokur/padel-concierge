import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LEVEL_COLORS: Record<string, string> = {
  "C+": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "C": "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  "B": "text-green-400 bg-green-500/10 border-green-500/20",
};

export default function CoachDashboard() {
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
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-serif mb-1">Добро пожаловать, Миша 👋</h1>
            <p className="text-muted-foreground">{dateStr}</p>
          </div>
          <Link href="/clients/new">
            <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-black font-semibold px-4 h-9 text-sm transition-all hover:bg-primary/90">
              + Add Client
            </button>
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Clients", value: activeClients.length, icon: "👥", color: "text-primary" },
            { label: "Pending Videos", value: pendingVideos.length, icon: "🎬", color: "text-accent" },
            { label: "Unread Messages", value: unreadMessages.length, icon: "💬", color: "text-yellow-400" },
            { label: "Revenue This Week", value: `${weekRevenue} AED`, icon: "💰", color: "text-green-400" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="rounded-[20px] bg-card border border-white/5">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{icon}</span>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <div className={cn("text-2xl font-mono font-semibold", color)}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Today's sessions */}
        <div className="rounded-[20px] bg-card border border-white/5">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div className="text-base font-medium">Today — {dayName}</div>
            {(todaySessions as any[]).length === 0 && (
              <span className="text-xs text-muted-foreground">No recurring sessions today</span>
            )}
          </div>
          <div className="px-5 pb-5 space-y-3">
            {(todaySessions as any[]).length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Free day — no scheduled sessions 🏖️
              </div>
            ) : (
              (todaySessions as any[]).map((session: any) => (
                <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif text-sm">
                      {session.client?.avatarInitials ?? "?"}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{session.client?.name}</div>
                      <div className="text-xs text-muted-foreground">{session.startTime} – {session.endTime} · {session.court || "Court TBD"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border", LEVEL_COLORS[session.client?.level ?? "C"] ?? "")}>
                      {session.client?.level}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border bg-green-500/10 text-green-400 border-green-500/20">
                      Recurring
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Clients overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(clients as any[]).map((client: any) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <div className="rounded-[20px] bg-card border border-white/5 hover:border-primary/30 transition-colors cursor-pointer">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif">
                        {client.avatarInitials}
                      </div>
                      <div>
                        <div className="font-medium">{client.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{client.bookingPattern.replace("_", " ")}</div>
                      </div>
                    </div>
                    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border", LEVEL_COLORS[client.level] ?? "border-white/10 text-muted-foreground")}>
                      {client.level}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{client.totalSessions} sessions · {client.totalRevenue} AED</span>
                    <span className={cn(client.status === "active" ? "text-green-400" : "text-muted-foreground")}>
                      ● {client.status}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Pending video queue */}
        {pendingVideos.length > 0 && (
          <div className="rounded-[20px] bg-card border border-white/5">
            <div className="px-5 pt-5 pb-3 flex items-center gap-2">
              <span className="text-base font-medium">🎬 Video Analysis Queue</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-accent/10 text-accent border-accent/20">
                {pendingVideos.length}
              </span>
            </div>
            <div className="px-5 pb-5 space-y-2">
              {pendingVideos.slice(0, 3).map((v: any) => (
                <Link key={v.id} href={`/video-analysis/${v.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-white/5 hover:border-primary/20 cursor-pointer transition-colors">
                    <div className="text-sm font-medium">Video #{v.id}</div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border border-white/10 text-muted-foreground capitalize">
                      {v.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent messages preview */}
        {unreadMessages.length > 0 && (
          <div className="rounded-[20px] bg-card border border-white/5">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base font-medium">💬 New Messages</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                  {unreadMessages.length}
                </span>
              </div>
              <Link href="/messages">
                <span className="text-xs text-primary hover:underline cursor-pointer">View all</span>
              </Link>
            </div>
            <div className="px-5 pb-5 space-y-2">
              {unreadMessages.slice(0, 3).map((m: any) => (
                <div key={m.id} className="p-3 rounded-lg bg-background/50 border border-white/5 text-sm">
                  <span className="text-muted-foreground">{m.content}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
