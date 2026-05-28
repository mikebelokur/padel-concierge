import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

type Kind = "match" | "booking" | "group-training";

const PATHS: Record<Kind, (id: string | number) => string> = {
  match: (id) => `/api/matches/${id}/ics`,
  booking: (id) => `/api/bookings/${id}/ics`,
  "group-training": (id) => `/api/group-trainings/${id}/ics`,
};

const FILENAMES: Record<Kind, (id: string | number) => string> = {
  match: (id) => `padel-match-${id}.ics`,
  booking: (id) => `padel-booking-${id}.ics`,
  "group-training": (id) => `padel-training-${id}.ics`,
};

interface Props {
  kind: Kind;
  id: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function AddToCalendarButton({ kind, id, className, style }: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(PATHS[kind](id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(msg || res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(
        new Blob([blob], { type: "text/calendar;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = FILENAMES[kind](id);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast({
        title: t("calendar.downloadFailed"),
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className={
        className ??
        "w-full rounded-[20px] font-semibold transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
      }
      style={
        style ?? {
          minHeight: "52px",
          fontSize: "15px",
          background: "hsl(220 20% 10%)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.85)",
        }
      }
    >
      {busy ? t("calendar.preparing") : `📅 ${t("calendar.addToCalendar")}`}
    </button>
  );
}
