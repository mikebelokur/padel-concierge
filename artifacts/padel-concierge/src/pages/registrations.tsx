import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif mb-1">New Registrations</h1>
            <p className="text-muted-foreground">Review and approve players who signed up</p>
          </div>
          {pending.length > 0 && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm border bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
              {pending.length} pending approval
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading…</div>
        ) : pending.length === 0 && rejected.length === 0 ? (
          <div className="rounded-[20px] bg-card border border-white/5">
            <div className="py-16 text-center">
              <div className="text-4xl mb-3">✅</div>
              <div className="font-medium mb-1">All caught up</div>
              <div className="text-sm text-muted-foreground">No pending registrations right now.</div>
            </div>
          </div>
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
                    <div
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className={cn(
                        "rounded-[20px] bg-card border cursor-pointer hover:border-primary/30 transition-colors",
                        selected?.id === r.id ? "border-primary/50 bg-primary/5" : "border-white/5"
                      )}
                    >
                      <div className="p-4">
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
                          <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border", LEVEL_COLORS[r.level] ?? "")}>
                            Level {r.level}
                          </span>
                          {r.phone && <span className="text-xs text-muted-foreground">{r.phone}</span>}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            className="flex-1 inline-flex items-center justify-center rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium h-8 text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={(e) => { e.stopPropagation(); approve.mutate(r.id); }}
                            disabled={approve.isPending}
                          >
                            ✅ Approve
                          </button>
                          <button
                            className="flex-1 inline-flex items-center justify-center rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 bg-transparent font-medium h-8 text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={(e) => { e.stopPropagation(); reject.mutate(r.id); }}
                            disabled={reject.isPending}
                          >
                            ❌ Reject
                          </button>
                        </div>
                      </div>
                    </div>
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
                    <div key={r.id} className="rounded-[20px] bg-card border border-white/5 opacity-60">
                      <div className="p-4">
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
                            <button
                              className="inline-flex items-center justify-center rounded-xl bg-transparent text-green-400 hover:text-green-300 h-7 px-2 text-xs transition-colors"
                              onClick={() => approve.mutate(r.id)}
                            >
                              Approve
                            </button>
                            <button
                              className="inline-flex items-center justify-center rounded-xl bg-transparent text-red-400 hover:text-red-300 h-7 px-2 text-xs transition-colors"
                              onClick={() => remove.mutate(r.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* RIGHT: detail panel */}
            <div>
              {selected ? (
                <div className="rounded-[20px] bg-card border border-primary/20 sticky top-6">
                  <div className="px-5 pt-5 pb-3 border-b border-white/5 flex items-center justify-between">
                    <div className="text-sm font-medium">Registration Details</div>
                    <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif text-xl">
                        {selected.name?.[0]}
                      </div>
                      <div>
                        <div className="font-serif text-lg">{selected.name}</div>
                        <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border mt-1", LEVEL_COLORS[selected.level] ?? "")}>
                          Level {selected.level}
                        </span>
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
                      <button
                        className="flex-1 inline-flex items-center justify-center rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold h-11 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => approve.mutate(selected.id)}
                        disabled={approve.isPending || selected.approvalStatus === "approved"}
                      >
                        {selected.approvalStatus === "approved" ? "✅ Approved" : "✅ Approve Player"}
                      </button>
                      <button
                        className="inline-flex items-center justify-center rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 bg-transparent font-semibold px-4 h-11 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => reject.mutate(selected.id)}
                        disabled={reject.isPending}
                      >
                        ❌
                      </button>
                    </div>
                  </div>
                </div>
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
