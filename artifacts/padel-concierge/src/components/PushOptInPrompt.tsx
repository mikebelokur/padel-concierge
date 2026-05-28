import { useEffect, useState } from "react";
import {
  getPromptState,
  pushSupported,
  setPromptState,
  subscribeToPush,
} from "@/lib/push";
import { useLanguage } from "@/contexts/LanguageContext";

const EVENT_NAME = "push:prompt";

export function triggerPushPrompt(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function PushOptInPrompt() {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onTrigger = () => {
      if (!pushSupported()) return;
      if (getPromptState() !== "pending") return;
      if (Notification.permission !== "default") return;
      setOpen(true);
    };
    window.addEventListener(EVENT_NAME, onTrigger);
    return () => window.removeEventListener(EVENT_NAME, onTrigger);
  }, []);

  if (!open) return null;

  const t =
    language === "ru"
      ? {
          title: "Включить уведомления?",
          body: "Получайте мгновенные уведомления о новых приглашениях на матч и изменениях в бронированиях.",
          enable: "Включить",
          later: "Позже",
        }
      : {
          title: "Turn on notifications?",
          body: "Get instant alerts for new match invites and booking changes.",
          enable: "Enable",
          later: "Not now",
        };

  const handleEnable = async () => {
    setOpen(false);
    await subscribeToPush();
  };
  const handleLater = () => {
    setOpen(false);
    setPromptState("asked");
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:bottom-4 sm:right-4 sm:left-auto sm:max-w-sm">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur">
        <div className="text-sm font-semibold text-white">{t.title}</div>
        <p className="mt-1 text-xs text-white/70">{t.body}</p>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleLater}
            className="rounded-md px-3 py-1.5 text-xs text-white/70 hover:text-white"
          >
            {t.later}
          </button>
          <button
            type="button"
            onClick={handleEnable}
            className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white/90"
          >
            {t.enable}
          </button>
        </div>
      </div>
    </div>
  );
}
