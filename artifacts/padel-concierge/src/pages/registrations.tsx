import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const LEVEL_COLORS: Record<string, string> = {
  "C+": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "C":  "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  "D+": "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "D":  "text-muted-foreground bg-white/5 border-white/10",
  "B":  "text-green-400 bg-green-500/10 border-green-500/20",
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Registrations() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["registrations"],
    queryFn: () => apiFetch("/admin/registrations"),
    refetchInterval: 30000,
  });

  const pending = (registrations as any[]).filter((r: any) => r.approvalStatus === "pending");
  const rejected = (registrations as any[]).filter((r: any) => r.approvalStatus === "rejected");

  const approve = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/registrations/${id}/approve`, { method: "PUT" }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["registrations"] });
      qc.invalidateQueries({ queryKey: ["pending-count"] });
      if (selected?.id === id) setSelected(null);
      toast({ title: "✅ Approved", description: "Player can now access all features." });
    },
  });

  const reject = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/registrations/${id}/reject`, { method: "PUT" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations"] });
      qc.invalidateQueries({ queryKey: ["pending-count"] });
      toast({ title: "Registration rejected" });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/registrations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations"] });
      if (selected) setSelected(null);
      toast({ title: "Registration deleted" });
    },
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif mb-1">New Registrations</h1>
            <p className="text-muted-foreground">Review and approve players who signed up</p>
          </div>
          {pending.length > 0 && (
            <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-sm px-3 py-1">
              {pending.length} pending approval
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading…</div>
        ) : pending.length === 0 && rejected.length === 0 ? (
          <Card className="bg-card border-white/5">
            <CardContent className="py-16 text-center">
              <div className="text-4xl mb-3">✅</div>
              <div className="font-medium mb-1">All caught up</div>
              <div className="text-sm text-muted-foreground">No pending registrations right now.</div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: list */}
            <div className="space-y-3">
              {/* Pending */}
              {pending.length > 0 && (
                <>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">
                    Pending ({pending.length})
                  </div>
                  {pending.map((r: any) => (
                    <Card
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className={cn(
                        "bg-card border-white/5 cursor-pointer hover:border-primary/30 transition-colors",
                        selected?.id === r.id && "border-primary/50 bg-primary/5"
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-400 font-serif">
                              {r.name?.[0] ?? "?"}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{r.name}</div>
                              <div className="text-xs text-muted-foreground">{r.email}</div>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Badge variant="outline" className={cn("text-xs", LEVEL_COLORS[r.level] ?? "")}>
                            Level {r.level}
                          </Badge>
                          {r.phone && <span className="text-xs text-muted-foreground">{r.phone}</span>}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs h-8"
                            onClick={(e) => { e.stopPropagation(); approve.mutate(r.id); }}
                            disabled={approve.isPending}
                          >
                            ✅ Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-8"
                            onClick={(e) => { e.stopPropagation(); reject.mutate(r.id); }}
                            disabled={reject.isPending}
                          >
                            ❌ Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}

              {/* Rejected */}
              {rejected.length > 0 && (
                <>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1 mt-4">
                    Rejected ({rejected.length})
                  </div>
                  {rejected.map((r: any) => (
                    <Card key={r.id} className="bg-card border-white/5 opacity-60">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground font-serif">
                              {r.name?.[0] ?? "?"}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{r.name}</div>
                              <div className="text-xs text-muted-foreground">{r.email}</div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-green-400 hover:text-green-300 h-7 px-2"
                              onClick={() => approve.mutate(r.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-red-400 hover:text-red-300 h-7 px-2"
                              onClick={() => remove.mutate(r.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </div>

            {/* RIGHT: detail panel */}
            <div>
              {selected ? (
                <Card className="bg-card border-primary/20 sticky top-6">
                  <CardHeader className="pb-3 border-b border-white/5">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Registration Details</CardTitle>
                      <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif text-xl">
                        {selected.name?.[0]}
                      </div>
                      <div>
                        <div className="font-serif text-lg">{selected.name}</div>
                        <Badge variant="outline" className={cn("text-xs mt-1", LEVEL_COLORS[selected.level] ?? "")}>
                          Level {selected.level}
                        </Badge>
                      </div>
                    </div>
                    {[
                      ["📧 Email",     selected.email],
                      ["📱 Phone",     selected.phone || "—"],
                      ["🎯 Goal",      selected.goal],
                      ["⚡ Intensity", selected.intensity],
                      ["📍 Location",  selected.locationName || "Dubai"],
                      ["🕐 Registered", new Date(selected.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start gap-3 text-sm py-1.5 border-b border-white/5 last:border-0">
                        <span className="text-muted-foreground w-32 flex-shrink-0">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                    <div className="flex gap-3 pt-2">
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white"
                        onClick={() => approve.mutate(selected.id)}
                        disabled={approve.isPending || selected.approvalStatus === "approved"}
                      >
                        {selected.approvalStatus === "approved" ? "✅ Approved" : "✅ Approve Player"}
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        onClick={() => reject.mutate(selected.id)}
                        disabled={reject.isPending}
                      >
                        ❌
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border border-white/5 rounded-xl">
                  Click a registration to see details
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
