import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  // Get latest message per client
  const latestPerClient = (clients as any[]).map((c: any) => {
    const msgs = (allMessages as any[]).filter((m: any) => m.clientId === c.id);
    const unread = msgs.filter((m: any) => !m.read && m.direction === "in").length;
    const last = msgs[msgs.length - 1];
    return { ...c, lastMessage: last, unreadCount: unread };
  });

  // Send available slots template
  const sendSlots = () => {
    const slots = "📅 Свободные слоты:\n• Понедельник 18:00–19:30\n• Среда 17:00–18:30\n• Пятница 19:00–20:30\nКакой подходит?";
    setDraft(slots);
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-56px)] overflow-hidden">
        {/* Client list */}
        <div className={`${selectedClient ? "hidden sm:flex" : "flex"} w-full sm:w-72 border-r border-white/5 flex-col`}>
          <div className="p-4 border-b border-white/5">
            <h2 className="font-serif text-lg mb-1">Messages</h2>
            <p className="text-xs text-muted-foreground">WhatsApp conversations</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {latestPerClient.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setSelectedClient(c)}
                className={cn(
                  "w-full text-left p-4 border-b border-white/5 hover:bg-white/3 transition-colors",
                  selectedClient?.id === c.id && "bg-primary/5 border-l-2 border-l-primary"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif flex-shrink-0">
                      {c.avatarInitials}
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full text-xs flex items-center justify-center text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.lastMessage ? c.lastMessage.content : "No messages yet"}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat thread */}
        <div className={`${selectedClient ? "flex" : "hidden sm:flex"} flex-1 flex-col`}>
          {!selectedClient ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a client to view messages
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="p-4 border-b border-white/5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    className="sm:hidden text-muted-foreground hover:text-foreground mr-1 flex-shrink-0"
                    onClick={() => setSelectedClient(null)}
                  >←</button>
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif flex-shrink-0">
                    {selectedClient.avatarInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{selectedClient.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="text-green-400">●</span> WhatsApp
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="border-white/10 text-xs" onClick={sendSlots}>
                    📅 Send Slots
                  </Button>
                  <Link href={`/clients/${selectedClient.id}`}>
                    <Button size="sm" variant="ghost" className="text-xs text-muted-foreground">View Profile</Button>
                  </Link>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(thread as any[]).length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-8">No messages yet</div>
                ) : (
                  (thread as any[]).map((msg: any) => (
                    <div key={msg.id} className={cn("flex", msg.direction === "out" ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-xs lg:max-w-sm px-4 py-2 rounded-2xl text-sm whitespace-pre-line",
                        msg.direction === "out"
                          ? "bg-primary text-white rounded-br-sm"
                          : "bg-white/8 text-foreground rounded-bl-sm"
                      )}>
                        {msg.content}
                        <div className={cn("text-xs mt-1", msg.direction === "out" ? "text-white/60" : "text-muted-foreground")}>
                          {new Date(msg.sentAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input */}
              <div className="p-4 border-t border-white/5">
                <div className="flex gap-2">
                  <Input
                    placeholder="Message…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && draft.trim() && sendMessage.mutate(draft.trim())}
                    className="bg-background border-white/10"
                  />
                  <Button
                    onClick={() => draft.trim() && sendMessage.mutate(draft.trim())}
                    disabled={!draft.trim() || sendMessage.isPending}
                  >
                    Send
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
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
