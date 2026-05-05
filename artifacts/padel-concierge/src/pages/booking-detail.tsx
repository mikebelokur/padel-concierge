import { AppLayout } from "@/components/layout/AppLayout";
import { useGetBooking, useCreatePaymentIntent, useConfirmPayment, getGetBookingQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function BookingDetail() {
  const params = useParams();
  const bookingId = Number(params.id);
  const queryClient = useQueryClient();
  const { data: booking, isLoading } = useGetBooking(bookingId, { 
    query: { enabled: !!bookingId, queryKey: getGetBookingQueryKey(bookingId) } 
  });
  
  const createIntent = useCreatePaymentIntent();
  const confirmPayment = useConfirmPayment();
  const { toast } = useToast();
  const [isPaying, setIsPaying] = useState(false);

  const handlePayment = async () => {
    setIsPaying(true);
    try {
      const intent = await createIntent.mutateAsync({ id: bookingId });
      await confirmPayment.mutateAsync({ 
        id: bookingId, 
        data: { paymentIntentId: intent.paymentIntentId } 
      });
      toast({ title: "Payment Successful", description: "Your spot is secured." });
      queryClient.invalidateQueries({ queryKey: getGetBookingQueryKey(bookingId) });
    } catch (e) {
      toast({ title: "Payment Failed", variant: "destructive" });
    } finally {
      setIsPaying(false);
    }
  };

  if (isLoading) return <AppLayout><div className="p-8">Loading...</div></AppLayout>;
  if (!booking) return <AppLayout><div className="p-8">Booking not found</div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-5 sm:space-y-8">
        <header className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-serif mb-2">Booking #{booking.id}</h1>
            <p className="text-muted-foreground">{booking.match?.clubName} • {booking.match?.date}</p>
          </div>
          <Badge variant="outline" className={
            booking.paymentStatus === 'completed' ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"
          }>
            {booking.paymentStatus}
          </Badge>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="bg-card border-white/5">
            <CardHeader>
              <CardTitle>Match Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-muted-foreground">Date</span>
                <span>{booking.match?.date}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-muted-foreground">Time</span>
                <span>{booking.match?.time}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-muted-foreground">Format</span>
                <span>{booking.match?.format}</span>
              </div>
              <div className="flex justify-between py-2 font-medium text-lg">
                <span>Total</span>
                <span>{booking.match?.price} AED</span>
              </div>
              {booking.paymentStatus === 'completed' && (
                <Button variant="outline" className="w-full mt-4">Add to Calendar</Button>
              )}
            </CardContent>
          </Card>

          {booking.paymentStatus !== 'completed' && (
            <Card className="bg-card border-white/5">
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Card Number</Label>
                  <Input placeholder="4242 4242 4242 4242" className="bg-background border-white/10 font-mono" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Expiry</Label>
                    <Input placeholder="MM/YY" className="bg-background border-white/10" />
                  </div>
                  <div className="space-y-2">
                    <Label>CVC</Label>
                    <Input placeholder="123" className="bg-background border-white/10" />
                  </div>
                </div>
                <Button 
                  className="w-full mt-6" 
                  onClick={handlePayment}
                  disabled={isPaying}
                >
                  {isPaying ? "Processing..." : `Pay ${booking.match?.price} AED`}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
