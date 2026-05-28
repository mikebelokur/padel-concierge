import { useEffect, useState } from "react";
import { Link } from "wouter";
import { getPushStatus } from "@/lib/push";
import { useLanguage } from "@/contexts/LanguageContext";

const DISMISS_KEY = "push_blocked_banner_dismissed";

export function PushBlockedBanner() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // ignore
    }
    getPushStatus().then(s => {
      if (!cancelled && s === "blocked") setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  return (
    <Link
      href="/settings#push-notifications"
      className="flex items-start gap-3 mb-4 rounded-[14px] px-4 py-3 transition-colors hover:bg-[rgba(212,175,55,0.1)] no-underline"
      style={{
        border: "1px solid rgba(212,175,55,0.3)",
        background: "rgba(212,175,55,0.06)",
      }}
      role="alert"
    >
      <span aria-hidden className="text-base leading-5">🔕</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white">
          {t("pushBlockedBanner.title")}
        </div>
        <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>
          {t("pushBlockedBanner.cta")}
        </div>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t("pushBlockedBanner.dismiss")}
        className="flex-shrink-0 -mr-1 -mt-1 px-2 py-1 text-base leading-none text-white/60 hover:text-white"
      >
        ×
      </button>
    </Link>
  );
}
