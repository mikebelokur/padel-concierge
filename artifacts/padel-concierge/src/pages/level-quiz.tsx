import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LEVEL_QUESTIONS, calcQuizLevel, downgradeLevel, generateSessionId,
} from "@/lib/level-quiz";
import { submitLevelQuiz } from "@/lib/level-quiz-api";

const TOTAL = 10;

type Answers = {
  q1?: number; q2?: number; q3?: number;
  q4?: string; q4Extra?: string;
  q5?: string; q6?: string; q7?: string;
  q8?: string; q9?: string; q10?: string;
};

const SESSION_KEY = "lq_session";

function GoldProgressBar({ step }: { step: number }) {
  return (
    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${(step / TOTAL) * 100}%`,
          background: "linear-gradient(90deg, #D4AF37, #f0d060)",
        }}
      />
    </div>
  );
}

export default function LevelQuiz() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Answers>({});
  const [q4Extra, setQ4Extra] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const [loading, setLoading] = useState(false);

  const [sessionId] = useState(() => {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = generateSessionId();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  });

  useEffect(() => {
    const saved = sessionStorage.getItem("lq_result");
    if (saved) setLocation("/level-quiz/result");
  }, []);

  const isPersonality = step <= 3;
  const levelIdx = step - 4;
  const levelQ = !isPersonality ? LEVEL_QUESTIONS[levelIdx] : null;

  function handleBack() {
    if (showExtra) { setShowExtra(false); return; }
    if (step > 1) setStep(s => s - 1);
  }

  function setQ(key: "q1" | "q2" | "q3", val: number, nextStep: number) {
    setAnswers(a => ({ ...a, [key]: val }));
    setStep(nextStep);
  }

  async function saveAndFinish(finalAnswers: Answers) {
    const levelAnswers: Record<string, string> = {};
    LEVEL_QUESTIONS.forEach(q => {
      const v = (finalAnswers as Record<string, string>)[q.key];
      if (v) levelAnswers[q.key] = v;
    });
    const quizLevel = calcQuizLevel(levelAnswers);
    const realLevel = downgradeLevel(quizLevel);
    const q3Options = t("levelQuiz.q3Options", { returnObjects: true }) as unknown as string[];
    const personality = finalAnswers.q3 != null ? q3Options[finalAnswers.q3] : null;

    setLoading(true);
    try {
      const result = await submitLevelQuiz({
        sessionId, quizLevel, realLevel,
        personalityType: personality,
        q1Answer: finalAnswers.q1 ?? null,
        q2Answer: finalAnswers.q2 ?? null,
        q3Answer: finalAnswers.q3 ?? null,
        q4Answer: levelAnswers.q4 ?? null,
        q4Extra: q4Extra || null,
        q5Answer: levelAnswers.q5 ?? null,
        q6Answer: levelAnswers.q6 ?? null,
        q7Answer: levelAnswers.q7 ?? null,
        q8Answer: levelAnswers.q8 ?? null,
        q9Answer: levelAnswers.q9 ?? null,
        q10Answer: levelAnswers.q10 ?? null,
      });
      sessionStorage.setItem("lq_result", JSON.stringify(result));
      sessionStorage.setItem("lq_answers", JSON.stringify(finalAnswers));
      setLocation("/level-quiz/result");
    } catch {
      setLoading(false);
    }
  }

  function handleLevelAnswer(key: string, val: string, hasExtra: boolean, isLast: boolean) {
    const newAnswers = { ...answers, [key]: val };
    setAnswers(newAnswers);
    if (hasExtra) setShowExtra(true);
    else if (isLast) saveAndFinish(newAnswers);
    else setStep(s => s + 1);
  }

  function handleExtraContinue() {
    setShowExtra(false);
    const isLast = step === TOTAL;
    if (isLast) saveAndFinish(answers);
    else setStep(s => s + 1);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="text-5xl mb-5 animate-bounce">🏸</div>
          <p className="text-muted-foreground" style={{ fontSize: "17px" }}>{t("levelQuiz.loading")}</p>
        </div>
      </div>
    );
  }

  const q1Options = t("levelQuiz.q1Options", { returnObjects: true }) as unknown as string[];
  const q2Options = t("levelQuiz.q2Options", { returnObjects: true }) as unknown as string[];
  const q3Options = t("levelQuiz.q3Options", { returnObjects: true }) as unknown as string[];

  const personalitySteps = [
    { emoji: "🎯", label: t("levelQuiz.q1.label"), question: t("levelQuiz.q1.text"), options: q1Options, qKey: "q1" as const, selected: answers.q1 },
    { emoji: "❤️", label: t("levelQuiz.q2.label"), question: t("levelQuiz.q2.text"), options: q2Options, qKey: "q2" as const, selected: answers.q2 },
    { emoji: "🏆", label: t("levelQuiz.q3.label"), question: t("levelQuiz.q3.text"), options: q3Options, qKey: "q3" as const, selected: answers.q3 },
  ];

  return (
    <div
      className="min-h-screen flex flex-col bg-black"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="w-full max-w-[480px] mx-auto flex flex-col flex-1 px-6 py-6">

        {/* Header with progress */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="text-muted-foreground hover:text-white transition-colors font-medium flex-shrink-0"
                style={{ fontSize: "15px" }}
              >
                ← {t("levelQuiz.back").replace("← ", "")}
              </button>
            )}
            <div className="flex-1">
              <GoldProgressBar step={step} />
            </div>
            <span className="text-muted-foreground flex-shrink-0 font-mono" style={{ fontSize: "13px" }}>
              {step}/{TOTAL}
            </span>
          </div>
        </div>

        {/* Personality questions */}
        {isPersonality && (() => {
          const q = personalitySteps[step - 1];
          return (
            <div className="flex-1 flex flex-col animate-fade-up">
              <div className="mb-8">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-5"
                  style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.25)" }}
                >
                  {q.emoji}
                </div>
                <div
                  className="mb-2 font-medium uppercase tracking-widest"
                  style={{ fontSize: "11px", color: "#D4AF37" }}
                >
                  {q.label}
                </div>
                <h2 className="font-serif font-bold text-white leading-snug" style={{ fontSize: "22px" }}>
                  {q.question}
                </h2>
              </div>
              <div className="space-y-3">
                {q.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setQ(q.qKey, i, step + 1)}
                    className="w-full text-left px-5 py-4 rounded-[16px] border transition-all"
                    style={{
                      minHeight: "64px",
                      fontSize: "16px",
                      background: q.selected === i ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.03)",
                      borderColor: q.selected === i ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.1)",
                      color: q.selected === i ? "#D4AF37" : "rgba(255,255,255,0.85)",
                    }}
                  >
                    <span
                      className="font-bold mr-3"
                      style={{ color: "rgba(212,175,55,0.6)", fontSize: "13px" }}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Level questions */}
        {!isPersonality && levelQ && (
          <div className="flex-1 flex flex-col animate-fade-up">
            <div className="mb-8">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-5"
                style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.25)" }}
              >
                {levelQ.emoji}
              </div>
              <div
                className="mb-2 font-medium uppercase tracking-widest"
                style={{ fontSize: "11px", color: "#D4AF37" }}
              >
                {t(`levelQuiz.${levelQ.key}.label`)}
              </div>
              <h2 className="font-serif font-bold text-white leading-snug" style={{ fontSize: "22px" }}>
                {t(`levelQuiz.${levelQ.key}.text`)}
              </h2>
            </div>

            {showExtra ? (
              <div className="flex flex-col gap-4">
                <p className="text-muted-foreground" style={{ fontSize: "16px" }}>{t("levelQuiz.howDoYouDo")}</p>
                <textarea
                  value={q4Extra}
                  onChange={(e) => setQ4Extra(e.target.value)}
                  placeholder={t("levelQuiz.optional")}
                  rows={4}
                  className="w-full px-4 py-4 rounded-[16px] border text-white placeholder-white/30 outline-none transition-colors resize-none"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderColor: "rgba(255,255,255,0.1)",
                    fontSize: "16px",
                  }}
                />
                <button
                  onClick={handleExtraContinue}
                  className="w-full rounded-[14px] font-semibold text-black bg-primary transition-all"
                  style={{ height: "56px", fontSize: "17px" }}
                >
                  {t("levelQuiz.continueBtn")}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {(["yes", "no"] as const).map((val) => (
                  <button
                    key={val}
                    onClick={() => handleLevelAnswer(levelQ.key, val, levelQ.hasExtra, step === TOTAL)}
                    className="w-full rounded-[16px] border font-bold transition-all"
                    style={{
                      minHeight: "72px",
                      fontSize: "20px",
                      background: val === "yes" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                      borderColor: val === "yes" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
                      color: val === "yes" ? "#22c55e" : "#ef4444",
                    }}
                  >
                    {val === "yes" ? t("levelQuiz.yes") : t("levelQuiz.no")}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
