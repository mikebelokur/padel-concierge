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
          {TRAINING_CARDS.map((card) => (
            <Link key={card.href} href={card.href}>
              <div
                data-testid={`card-training-${card.href.replace(/\W+/g, "-")}`}
                className="cursor-pointer rounded-xl border border-white/10 bg-card hover:border-primary/40 hover:bg-white/5 transition-colors p-5 min-h-[112px] flex gap-4 items-start"
              >
                <span className="text-3xl leading-none">{card.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-base">{t(card.titleKey)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t(card.descKey)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
