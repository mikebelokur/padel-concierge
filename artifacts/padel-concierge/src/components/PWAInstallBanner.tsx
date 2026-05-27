import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const VISIT_KEY = "pwa_visit_count";
const DISMISS_KEY = "pwa_banner_dismissed";

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS-specific
    window.navigator.standalone === true
  );
}

export function PWAInstallBanner() {
  const { i18n } = useTranslation();
  const lang = i18n.language === "ru" ? "ru" : "en";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isMobile() || isStandalone()) return undefined;
    if (localStorage.getItem(DISMISS_KEY)) return undefined;
    const visits = parseInt(localStorage.getItem(VISIT_KEY) ?? "0", 10) + 1;
    localStorage.setItem(VISIT_KEY, String(visits));
    if (visits >= 2) {
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  if (!visible) return null;

  const ios = isIOS();
  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-[100] rounded-2xl p-4 shadow-2xl"
      style={{
        background: "rgba(20,20,20,0.97)",
        border: "1px solid rgba(212,175,55,0.3)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">📱</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white">
            {lang === "ru" ? "Добавь на главный экран — будет как приложение" : "Add to Home Screen — works like an app"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {ios
              ? lang === "ru"
                ? "Safari → поделиться → «На экран Домой»"
                : "Safari → Share → Add to Home Screen"
              : lang === "ru"
              ? "Chrome → меню (⋮) → «Установить приложение»"
              : "Chrome → menu (⋮) → Install app"}
          </div>
        </div>
        <button
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
          className="text-muted-foreground hover:text-white text-lg leading-none flex-shrink-0"
          aria-label="dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
