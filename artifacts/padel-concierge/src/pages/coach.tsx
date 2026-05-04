import { AppLayout } from "@/components/layout/AppLayout";
import { useListCoachPlayers, useListCoachUpcomingMatches, useListVideoAnalyses, useVerifyUser } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function CoachDashboard() {
  const { data: players } = useListCoachPlayers();
  const { data: matches } = useListCoachUpcomingMatches();
  const { data: analyses } = useListVideoAnalyses();
  const verifyUser = useVerifyUser();
  const { toast } = useToast();

  const handleVerify = (id: number) => {
    verifyUser.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Player Verified", description: "The player's skill level has been verified." });
      }
    });
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-serif mb-2">Coach Dashboard</h1>
          <p className="text-muted-foreground">Manage your players, matches, and video analysis queue.</p>
        </header>

        <Tabs defaultValue="players">
          <TabsList className="bg-card border-white/5">
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="matches">Upcoming Matches</TabsTrigger>
            <TabsTrigger value="analyses">Video Analyses</TabsTrigger>
          </TabsList>

          <TabsContent value="players" className="mt-6 space-y-4">
            {players?.map(player => (
              <Card key={player.id} className="bg-card border-white/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center font-serif text-primary">
                      {player.name[0]}
                    </div>
                    <div>
                      <div className="font-medium">{player.name}</div>
                      <div className="text-sm text-muted-foreground">{player.level} • {player.goal}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {player.verified ? (
                      <Badge className="bg-green-500/20 text-green-400">Verified</Badge>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleVerify(player.id)} disabled={verifyUser.isPending}>
                        Verify Level
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="matches" className="mt-6 space-y-4">
            {matches?.map(match => (
              <Card key={match.id} className="bg-card border-white/5">
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <div className="font-serif text-lg">{match.clubName}</div>
                    <div className="text-sm text-muted-foreground">{match.date} at {match.time} • {match.format}</div>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    {match.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="analyses" className="mt-6 space-y-4">
            {analyses?.map(analysis => (
              <Card key={analysis.id} className="bg-card border-white/5">
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <div className="font-medium">Video Analysis #{analysis.id}</div>
                    <div className="text-sm text-muted-foreground">Uploaded: {analysis.uploadDate}</div>
                  </div>
                  <Badge variant="outline">{analysis.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
