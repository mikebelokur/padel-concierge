import { useAuth } from "@/contexts/AuthContext";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  const { user } = useAuth();
  
  // Example call for stats
  const { data: stats, isLoading } = useGetDashboardStats();

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar Placeholder */}
      <div className="w-64 border-r border-white/5 bg-card flex flex-col">
        <div className="p-6 font-serif text-xl border-b border-white/5">Padel Concierge</div>
        <div className="p-4 flex-1 space-y-2">
          <div className="px-4 py-2 bg-primary/10 text-primary rounded-md font-medium">Dashboard</div>
          <div className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-md cursor-pointer transition-colors">Matches</div>
          <div className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-md cursor-pointer transition-colors">Bookings</div>
          <div className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-md cursor-pointer transition-colors">Profile</div>
        </div>
      </div>

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          <header>
            <h1 className="text-3xl font-serif mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {user?.name || 'Player'}. Here is your overview.</p>
          </header>
          
          {isLoading ? (
            <div>Loading stats...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <CardTitle className="text-sm font-medium text-muted-foreground">Online Players</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-mono text-accent">{stats?.onlineUsers || 0}</div>
                </CardContent>
              </Card>
              <Card className="bg-card border-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Matches Played</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-mono">{user?.matchesPlayed || 0}</div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
