import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

interface Court {
  id: number;
  name: string;
  location: string;
  address: string;
  pricePerHour: number;
  amenities: string[];
  surface: string;
  indoor: boolean;
  imageUrl: string | null;
  availableSlots: string[];
}

interface Slot { time: string; available: boolean; }

interface CourtBooking {
  id: number;
  courtId: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  totalPrice: number;
  court: Court | null;
}

const SURFACE_COLORS: Record<string, string> = {
  clay: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  concrete: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  artificial: "text-green-400 bg-green-400/10 border-green-400/20",
};

export default function Courts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("");
  const [showModal, setShowModal] = useState(false);

  const { data: courts = [], isLoading } = useQuery({
    queryKey: ["courts"],
    queryFn: () => apiFetch<Court[]>("/courts"),
  });

  const { data: myBookings = [] } = useQuery({
    queryKey: ["court-bookings", user?.id],
    queryFn: () => apiFetch<CourtBooking[]>(`/court-bookings?userId=${user?.id}`),
    enabled: !!user?.id,
  });

  const { data: slots = [] } = useQuery({
    queryKey: ["court-availability", selectedCourt?.id, bookDate],
    queryFn: () => apiFetch<Slot[]>(`/courts/${selectedCourt!.id}/availability?date=${bookDate}`),
    enabled: !!selectedCourt && !!bookDate,
  });

  const bookMutation = useMutation({
    mutationFn: () => apiFetch("/court-bookings", {
      method: "POST",
      body: JSON.stringify({ userId: user?.id, courtId: selectedCourt?.id, date: bookDate, startTime: bookTime }),
    }),
    onSuccess: () => {
      toast({ title: "Court booked!", description: `${selectedCourt?.name} on ${bookDate} at ${bookTime}` });
      qc.invalidateQueries({ queryKey: ["court-bookings"] });
      qc.invalidateQueries({ queryKey: ["court-availability"] });
      setShowModal(false);
      setBookTime("");
    },
    onError: (e: Error) => toast({ title: "Booking failed", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/court-bookings/${id}/cancel`, { method: "PATCH" }),
    onSuccess: () => {
      toast({ title: "Booking cancelled" });
      qc.invalidateQueries({ queryKey: ["court-bookings"] });
    },
  });

  const today = new Date().toISOString().split("T")[0];
  const upcomingBookings = myBookings.filter((b) => b.status !== "cancelled" && b.date >= today);
  const pastBookings = myBookings.filter((b) => b.status !== "cancelled" && b.date < today).slice(0, 3);

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-10">
        <header>
          <h1 className="text-3xl font-serif mb-2">Courts</h1>
          <p className="text-muted-foreground">Book a premium court in Dubai. All courts include equipment and coaching access.</p>
        </header>

        {/* Court Grid */}
        {isLoading ? (
          <div className="text-muted-foreground">Loading courts...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courts.map((court) => (
              <Card key={court.id} className="bg-card border-white/5 hover:border-white/10 transition-all group overflow-hidden">
                <div className="h-36 bg-gradient-to-br from-primary/10 to-accent/5 flex items-center justify-center relative">
                  <div className="text-5xl opacity-30">🏟️</div>
                  <div className="absolute top-3 right-3 flex gap-2">
                    <Badge variant="outline" className={`text-xs ${SURFACE_COLORS[court.surface] ?? "text-muted-foreground"}`}>
                      {court.surface}
                    </Badge>
                    {court.indoor && (
                      <Badge variant="outline" className="text-xs text-primary bg-primary/10 border-primary/20">Indoor</Badge>
                    )}
                  </div>
                </div>
                <CardContent className="p-5 space-y-3">
                  <div>
                    <h3 className="font-serif text-lg leading-tight">{court.name}</h3>
                    <p className="text-sm text-muted-foreground">{court.location}</p>
                    <p className="text-xs text-muted-foreground">{court.address}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {court.amenities.slice(0, 3).map((a) => (
                      <Badge key={a} variant="outline" className="text-xs border-white/10 text-muted-foreground">{a}</Badge>
                    ))}
                    {court.amenities.length > 3 && (
                      <Badge variant="outline" className="text-xs border-white/10 text-muted-foreground">+{court.amenities.length - 3}</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-mono text-primary">{court.pricePerHour} AED<span className="text-muted-foreground text-xs">/hr</span></span>
                    <Button
                      size="sm"
                      onClick={() => { setSelectedCourt(court); setShowModal(true); setBookDate(""); setBookTime(""); }}
                    >
                      Book Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* My Bookings */}
        {upcomingBookings.length > 0 && (
          <section>
            <h2 className="text-xl font-serif mb-4">My Upcoming Court Bookings</h2>
            <div className="space-y-3">
              {upcomingBookings.map((b) => (
                <Card key={b.id} className="bg-card border-white/5">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-xl">🏟️</div>
                      <div>
                        <div className="font-medium">{b.court?.name}</div>
                        <div className="text-sm text-muted-foreground">{b.date} · {b.startTime} – {b.endTime}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-muted-foreground">{b.totalPrice} AED</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/10 text-muted-foreground hover:text-destructive hover:border-destructive/30"
                        onClick={() => cancelMutation.mutate(b.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Booking Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="bg-card border-white/10 text-foreground max-w-md">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Book {selectedCourt?.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">{selectedCourt?.address}</p>
            </DialogHeader>
            <div className="space-y-5 mt-2">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  min={today}
                  value={bookDate}
                  onChange={(e) => { setBookDate(e.target.value); setBookTime(""); }}
                  className="bg-background border-white/10"
                />
              </div>
              {bookDate && (
                <div className="space-y-2">
                  <Label>Time Slot</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((s) => (
                      <button
                        key={s.time}
                        disabled={!s.available}
                        onClick={() => setBookTime(s.time)}
                        className={`py-2 px-3 rounded-md text-sm font-mono border transition-all ${
                          bookTime === s.time
                            ? "bg-primary text-white border-primary"
                            : s.available
                            ? "bg-background border-white/10 hover:border-primary/50 text-foreground"
                            : "bg-background/30 border-white/5 text-muted-foreground/40 cursor-not-allowed"
                        }`}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-muted-foreground text-sm">Total: <span className="font-mono text-foreground">{selectedCourt?.pricePerHour} AED</span></span>
                <Button
                  onClick={() => bookMutation.mutate()}
                  disabled={!bookDate || !bookTime || bookMutation.isPending}
                  className="shadow-lg shadow-primary/20"
                >
                  {bookMutation.isPending ? "Booking..." : "Confirm Booking"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
