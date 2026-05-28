import { useMemo, useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDubaiDateTime, formatDubaiTime, formatDubaiTimeRange } from "@/lib/datetime";
import {
  useListGroupTrainings,
  useListMyTrainingBookings,
  useBookGroupTraining,
  useCancelMyTrainingBooking,
  getListGroupTrainingsQueryKey,
  getListMyTrainingBookingsQueryKey,
  type GroupTraining,
  type TrainingBookingWithTraining,
} from "@workspace/api-client-react";

const CATEGORIES = ["D-", "D", "D+", "C-", "C", "C+", "B-"] as const;
const LEVELS = ["D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A"];
const CATEGORY_INDEX = Object.fromEntries(
  CATEGORIES.map((c, i) => [c, i]),
) as Record<string, number>;
const LEVEL_INDEX = Object.fromEntries(LEVELS.map((l, i) => [l, i])) as Record<string, number>;

const CARD_BG = "hsl(220 20% 6%)";
const CARD_BORDER = "1px solid rgba(255,255,255,0.06)";
const GOLD = "#D4AF37";

type CoachLite = {
  id: number;
  name: string;
  avatar: string | null;
  level?: string | null;
};

function formatDateTime(iso: string, language: string): string {
  return formatDubaiDateTime(iso, language);
}

function formatDateRange(iso: string, durationMinutes: number, language: string): string {
  return formatDubaiTimeRange(iso, durationMinutes, language);
}

function formatWeekday(iso: string, language: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString(language === "ru" ? "ru-RU" : "en-GB", {
      weekday: "long",
      timeZone: "Asia/Dubai",
    })
    .replace(/\.$/, "");
}

function formatStartTime(iso: string, language: string): string {
  return formatDubaiTime(iso, language);
}

function mapsUrl(name: string, addr: string | null): string {
  const q = encodeURIComponent(addr ? `${name}, ${addr}` : name);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

const CATEGORY_COLORS: Record<string, { fg: string; bg: string }> = {
  "D-": { fg: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  "D":  { fg: "#94a3b8", bg: "rgba(148,163,184,0.14)" },
  "D+": { fg: "#7dd3fc", bg: "rgba(125,211,252,0.12)" },
  "C-": { fg: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  "C":  { fg: "#a78bfa", bg: "rgba(167,139,250,0.14)" },
  "C+": { fg: "#c084fc", bg: "rgba(192,132,252,0.14)" },
  "B-": { fg: "#D4AF37", bg: "rgba(212,175,55,0.14)" },
};

function dateOnly(iso: string): string {
  // local YYYY-MM-DD for trainer-match-request payload
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeOnly(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60);
}

// Registration window: opens 48h before start, closes 12h before start.
const REG_OPEN_HOURS_BEFORE = 48;
const REG_CLOSE_HOURS_BEFORE = 12;

type RegWindow =
  | { kind: "scheduled"; opensInHours: number }
  | { kind: "open"; closesInHours: number }
  | { kind: "closing_soon"; closesInHours: number }
  | { kind: "closed" }
  | { kind: "none" };

function registrationWindow(training: GroupTraining): RegWindow {
  const h = hoursUntil(training.dateTime);
  if (training.status === "scheduled") {
    return { kind: "scheduled", opensInHours: Math.max(0, h - REG_OPEN_HOURS_BEFORE) };
  }
  if (training.status === "closed") {
    return { kind: "closed" };
  }
  if (training.status === "open" || training.status === "full") {
    const closesInHours = h - REG_CLOSE_HOURS_BEFORE;
    if (closesInHours > 0 && closesInHours <= 24) {
      return { kind: "closing_soon", closesInHours };
    }
    return { kind: "open", closesInHours };
  }
  return { kind: "none" };
}

function formatHoursLabel(
  hours: number,
  t: (k: string, v?: Record<string, string | number>) => string,
): string {
  if (hours >= 24) {
    const d = Math.round(hours / 24);
    return t("playerTrainings.window.days", { count: d });
  }
  if (hours >= 1) {
    return t("playerTrainings.window.hours", { count: Math.round(hours) });
  }
  return t("playerTrainings.window.minutes", { count: Math.max(1, Math.round(hours * 60)) });
}

function CategoryBadge({ cat }: { cat: string }) {
  const c = CATEGORY_COLORS[cat] ?? { fg: GOLD, bg: "rgba(212,175,55,0.10)" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-semibold"
      style={{
        fontSize: "11px",
        color: c.fg,
        background: c.bg,
        border: `1px solid ${c.fg}40`,
      }}
    >
      {cat}
    </span>
  );
}

function StatusBadge({
  status,
  locked,
  isPast,
  t,
}: {
  status: string;
  locked: boolean;
  isPast: boolean;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const pill = (label: string, fg: string, bg: string) => (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
      style={{ color: fg, background: bg, border: `1px solid ${fg}40` }}
    >
      {label}
    </span>
  );
  if (status === "cancelled") {
    return pill(t("playerTrainings.card.cancelledByCoach"), "#f87171", "rgba(248,113,113,0.12)");
  }
  if (isPast) {
    return pill(t("playerTrainings.card.past"), "#94a3b8", "rgba(148,163,184,0.12)");
  }
  if (locked) {
    return pill(`🔒 ${t("playerTrainings.card.locked")}`, "#f87171", "rgba(248,113,113,0.12)");
  }
  if (status === "full") {
    return pill(t("playerTrainings.card.full"), GOLD, "rgba(212,175,55,0.12)");
  }
  if (status === "open") {
    return pill(t("playerTrainings.card.open"), "#4ade80", "rgba(74,222,128,0.12)");
  }
  return null;
}

function CoachAvatar({ coach }: { coach: CoachLite | null }) {
  if (coach?.avatar) {
    return (
      <img
        src={coach.avatar}
        alt={coach.name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: 44, height: 44, border: `1px solid ${GOLD}40` }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-serif flex-shrink-0"
      style={{
        width: 44,
        height: 44,
        background: "rgba(212,175,55,0.15)",
        color: GOLD,
        fontSize: "18px",
        border: `1px solid ${GOLD}40`,
      }}
    >
      {coach?.name?.[0] ?? "?"}
    </div>
  );
}

function ProgressBar({ booked, max }: { booked: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((booked / max) * 100)) : 0;
  const full = booked >= max;
  return (
    <div className="w-full" style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: full ? GOLD : "#4ade80",
          transition: "width 240ms ease",
        }}
      />
    </div>
  );
}

type CardAction =
  | { kind: "book"; training: GroupTraining }
  | { kind: "cancel"; training: GroupTraining }
  | { kind: "locked"; training: GroupTraining }
  | { kind: "waitlist"; training: GroupTraining }
  | { kind: "none" };

function TrainingCard({
  training,
  coach,
  myBookingStatus,
  myLevel,
  onAction,
  language,
}: {
  training: GroupTraining;
  coach: CoachLite | null;
  myBookingStatus: "booked" | "cancelled" | "attended" | "no_show" | null;
  myLevel: string | null;
  onAction: (a: CardAction) => void;
  language: string;
}) {
  const { t } = useLanguage();
  const isPast =
    new Date(training.dateTime).getTime() < Date.now() ||
    training.status === "cancelled" ||
    training.status === "completed" ||
    myBookingStatus === "attended" ||
    myBookingStatus === "no_show";

  const myIdx = myLevel ? LEVEL_INDEX[myLevel] ?? -1 : -1;
  const tCatIdx = CATEGORY_INDEX[training.category] ?? 99;
  const locked = !isPast && myIdx >= 0 && tCatIdx > myIdx && myBookingStatus !== "booked";
  const isBooked = myBookingStatus === "booked";
  const isFull = training.bookedCount >= training.maxParticipants && !isBooked;
  const win = registrationWindow(training);
  const notOpenYet = win.kind === "scheduled";
  const regClosed = win.kind === "closed";

  const cta: CardAction = (() => {
    if (isPast) return { kind: "none" };
    if (training.status === "cancelled") return { kind: "none" };
    if (isBooked) return { kind: "cancel", training };
    if (locked) return { kind: "locked", training };
    if (notOpenYet) return { kind: "none" };
    if (regClosed) return { kind: "none" };
    if (isFull) return { kind: "waitlist", training };
    return { kind: "book", training };
  })();

  const ctaLabel = (() => {
    switch (cta.kind) {
      case "book":
        return t("playerTrainings.card.book");
      case "cancel":
        return t("playerTrainings.card.cancel");
      case "locked":
        return t("playerTrainings.card.requestApproval");
      case "waitlist":
        return t("playerTrainings.card.waitlist");
      default:
        return "";
    }
  })();

  const disabledLabel = (() => {
    if (notOpenYet && win.kind === "scheduled") {
      return t("playerTrainings.card.opensIn", {
        in: formatHoursLabel(win.opensInHours, t),
      });
    }
    if (regClosed) return t("playerTrainings.card.regClosed");
    if (training.status === "cancelled") return t("playerTrainings.card.cancelledByCoach");
    return t("playerTrainings.card.past");
  })();

  const ctaBg = (() => {
    if (cta.kind === "cancel") return "rgba(248,113,113,0.12)";
    if (cta.kind === "locked") return "rgba(248,113,113,0.10)";
    if (cta.kind === "waitlist") return "rgba(255,255,255,0.06)";
    return GOLD;
  })();
  const ctaFg = (() => {
    if (cta.kind === "cancel") return "#f87171";
    if (cta.kind === "locked") return "#f87171";
    if (cta.kind === "waitlist") return "#ffffff";
    return "#000";
  })();
  const ctaBorder = (() => {
    if (cta.kind === "cancel") return "1px solid #f8717140";
    if (cta.kind === "locked") return "1px solid #f8717140";
    if (cta.kind === "waitlist") return "1px solid rgba(255,255,255,0.12)";
    return "none";
  })();

  return (
    <div
      className="rounded-[20px] p-4"
      style={{
        background: CARD_BG,
        border: CARD_BORDER,
        opacity: isPast ? 0.55 : 1,
      }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <CoachAvatar coach={coach} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <CategoryBadge cat={training.category} />
            <StatusBadge status={training.status} locked={locked} isPast={isPast} t={t} />
            {!isPast && win.kind === "scheduled" && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                style={{ color: "#94a3b8", background: "rgba(148,163,184,0.12)", border: "1px solid #94a3b840" }}
              >
                ⏳ {t("playerTrainings.card.opensIn", { in: formatHoursLabel(win.opensInHours, t) })}
              </span>
            )}
            {!isPast && win.kind === "closing_soon" && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                style={{ color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid #fbbf2440" }}
              >
                ⏰ {t("playerTrainings.card.closingIn", { in: formatHoursLabel(win.closesInHours, t) })}
              </span>
            )}
            {!isPast && win.kind === "closed" && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                style={{ color: "#f87171", background: "rgba(248,113,113,0.12)", border: "1px solid #f8717140" }}
              >
                {t("playerTrainings.card.regClosed")}
              </span>
            )}
            {isBooked && !isPast && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                style={{ color: "#4ade80", background: "rgba(74,222,128,0.12)", border: "1px solid #4ade8040" }}
              >
                ✓ {t("playerTrainings.card.myStatus.booked")}
              </span>
            )}
            {myBookingStatus === "attended" && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                style={{ color: "#4ade80", background: "rgba(74,222,128,0.12)", border: "1px solid #4ade8040" }}
              >
                {t("playerTrainings.card.myStatus.attended")}
              </span>
            )}
            {myBookingStatus === "no_show" && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                style={{ color: "#f87171", background: "rgba(248,113,113,0.12)", border: "1px solid #f8717140" }}
              >
                {t("playerTrainings.card.myStatus.no_show")}
              </span>
            )}
          </div>
          <div className="text-white font-semibold leading-tight" style={{ fontSize: "17px" }}>
            {formatDateRange(training.dateTime, training.durationMinutes, language)}
          </div>
          <div className="text-muted-foreground" style={{ fontSize: "13px", marginTop: 2 }}>
            {t("playerTrainings.card.withCoach", { coach: coach?.name ?? `#${training.coachId}` })}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-mono font-semibold" style={{ color: GOLD, fontSize: "17px" }}>
            {Number(training.priceAed).toFixed(0)}
          </div>
          <div className="text-muted-foreground" style={{ fontSize: "11px" }}>AED</div>
        </div>
      </div>

      {/* Court — clickable opens Google Maps */}
      <a
        href={mapsUrl(training.courtName, training.courtAddress ?? null)}
        target="_blank"
        rel="noopener noreferrer"
        className="block mb-3 -mx-1 px-1 py-1 rounded-md hover:bg-white/[0.03] transition-colors"
      >
        <div className="text-white" style={{ fontSize: "13px" }}>
          📍 <span className="underline decoration-white/20 underline-offset-2">{training.courtName}</span>
        </div>
        {training.courtAddress && (
          <div className="text-muted-foreground" style={{ fontSize: "12px", marginTop: 2, paddingLeft: 18 }}>
            {training.courtAddress}
          </div>
        )}
      </a>

      {/* Spots progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-muted-foreground" style={{ fontSize: "12px" }}>
            {t("playerTrainings.card.spots", {
              count: training.bookedCount,
              max: training.maxParticipants,
            })}
          </span>
          <span style={{ fontSize: "12px", color: isFull ? GOLD : "#4ade80" }}>
            {isFull
              ? t("playerTrainings.card.full")
              : t("playerTrainings.card.free", {
                  count: Math.max(0, training.maxParticipants - training.bookedCount),
                })}
          </span>
        </div>
        <ProgressBar booked={training.bookedCount} max={training.maxParticipants} />
      </div>

      {/* Description */}
      {(language === "ru" ? training.descriptionRu : training.descriptionEn) && (
        <div
          className="text-muted-foreground rounded-lg px-3 py-2 mb-3"
          style={{ fontSize: "12px", background: "rgba(255,255,255,0.03)" }}
        >
          {language === "ru" ? training.descriptionRu : training.descriptionEn}
        </div>
      )}

      {/* CTA — past trainings render a disabled button */}
      {cta.kind === "none" ? (
        <button
          disabled
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-all"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.35)",
            border: "1px solid rgba(255,255,255,0.06)",
            height: 44,
            fontSize: "14px",
            cursor: "not-allowed",
          }}
        >
          {disabledLabel}
        </button>
      ) : (
        <button
          onClick={() => onAction(cta)}
          title={
            cta.kind === "locked"
              ? t("playerTrainings.card.lockedTooltip", {
                  level: myLevel ?? "—",
                  cat: training.category,
                })
              : undefined
          }
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all active:scale-[0.98]"
          style={{
            background: ctaBg,
            color: ctaFg,
            border: ctaBorder,
            height: 44,
            fontSize: "14px",
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

function BookModal({
  training,
  coach,
  onClose,
  language,
}: {
  training: GroupTraining;
  coach: CoachLite | null;
  onClose: () => void;
  language: string;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const bookMut = useBookGroupTraining({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListGroupTrainingsQueryKey() });
        qc.invalidateQueries({ queryKey: getListMyTrainingBookingsQueryKey() });
        toast({
          title: t("playerTrainings.bookModal.success", {
            court: training.courtName,
            day: formatWeekday(training.dateTime, language),
            time: formatStartTime(training.dateTime, language),
          }),
        });
        onClose();
      },
      onError: (err: any) => {
        const status = err?.response?.status ?? err?.status;
        const body = err?.response?.data ?? {};
        const code = body?.code as string | undefined;
        const reason = body?.reason as string | undefined;

        // LEVEL_REQUIRED — deep-link to quiz so the player can set their level.
        if (status === 400 && code === "LEVEL_REQUIRED") {
          toast({
            title: t("playerTrainings.bookModal.errorLevelRequiredTitle"),
            description: t("playerTrainings.bookModal.errorLevelRequiredBody"),
            variant: "destructive",
            action: (
              <ToastAction
                altText={t("playerTrainings.bookModal.errorLevelRequiredAction")}
                onClick={() => {
                  onClose();
                  navigate("/quiz");
                }}
              >
                {t("playerTrainings.bookModal.errorLevelRequiredAction")}
              </ToastAction>
            ),
          });
          return;
        }

        // LEVEL_TOO_HIGH — above player's level.
        if (status === 403 && code === "LEVEL_TOO_HIGH") {
          toast({
            title: t("playerTrainings.bookModal.errorLevelTooHigh", {
              cat: body?.category ?? training.category,
              level: body?.yourLevel ?? "—",
            }),
            variant: "destructive",
          });
          return;
        }

        // Registration window: not open yet.
        if (status === 409 && reason === "scheduled") {
          const h = hoursUntil(training.dateTime) - REG_OPEN_HOURS_BEFORE;
          toast({
            title:
              h > 0
                ? t("playerTrainings.bookModal.errorScheduledIn", {
                    in: formatHoursLabel(h, t),
                  })
                : t("playerTrainings.bookModal.errorScheduled"),
            variant: "destructive",
          });
          return;
        }

        // Registration window: closed.
        if (status === 409 && reason === "closed") {
          toast({
            title: t("playerTrainings.bookModal.errorClosed"),
            variant: "destructive",
          });
          return;
        }

        if (status === 409 && body?.alreadyBooked) {
          toast({ title: t("playerTrainings.bookModal.errorAlready"), variant: "destructive" });
          return;
        }
        if (status === 409 && body?.full) {
          toast({ title: t("playerTrainings.bookModal.errorFull"), variant: "destructive" });
          return;
        }
        // Legacy fallback: 403 without code, or any other 409.
        if (status === 403) {
          toast({ title: t("playerTrainings.bookModal.errorLevel"), variant: "destructive" });
          return;
        }
        toast({ title: t("playerTrainings.bookModal.errorGeneric"), variant: "destructive" });
      },
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md rounded-3xl border-white/10 text-white"
        style={{ background: CARD_BG }}
      >
        <DialogHeader>
          <DialogTitle className="font-serif" style={{ fontSize: "20px" }}>
            {t("playerTrainings.bookModal.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3" style={{ fontSize: "14px" }}>
          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="text-white font-medium mb-1">{formatDateRange(training.dateTime, training.durationMinutes, language)}</div>
            <div className="text-muted-foreground" style={{ fontSize: "13px" }}>
              {coach?.name ?? `#${training.coachId}`} · {training.courtName}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <CategoryBadge cat={training.category} />
              <span className="text-muted-foreground" style={{ fontSize: "12px" }}>
                {t("playerTrainings.card.duration", { min: training.durationMinutes })}
              </span>
              <span className="ml-auto font-mono font-semibold" style={{ color: GOLD }}>
                {Number(training.priceAed).toFixed(0)} AED
              </span>
            </div>
          </div>

          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.18)" }}
          >
            <div className="text-white font-medium mb-1" style={{ fontSize: "13px" }}>
              {t("playerTrainings.bookModal.policyTitle")}
            </div>
            <div className="text-muted-foreground leading-relaxed" style={{ fontSize: "12px" }}>
              {t("playerTrainings.bookModal.policyFree")}
              <br />
              {t("playerTrainings.bookModal.policyLate")}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 pt-2 flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={bookMut.isPending}
            className="flex-1 inline-flex items-center justify-center rounded-xl font-medium text-white transition-all active:scale-[0.97]"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", height: 44, fontSize: "14px" }}
          >
            {t("playerTrainings.bookModal.cancel")}
          </button>
          <button
            type="button"
            onClick={() => bookMut.mutate({ id: training.id })}
            disabled={bookMut.isPending}
            className="flex-1 inline-flex items-center justify-center rounded-xl font-semibold text-black transition-all active:scale-[0.97] disabled:opacity-60"
            style={{ background: GOLD, height: 44, fontSize: "14px" }}
          >
            {bookMut.isPending
              ? t("playerTrainings.bookModal.booking")
              : t("playerTrainings.bookModal.confirm")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelModal({
  training,
  onClose,
  language,
}: {
  training: GroupTraining;
  onClose: () => void;
  language: string;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const late = hoursUntil(training.dateTime) < 12;

  const cancelMut = useCancelMyTrainingBooking({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListGroupTrainingsQueryKey() });
        qc.invalidateQueries({ queryKey: getListMyTrainingBookingsQueryKey() });
        toast({ title: t("playerTrainings.cancelModal.success") });
        onClose();
      },
      onError: () => {
        toast({ title: t("playerTrainings.cancelModal.error"), variant: "destructive" });
      },
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md rounded-3xl border-white/10 text-white"
        style={{ background: CARD_BG }}
      >
        <DialogHeader>
          <DialogTitle className="font-serif" style={{ fontSize: "20px" }}>
            {t("playerTrainings.cancelModal.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3" style={{ fontSize: "14px" }}>
          <div className="text-muted-foreground">
            {formatDateTime(training.dateTime, language)} · {training.courtName}
          </div>
          <div
            className="rounded-xl p-3"
            style={{
              background: late ? "rgba(248,113,113,0.08)" : "rgba(74,222,128,0.08)",
              border: `1px solid ${late ? "#f8717140" : "#4ade8040"}`,
              fontSize: "13px",
              color: late ? "#f87171" : "#4ade80",
            }}
          >
            {late
              ? t("playerTrainings.cancelModal.warningLate")
              : t("playerTrainings.cancelModal.warningFree")}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 pt-2 flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={cancelMut.isPending}
            className="flex-1 inline-flex items-center justify-center rounded-xl font-medium text-white transition-all active:scale-[0.97]"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", height: 44, fontSize: "14px" }}
          >
            {t("playerTrainings.cancelModal.keep")}
          </button>
          <button
            type="button"
            onClick={() => cancelMut.mutate({ id: training.id })}
            disabled={cancelMut.isPending}
            className="flex-1 inline-flex items-center justify-center rounded-xl font-semibold transition-all active:scale-[0.97] disabled:opacity-60"
            style={{ background: "#f87171", color: "#000", height: 44, fontSize: "14px" }}
          >
            {cancelMut.isPending
              ? t("playerTrainings.cancelModal.cancelling")
              : t("playerTrainings.cancelModal.confirm")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LockedModal({
  training,
  coach,
  myLevel,
  playerId,
  onClose,
  language,
}: {
  training: GroupTraining;
  coach: CoachLite | null;
  myLevel: string | null;
  playerId: number;
  onClose: () => void;
  language: string;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      const body = JSON.stringify({
        playerId,
        format: "training",
        venue: training.courtName,
        requestedDate: dateOnly(training.dateTime),
        requestedTime: timeOnly(training.dateTime),
        notes: `[APPROVAL: group training ${training.id}] cat=${training.category} level=${myLevel ?? "—"} coach=${coach?.name ?? training.coachId}. ${notes}`.trim(),
      });
      await apiFetch("/trainer-match-requests", { method: "POST", body });
      toast({ title: t("playerTrainings.lockedModal.success") });
      onClose();
    } catch {
      toast({ title: t("playerTrainings.lockedModal.error"), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md rounded-3xl border-white/10 text-white"
        style={{ background: CARD_BG }}
      >
        <DialogHeader>
          <DialogTitle className="font-serif" style={{ fontSize: "20px" }}>
            🔒 {t("playerTrainings.lockedModal.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3" style={{ fontSize: "14px" }}>
          <div className="text-muted-foreground">{formatDateTime(training.dateTime, language)} · {training.courtName}</div>
          <div className="text-white leading-relaxed" style={{ fontSize: "13px" }}>
            {t("playerTrainings.lockedModal.body", {
              cat: training.category,
              level: myLevel ?? "—",
            })}
          </div>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("playerTrainings.lockedModal.notesPlaceholder")}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#D4AF37]/50"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2 pt-2 flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="flex-1 inline-flex items-center justify-center rounded-xl font-medium text-white transition-all active:scale-[0.97]"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", height: 44, fontSize: "14px" }}
          >
            {t("playerTrainings.bookModal.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="flex-1 inline-flex items-center justify-center rounded-xl font-semibold text-black transition-all active:scale-[0.97] disabled:opacity-60"
            style={{ background: GOLD, height: 44, fontSize: "14px" }}
          >
            {sending
              ? t("playerTrainings.lockedModal.sending")
              : t("playerTrainings.lockedModal.send")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WaitlistModal({
  training,
  playerId,
  onClose,
  language,
}: {
  training: GroupTraining;
  playerId: number;
  onClose: () => void;
  language: string;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const handleJoin = async () => {
    setSending(true);
    try {
      const body = JSON.stringify({
        playerId,
        format: "training",
        venue: training.courtName,
        requestedDate: dateOnly(training.dateTime),
        requestedTime: timeOnly(training.dateTime),
        notes: `[WAITLIST: group training ${training.id}] cat=${training.category}`,
      });
      await apiFetch("/trainer-match-requests", { method: "POST", body });
      toast({ title: t("playerTrainings.waitlistModal.success") });
      onClose();
    } catch {
      toast({ title: t("playerTrainings.waitlistModal.error"), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md rounded-3xl border-white/10 text-white"
        style={{ background: CARD_BG }}
      >
        <DialogHeader>
          <DialogTitle className="font-serif" style={{ fontSize: "20px" }}>
            {t("playerTrainings.waitlistModal.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2" style={{ fontSize: "14px" }}>
          <div className="text-muted-foreground">{formatDateTime(training.dateTime, language)} · {training.courtName}</div>
          <div className="text-white leading-relaxed" style={{ fontSize: "13px" }}>
            {t("playerTrainings.waitlistModal.body")}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2 pt-2 flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="flex-1 inline-flex items-center justify-center rounded-xl font-medium text-white transition-all active:scale-[0.97]"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", height: 44, fontSize: "14px" }}
          >
            {t("playerTrainings.bookModal.cancel")}
          </button>
          <button
            type="button"
            onClick={handleJoin}
            disabled={sending}
            className="flex-1 inline-flex items-center justify-center rounded-xl font-semibold text-black transition-all active:scale-[0.97] disabled:opacity-60"
            style={{ background: GOLD, height: 44, fontSize: "14px" }}
          >
            {sending
              ? t("playerTrainings.waitlistModal.joining")
              : t("playerTrainings.waitlistModal.confirm")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Tabs({
  value,
  onChange,
  counts,
}: {
  value: "available" | "myBookings" | "history";
  onChange: (v: "available" | "myBookings" | "history") => void;
  counts: { myBookings: number };
}) {
  const { t } = useLanguage();
  const items: { key: "available" | "myBookings" | "history"; label: string; badge?: number }[] = [
    { key: "available", label: t("playerTrainings.tabs.available") },
    { key: "myBookings", label: t("playerTrainings.tabs.myBookings"), badge: counts.myBookings },
    { key: "history", label: t("playerTrainings.tabs.history") },
  ];
  return (
    <div
      className="inline-flex rounded-2xl p-1 mb-4 w-full"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl transition-all"
            style={{
              height: 40,
              fontSize: "13px",
              fontWeight: 600,
              background: active ? GOLD : "transparent",
              color: active ? "#000" : "rgba(255,255,255,0.65)",
            }}
          >
            {it.label}
            {it.badge !== undefined && it.badge > 0 && (
              <span
                className="inline-flex items-center justify-center rounded-full font-bold"
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  fontSize: "10px",
                  background: active ? "rgba(0,0,0,0.18)" : GOLD,
                  color: active ? "#000" : "#000",
                  lineHeight: 1,
                }}
              >
                {it.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div
      className="rounded-[20px] p-8 text-center text-muted-foreground"
      style={{ background: CARD_BG, border: CARD_BORDER, fontSize: "14px" }}
    >
      {msg}
    </div>
  );
}

export default function GroupTrainings() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [tab, setTab] = useState<"available" | "myBookings" | "history">("available");
  const [action, setAction] = useState<CardAction>({ kind: "none" });

  const { data: available = [], isLoading: loadingAvail } = useListGroupTrainings();
  const { data: myBookingsRaw = [], isLoading: loadingMine } = useListMyTrainingBookings();

  const myBookings = myBookingsRaw as TrainingBookingWithTraining[];
  const trainings = available as GroupTraining[];

  // Build a single list of coach IDs to fetch in one batch
  const coachIds = useMemo(() => {
    const ids = new Set<number>();
    trainings.forEach((tr) => ids.add(tr.coachId));
    myBookings.forEach((b) => b.training && ids.add(b.training.coachId));
    return Array.from(ids);
  }, [trainings, myBookings]);

  const { data: coaches = [] } = useQuery({
    queryKey: ["players-batch", coachIds.sort().join(",")],
    enabled: coachIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        coachIds.map((id) =>
          apiFetch<CoachLite>(`/users/${id}`).catch(() => null),
        ),
      );
      return results.filter((c): c is CoachLite => !!c);
    },
    staleTime: 5 * 60 * 1000,
  });

  const coachMap = useMemo(() => {
    const m = new Map<number, CoachLite>();
    (coaches as CoachLite[]).forEach((c) => m.set(c.id, c));
    return m;
  }, [coaches]);

  // Active bookings keyed by trainingId for "available" tab status
  const myBookingByTrainingId = useMemo(() => {
    const m = new Map<string, TrainingBookingWithTraining>();
    myBookings.forEach((b) => {
      if (b.status !== "cancelled") m.set(b.trainingId, b);
    });
    return m;
  }, [myBookings]);

  const now = Date.now();

  const upcomingBookings = useMemo(
    () =>
      myBookings
        .filter(
          (b) =>
            b.status === "booked" &&
            b.training &&
            new Date(b.training.dateTime).getTime() >= now &&
            b.training.status !== "cancelled",
        )
        .sort(
          (a, b) =>
            new Date(a.training.dateTime).getTime() - new Date(b.training.dateTime).getTime(),
        ),
    [myBookings, now],
  );

  const historyBookings = useMemo(
    () =>
      myBookings
        .filter(
          (b) =>
            b.status === "cancelled" ||
            b.status === "attended" ||
            b.status === "no_show" ||
            (b.training &&
              (new Date(b.training.dateTime).getTime() < now ||
                b.training.status === "cancelled" ||
                b.training.status === "completed")),
        )
        .sort(
          (a, b) =>
            new Date(b.training?.dateTime ?? b.bookedAt).getTime() -
            new Date(a.training?.dateTime ?? a.bookedAt).getTime(),
        ),
    [myBookings, now],
  );

  const availableUpcoming = useMemo(
    () =>
      trainings
        .filter((tr) => new Date(tr.dateTime).getTime() >= now && tr.status !== "cancelled" && tr.status !== "completed")
        .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()),
    [trainings, now],
  );

  const myLevel = (user as any)?.level ?? null;
  const myId = user?.id ?? 0;

  const handleAction = (a: CardAction) => setAction(a);
  const closeModal = () => setAction({ kind: "none" });

  const isLoading = loadingAvail || loadingMine;

  const renderAvailable = () => {
    if (isLoading) return <div className="text-muted-foreground text-sm py-6 text-center">…</div>;
    if (availableUpcoming.length === 0) {
      return <EmptyState msg={t("playerTrainings.empty.available")} />;
    }
    return (
      <div className="space-y-3">
        {availableUpcoming.map((tr) => {
          const mine = myBookingByTrainingId.get(tr.id);
          return (
            <TrainingCard
              key={tr.id}
              training={tr}
              coach={coachMap.get(tr.coachId) ?? null}
              myBookingStatus={
                mine && mine.status === "booked" ? "booked" : null
              }
              myLevel={myLevel}
              onAction={handleAction}
              language={language}
            />
          );
        })}
      </div>
    );
  };

  const renderMyBookings = () => {
    if (isLoading) return <div className="text-muted-foreground text-sm py-6 text-center">…</div>;
    if (upcomingBookings.length === 0) {
      return <EmptyState msg={t("playerTrainings.empty.myBookings")} />;
    }
    return (
      <div className="space-y-3">
        {upcomingBookings.map((b) => (
          <TrainingCard
            key={b.id}
            training={b.training}
            coach={coachMap.get(b.training.coachId) ?? null}
            myBookingStatus="booked"
            myLevel={myLevel}
            onAction={handleAction}
            language={language}
          />
        ))}
      </div>
    );
  };

  const renderHistory = () => {
    if (isLoading) return <div className="text-muted-foreground text-sm py-6 text-center">…</div>;
    if (historyBookings.length === 0) {
      return <EmptyState msg={t("playerTrainings.empty.history")} />;
    }
    return (
      <div className="space-y-3">
        {historyBookings.map((b) => (
          <TrainingCard
            key={b.id}
            training={b.training}
            coach={coachMap.get(b.training.coachId) ?? null}
            myBookingStatus={b.status as any}
            myLevel={myLevel}
            onAction={() => {}}
            language={language}
          />
        ))}
      </div>
    );
  };

  const activeTraining = action.kind !== "none" ? action.training : null;
  const activeCoach = activeTraining ? coachMap.get(activeTraining.coachId) ?? null : null;

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 max-w-2xl mx-auto" style={{ paddingTop: "24px", paddingBottom: "96px" }}>
        <div className="mb-5">
          <h1 className="font-serif font-bold text-white mb-1" style={{ fontSize: "28px" }}>
            {t("playerTrainings.title")}
          </h1>
          <p className="text-muted-foreground" style={{ fontSize: "14px" }}>
            {t("playerTrainings.subtitle")}
          </p>
        </div>

        <Tabs value={tab} onChange={setTab} counts={{ myBookings: upcomingBookings.length }} />

        {tab === "available" && renderAvailable()}
        {tab === "myBookings" && renderMyBookings()}
        {tab === "history" && renderHistory()}
      </div>

      {action.kind === "book" && activeTraining && (
        <BookModal training={activeTraining} coach={activeCoach} onClose={closeModal} language={language} />
      )}
      {action.kind === "cancel" && activeTraining && (
        <CancelModal training={activeTraining} onClose={closeModal} language={language} />
      )}
      {action.kind === "locked" && activeTraining && (
        <LockedModal
          training={activeTraining}
          coach={activeCoach}
          myLevel={myLevel}
          playerId={myId}
          onClose={closeModal}
          language={language}
        />
      )}
      {action.kind === "waitlist" && activeTraining && (
        <WaitlistModal training={activeTraining} playerId={myId} onClose={closeModal} language={language} />
      )}
    </AppLayout>
  );
}
