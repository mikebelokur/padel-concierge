import { AppLayout } from "@/components/layout/AppLayout";
import { useGetMatch, useCreateBooking, getGetMatchQueryKey } from "@workspace/api-client-react";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function MatchDetail() {
  const params = useParams();
  const matchId = Number(params.id);
  const { data: match, isLoading } = useGetMatch(matchId, { query: { enabled: !!matchId, queryKey: getGetMatchQueryKey(matchId) } });
  const [phase, setPhase] = useState(0);
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes per phase
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const createBooking = useCreateBooking();
  const { toast } = useToast();

  const phases = [
    { title: "Baseline Defence", duration: 180, desc: "Depth, sending ball deep" },
    { title: "Glass Defence", duration: 180, desc: "Rebounds, high ball control" },
    { title: "Volley Play", duration: 120, desc: "Clean strikes, soft hands" },
    { title: "Smash/Bandeja", duration: 120, desc: "Aggressive overhead shots" }
  ];

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
      return () => clearTimeout(timer);
    } else if (phase < phases.length - 1) {
      setPhase(p => p + 1);
      setTimeLeft(phases[phase + 1].duration);
    }
  }, [timeLeft, phase]);

  const handleBook = () => {
    if (!user) return;
    createBooking.mutate({ data: { userId: user.id, matchId } }, {
      onSuccess: (booking) => {
        toast({ title: "Booking created", description: "Redirecting to payment..." });
        setLocation(`/bookings/${booking.id}`);
      }
    });
  };

  if (isLoading) return <AppLayout><div className="p-8">Loading match details...</div></AppLayout>;
  if (!match) return <AppLayout><div className="p-8">Match not found</div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <header>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-serif">{match.clubName}</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary text-lg px-4 py-1">{match.price} AED</Badge>
          </div>
          <div className="flex gap-4 text-muted-foreground">
            <span>{match.date}</span>
            <span>•</span>
            <span>{match.time}</span>
            <span>•</span>
            <span>{match.format} format</span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <Card className="bg-card border-white/5">
              <CardHeader>
                <CardTitle>Players ({match.players.length}/4)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {match.players.map(player => (
                  <div key={player.userId} className="flex items-center justify-between p-3 rounded-lg bg-background border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-serif text-primary">
                        {player.name[0]}
                      </div>
                      <div>
                        <div className="font-medium">{player.name}</div>
                        <div className="text-sm text-muted-foreground">{player.level}</div>
                      </div>
                    </div>
                    {player.confirmed && <Badge variant="outline" className="text-primary border-primary/20">Confirmed</Badge>}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-card border-white/5">
              <CardHeader>
                <CardTitle className="text-destructive">Latecomers Rule</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Strict 5-minute grace period. After 5 minutes, you must join without warm-up. This ensures the quality and intensity of the match for all confirmed players.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-card border-white/5">
              <CardHeader>
                <CardTitle>Warm-up Protocol</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center p-4 bg-background rounded-lg border border-white/5">
                  <div className="text-sm text-primary mb-1">{phases[phase].title}</div>
                  <div className="text-3xl font-mono">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</div>
                  <div className="text-xs text-muted-foreground mt-2">{phases[phase].desc}</div>
                </div>
                <div className="space-y-2">
                  {phases.map((p, i) => (
                    <div key={i} className={`h-2 rounded-full ${i <= phase ? 'bg-primary' : 'bg-white/10'}`} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Button 
              size="lg" 
              className="w-full text-lg h-14" 
              onClick={handleBook}
              disabled={createBooking.isPending || match.players.length >= 4}
            >
              {createBooking.isPending ? "Confirming..." : "Confirm Booking"}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
