import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WPT_LEVELS = ["1.0","1.5","2.0","2.5","3.0","3.5","4.0","4.5","5.0"];
const ROLE_COLORS: Record<string, string> = {
  owner: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  admin: "text-primary border-primary/30 bg-primary/10",
  coach: "text-accent border-accent/30 bg-accent/10",
  player: "text-muted-foreground border-white/10 bg-white/5",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "registrations">("overview");
  const [search, setSearch] = useState("");
  const [editingLevel, setEditingLevel] = useState<Record<number, string>>({});

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { refetchInterval: 30000 },
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/admin/users"),
  });

  const {
    data: registrations = [],
    isLoading: regsLoading,
    refetch: refetchRegs,
    isFetching: regsRefetching,
  } = useQuery({
    queryKey: ["registrations"],
    queryFn: () => apiFetch("/admin/registrations"),
    refetchInterval: 30000,
  });

  const pending = (registrations as any[]).filter((r: any) => r.approvalStatus === "pending");
  const rejected = (registrations as any[]).filter((r: any) => r.approvalStatus === "rejected");

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/registrations/${id}/approve`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      queryClient.invalidateQueries({ queryKey: ["pending-count"] });
      toast({ title: "✅ Player approved", description: "They now have full access." });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/registrations/${id}/reject`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      queryClient.invalidateQueries({ queryKey: ["pending-count"] });
      toast({ title: "Registration rejected" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/registrations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      toast({ title: "Registration deleted" });
    },
  });

  const setLevelMutation = useMutation({
    mutationFn: ({ id, level }: { id: number; level: string }) =>
      apiFetch(`/admin/users/${id}/level`, { method: "PUT", body: JSON.stringify({ level }) }),
    onSuccess: (updated: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: `Level updated to WPT ${updated.level} for ${updated.name}` });
      setEditingLevel((prev) => { const n = { ...prev }; delete n[updated.id]; return n; });
    },
    onError: () => toast({ title: "Failed to update level", variant: "destructive" }),
  });

  const setRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      apiFetch(`/admin/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "Role updated" }); },
    onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
  });

  const userDeleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "User deleted" }); },
    onError: () => toast({ title: "Failed to delete user", variant: "destructive" }),
  });

  const filteredUsers = (users as any[]).filter((u: any) =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const tabs = [
    { id: "overview", label: "Overview" },
    {
      id: "registrations",
      label: "New Registrations",
      badge: pending.length > 0 ? pending.length : null,
    },
  ] as const;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <header>
          <h1 className="text-3xl font-serif mb-1">Admin Console</h1>
          <p className="text-muted-foreground">Platform overview and user management.</p>
        </header>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-lg w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.badge && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-yellow-500 text-black text-xs font-bold flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── OVERVIEW TAB ─── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Users",    value: stats?.totalUsers ?? "–",                  color: "" },
                { label: "Online Now",     value: stats?.onlineUsers ?? "–",                 color: "text-accent" },
                { label: "Total Matches",  value: stats?.totalMatches ?? "–",                color: "" },
                { label: "Daily Revenue",  value: stats ? `${stats.dailyRevenue} AED` : "–", color: "text-primary" },
              ].map(({ label, value, color }) => (
                <Card key={label} className="bg-card border-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-mono ${color}`}>{value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Level chart */}
            {stats?.levelDistribution && (
              <Card className="bg-card border-white/5">
                <CardHeader>
                  <CardTitle className="text-sm">WPT Level Distribution</CardTitle>
                </CardHeader>
                <CardContent className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.levelDistribution}>
                      <XAxis dataKey="level" stroke="#6b7a99" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#6b7a99" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.05)" }}
                        contentStyle={{ backgroundColor: "#0d1420", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                      />
                      <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* User management */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-serif">User Management</h2>
                <span className="text-sm text-muted-foreground">{filteredUsers.length} users</span>
              </div>
              <div className="mb-4">
                <Input
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-sm bg-background border-white/10"
                />
              </div>
              <div className="rounded-xl border border-white/5 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/3 border-b border-white/5">
                    <tr>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">User</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Role</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">WPT Level</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Stats</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {usersLoading ? (
                      <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Loading users…</td></tr>
                    ) : filteredUsers.map((u: any) => (
                      <tr key={u.id} className="hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {u.role === "owner" && <span className="text-yellow-400 text-sm">👑</span>}
                            <div>
                              <div className="font-medium text-foreground">{u.name}</div>
                              <div className="text-xs text-muted-foreground">{u.email}</div>
                            </div>
                            {u.verified && <span className="text-accent text-xs ml-1">✓</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Select defaultValue={u.role} onValueChange={(role) => setRoleMutation.mutate({ id: u.id, role })}>
                            <SelectTrigger className={`h-7 text-xs w-24 border ${ROLE_COLORS[u.role] ?? ""}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["player","coach","admin","owner"].map((r) => (
                                <SelectItem key={r} value={r} className="text-xs capitalize">{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Select
                              defaultValue={u.level}
                              value={editingLevel[u.id] ?? u.level}
                              onValueChange={(v) => setEditingLevel((prev) => ({ ...prev, [u.id]: v }))}
                            >
                              <SelectTrigger className="h-7 text-xs w-20 bg-background border-white/10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {WPT_LEVELS.map((l) => (
                                  <SelectItem key={l} value={l} className="text-xs font-mono">{l}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {editingLevel[u.id] && editingLevel[u.id] !== u.level && (
                              <Button size="sm" className="h-7 px-2 text-xs"
                                onClick={() => setLevelMutation.mutate({ id: u.id, level: editingLevel[u.id] })}
                                disabled={setLevelMutation.isPending}>
                                Save
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-muted-foreground">
                            <span>{u.matchesPlayed}M</span>
                            <span className="mx-1 text-accent">{u.wins}W</span>
                            {u.isOnline && <span className="text-green-400">● online</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-card border-white/10">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {u.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove their account, bookings, and all associated data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground"
                                  onClick={() => userDeleteMutation.mutate(u.id)}>
                                  Delete User
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── NEW REGISTRATIONS TAB ─── */}
        {activeTab === "registrations" && (
          <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {pending.length > 0 ? (
                  <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-sm px-3 py-1">
                    {pending.length} pending approval
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/10 text-sm px-3 py-1">
                    ✅ All clear
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  Updates every 30s
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-white/10 text-sm gap-2"
                onClick={() => refetchRegs()}
                disabled={regsRefetching}
              >
                {regsRefetching ? "⟳ Refreshing…" : "⟳ Refresh"}
              </Button>
            </div>

            {regsLoading ? (
              <div className="text-center py-16 text-muted-foreground">Loading registrations…</div>
            ) : pending.length === 0 && rejected.length === 0 ? (
              <Card className="bg-card border-white/5">
                <CardContent className="py-16 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <div className="font-medium mb-1">All caught up</div>
                  <div className="text-sm text-muted-foreground">No pending or rejected registrations.</div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* PENDING TABLE */}
                {pending.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2 px-1">
                      Pending ({pending.length})
                    </div>
                    <div className="rounded-xl border border-yellow-500/20 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-yellow-500/5 border-b border-yellow-500/20">
                          <tr>
                            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Name</th>
                            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Email</th>
                            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Phone</th>
                            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Level</th>
                            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Registered</th>
                            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {pending.map((r: any) => (
                            <tr key={r.id} className="hover:bg-white/2 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-400 font-serif text-sm flex-shrink-0">
                                    {r.name?.[0] ?? "?"}
                                  </div>
                                  <div>
                                    <div className="font-medium">{r.name}</div>
                                    <div className="text-xs text-muted-foreground capitalize">{r.goal}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{r.email}</td>
                              <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{r.phone || "—"}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="text-xs font-mono">{r.level}</Badge>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-xs">
                                  <div>{fmtDate(r.createdAt)}</div>
                                  <div className="text-muted-foreground">{timeAgo(r.createdAt)}</div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    className="h-7 px-3 text-xs bg-green-600 hover:bg-green-500 text-white"
                                    onClick={() => approveMutation.mutate(r.id)}
                                    disabled={approveMutation.isPending}
                                  >
                                    ✅ Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-3 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                    onClick={() => rejectMutation.mutate(r.id)}
                                    disabled={rejectMutation.isPending}
                                  >
                                    ❌ Reject
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* REJECTED TABLE */}
                {rejected.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2 px-1">
                      Rejected ({rejected.length})
                    </div>
                    <div className="rounded-xl border border-white/5 overflow-hidden opacity-70">
                      <table className="w-full text-sm">
                        <thead className="bg-white/3 border-b border-white/5">
                          <tr>
                            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Name</th>
                            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Email</th>
                            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Phone</th>
                            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Level</th>
                            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Registered</th>
                            <th className="text-left px-4 py-3 text-muted-foreground font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {rejected.map((r: any) => (
                            <tr key={r.id} className="hover:bg-white/2 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-medium">{r.name}</div>
                                <div className="text-xs text-muted-foreground capitalize">{r.goal}</div>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{r.email}</td>
                              <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{r.phone || "—"}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="text-xs font-mono">{r.level}</Badge>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.createdAt)}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    className="h-7 px-3 text-xs bg-green-600 hover:bg-green-500 text-white"
                                    onClick={() => approveMutation.mutate(r.id)}
                                    disabled={approveMutation.isPending}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                                    onClick={() => deleteMutation.mutate(r.id)}
                                    disabled={deleteMutation.isPending}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
