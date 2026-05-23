import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Home() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at center, rgba(45, 125, 255, 0.1) 0%, transparent 60%)" }} />

      <div className="z-10 text-center max-w-3xl">
        <h1 className="text-5xl md:text-7xl font-serif mb-6 tracking-tight">Padel Concierge</h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
          {t("home.tagline")}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/register">
            <button className="w-full sm:w-auto inline-flex items-center justify-center rounded-[14px] bg-primary text-black font-semibold text-lg px-8 h-14 transition-all hover:bg-primary/90">
              {t("home.getStarted")}
            </button>
          </Link>
          <Link href="/login">
            <button className="w-full sm:w-auto inline-flex items-center justify-center rounded-[14px] border border-white/10 bg-transparent font-medium text-lg px-8 h-14 text-foreground transition-all hover:bg-white/5">
              {t("home.login")}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
