import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

function LevelBadge({ level }: { level: string }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border flex-shrink-0"
      style={{ color: "#D4AF37", borderColor: "rgba(212,175,55,0.30)", background: "rgba(212,175,55,0.08)" }}
    >
      {level}
    </span>
  );
}

export default function Clients() {
  const [search, setSearch] = useState("");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["coaching-clients"],
    queryFn: () => apiFetch("/coaching/clients"),
  });

  const filtered = (clients as any[]).filter(
    (c: any) => !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 max-w-4xl mx-auto" style={{ paddingTop: "24px", paddingBottom: "40px" }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-serif font-bold text-white mb-0.5" style={{ fontSize: "28px" }}>Клиенты</h1>
            <p className="text-muted-foreground" style={{ fontSize: "14px" }}>
              {(clients as any[]).length} клиентов
            </p>
          </div>
          <Link href="/clients/new">
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold text-black transition-all active:scale-[0.97]"
              style={{ background: "#D4AF37", height: "44px", paddingLeft: "16px", paddingRight: "16px", fontSize: "14px" }}
            >
              + Новый клиент
            </button>
          </Link>
        </div>

        {/* Search */}
        <div className="mb-5">
          <input
            type="text"
            placeholder="Поиск клиентов…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm text-white placeholder-muted-foreground outline-none rounded-xl transition-all"
            style={{
              background: "hsl(220 20% 6%)",
              border: "1px solid rgba(255,255,255,0.10)",
              height: "44px",
              paddingLeft: "16px",
              paddingRight: "16px",
              fontSize: "15px",
            }}
          />
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground" style={{ fontSize: "14px" }}>Загрузка…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground" style={{ fontSize: "14px" }}>
            {search ? "Клиенты не найдены" : "Клиентов пока нет"}
          </div>
        ) : (
          <div
            className="rounded-[20px] overflow-hidden"
            style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {filtered.map((client: any, i: number) => (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <div
                  className="flex items-center px-5 cursor-pointer transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
                  style={{
                    minHeight: "72px",
                    borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="rounded-full flex items-center justify-center font-serif flex-shrink-0 mr-3"
                    style={{ width: "44px", height: "44px", background: "rgba(212,175,55,0.12)", color: "#D4AF37", fontSize: "16px" }}
                  >
                    {client.avatarInitials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-white truncate" style={{ fontSize: "15px" }}>{client.name}</span>
                      {client.status === "active" && (
                        <span style={{ color: "#4ade80", fontSize: "11px" }}>●</span>
                      )}
                    </div>
                    <div className="text-muted-foreground truncate" style={{ fontSize: "13px" }}>
                      {client.phone && <span className="mr-2">📱 {client.phone}</span>}
                      <span>{client.bookingPattern === "on_demand" ? "По запросу" : client.bookingPattern === "recurring" ? "Регулярные" : client.bookingPattern}</span>
                      {client.pricePerSession && <span className="ml-2">· {client.pricePerSession} AED</span>}
                    </div>
                    {client.nextSessionPlan && (
                      <div className="text-muted-foreground truncate mt-0.5" style={{ fontSize: "12px" }}>
                        📋 {client.nextSessionPlan}
                      </div>
                    )}
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <div className="text-right">
                      <LevelBadge level={client.level} />
                      <div className="text-muted-foreground mt-0.5 text-right" style={{ fontSize: "11px" }}>
                        {client.totalSessions} сессий
                      </div>
                    </div>
                    <span className="text-muted-foreground" style={{ fontSize: "20px" }}>›</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
