import { AppLayout } from "@/components/layout/AppLayout";
import { useGetMatchSuggestions, getGetMatchSuggestionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Lock } from "lucide-react";

export default function MatchSuggest() {
  const { user } = useAuth();
  const { data: suggestions, isLoading } = useGetMatchSuggestions(
    { userId: user?.id || 0 },
    { query: { enabled: !!user?.id, queryKey: getGetMatchSuggestionsQueryKey({ userId: user?.id || 0 }) } }
  );

  const renderCard = (title: string, match: any, type: string) => {
    if (!match) return null;
    
    const isLocked = type === 'best' && !user?.verified;

    return (
      <Card className="bg-card border-white/5 relative overflow-hidden h-full flex flex-col">
        {isLocked && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 text-center border border-white/10">
            <Lock className="w-8 h-8 text-muted-foreground mb-4" />
            <h3 className="font-serif text-xl mb-2">Verification Required</h3>
            <p className="text-sm text-muted-foreground mb-6">Play 1 verification match to unlock Best Match suggestions.</p>
            <Button variant="outline">Learn More</Button>
          </div>
        )}
        
        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle className="flex justify-between items-center">
            <span>{title}</span>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{match.balanceScore}% Match</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-6">
          <div>
            <div className="font-serif text-xl mb-1">{match.clubName}</div>
            <div className="text-sm text-muted-foreground">{match.date} at {match.time}</div>
          </div>
          
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground mb-2">Players</div>
            {match.players.map((p: any) => (
              <div key={p.userId} className="flex justify-between items-center text-sm">
                <span>{p.name}</span>
                <span className="font-mono text-muted-foreground">{p.level}</span>
              </div>
            ))}
          </div>

          <Link href={`/matches/${match.id}`}>
            <Button className="w-full">View Match</Button>
          </Link>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) return <AppLayout><div className="p-8">Analyzing player network...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 sm:space-y-8">
        <header>
          <h1 className="text-3xl font-serif mb-2">Smart Match Suggestions</h1>
          <p className="text-muted-foreground">Curated games based on your level, style, and history.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {renderCard("Best Match", suggestions?.best, "best")}
          {renderCard("Balanced", suggestions?.balanced, "balanced")}
          {renderCard("Challenging", suggestions?.challenging, "challenging")}
          {renderCard("Easy", suggestions?.easy, "easy")}
        </div>
      </div>
    </AppLayout>
  );
}
