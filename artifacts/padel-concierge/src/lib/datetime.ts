export type DateInput = string | number | Date;

const DUBAI_TZ = "Asia/Dubai";

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

function intlLocale(locale: string): string {
  return locale === "ru" ? "ru-RU" : "en-GB";
}

function stripTrailingDot(s: string): string {
  return s.replace(/\.$/, "");
}

export function formatDubaiDateTime(input: DateInput, locale: string = "en"): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  const intl = intlLocale(locale);
  const datePart = stripTrailingDot(
    d.toLocaleDateString(intl, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: DUBAI_TZ,
    }),
  ).replace(/\./g, "");
  const timePart = d.toLocaleTimeString(intl, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: DUBAI_TZ,
  });
  return `${datePart} · ${timePart}`;
}

export function formatDubaiDate(input: DateInput, locale: string = "en"): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  return stripTrailingDot(
    d.toLocaleDateString(intlLocale(locale), {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: DUBAI_TZ,
    }),
  ).replace(/\./g, "");
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

export function formatDubaiTimeRange(
  input: DateInput,
  durationMinutes: number,
  locale: string = "en",
): string {
  const start = toDate(input);
  if (Number.isNaN(start.getTime())) return "";
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return `${formatDubaiDate(start, locale)} · ${formatDubaiTime(start, locale)} – ${formatDubaiTime(end, locale)}`;
}

export function formatDubaiMonthYear(input: DateInput, locale: string = "en"): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  return stripTrailingDot(
    d.toLocaleDateString(intlLocale(locale), {
      month: "short",
      year: "numeric",
      timeZone: DUBAI_TZ,
    }),
  );
}

export function formatDubaiShortDate(input: DateInput, locale: string = "en"): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) return "";
  return stripTrailingDot(
    d.toLocaleDateString(intlLocale(locale), {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: DUBAI_TZ,
    }),
  );
}
