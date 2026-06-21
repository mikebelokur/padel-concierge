import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

const GOLD = "#D4AF37";

/** Minimal shapes — only the fields the cabinet reads (avoids `any`). */
interface CabinetClient {
  status?: string;
}
interface CabinetSession {
  date?: string;
}
interface CabinetMessage {
  read?: boolean;
  direction?: string;
}
interface CabinetAnalysis {
  status?: string;
}

interface CabinetTool {
  href: string;
  icon: string;
  title: string;
  desc: string;
  badge?: number;
}

/** Coach cabinet — a single entry point that aggregates the coach's tools
 *  and a live summary. Gated to coach/admin/developer modes via App router. */
export default function Cabinet() {
  const { user } = useAuth();
  const firstName = (user?.name ?? "").trim().split(" ")[0] || "тренер";
  const dateStr = new Date().toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["coaching-clients"],
    queryFn: () => apiFetch<CabinetClient[]>("/coaching/clients"),
  });
  const { data: todaySessions = [] } = useQuery({
    queryKey: ["coaching-today"],
    queryFn: () => apiFetch<CabinetSession[]>("/coaching/today"),
  });
  const { data: messages = [] } = useQuery({
    queryKey: ["coaching-messages"],
    queryFn: () => apiFetch<CabinetMessage[]>("/coaching/messages"),
  });
  const { data: analyses = [] } = useQuery({
    queryKey: ["video-analyses-coach"],
    queryFn: () => apiFetch<CabinetAnalysis[]>("/video-analysis?limit=20"),
  });

  const activeClients = clients.filter((c) => c.status === "active").length;
  const unreadMessages = messages.filter((m) => !m.read && m.direction === "in").length;
  const pendingVideos = analyses.filter(
    (a) => a.status === "pending" || a.status === "in_progress",
  ).length;
  const todayCount = todaySessions.length;

  const stats: Array<{ label: string; value: number; icon: string }> = [
    { label: "Активные клиенты", value: activeClients, icon: "👥" },
    { label: "Тренировки сегодня", value: todayCount, icon: "📅" },
    { label: "Видео на проверке", value: pendingVideos, icon: "🎬" },
    { label: "Непрочитанные", value: unreadMessages, icon: "💬" },
  ];

  const tools: CabinetTool[] = [
    { href: "/coach", icon: "📊", title: "Дашборд тренера", desc: "Сводка, доход, очередь видео" },
    { href: "/clients", icon: "👥", title: "Клиенты", desc: "База клиентов и профили", badge: activeClients },
    { href: "/coach/group-trainings", icon: "🎾", title: "Групповые тренировки", desc: "Расписание и записи" },
    { href: "/messages", icon: "💬", title: "Сообщения", desc: "Переписка с клиентами", badge: unreadMessages },
    { href: "/video-analysis", icon: "🎬", title: "Видеоразбор", desc: "Анализ техники", badge: pendingVideos },
    { href: "/clients/new", icon: "➕", title: "Добавить клиента", desc: "Новая карточка клиента" },
  ];

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 max-w-5xl mx-auto" style={{ paddingTop: "24px", paddingBottom: "40px" }}>
        {/* Header */}
        <div className="mb-6">
          <p className="text-muted-foreground" style={{ fontSize: "13px", textTransform: "uppercase", letterSpacing: "1.5px" }}>
            Кабинет тренера
          </p>
          <h1 className="font-serif font-bold text-white mt-1 mb-0.5" style={{ fontSize: "28px" }}>
            С возвращением, {firstName} 👋
          </h1>
          <p className="text-muted-foreground" style={{ fontSize: "14px" }}>{dateStr}</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {stats.map(({ label, value, icon }) => (
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
                <div className="font-mono font-semibold" style={{ fontSize: "22px", color: "white" }}>
                  {value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tools grid */}
        <p className="text-muted-foreground mb-3" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1.5px" }}>
          Инструменты
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tools.map(({ href, icon, title, desc, badge }) => (
            <Link key={href} href={href}>
              <div
                className="rounded-[20px] transition-all active:scale-[0.98] cursor-pointer h-full"
                style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="p-4 flex items-start gap-3">
                  <div
                    className="flex items-center justify-center rounded-xl shrink-0"
                    style={{ width: "44px", height: "44px", background: "rgba(212,175,55,0.10)", fontSize: "20px" }}
                  >
                    {icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white" style={{ fontSize: "15px" }}>{title}</span>
                      {badge != null && badge > 0 && (
                        <span
                          className="inline-flex items-center justify-center rounded-full font-mono"
                          style={{ minWidth: "20px", height: "20px", padding: "0 6px", fontSize: "11px", color: GOLD, background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.30)" }}
                        >
                          {badge}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-0.5" style={{ fontSize: "12.5px" }}>{desc}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
