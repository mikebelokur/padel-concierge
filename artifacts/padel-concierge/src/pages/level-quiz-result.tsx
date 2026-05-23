import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { LEVEL_ORDER, type Level } from "@/lib/level-quiz";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LevelQuizResult() {
  const [, setLocation] = useLocation();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown> | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const r = sessionStorage.getItem("lq_result");
    const a = sessionStorage.getItem("lq_answers");
    if (!r) { setLocation("/level-quiz"); return; }
    setResult(JSON.parse(r));
    if (a) setAnswers(JSON.parse(a));
  }, []);

  if (!result) return null;

  const realLevel = result.real_level as Level;
  const quizLevel = result.quiz_level as Level;
  const levelIdx = LEVEL_ORDER.indexOf(realLevel);

  const q1 = answers?.q1 != null ? t(`levelQuiz.q1Options.${answers.q1 as number}`) : null;
  const q2 = answers?.q2 != null ? t(`levelQuiz.q2Options.${answers.q2 as number}`) : null;
  const q3 = answers?.q3 != null ? t(`levelQuiz.q3Options.${answers.q3 as number}`) : null;

  function retake() {
    sessionStorage.removeItem("lq_result");
    sessionStorage.removeItem("lq_answers");
    sessionStorage.removeItem("lq_session");
    setLocation("/level-quiz");
  }

  return (
    <div
      className="min-h-screen bg-black flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="w-full max-w-[480px] mx-auto px-6 py-8 flex flex-col gap-6 animate-fade-up">

        {/* Level hero */}
        <div className="text-center pt-4">
          <div
            className="font-medium uppercase tracking-widest mb-4"
            style={{ fontSize: "11px", color: "#D4AF37" }}
          >
            {t("levelQuizResult.yourLevel")}
          </div>
          <div
            className="font-black leading-none mb-4"
            style={{
              fontSize: "96px",
              color: "#D4AF37",
              textShadow: "0 0 60px rgba(212,175,55,0.5)",
            }}
          >
            {realLevel}
          </div>
          <p className="text-muted-foreground leading-relaxed" style={{ fontSize: "16px" }}>
            {t(`levelQuiz.levelDescriptions.${realLevel}`)}
          </p>
          {quizLevel !== realLevel && (
            <p className="mt-2 text-muted-foreground" style={{ fontSize: "13px" }}>
              {t("levelQuizResult.quizVsReal", { quizLevel, realLevel })}
            </p>
          )}
        </div>

        {/* Honest message */}
        <div
          className="rounded-[16px] px-5 py-4"
          style={{
            borderLeft: "4px solid #D4AF37",
            background: "rgba(212,175,55,0.06)",
            borderRadius: "0 16px 16px 0",
          }}
        >
          <p className="text-white/80 leading-relaxed" style={{ fontSize: "15px" }}>
            {t("levelQuizResult.honestMessage")}
          </p>
        </div>

        {/* Level scale */}
        <div
          className="rounded-[20px] p-5"
          style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div
            className="uppercase tracking-widest mb-5"
            style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}
          >
            {t("levelQuizResult.developmentScale")}
          </div>
          <div className="flex items-end gap-2">
            {LEVEL_ORDER.map((lvl, i) => (
              <div key={lvl} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: i === levelIdx ? "44px" : i < levelIdx ? "24px" : "14px",
                    background: i === levelIdx
                      ? "#D4AF37"
                      : i < levelIdx
                      ? "rgba(212,175,55,0.35)"
                      : "rgba(255,255,255,0.08)",
                    boxShadow: i === levelIdx ? "0 0 20px rgba(212,175,55,0.4)" : "none",
                  }}
                />
                <span
                  className="font-bold"
                  style={{
                    fontSize: "12px",
                    color: i === levelIdx ? "#D4AF37" : "rgba(255,255,255,0.25)",
                  }}
                >
                  {lvl}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Player profile */}
        {(q1 || q2 || q3) && (
          <div
            className="rounded-[20px] p-5"
            style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div
              className="uppercase tracking-widest mb-5"
              style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}
            >
              {t("levelQuizResult.playerProfile")}
            </div>
            <div className="space-y-4">
              {q1 && (
                <div className="flex gap-4">
                  <span className="text-muted-foreground flex-shrink-0" style={{ fontSize: "14px", minWidth: "90px" }}>{t("levelQuizResult.background")}</span>
                  <span className="text-white" style={{ fontSize: "14px" }}>{q1}</span>
                </div>
              )}
              {q2 && (
                <div className="flex gap-4">
                  <span className="text-muted-foreground flex-shrink-0" style={{ fontSize: "14px", minWidth: "90px" }}>{t("levelQuizResult.motivation")}</span>
                  <span className="text-white" style={{ fontSize: "14px" }}>{q2}</span>
                </div>
              )}
              {q3 && (
                <div className="flex gap-4">
                  <span className="text-muted-foreground flex-shrink-0" style={{ fontSize: "14px", minWidth: "90px" }}>{t("levelQuizResult.style")}</span>
                  <span className="text-white" style={{ fontSize: "14px" }}>{q3}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CTA buttons */}
        <button
          onClick={() => setLocation("/level-quiz/profile")}
          className="w-full rounded-[14px] font-semibold text-black transition-all"
          style={{ height: "56px", fontSize: "17px", background: "#D4AF37", boxShadow: "0 4px 20px rgba(212,175,55,0.3)" }}
        >
          {t("levelQuizResult.goToProfile")}
        </button>

        <button
          onClick={retake}
          className="w-full rounded-[14px] border font-medium text-muted-foreground hover:text-white hover:border-white/25 transition-colors"
          style={{ height: "50px", fontSize: "15px", borderColor: "rgba(255,255,255,0.1)" }}
        >
          {t("levelQuizResult.retakeQuiz")}
        </button>
      </div>
    </div>
  );
}
