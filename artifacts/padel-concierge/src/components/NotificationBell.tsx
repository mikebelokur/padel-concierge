import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { formatDubaiDateTime } from "@/lib/datetime";

interface NotificationItem {
  id: string;
  kind: string;
  trainingId: string | null;
  titleEn: string;
  titleRu: string;
  bodyEn: string;
  bodyRu: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: countData } = useQuery({
    queryKey: ["notifications-unread-count", user?.id],
    queryFn: () =>
      apiFetch<{ count: number }>("/notifications/unread-count"),
    enabled: !!user?.id,
    refetchInterval: 60000,
  });
  const unreadCount = countData?.count ?? 0;

  const { data: items = [], refetch } = useQuery({
    queryKey: ["notifications-list", user?.id],
    queryFn: () => apiFetch<NotificationItem[]>("/notifications"),
    enabled: !!user?.id && open,
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!user?.id) return null;

  const handleMarkRead = async (id: string) => {
    await apiFetch(`/notifications/${id}/read`, { method: "POST" });
    qc.invalidateQueries({ queryKey: ["notifications-unread-count", user.id] });
    refetch();
  };
  const handleReadAll = async () => {
    await apiFetch(`/notifications/read-all`, { method: "POST" });
    qc.invalidateQueries({ queryKey: ["notifications-unread-count", user.id] });
    refetch();
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("notifications.title")}
        className="relative w-9 h-9 flex items-center justify-center rounded-md hover:bg-white/5 transition-colors"
      >
        <span className="text-lg leading-none">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-yellow-500 text-black text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 max-h-[70vh] overflow-y-auto bg-black border border-white/10 rounded-lg shadow-2xl z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 sticky top-0 bg-black">
            <span className="text-sm font-semibold">{t("notifications.title")}</span>
            {unreadCount > 0 && (
              <button
                onClick={handleReadAll}
                className="text-xs text-primary hover:underline"
              >
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              {t("notifications.empty")}
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {items.map((n) => {
                const title = language === "ru" ? n.titleRu : n.titleEn;
                const body = language === "ru" ? n.bodyRu : n.bodyEn;
                const Inner = (
                  <div
                    className={cn(
                      "px-3 py-2.5 cursor-pointer hover:bg-white/5 transition-colors",
                      !n.readAt && "bg-primary/5",
                    )}
                    onClick={() => {
                      if (!n.readAt) handleMarkRead(n.id);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      {!n.readAt && (
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {body}
                        </div>
                        <div className="text-[10px] text-muted-foreground/60 mt-1">
                          {formatDubaiDateTime(n.createdAt, language)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? <Link href={n.link}>{Inner}</Link> : Inner}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
