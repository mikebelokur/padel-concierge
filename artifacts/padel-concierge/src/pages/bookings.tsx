import { AppLayout } from "@/components/layout/AppLayout";
import { PullToRefreshIndicator } from "@/components/ui/PullToRefreshIndicator";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useListBookings } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

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

function BookingCardSkeleton({ upcoming = false }: { upcoming?: boolean }) {
  return (
    <div
      className="rounded-[20px] p-5"
      style={{
        background: "hsl(220 20% 6%)",
        border: `1px solid ${upcoming ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.06)"}`,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div
            className="rounded-md animate-pulse mb-2"
            style={{ background: "rgba(255,255,255,0.08)", height: "19px", width: "58%" }}
          />
          <div
            className="rounded animate-pulse"
            style={{ background: "rgba(255,255,255,0.05)", height: "13px", width: "72%" }}
          />
        </div>
        <div
          className="rounded-full animate-pulse flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.07)", height: "26px", width: "82px" }}
        />
      </div>
      <div
        className="flex items-center justify-between pt-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {upcoming ? (
          <>
            <div
              className="rounded-full animate-pulse"
              style={{ background: "rgba(212,175,55,0.18)", height: "32px", width: "112px" }}
            />
            <div
              className="rounded animate-pulse"
              style={{ background: "rgba(255,255,255,0.05)", height: "18px", width: "10px" }}
            />
          </>
        ) : (
          <div
            className="ml-auto rounded animate-pulse"
            style={{ background: "rgba(255,255,255,0.05)", height: "18px", width: "10px" }}
          />
        )}
      </div>
    </div>
  );
}

export default function Bookings() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data: bookings, isLoading, refetch } = useListBookings({ userId: user?.id });
  const { pullY, isRefreshing } = usePullToRefresh(refetch);

  const upcoming = (bookings ?? []).filter(b => isUpcoming(b.match?.date));
  const past = (bookings ?? []).filter(b => !isUpcoming(b.match?.date));

  return (
    <AppLayout>
      <div style={{ position: "relative" }}>
        <PullToRefreshIndicator pullY={pullY} isRefreshing={isRefreshing} />

        <div
          className="max-w-2xl mx-auto px-6 animate-fade-up"
          style={{
            paddingTop: "28px",
            transform: pullY > 0 ? `translateY(${pullY * 0.3}px)` : undefined,
            transition: pullY === 0 ? "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)" : "none",
          }}
        >
          <header className="mb-6">
            <h1 className="font-serif font-bold text-white mb-1" style={{ fontSize: "26px" }}>
              {t("bookings.title")}
            </h1>
            <p className="text-muted-foreground" style={{ fontSize: "15px" }}>
              {t("bookings.subtitle")}
            </p>
          </header>

          {isLoading ? (
            <div className="space-y-6">
              <section>
                <div
                  className="rounded animate-pulse mb-3"
                  style={{ background: "rgba(255,255,255,0.06)", height: "11px", width: "68px" }}
                />
                <div className="space-y-3">
                  {[1, 2].map(i => <BookingCardSkeleton key={i} upcoming />)}
                </div>
              </section>
              <section>
                <div
                  className="rounded animate-pulse mb-3"
                  style={{ background: "rgba(255,255,255,0.04)", height: "11px", width: "40px" }}
                />
                <div className="space-y-3">
                  <BookingCardSkeleton />
                </div>
              </section>
            </div>
          ) : (bookings ?? []).length === 0 ? (
            <div
              className="rounded-[20px] p-10 text-center"
              style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="text-3xl mb-3">📅</div>
              <div className="text-white font-medium mb-1">{t("bookings.emptyTitle")}</div>
              <div className="text-muted-foreground mb-4" style={{ fontSize: "14px" }}>
                {t("bookings.emptyHint")}
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
                  {t("bookings.findMatch")}
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">

              {upcoming.length > 0 && (
                <section>
                  <div
                    className="uppercase font-semibold mb-3"
                    style={{ fontSize: "11px", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}
                  >
                    {t("bookings.upcoming")}
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
                                {t("bookings.viewDetails")}
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

              {(past.length > 0 || upcoming.length > 0) && (
                <section>
                  <div
                    className="uppercase font-semibold mb-3"
                    style={{ fontSize: "11px", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}
                  >
                    {t("bookings.past")}
                  </div>
                  {past.length === 0 ? (
                    <div
                      className="rounded-[20px] p-10 text-center"
                      style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      <div className="text-3xl mb-3">🗂️</div>
                      <div className="text-white font-medium mb-1" style={{ fontSize: "17px" }}>
                        {t("bookings.emptyPastTitle")}
                      </div>
                      <div className="text-muted-foreground" style={{ fontSize: "14px" }}>
                        {t("bookings.emptyPastHint")}
                      </div>
                    </div>
                  ) : (
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
                  )}
                </section>
              )}
            </div>
          )}

          <div style={{ height: "32px" }} />
        </div>
      </div>
    </AppLayout>
  );
}
