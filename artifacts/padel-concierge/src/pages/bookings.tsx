import { AppLayout } from "@/components/layout/AppLayout";
import { useListBookings } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

const PAYMENT_STATUS_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  completed: { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.3)",  color: "#4ade80" },
  pending:   { bg: "rgba(234,179,8,0.12)",  border: "rgba(234,179,8,0.3)",  color: "#facc15" },
  failed:    { bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.25)", color: "#f87171" },
  cancelled: { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" },
};

function paymentStyle(status: string) {
  return PAYMENT_STATUS_STYLES[status] ?? PAYMENT_STATUS_STYLES.pending;
}

function isUpcoming(date: string | undefined) {
  if (!date) return false;
  return new Date(date) >= new Date(new Date().toDateString());
}

export default function Bookings() {
  const { user } = useAuth();
  const { data: bookings, isLoading } = useListBookings({ userId: user?.id });

  const upcoming = (bookings ?? []).filter(b => isUpcoming(b.match?.date));
  const past = (bookings ?? []).filter(b => !isUpcoming(b.match?.date));

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 animate-fade-up" style={{ paddingTop: "28px" }}>

        {/* ── HEADER ── */}
        <header className="mb-6">
          <h1 className="font-serif font-bold text-white mb-1" style={{ fontSize: "26px" }}>
            My Bookings
          </h1>
          <p className="text-muted-foreground" style={{ fontSize: "15px" }}>
            Your upcoming and past matches.
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="rounded-[20px] p-5 animate-pulse"
                style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)", minHeight: "110px" }}
              />
            ))}
          </div>
        ) : (bookings ?? []).length === 0 ? (
          <div
            className="rounded-[20px] p-10 text-center"
            style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="text-3xl mb-3">📅</div>
            <div className="text-white font-medium mb-1">No bookings yet</div>
            <div className="text-muted-foreground mb-4" style={{ fontSize: "14px" }}>
              Join a match to see your bookings here.
            </div>
            <Link href="/matches">
              <button
                className="rounded-full font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  height: "44px",
                  padding: "0 24px",
                  fontSize: "15px",
                  background: "#D4AF37",
                  color: "#000",
                }}
              >
                Find a Match
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── UPCOMING ── */}
            {upcoming.length > 0 && (
              <section>
                <div
                  className="uppercase font-semibold mb-3"
                  style={{ fontSize: "11px", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}
                >
                  Upcoming
                </div>
                <div className="space-y-3">
                  {upcoming.map(booking => {
                    const ps = paymentStyle(booking.paymentStatus ?? "pending");
                    return (
                      <Link key={booking.id} href={`/bookings/${booking.id}`}>
                        <div
                          className="rounded-[20px] p-5 cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.99]"
                          style={{
                            background: "hsl(220 20% 6%)",
                            border: "1px solid rgba(212,175,55,0.15)",
                          }}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="font-serif font-semibold text-white truncate" style={{ fontSize: "17px" }}>
                                {booking.match?.clubName ?? "Match"}
                              </div>
                              <div className="text-muted-foreground mt-0.5" style={{ fontSize: "13px" }}>
                                {booking.match?.date} · {booking.match?.time}
                                {booking.match?.format && ` · ${booking.match.format}`}
                              </div>
                            </div>
                            <span
                              className="rounded-full px-3 py-1 font-medium capitalize flex-shrink-0"
                              style={{
                                fontSize: "12px",
                                background: ps.bg,
                                border: `1px solid ${ps.border}`,
                                color: ps.color,
                              }}
                            >
                              {booking.paymentStatus}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <span
                              className="rounded-full px-3 py-1.5 font-semibold"
                              style={{ fontSize: "13px", background: "#D4AF37", color: "#000" }}
                            >
                              View Details
                            </span>
                            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "20px", lineHeight: 1 }}>›</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── PAST ── */}
            {past.length > 0 && (
              <section>
                <div
                  className="uppercase font-semibold mb-3"
                  style={{ fontSize: "11px", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}
                >
                  Past
                </div>
                <div className="space-y-3">
                  {past.map(booking => {
                    const ps = paymentStyle(booking.paymentStatus ?? "pending");
                    return (
                      <Link key={booking.id} href={`/bookings/${booking.id}`}>
                        <div
                          className="rounded-[20px] p-5 cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.99]"
                          style={{
                            background: "hsl(220 20% 6%)",
                            border: "1px solid rgba(255,255,255,0.07)",
                          }}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="font-serif font-semibold text-white truncate" style={{ fontSize: "17px", opacity: 0.75 }}>
                                {booking.match?.clubName ?? "Match"}
                              </div>
                              <div className="text-muted-foreground mt-0.5" style={{ fontSize: "13px" }}>
                                {booking.match?.date} · {booking.match?.time}
                                {booking.match?.format && ` · ${booking.match.format}`}
                              </div>
                            </div>
                            <span
                              className="rounded-full px-3 py-1 font-medium capitalize flex-shrink-0"
                              style={{
                                fontSize: "12px",
                                background: ps.bg,
                                border: `1px solid ${ps.border}`,
                                color: ps.color,
                              }}
                            >
                              {booking.paymentStatus}
                            </span>
                          </div>

                          <div className="flex items-center justify-end pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "20px", lineHeight: 1 }}>›</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        <div style={{ height: "32px" }} />
      </div>
    </AppLayout>
  );
}
