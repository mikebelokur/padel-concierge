import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function CoachMessages() {
  const qc = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [draft, setDraft] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["coaching-clients"],
    queryFn: () => apiFetch("/coaching/clients"),
  });

  const { data: allMessages = [] } = useQuery({
    queryKey: ["coaching-messages"],
    queryFn: () => apiFetch("/coaching/messages"),
    refetchInterval: 10000,
  });

  const { data: thread = [] } = useQuery({
    queryKey: ["coaching-messages", selectedClient?.id],
    queryFn: () => apiFetch(`/coaching/messages?clientId=${selectedClient.id}`),
    enabled: !!selectedClient,
  });

  const sendMessage = useMutation({
    mutationFn: (content: string) => apiFetch("/coaching/messages", {
      method: "POST",
      body: JSON.stringify({ clientId: selectedClient.id, content, direction: "out", channel: "whatsapp" }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coaching-messages"] });
      setDraft("");
    },
  });

  const latestPerClient = (clients as any[]).map((c: any) => {
    const msgs = (allMessages as any[]).filter((m: any) => m.clientId === c.id);
    const unread = msgs.filter((m: any) => !m.read && m.direction === "in").length;
    const last = msgs[msgs.length - 1];
    return { ...c, lastMessage: last, unreadCount: unread };
  });

  const sendSlots = () => {
    const slots = "📅 Свободные слоты:\n• Понедельник 18:00–19:30\n• Среда 17:00–18:30\n• Пятница 19:00–20:30\nКакой подходит?";
    setDraft(slots);
  };

  return (
    <AppLayout>
      <div className="flex overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
        {/* Client list */}
        <div
          className={cn(
            selectedClient ? "hidden sm:flex" : "flex",
            "w-full sm:w-72 flex-col"
          )}
          style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <h2 className="font-serif font-bold text-white mb-0.5" style={{ fontSize: "20px" }}>Messages</h2>
            <p className="text-muted-foreground" style={{ fontSize: "12px" }}>WhatsApp conversations</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {latestPerClient.map((c: any, i: number) => (
              <button
                key={c.id}
                onClick={() => setSelectedClient(c)}
                className={cn(
                  "w-full text-left transition-colors",
                  selectedClient?.id === c.id
                    ? "bg-white/[0.05]"
                    : "hover:bg-white/[0.03]"
                )}
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  borderLeft: selectedClient?.id === c.id ? "2px solid #D4AF37" : "2px solid transparent",
                }}
              >
                <div className="flex items-center gap-3 px-4" style={{ minHeight: "64px" }}>
                  <div className="relative flex-shrink-0">
                    <div
                      className="rounded-full flex items-center justify-center font-serif"
                      style={{ width: "42px", height: "42px", background: "rgba(212,175,55,0.12)", color: "#D4AF37", fontSize: "15px" }}
                    >
                      {c.avatarInitials}
                    </div>
                    {c.unreadCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 flex items-center justify-center font-bold rounded-full text-white"
                        style={{ width: "18px", height: "18px", fontSize: "10px", background: "#D4AF37", color: "#000" }}
                      >
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white truncate" style={{ fontSize: "14px" }}>{c.name}</div>
                    <div className="text-muted-foreground truncate" style={{ fontSize: "12px" }}>
                      {c.lastMessage ? c.lastMessage.content : "No messages yet"}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat thread */}
        <div className={cn(selectedClient ? "flex" : "hidden sm:flex", "flex-1 flex-col")}>
          {!selectedClient ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground" style={{ fontSize: "14px" }}>
              Select a client to view messages
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div
                className="flex items-center justify-between gap-2 px-4 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", minHeight: "60px" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    className="sm:hidden text-muted-foreground hover:text-white mr-1 flex-shrink-0 transition-colors"
                    style={{ fontSize: "20px", minWidth: "44px", minHeight: "44px", display: "flex", alignItems: "center" }}
                    onClick={() => setSelectedClient(null)}
                  >
                    ‹
                  </button>
                  <div
                    className="rounded-full flex items-center justify-center font-serif flex-shrink-0"
                    style={{ width: "36px", height: "36px", background: "rgba(212,175,55,0.12)", color: "#D4AF37", fontSize: "13px" }}
                  >
                    {selectedClient.avatarInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate" style={{ fontSize: "15px" }}>{selectedClient.name}</div>
                    <div className="flex items-center gap-1" style={{ fontSize: "12px" }}>
                      <span style={{ color: "#4ade80" }}>●</span>
                      <span className="text-muted-foreground">WhatsApp</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={sendSlots}
                    className="inline-flex items-center justify-center rounded-xl font-medium text-white transition-all hover:bg-white/[0.06] active:scale-[0.97]"
                    style={{ border: "1px solid rgba(255,255,255,0.12)", height: "44px", paddingLeft: "14px", paddingRight: "14px", fontSize: "13px" }}
                  >
                    📅 Send Slots
                  </button>
                  <Link href={`/clients/${selectedClient.id}`}>
                    <button
                      className="inline-flex items-center justify-center rounded-xl font-medium text-muted-foreground transition-all hover:bg-white/[0.06] hover:text-white active:scale-[0.97]"
                      style={{ height: "44px", paddingLeft: "14px", paddingRight: "14px", fontSize: "13px" }}
                    >
                      View Profile
                    </button>
                  </Link>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {(thread as any[]).length === 0 ? (
                  <div className="text-center text-muted-foreground py-8" style={{ fontSize: "14px" }}>No messages yet</div>
                ) : (
                  (thread as any[]).map((msg: any) => (
                    <div key={msg.id} className={cn("flex", msg.direction === "out" ? "justify-end" : "justify-start")}>
                      <div
                        className="whitespace-pre-line"
                        style={{
                          maxWidth: "280px",
                          padding: "10px 14px",
                          borderRadius: msg.direction === "out" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          background: msg.direction === "out" ? "#D4AF37" : "rgba(255,255,255,0.08)",
                          color: msg.direction === "out" ? "#000" : "white",
                          fontSize: "14px",
                          lineHeight: "1.45",
                        }}
                      >
                        {msg.content}
                        <div
                          style={{
                            fontSize: "11px",
                            marginTop: "4px",
                            color: msg.direction === "out" ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.4)",
                          }}
                        >
                          {new Date(msg.sentAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input */}
              <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Message…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && draft.trim() && sendMessage.mutate(draft.trim())}
                    className="flex-1 text-white placeholder-muted-foreground outline-none rounded-xl transition-all"
                    style={{
                      background: "hsl(220 20% 6%)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      height: "44px",
                      paddingLeft: "16px",
                      paddingRight: "16px",
                      fontSize: "15px",
                    }}
                  />
                  <button
                    onClick={() => draft.trim() && sendMessage.mutate(draft.trim())}
                    disabled={!draft.trim() || sendMessage.isPending}
                    className="inline-flex items-center justify-center rounded-xl font-semibold text-black transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "#D4AF37", height: "44px", paddingLeft: "20px", paddingRight: "20px", fontSize: "14px", flexShrink: 0 }}
                  >
                    Send
                  </button>
                </div>
                <p className="text-muted-foreground mt-2" style={{ fontSize: "11px" }}>
                  Messages saved in-app. Connect Twilio to sync with real WhatsApp.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
