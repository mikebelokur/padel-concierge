import { useState } from "react";
import { useRoute, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const LEVEL_COLORS: Record<string, string> = {
  "C+": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "C":  "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  "B":  "text-green-400 bg-green-500/10 border-green-500/20",
};
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ClientProfile() {
  const [, params] = useRoute("/clients/:id");
  const id = params?.id;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [newQuestion, setNewQuestion] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [noteResponse, setNoteResponse] = useState<Record<number, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["client-profile", id],
    queryFn: () => apiFetch(`/coaching/clients/${id}`),
    enabled: !!id,
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
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif text-2xl">
              {client.avatarInitials}
            </div>
            <div>
              <h1 className="text-2xl font-serif">{client.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={cn("text-xs", LEVEL_COLORS[client.level] ?? "")}>
                  Level {client.level}
                </Badge>
                {client.phone && <span className="text-sm text-muted-foreground">📱 {client.phone}</span>}
                {client.email && <span className="text-sm text-muted-foreground">✉ {client.email}</span>}
              </div>
              <div className="text-sm text-muted-foreground mt-1 capitalize">
                {client.bookingPattern.replace("_", " ")} · {client.pricePerSession} AED/session · {client.totalSessions} sessions total
              </div>
            </div>
          </div>
          <Link href="/clients"><Button variant="outline" size="sm" className="border-white/10">← Back</Button></Link>
        </div>

        {/* Recurring schedule */}
        {recurring.length > 0 && (
          <Card className="bg-card border-white/5">
            <CardContent className="p-4">
              <div className="text-sm font-medium mb-2 text-muted-foreground uppercase tracking-wider text-xs">Recurring Slots</div>
              <div className="flex flex-wrap gap-2">
                {recurring.map((s: any) => (
                  <Badge key={s.id} className="bg-primary/10 text-primary border-primary/20">
                    {DAY_NAMES[s.dayOfWeek]} {s.startTime}–{s.endTime}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Package tracker */}
        {client.packageType === "package" && client.sessionsInPackage > 0 && (() => {
          const used = justMarked ?? client.sessionsUsed;
          const total = client.sessionsInPackage;
          const remaining = total - used;
          const pct = Math.min(100, (used / total) * 100);
          const exhausted = remaining <= 0;
          return (
            <div className={cn(
              "p-4 rounded-xl border",
              exhausted
                ? "bg-amber-500/5 border-amber-500/20"
                : "bg-primary/5 border-primary/20"
            )}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Пакет сессий</div>
                  <div className="font-semibold text-foreground">
                    Сессий использовано: <span className={exhausted ? "text-amber-400" : "text-primary"}>{used}</span> / {total}
                  </div>
                  {!exhausted && (
                    <div className="text-xs text-muted-foreground mt-0.5">Осталось: {remaining}</div>
                  )}
                </div>
                {!exhausted ? (
                  <Button
                    size="sm"
                    onClick={() => markSession.mutate()}
                    disabled={markSession.isPending}
                    className="shrink-0"
                  >
                    {markSession.isPending ? "…" : "+ Отметить тренировку"}
                  </Button>
                ) : null}
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden mb-2">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    exhausted ? "bg-amber-500" : "bg-primary"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Confirmation flash */}
              {justMarked !== null && (
                <div className="mt-2 text-sm text-emerald-400 font-medium">
                  ✓ Тренировка {justMarked} отмечена
                </div>
              )}

              {/* Exhausted CTA */}
              {exhausted && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-amber-400 font-medium">
                    Пакет завершён. Предложить продление?
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 shrink-0"
                    onClick={() => {
                      const msg = `Привет! Твой пакет из ${total} тренировок завершён. Готов продолжить? 💪`;
                      window.open(`https://wa.me/${client.phone?.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`);
                    }}
                  >
                    📲 WhatsApp
                  </Button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Next session plan */}
        {client.nextSessionPlan && (
          <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 text-sm">
            <span className="text-accent font-medium">📋 Next Session Plan: </span>
            <span className="text-foreground">{client.nextSessionPlan}</span>
          </div>
        )}

        <Tabs defaultValue="sessions">
          <TabsList className="bg-card border-white/5">
            <TabsTrigger value="sessions">Sessions ({sessions.length})</TabsTrigger>
            <TabsTrigger value="notes">Post-Match Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="chat">Chat ({messages.length})</TabsTrigger>
          </TabsList>

          {/* SESSIONS */}
          <TabsContent value="sessions" className="mt-4 space-y-3">
            {sessions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No sessions yet</div>
            ) : (
              sessions.map((s: any) => (
                <Card key={s.id} className="bg-card border-white/5">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Session {s.sessionNumber}
                          </span>
                          <span className="font-medium">{s.topic}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{s.date} · {s.time} · {s.durationMinutes} min{s.court ? ` · ${s.court}` : ""}</div>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">{s.status}</Badge>
                    </div>
                    {s.subtopics?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {s.subtopics.map((t: string) => (
                          <span key={t} className="text-xs px-2 py-0.5 rounded bg-white/5 text-muted-foreground">{t}</span>
                        ))}
                      </div>
                    )}
                    {s.coachNotes && (
                      <p className="text-sm text-muted-foreground mt-2 border-t border-white/5 pt-2">{s.coachNotes}</p>
                    )}
                    {s.nextSessionFocus && (
                      <div className="mt-2 text-xs text-accent">→ Next: {s.nextSessionFocus}</div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* POST-MATCH NOTES */}
          <TabsContent value="notes" className="mt-4 space-y-3">
            {/* Add new question */}
            <Card className="bg-card border-white/5">
              <CardContent className="p-4 space-y-3">
                <Label className="text-sm font-medium">Record Post-Match Question</Label>
                <Textarea
                  placeholder="Question asked on court (e.g. Как улучшить технику виоловки?)"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="bg-background border-white/10 resize-none"
                  rows={2}
                />
                <Button
                  size="sm"
                  onClick={() => newQuestion.trim() && addNote.mutate(newQuestion.trim())}
                  disabled={!newQuestion.trim() || addNote.isPending}
                >
                  Record Question
                </Button>
              </CardContent>
            </Card>

            {notes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No questions recorded yet</div>
            ) : (
              notes.map((note: any) => (
                <Card key={note.id} className="bg-card border-white/5">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">❓ {note.question}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(note.recordedAt).toLocaleDateString("en-GB")} · {note.category}
                        </p>
                      </div>
                    </div>
                    {note.coachResponse ? (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-sm text-foreground">
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/10"
                          onClick={() => updateNote.mutate({ noteId: note.id, coachResponse: noteResponse[note.id] ?? "" })}
                          disabled={!noteResponse[note.id] || updateNote.isPending}
                        >
                          Save Response
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* CHAT HISTORY */}
          <TabsContent value="chat" className="mt-4">
            <Card className="bg-card border-white/5">
              <CardHeader className="pb-2 border-b border-white/5">
                <CardTitle className="text-sm flex items-center gap-2">
                  💬 WhatsApp History
                  <Badge variant="outline" className="text-xs border-green-500/30 text-green-400 bg-green-500/10">WhatsApp</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2 max-h-80 overflow-y-auto mb-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">No messages yet</div>
                  ) : (
                    messages.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "max-w-xs px-3 py-2 rounded-xl text-sm",
                          msg.direction === "out"
                            ? "ml-auto bg-primary/20 text-foreground rounded-br-sm"
                            : "bg-white/5 text-foreground rounded-bl-sm"
                        )}
                      >
                        <p>{msg.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {msg.direction === "out" ? "Misha" : client.name} · {new Date(msg.sentAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message…"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && newMessage.trim() && sendMessage.mutate(newMessage.trim())}
                    className="bg-background border-white/10 text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => newMessage.trim() && sendMessage.mutate(newMessage.trim())}
                    disabled={!newMessage.trim() || sendMessage.isPending}
                  >
                    Send
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
