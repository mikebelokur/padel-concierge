import { AppLayout } from "@/components/layout/AppLayout";
import { useListMatches } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Matches() {
  const { data: matches, isLoading } = useListMatches();

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-5 sm:space-y-8">
        <div className="flex items-center justify-between">
          <header>
            <h1 className="text-3xl font-serif mb-2">Available Matches</h1>
            <p className="text-muted-foreground">Find the right game for your level.</p>
          </header>
          <Link href="/matches/suggest">
            <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">Smart Suggestions</Button>
          </Link>
        </div>

        {isLoading ? (
          <div>Loading matches...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches?.map((match) => (
              <Card key={match.id} className="bg-card border-white/5 overflow-hidden hover:border-white/10 transition-colors">
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-serif text-xl">{match.clubName}</div>
                      <div className="text-sm text-muted-foreground">{match.date} at {match.time}</div>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {match.format}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <div>
                      <span className="text-muted-foreground">Level: </span>
                      <span className="font-mono">{match.levelMin} - {match.levelMax}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Price: </span>
                      <span className="font-mono">{match.price} AED</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-primary font-mono">{match.players.length}</span>
                      <span className="text-muted-foreground">/4 Players</span>
                    </div>
                    <Link href={`/matches/${match.id}`}>
                      <Button size="sm">View Details</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
