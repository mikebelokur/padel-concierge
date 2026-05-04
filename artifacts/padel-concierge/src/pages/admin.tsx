import { AppLayout } from "@/components/layout/AppLayout";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function Admin() {
  const { data: stats, isLoading } = useGetDashboardStats({
    query: { refetchInterval: 30000 }
  });

  if (isLoading) return <AppLayout><div className="p-8">Loading admin data...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-serif mb-2">Admin Console</h1>
          <p className="text-muted-foreground">Real-time platform overview.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-card border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Online Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono text-accent">{stats?.onlineUsers || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Matches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono">{stats?.totalMatches || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Daily Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono text-primary">{stats?.dailyRevenue || 0} AED</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card border-white/5">
            <CardHeader>
              <CardTitle>Level Distribution</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {stats?.levelDistribution && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.levelDistribution}>
                    <XAxis dataKey="level" stroke="#6b7a99" />
                    <YAxis stroke="#6b7a99" />
                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#0d1420', border: '1px solid rgba(255,255,255,0.1)'}} />
                    <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
