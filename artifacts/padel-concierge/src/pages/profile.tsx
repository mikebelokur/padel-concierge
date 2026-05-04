import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useGetPlayerStats, getGetPlayerStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ['#2d7dff', '#00d4ff', '#6b7a99'];

export default function Profile() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useGetPlayerStats(user?.id || 0, {
    query: { enabled: !!user?.id, queryKey: getGetPlayerStatsQueryKey(user?.id || 0) }
  });

  if (isLoading) return <AppLayout><div className="p-8">Loading profile...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <header className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif text-3xl border border-primary/30">
            {user?.name?.[0]}
          </div>
          <div>
            <h1 className="text-3xl font-serif mb-2">{user?.name}</h1>
            <div className="flex gap-3 items-center">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-sm px-3">{user?.level}</Badge>
              <span className="text-muted-foreground">{user?.locationName}</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card border-white/5 md:col-span-2">
            <CardHeader>
              <CardTitle>Level Progression</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Current: {user?.level}</span>
                <span className="text-muted-foreground">{stats?.winsToNextLevel} wins to next level</span>
              </div>
              <Progress value={stats?.levelProgress || 0} className="h-3 bg-white/5" />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>D-</span><span>D</span><span>D+</span><span>C-</span><span>C</span><span>C+</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Level Confidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-mono text-accent">{stats?.levelConfidence || 0}%</div>
              <p className="text-xs text-muted-foreground mt-2">Based on recent performance against verified players</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card border-white/5">
            <CardHeader>
              <CardTitle>Win Trend (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {stats?.winTrend && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.winTrend}>
                    <XAxis dataKey="date" stroke="#6b7a99" fontSize={12} />
                    <YAxis stroke="#6b7a99" fontSize={12} />
                    <Tooltip contentStyle={{backgroundColor: '#0d1420', border: '1px solid rgba(255,255,255,0.1)'}} />
                    <Line type="monotone" dataKey="winRate" stroke="#2d7dff" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-white/5">
            <CardHeader>
              <CardTitle>Format Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="h-64 flex items-center justify-center">
              {stats?.formatBreakdown && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.formatBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="format"
                    >
                      {stats.formatBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{backgroundColor: '#0d1420', border: '1px solid rgba(255,255,255,0.1)'}} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
