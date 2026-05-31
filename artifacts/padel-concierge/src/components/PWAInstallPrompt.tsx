import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePwaInstall } from "@/lib/pwaInstall";

const EVENT_NAME = "pwa:install";
const PENDING_KEY = "pwa_install_pending";

/** Surfaces the install prompt prominently (e.g. right after registration). */
export function triggerInstallPrompt(): void {
  if (typeof window === "undefined") return;
  // Persist so a full-page redirect/reload still surfaces the prompt.
  try {
    sessionStorage.setItem(PENDING_KEY, "1");
  } catch {
    // sessionStorage unavailable — fall back to the event only.
  }
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function PWAInstallPrompt() {
  const { language } = useLanguage();
  const lang = language === "ru" ? "ru" : "en";
  const { isInstallable, isInstalled, isIOS, isMobile, promptInstall } = usePwaInstall();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onTrigger = () => {
      if (isInstalled) {
        try {
          sessionStorage.removeItem(PENDING_KEY);
        } catch {
          // ignore
        }
        return;
      }
      // Only worth surfacing where we can actually install or instruct.
      if (!isInstallable && !isMobile) return;
      try {
        sessionStorage.removeItem(PENDING_KEY);
      } catch {
        // ignore
      }
      setOpen(true);
    };
    // Catch a pending trigger that survived a full-page redirect/reload.
    try {
      if (sessionStorage.getItem(PENDING_KEY)) onTrigger();
    } catch {
      // ignore
    }
    window.addEventListener(EVENT_NAME, onTrigger);
    return () => window.removeEventListener(EVENT_NAME, onTrigger);
  }, [isInstalled, isInstallable, isMobile]);

  if (!open || isInstalled) return null;

  const t =
    lang === "ru"
      ? {
          title: "Добавь приложение на главный экран",
          body: "Запускай Padel Concierge одним касанием — без поиска ссылки. Работает как обычное приложение.",
          install: "Установить приложение",
          iosSteps: "Нажми «Поделиться» в Safari, затем «На экран „Домой“».",
          androidSteps: "Открой меню (⋮) в браузере и выбери «Установить приложение».",
          later: "Позже",
        }
      : {
          title: "Add the app to your home screen",
          body: "Launch Padel Concierge with one tap — no link hunting. Works like a native app.",
          install: "Install app",
          iosSteps: "Tap Share in Safari, then “Add to Home Screen”.",
          androidSteps: "Open your browser menu (⋮) and choose “Install app”.",
          later: "Not now",
        };

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome !== "dismissed") setOpen(false);
  };

  const handleLater = () => setOpen(false);

  return (
    <div className="fixed inset-x-0 bottom-0 z-[110] p-3 sm:bottom-4 sm:right-4 sm:left-auto sm:max-w-sm">
      <div
        className="rounded-2xl p-5 shadow-2xl"
        style={{
          background: "rgba(20,20,20,0.98)",
          border: "1px solid rgba(212,175,55,0.3)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="text-3xl flex-shrink-0">📲</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold text-white">{t.title}</div>
            <div className="text-sm text-muted-foreground mt-1">{t.body}</div>
          </div>
        </div>

        {!isInstallable && (
          <div
            className="mt-3 rounded-xl px-3 py-2.5 text-sm text-white/80"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            {isIOS ? t.iosSteps : t.androidSteps}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {isInstallable && (
            <button
              onClick={handleInstall}
              className="flex-1 rounded-full px-4 py-2.5 text-sm font-semibold"
              style={{ background: "#D4AF37", color: "#000" }}
            >
              {t.install}
            </button>
          )}
          <button
            onClick={handleLater}
            className="rounded-full px-4 py-2.5 text-sm font-medium text-white/70 hover:text-white"
            style={{ border: "1px solid rgba(255,255,255,0.15)" }}
          >
            {t.later}
          </button>
        </div>
      </div>
    </div>
  );
}
