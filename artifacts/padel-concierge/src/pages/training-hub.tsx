import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { TRAINING_CARDS } from "@/lib/navConfig";
import { AppLayout } from "@/components/layout/AppLayout";

export default function TrainingHub() {
  const { t } = useLanguage();
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="font-serif text-2xl tracking-tight">{t("training.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("training.subtitle")}</p>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TRAINING_CARDS.map((card) => {
            const testId = `card-training-${card.href.replace(/\W+/g, "-")}`;

            if (card.disabled) {
              return (
                <div
                  key={card.href}
                  data-testid={testId}
                  aria-disabled="true"
                  className="rounded-xl border border-white/10 bg-card p-5 min-h-[112px] flex gap-4 items-start opacity-50 cursor-not-allowed select-none"
                >
                  <span className="text-3xl leading-none grayscale">{card.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-base">{t(card.titleKey)}</span>
                      <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        {t("training.comingSoon")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{t(card.descKey)}</div>
                  </div>
                </div>
              );
            }

            return (
              <Link key={card.href} href={card.href}>
                <div
                  data-testid={testId}
                  className="cursor-pointer rounded-xl border border-white/10 bg-card hover:border-primary/40 hover:bg-white/5 transition-colors p-5 min-h-[112px] flex gap-4 items-start"
                >
                  <span className="text-3xl leading-none">{card.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-base">{t(card.titleKey)}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t(card.descKey)}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
