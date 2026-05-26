import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

const HIDDEN_PATHS = ["/assessment", "/quiz"];

function NoLevelStrip() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [location] = useLocation();

  if (!user || user.role !== "player" || user.level) return null;
  if (HIDDEN_PATHS.some((p) => location === p || location.startsWith(`${p}/`))) {
    return null;
  }

  return (
    <Link href="/assessment">
      <a
        className="block w-full text-center px-4 py-2 text-sm font-medium text-black hover:opacity-90 transition-opacity"
        style={{
          background: "rgba(212,175,55,0.95)",
          borderBottom: "1px solid rgba(212,175,55,0.6)",
        }}
        data-testid="banner-no-level-global"
      >
        <span className="font-semibold">{t("dashboard.noLevelBannerTitle")}</span>
        <span className="mx-2 opacity-70">·</span>
        <span className="underline">{t("dashboard.noLevelBannerCta")}</span>
      </a>
    </Link>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen overflow-y-auto pt-14 lg:pl-64 pb-24 lg:pb-0">
      <NoLevelStrip />
      {children}
    </main>
  );
}
