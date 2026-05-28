import { AppLayout } from "@/components/layout/AppLayout";
import { useGetBooking, useCreatePaymentIntent, useConfirmPayment, getGetBookingQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDubaiDate, formatDubaiTime } from "@/lib/datetime";

const PAYMENT_STATUS_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  completed: { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)",   color: "#4ade80" },
  pending:   { bg: "rgba(234,179,8,0.12)",   border: "rgba(234,179,8,0.3)",   color: "#facc15" },
  failed:    { bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.25)",  color: "#f87171" },
  cancelled: { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" },
};

function paymentStyle(status: string) {
  return PAYMENT_STATUS_STYLES[status] ?? PAYMENT_STATUS_STYLES.pending;
}

function InfoRow({ label, value, last }: { label: string; value: string | undefined; last?: boolean }) {
  return (
    <div
      className="flex items-center justify-between px-5"
      style={{
        minHeight: "52px",
        borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <span className="text-muted-foreground" style={{ fontSize: "14px" }}>{label}</span>
      <span className="text-white font-medium" style={{ fontSize: "14px" }}>{value ?? "—"}</span>
    </div>
  );
}

export default function BookingDetail() {
  const params = useParams();
  const bookingId = Number(params.id);
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const { data: booking, isLoading } = useGetBooking(bookingId, {
    query: { enabled: !!bookingId, queryKey: getGetBookingQueryKey(bookingId) },
  });

  const createIntent = useCreatePaymentIntent();
  const confirmPayment = useConfirmPayment();
  const { toast } = useToast();
  const [isPaying, setIsPaying] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  const handlePayment = async () => {
    setIsPaying(true);
    try {
      const intent = await createIntent.mutateAsync({ id: bookingId });
      await confirmPayment.mutateAsync({
        id: bookingId,
        data: { paymentIntentId: intent.paymentIntentId },
      });
      toast({ title: t("bookingDetail.toastSuccess"), description: t("bookingDetail.toastSuccessDesc") });
      queryClient.invalidateQueries({ queryKey: getGetBookingQueryKey(bookingId) });
    } catch {
      toast({ title: t("bookingDetail.toastFailed"), variant: "destructive" });
    } finally {
      setIsPaying(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-6 space-y-4" style={{ paddingTop: "28px" }}>
          {[1, 2].map(i => (
            <div key={i} className="rounded-[20px] animate-pulse" style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)", minHeight: "200px" }} />
          ))}
        </div>
      </AppLayout>
    );
  }

  if (!booking) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-6 text-center" style={{ paddingTop: "80px" }}>
          <div className="text-3xl mb-3">📅</div>
          <div className="text-white font-medium">{t("bookingDetail.notFound")}</div>
        </div>
      </AppLayout>
    );
  }

  const ps = paymentStyle(booking.paymentStatus ?? "pending");
  const isPaid = booking.paymentStatus === "completed";

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 animate-fade-up" style={{ paddingTop: "28px", paddingBottom: "40px" }}>

        {/* ── HEADER ── */}
        <header className="mb-6">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="font-serif font-bold text-white leading-tight" style={{ fontSize: "26px" }}>
              {t("bookingDetail.title", { id: booking.id })}
            </h1>
            <span
              className="rounded-full px-3 py-1 font-medium capitalize flex-shrink-0"
              style={{
                fontSize: "12px",
                background: ps.bg,
                border: `1px solid ${ps.border}`,
                color: ps.color,
                marginTop: "6px",
              }}
            >
              {booking.paymentStatus}
            </span>
          </div>
          <p className="text-muted-foreground" style={{ fontSize: "14px" }}>
            {booking.match?.clubName} · {booking.match?.date && booking.match?.time ? formatDubaiDate(`${booking.match.date}T${booking.match.time}:00+04:00`, language) : (booking.match?.date ?? "")}
          </p>
        </header>

        {/* ── MATCH DETAILS ── */}
        <section className="mb-4">
          <div
            className="uppercase font-semibold mb-3"
            style={{ fontSize: "11px", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}
          >
            {t("bookingDetail.matchDetails")}
          </div>
          <div
            className="rounded-[20px] overflow-hidden"
            style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <InfoRow
              label={t("bookingDetail.date")}
              value={booking.match?.date && booking.match?.time ? formatDubaiDate(`${booking.match.date}T${booking.match.time}:00+04:00`, language) : booking.match?.date}
            />
            <InfoRow
              label={t("bookingDetail.time")}
              value={booking.match?.date && booking.match?.time ? formatDubaiTime(`${booking.match.date}T${booking.match.time}:00+04:00`, language) : booking.match?.time}
            />
            <InfoRow label={t("bookingDetail.format")} value={booking.match?.format} />
            <div
              className="flex items-center justify-between px-5"
              style={{ minHeight: "56px" }}
            >
              <span className="font-semibold text-white" style={{ fontSize: "16px" }}>{t("bookingDetail.total")}</span>
              <span
                className="font-mono font-bold"
                style={{ fontSize: "20px", color: "#D4AF37" }}
              >
                {booking.match?.price} AED
              </span>
            </div>
          </div>
        </section>

        {/* ── PAYMENT COMPLETE STATE ── */}
        {isPaid && (
          <div
            className="rounded-[20px] p-5 mb-4 flex items-center gap-4"
            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
          >
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "rgba(34,197,94,0.2)",
                fontSize: "22px",
              }}
            >
              ✓
            </div>
            <div>
              <div style={{ fontSize: "15px", color: "#4ade80", fontWeight: 600 }}>{t("bookingDetail.paymentComplete")}</div>
              <div className="text-muted-foreground" style={{ fontSize: "13px" }}>{t("bookingDetail.spotSecured")}</div>
            </div>
          </div>
        )}

        {isPaid && (
          <button
            className="w-full rounded-[20px] font-semibold transition-all hover:scale-[1.01] active:scale-[0.98]"
            style={{ minHeight: "52px", fontSize: "15px", background: "hsl(220 20% 10%)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)" }}
            onClick={() => {}}
          >
            {t("bookingDetail.addToCalendar")}
          </button>
        )}

        {/* ── PAYMENT FORM ── */}
        {!isPaid && (
          <section className="mb-4">
            <div
              className="uppercase font-semibold mb-3"
              style={{ fontSize: "11px", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}
            >
              {t("bookingDetail.payment")}
            </div>
            <div
              className="rounded-[20px] p-5 space-y-4"
              style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div>
                <div className="text-muted-foreground mb-1.5" style={{ fontSize: "12px", letterSpacing: "0.04em" }}>{t("bookingDetail.cardNumber")}</div>
                <input
                  type="text"
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={e => setCardNumber(e.target.value)}
                  className="w-full rounded-[12px] font-mono outline-none transition-colors"
                  style={{
                    height: "48px",
                    padding: "0 16px",
                    fontSize: "15px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff",
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-muted-foreground mb-1.5" style={{ fontSize: "12px", letterSpacing: "0.04em" }}>{t("bookingDetail.expiry")}</div>
                  <input
                    type="text"
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={e => setExpiry(e.target.value)}
                    className="w-full rounded-[12px] outline-none transition-colors"
                    style={{
                      height: "48px",
                      padding: "0 16px",
                      fontSize: "15px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#fff",
                    }}
                  />
                </div>
                <div>
                  <div className="text-muted-foreground mb-1.5" style={{ fontSize: "12px", letterSpacing: "0.04em" }}>{t("bookingDetail.cvc")}</div>
                  <input
                    type="text"
                    placeholder="123"
                    value={cvc}
                    onChange={e => setCvc(e.target.value)}
                    className="w-full rounded-[12px] outline-none transition-colors"
                    style={{
                      height: "48px",
                      padding: "0 16px",
                      fontSize: "15px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#fff",
                    }}
                  />
                </div>
              </div>

              <p className="text-muted-foreground" style={{ fontSize: "11px" }}>
                {t("bookingDetail.testCard")}
              </p>
            </div>

            <button
              className="w-full rounded-[20px] font-semibold transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 mt-4"
              style={{
                minHeight: "56px",
                fontSize: "17px",
                background: "#D4AF37",
                color: "#000",
                cursor: isPaying ? "wait" : "pointer",
              }}
              onClick={handlePayment}
              disabled={isPaying}
            >
              {isPaying ? t("bookingDetail.processing") : t("bookingDetail.pay", { price: booking.match?.price })}
            </button>
          </section>
        )}

      </div>
    </AppLayout>
  );
}
