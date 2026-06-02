import type { GroupTraining } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";

export const CATEGORIES = ["D-", "D", "D+", "C-", "C", "C+", "B-"] as const;
export type Category = (typeof CATEGORIES)[number];

const LEVELS = ["D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A"];

export const CATEGORY_INDEX: Record<string, number> = Object.fromEntries(
  CATEGORIES.map((c, i) => [c, i]),
);
const LEVEL_INDEX: Record<string, number> = Object.fromEntries(
  LEVELS.map((l, i) => [l, i]),
);

export const CATEGORY_COLORS: Record<string, string> = {
  "D-": "#94a3b8",
  D: "#94a3b8",
  "D+": "#7dd3fc",
  "C-": "#60a5fa",
  C: "#818cf8",
  "C+": "#a78bfa",
  "B-": "#D4AF37",
};

// Registration window: opens 48h before start, closes 12h before start.
const REG_OPEN_HOURS_BEFORE = 48;
const REG_CLOSE_HOURS_BEFORE = 12;

export function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

export type RegWindow =
  | { kind: "scheduled"; opensInHours: number }
  | { kind: "open"; closesInHours: number }
  | { kind: "closing_soon"; closesInHours: number }
  | { kind: "closed" }
  | { kind: "none" };

export function registrationWindow(training: GroupTraining): RegWindow {
  const h = hoursUntil(training.dateTime);
  if (training.status === "scheduled") {
    return {
      kind: "scheduled",
      opensInHours: Math.max(0, h - REG_OPEN_HOURS_BEFORE),
    };
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

export function formatWindowValue(
  hours: number,
  t: (k: string, v?: Record<string, string | number>) => string,
): string {
  if (hours >= 24) {
    return t("trainings.unit.d", { count: Math.round(hours / 24) });
  }
  if (hours >= 1) {
    return t("trainings.unit.h", { count: Math.round(hours) });
  }
  return t("trainings.unit.m", { count: Math.max(1, Math.round(hours * 60)) });
}

export type MyBookingStatus =
  | "booked"
  | "cancelled"
  | "attended"
  | "no_show"
  | null;

export function isPastTraining(
  training: GroupTraining,
  myBookingStatus: MyBookingStatus,
): boolean {
  return (
    new Date(training.dateTime).getTime() < Date.now() ||
    training.status === "cancelled" ||
    training.status === "completed" ||
    myBookingStatus === "attended" ||
    myBookingStatus === "no_show"
  );
}

export function isLevelLocked(
  training: GroupTraining,
  myLevel: string | null,
  myBookingStatus: MyBookingStatus,
): boolean {
  const isPast = isPastTraining(training, myBookingStatus);
  const myIdx = myLevel ? (LEVEL_INDEX[myLevel] ?? -1) : -1;
  const tCatIdx = CATEGORY_INDEX[training.category] ?? 99;
  return !isPast && myIdx >= 0 && tCatIdx > myIdx && myBookingStatus !== "booked";
}

interface ApiErrorLike {
  status?: number;
  data?: { error?: string; full?: boolean; alreadyBooked?: boolean } | null;
}

export function bookingErrorKey(err: unknown): string {
  const e = (err ?? {}) as ApiErrorLike;
  const status = e.status;
  const data = e.data ?? {};
  if (status === 400) return "trainings.errors.levelRequired";
  if (status === 403) return "trainings.errors.levelTooHigh";
  if (status === 409) {
    if (data.alreadyBooked) return "trainings.errors.alreadyBooked";
    if (data.full) return "trainings.errors.full";
    if (data.error === "scheduled") return "trainings.errors.scheduled";
    if (data.error === "closed") return "trainings.errors.closed";
  }
  return "trainings.errors.generic";
}

export function isCoachUser(user: User | null): boolean {
  if (!user) return false;
  if (user.modeCoach || user.modeAdmin || user.modeDeveloper) return true;
  return ["coach", "admin", "owner"].includes(user.role);
}
