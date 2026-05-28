// Minimal RFC 5545 .ics generator with Asia/Dubai VTIMEZONE.
// Dubai is fixed at UTC+04:00 year-round (no DST), so the VTIMEZONE is static.

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

// Fold lines longer than 75 octets per RFC 5545.
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (i === 0) {
      parts.push(line.slice(0, 75));
      i = 75;
    } else {
      parts.push(" " + line.slice(i, i + 74));
      i += 74;
    }
  }
  return parts.join("\r\n");
}

function formatDateUtc(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

// Format a Date as a local Dubai-time wall-clock string (no Z suffix), to be
// used with TZID=Asia/Dubai.
function formatDateDubai(d: Date): string {
  // Dubai = UTC+4, no DST.
  const t = new Date(d.getTime() + 4 * 60 * 60 * 1000);
  return (
    t.getUTCFullYear().toString() +
    pad(t.getUTCMonth() + 1) +
    pad(t.getUTCDate()) +
    "T" +
    pad(t.getUTCHours()) +
    pad(t.getUTCMinutes()) +
    pad(t.getUTCSeconds())
  );
}

export interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
}

const DUBAI_VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Asia/Dubai",
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:+0400",
  "TZOFFSETTO:+0400",
  "TZNAME:GST",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

export function buildIcs(event: IcsEvent): string {
  const now = new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Padel Concierge//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    DUBAI_VTIMEZONE,
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatDateUtc(now)}`,
    `DTSTART;TZID=Asia/Dubai:${formatDateDubai(event.start)}`,
    `DTEND;TZID=Asia/Dubai:${formatDateDubai(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
  ];
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

import type { Response } from "express";

export function sendIcs(res: Response, filename: string, body: string): void {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safe}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(body);
}
