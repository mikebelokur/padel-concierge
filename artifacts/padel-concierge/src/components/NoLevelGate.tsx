import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/layout/AppLayout";

export function useHasLevel(): boolean {
  const { user } = useAuth();
  return !!user?.level;
}

export function NoLevelGate() {
  const { t } = useLanguage();
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 animate-fade-up" style={{ paddingTop: "28px" }}>
        <div
          className="rounded-[20px] p-8 text-center"
          style={{
            background: "rgba(212,175,55,0.10)",
            border: "1.5px solid rgba(212,175,55,0.45)",
          }}
        >
          <div className="text-5xl mb-4">⚠️</div>
          <h2
            className="font-serif font-bold text-white mb-2"
            style={{ fontSize: "20px" }}
          >
            {t("dashboard.noLevelBannerTitle")}
          </h2>
          <p className="text-muted-foreground mb-6" style={{ fontSize: "15px" }}>
            {t("dashboard.noLevelBannerDesc")}
          </p>
          <Link href="/assessment">
            <button
              className="rounded-[12px] font-semibold text-black bg-primary hover:opacity-90 transition-opacity"
              style={{ fontSize: "15px", padding: "12px 24px" }}
            >
              {t("dashboard.noLevelBannerCta")}
            </button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
