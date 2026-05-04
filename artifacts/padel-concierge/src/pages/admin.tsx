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

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingLevel, setEditingLevel] = useState<Record<number, string>>({});

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { refetchInterval: 30000 },
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/admin/users"),
  });

  const setLevelMutation = useMutation({
    mutationFn: ({ id, level }: { id: number; level: string }) =>
      apiFetch(`/admin/users/${id}/level`, {
        method: "PUT",
        body: JSON.stringify({ level }),
      }),
    onSuccess: (updated: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: `Level updated to WPT ${updated.level} for ${updated.name}` });
      setEditingLevel((prev) => {
        const n = { ...prev };
        delete n[updated.id];
        return n;
      });
    },
    onError: () => toast({ title: "Failed to update level", variant: "destructive" }),
  });

  const setRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      apiFetch(`/admin/users/${id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Role updated" });
    },
    onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User deleted" });
    },
    onError: () => toast({ title: "Failed to delete user", variant: "destructive" }),
  });

  const filteredUsers = users.filter((u: any) =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-serif mb-1 flex items-center gap-2">
            Admin Console
          </h1>
          <p className="text-muted-foreground">Platform overview and user management.</p>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: stats?.totalUsers ?? "–", color: "" },
            { label: "Online Now", value: stats?.onlineUsers ?? "–", color: "text-accent" },
            { label: "Total Matches", value: stats?.totalMatches ?? "–", color: "" },
            { label: "Daily Revenue", value: stats ? `${stats.dailyRevenue} AED` : "–", color: "text-primary" },
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

        {/* Level distribution chart */}
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

        {/* User Management */}
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
                      <Select
                        defaultValue={u.role}
                        onValueChange={(role) => setRoleMutation.mutate({ id: u.id, role })}
                      >
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
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setLevelMutation.mutate({ id: u.id, level: editingLevel[u.id] })}
                            disabled={setLevelMutation.isPending}
                          >
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
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground"
                              onClick={() => deleteMutation.mutate(u.id)}
                            >
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
    </AppLayout>
  );
}
