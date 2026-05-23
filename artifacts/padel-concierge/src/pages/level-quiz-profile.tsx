import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { LEVEL_ORDER, type Level } from "@/lib/level-quiz";
import { useLanguage } from "@/contexts/LanguageContext";

const LOCALE_MAP: Record<string, string> = {
  en: "en-GB",
  ru: "ru-RU",
};

export default function LevelQuizProfile() {
  const [, setLocation] = useLocation();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown> | null>(null);
  const { t, language } = useLanguage();

  useEffect(() => {
    const r = sessionStorage.getItem("lq_result");
    const a = sessionStorage.getItem("lq_answers");
    if (!r) { setLocation("/level-quiz"); return; }
    setResult(JSON.parse(r));
    if (a) setAnswers(JSON.parse(a));
  }, []);

  if (!result) return null;

  const locale = LOCALE_MAP[language] ?? "en-GB";
  const realLevel = (result.real_level ?? "D-") as Level;
  const levelIdx = LEVEL_ORDER.indexOf(realLevel);
  const dateOpts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
  const completedDate = result.completed_at
    ? new Date(result.completed_at as string).toLocaleDateString(locale, dateOpts)
    : new Date().toLocaleDateString(locale, dateOpts);

  const q1 = answers?.q1 != null ? t(`levelQuiz.q1Options.${answers.q1 as number}`) : null;
  const q2 = answers?.q2 != null ? t(`levelQuiz.q2Options.${answers.q2 as number}`) : null;
  const q3 = answers?.q3 != null ? t(`levelQuiz.q3Options.${answers.q3 as number}`) : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#080808] px-5 py-8">
      <div className="w-full max-w-[480px] mx-auto flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <span className="text-xl font-black text-blue-400">{realLevel}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{t("levelQuizProfile.myProfile")}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/25 px-2.5 py-1 rounded-lg font-semibold">
                {t("levelQuizProfile.level")} {realLevel}
              </span>
              <span className="text-xs text-[#555]">{completedDate}</span>
            </div>
          </div>
        </div>

        {/* Progress scale */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          <div className="text-xs text-[#555] uppercase tracking-widest mb-4">{t("levelQuizProfile.progress")}</div>
          <div className="flex items-end gap-1.5 mb-2">
            {LEVEL_ORDER.map((lvl, i) => (
              <div key={lvl} className="flex-1 flex flex-col items-center gap-1.5">
                <div className={`w-full rounded-t transition-all ${
                  i === levelIdx ? "bg-blue-500 h-10" :
                  i < levelIdx  ? "bg-blue-500/30 h-5" :
                                  "bg-white/10 h-3"
                }`} />
                <span className={`text-xs font-bold ${i === levelIdx ? "text-blue-400" : "text-[#555]"}`}>{lvl}</span>
              </div>
            ))}
          </div>
          {levelIdx < LEVEL_ORDER.length - 1 && (
            <p className="text-xs text-[#555] mt-1">
              {t("levelQuizProfile.nextLevel")} <span className="text-[#8a8a8a]">{LEVEL_ORDER[levelIdx + 1]}</span>
            </p>
          )}
        </div>

        {/* Personality */}
        {(q1 || q2 || q3) && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-4">{t("levelQuizProfile.playerProfile")}</div>
            <div className="space-y-3">
              {q1 && <div className="flex items-start gap-3"><span className="text-[#555] text-sm w-24 shrink-0">{t("levelQuizResult.background")}</span><span className="text-white text-sm">{q1}</span></div>}
              {q2 && <div className="flex items-start gap-3"><span className="text-[#555] text-sm w-24 shrink-0">{t("levelQuizResult.motivation")}</span><span className="text-white text-sm">{q2}</span></div>}
              {q3 && <div className="flex items-start gap-3"><span className="text-[#555] text-sm w-24 shrink-0">{t("levelQuizResult.style")}</span><span className="text-white text-sm">{q3}</span></div>}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          <div className="text-xs text-[#555] uppercase tracking-widest mb-4">{t("levelQuizProfile.stats")}</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[#8a8a8a] text-sm">{t("levelQuizProfile.matchesPlayed")}</span>
              <span className="text-white font-semibold text-sm">0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8a8a8a] text-sm">{t("levelQuizProfile.quizCompleted")}</span>
              <span className="text-emerald-400 font-semibold text-sm">{t("levelQuizProfile.quizYes")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8a8a8a] text-sm">{t("levelQuizProfile.nextStep")}</span>
              <span className="text-amber-400 text-sm font-medium">{t("levelQuizProfile.findFirstGame")}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setLocation("/level-quiz/result")}
          className="w-full h-12 bg-transparent border border-white/10 text-[#8a8a8a] text-sm font-medium rounded-xl hover:border-white/20 hover:text-[#ccc] transition-colors"
        >
          {t("levelQuizProfile.viewResult")}
        </button>
      </div>
    </div>
  );
}
