import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

interface MatchRequest {
  id: number;
  fromUserId: number;
  toUserId: number;
  message: string | null;
  status: string;
  proposedDate: string | null;
  proposedTime: string | null;
  createdAt: string;
  fromUser: { id: number; name: string; level: string; verified: boolean } | null;
  toUser: { id: number; name: string; level: string; verified: boolean } | null;
}

interface User {
  id: number;
  name: string;
  level: string;
  verified: boolean;
  locationName: string | null;
  matchesPlayed: number;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  accepted: "text-green-400 bg-green-400/10 border-green-400/20",
  declined: "text-red-400 bg-red-400/10 border-red-400/20",
  cancelled: "text-muted-foreground bg-white/5 border-white/10",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function MatchRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"received" | "sent">("received");
  const [showSend, setShowSend] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<User | null>(null);
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [message, setMessage] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["match-requests", user?.id],
    queryFn: () => apiFetch<MatchRequest[]>(`/match-requests?userId=${user?.id}`),
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<User[]>("/users"),
  });

  const received = requests.filter((r) => r.toUserId === user?.id);
  const sent = requests.filter((r) => r.fromUserId === user?.id);

  const respondMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/match-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: (_data, vars) => {
      toast({ title: vars.status === "accepted" ? "Match request accepted!" : "Request declined" });
      qc.invalidateQueries({ queryKey: ["match-requests"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => apiFetch("/match-requests", {
      method: "POST",
      body: JSON.stringify({
        fromUserId: user?.id,
        toUserId: selectedPlayer?.id,
        message: message || null,
        proposedDate: proposedDate || null,
        proposedTime: proposedTime || null,
      }),
    }),
    onSuccess: () => {
      toast({ title: "Match request sent!", description: `Request sent to ${selectedPlayer?.name}` });
      qc.invalidateQueries({ queryKey: ["match-requests"] });
      setShowSend(false);
      setSelectedPlayer(null);
      setMessage("");
      setProposedDate("");
      setProposedTime("");
    },
    onError: (e: Error) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  const candidates = users.filter(
    (u) =>
      u.id !== user?.id &&
      u.name.toLowerCase().includes(search.toLowerCase())
  );

  const today = new Date().toISOString().split("T")[0];

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-serif mb-2">Match Requests</h1>
            <p className="text-muted-foreground">Send, receive, and manage match invitations.</p>
          </div>
          <Button onClick={() => setShowSend(true)} className="shadow-lg shadow-primary/20">
            Send Request
          </Button>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 bg-card border border-white/5 rounded-lg p-1 w-fit">
          {(["received", "sent"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
              <span className="ml-1.5 text-xs opacity-70">
                {t === "received" ? received.length : sent.length}
              </span>
            </button>
          ))}
        </div>

        {/* Request List */}
        {isLoading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-3">
            {(tab === "received" ? received : sent).length === 0 ? (
              <Card className="bg-card border-white/5">
                <CardContent className="p-8 text-center text-muted-foreground">
                  {tab === "received" ? "No match requests received yet." : "You haven't sent any requests yet."}
                </CardContent>
              </Card>
            ) : (
              (tab === "received" ? received : sent).map((r) => {
                const other = tab === "received" ? r.fromUser : r.toUser;
                return (
                  <Card key={r.id} className="bg-card border-white/5 hover:border-white/10 transition-colors">
                    <CardContent className="p-5 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-serif flex-shrink-0">
                        {other?.name?.[0] ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {other?.name}
                              {other?.verified && <span className="text-accent text-xs">✓</span>}
                              <Badge variant="outline" className="text-xs border-white/10 font-mono">
                                WPT {other?.level}
                              </Badge>
                            </div>
                            {r.proposedDate && (
                              <div className="text-sm text-muted-foreground mt-0.5">
                                Proposed: {r.proposedDate}{r.proposedTime ? ` at ${r.proposedTime}` : ""}
                              </div>
                            )}
                            {r.message && (
                              <p className="text-sm text-muted-foreground mt-1 italic">"{r.message}"</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <Badge variant="outline" className={`text-xs capitalize ${STATUS_STYLES[r.status]}`}>
                              {r.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                          </div>
                        </div>

                        {tab === "received" && r.status === "pending" && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              onClick={() => respondMutation.mutate({ id: r.id, status: "accepted" })}
                              disabled={respondMutation.isPending}
                              className="shadow-sm shadow-primary/20"
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/10 text-muted-foreground hover:text-foreground"
                              onClick={() => respondMutation.mutate({ id: r.id, status: "declined" })}
                              disabled={respondMutation.isPending}
                            >
                              Decline
                            </Button>
                          </div>
                        )}

                        {tab === "sent" && r.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 border-white/10 text-muted-foreground"
                            onClick={() => respondMutation.mutate({ id: r.id, status: "cancelled" })}
                          >
                            Cancel Request
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* Send Request Modal */}
        <Dialog open={showSend} onOpenChange={setShowSend}>
          <DialogContent className="bg-card border-white/10 text-foreground max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Send Match Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-1">
              {!selectedPlayer ? (
                <>
                  <div className="space-y-2">
                    <Label>Search Players</Label>
                    <Input
                      placeholder="Player name..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="bg-background border-white/10"
                    />
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {candidates.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 rounded-md hover:bg-white/5 cursor-pointer transition-colors"
                        onClick={() => setSelectedPlayer(p)}
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary text-sm font-serif">
                          {p.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.locationName ?? "Dubai"} · {p.matchesPlayed} matches</div>
                        </div>
                        <Badge variant="outline" className="text-xs border-white/10 font-mono">WPT {p.level}</Badge>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-md bg-primary/10">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif">
                      {selectedPlayer.name[0]}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{selectedPlayer.name}</div>
                      <div className="text-xs text-muted-foreground">WPT {selectedPlayer.level}</div>
                    </div>
                    <button className="ml-auto text-muted-foreground hover:text-foreground text-sm" onClick={() => setSelectedPlayer(null)}>
                      Change
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Proposed Date</Label>
                      <Input
                        type="date"
                        min={today}
                        value={proposedDate}
                        onChange={(e) => setProposedDate(e.target.value)}
                        className="bg-background border-white/10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Proposed Time</Label>
                      <Input
                        type="time"
                        value={proposedTime}
                        onChange={(e) => setProposedTime(e.target.value)}
                        className="bg-background border-white/10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Message (optional)</Label>
                    <Input
                      placeholder="Let's play this weekend!"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="bg-background border-white/10"
                    />
                  </div>
                  <Button
                    className="w-full shadow-lg shadow-primary/20"
                    onClick={() => sendMutation.mutate()}
                    disabled={sendMutation.isPending}
                  >
                    {sendMutation.isPending ? "Sending..." : "Send Request"}
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
