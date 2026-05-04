import { AppLayout } from "@/components/layout/AppLayout";
import { useListBookings } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

export default function Bookings() {
  const { user } = useAuth();
  const { data: bookings, isLoading } = useListBookings({ userId: user?.id });

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-serif mb-2">My Bookings</h1>
          <p className="text-muted-foreground">Your upcoming and past matches.</p>
        </header>

        {isLoading ? (
          <div>Loading bookings...</div>
        ) : (
          <div className="space-y-4">
            {bookings?.map((booking) => (
              <Card key={booking.id} className="bg-card border-white/5">
                <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-serif text-xl">{booking.match?.clubName}</h3>
                      <Badge variant="outline" className={
                        booking.paymentStatus === 'completed' ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                      }>
                        {booking.paymentStatus}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground text-sm flex gap-4">
                      <span>{booking.match?.date}</span>
                      <span>{booking.match?.time}</span>
                      <span>{booking.match?.format}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 w-full md:w-auto">
                    <Link href={`/bookings/${booking.id}`}>
                      <Button className="w-full md:w-auto">View Details</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {bookings?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground bg-card border border-white/5 rounded-lg">
                No bookings found. <Link href="/matches" className="text-primary hover:underline">Find a match</Link>.
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
