import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePwaInstall } from "@/lib/pwaInstall";

const VISIT_KEY = "pwa_visit_count";
const DISMISS_KEY = "pwa_banner_dismissed";

export function PWAInstallBanner() {
  const { i18n } = useTranslation();
  const lang = i18n.language === "ru" ? "ru" : "en";
  const { isInstallable, isInstalled, isIOS, isMobile, promptInstall } = usePwaInstall();
  const [gatePassed, setGatePassed] = useState(false);

  useEffect(() => {
    if (!isMobile || isInstalled) return undefined;
    if (localStorage.getItem(DISMISS_KEY)) return undefined;
    const visits = parseInt(localStorage.getItem(VISIT_KEY) ?? "0", 10) + 1;
    localStorage.setItem(VISIT_KEY, String(visits));
    if (visits >= 2) {
      const t = setTimeout(() => setGatePassed(true), 1500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isMobile, isInstalled]);

  // Suppress once installed, before the gate, or when there's nothing actionable
  // to offer (non-iOS browser that never fired beforeinstallprompt).
  if (isInstalled || !gatePassed) return null;
  if (!isInstallable && !isIOS) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setGatePassed(false);
  };

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") dismiss();
  };

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
          {!isInstallable && (
            <div className="text-xs text-muted-foreground mt-1">
              {isIOS
                ? lang === "ru"
                  ? "Safari → «Поделиться» → «На экран „Домой“»"
                  : "Safari → Share → Add to Home Screen"
                : lang === "ru"
                ? "Chrome → меню (⋮) → «Установить приложение»"
                : "Chrome → menu (⋮) → Install app"}
            </div>
          )}
          {isInstallable && (
            <button
              onClick={handleInstall}
              className="mt-2 rounded-full px-4 py-2 text-sm font-semibold"
              style={{ background: "#D4AF37", color: "#000" }}
            >
              {lang === "ru" ? "Установить приложение" : "Install app"}
            </button>
          )}
        </div>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-white text-lg leading-none flex-shrink-0"
          aria-label="dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
