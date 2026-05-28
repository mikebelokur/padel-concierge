export type DateInput = string | number | Date;

const DUBAI_TZ = "Asia/Dubai";

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

function intlLocale(locale: string): string {
  if (locale === "ru") return "ru-RU";
  if (locale === "ar") return "ar";
  return "en-GB";
}

function stripTrailingDot(s: string): string {
  return s.replace(/\.$/, "");
}

export function formatDubaiDate(
  input: DateInput,
  locale: string = "en",
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  return stripTrailingDot(
    d.toLocaleDateString(intlLocale(locale), {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: DUBAI_TZ,
      ...options,
    }),
  ).replace(/\./g, "");
}

export function formatDubaiLongDate(input: DateInput, locale: string = "en"): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  return stripTrailingDot(
    d.toLocaleDateString(intlLocale(locale), {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: DUBAI_TZ,
    }),
  );
}

export function formatDubaiTime(input: DateInput, locale: string = "en"): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: DUBAI_TZ,
  });
}

/**
 * Formats a match's `date` + `time` (e.g. "2026-05-30" + "18:30") into a
 * locale-aware Dubai-timezone string like "Sat, 30 May · 18:30".
 *
 * Accepts already-combined datetime strings too.
 */
export function formatMatchDateTime(
  date: string,
  time: string | null | undefined,
  locale: string = "en",
  variant: "short" | "long" = "short",
): string {
  // The API returns a calendar date ("YYYY-MM-DD") + Dubai-local wall time
  // ("HH:MM"). Append a `+04:00` offset so parsing pins the moment to Dubai
  // and locale formatting stays stable regardless of device timezone.
  const combined =
    time && !date.includes("T")
      ? `${date}T${time.length === 5 ? `${time}:00` : time}+04:00`
      : date;
  const datePart =
    variant === "long"
      ? formatDubaiLongDate(combined, locale)
      : formatDubaiDate(combined, locale);
  if (!time) return datePart;
  return `${datePart} · ${formatDubaiTime(combined, locale)}`;
}
