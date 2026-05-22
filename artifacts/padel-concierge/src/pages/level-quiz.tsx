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

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-500 rounded-full transition-all duration-300"
        style={{ width: `${(step / TOTAL) * 100}%` }}
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
      <div className="min-h-screen flex items-center justify-center bg-[#080808]">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🏸</div>
          <p className="text-[#8a8a8a]">{t("levelQuiz.loading")}</p>
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
    <div className="min-h-screen flex flex-col bg-[#080808] px-5 py-6">
      <div className="w-full max-w-[480px] mx-auto flex flex-col flex-1">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          {step > 1 && (
            <button onClick={handleBack} className="text-[#8a8a8a] hover:text-white transition-colors text-sm font-medium shrink-0">
              {t("levelQuiz.back")}
            </button>
          )}
          <div className="flex-1"><ProgressBar step={step} /></div>
          <span className="text-[#555] text-xs shrink-0">{step}/{TOTAL}</span>
        </div>

        {/* Personality questions */}
        {isPersonality && (() => {
          const q = personalitySteps[step - 1];
          return (
            <div className="flex-1 flex flex-col">
              <div className="mb-8">
                <div className="text-4xl mb-3">{q.emoji}</div>
                <div className="text-xs text-blue-400 font-medium uppercase tracking-widest mb-2">{q.label}</div>
                <h2 className="text-xl font-bold text-white leading-snug">{q.question}</h2>
              </div>
              <div className="space-y-3">
                {q.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setQ(q.qKey, i, step + 1)}
                    className={`w-full min-h-[56px] px-4 py-3 text-left rounded-xl border transition-all text-sm font-medium ${
                      q.selected === i
                        ? "border-blue-500 bg-blue-500/10 text-white"
                        : "border-white/10 bg-white/[0.03] text-[#ccc] hover:border-blue-500/50 hover:bg-blue-500/5"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Level questions */}
        {!isPersonality && levelQ && (
          <div className="flex-1 flex flex-col">
            <div className="mb-8">
              <div className="text-4xl mb-3">{levelQ.emoji}</div>
              <div className="text-xs text-blue-400 font-medium uppercase tracking-widest mb-2">
                {t(`levelQuiz.${levelQ.key}.label`)}
              </div>
              <h2 className="text-xl font-bold text-white leading-snug">
                {t(`levelQuiz.${levelQ.key}.text`)}
              </h2>
            </div>

            {showExtra ? (
              <div className="flex-1 flex flex-col gap-4">
                <p className="text-[#8a8a8a] text-sm">{t("levelQuiz.howDoYouDo")}</p>
                <textarea
                  value={q4Extra}
                  onChange={(e) => setQ4Extra(e.target.value)}
                  placeholder={t("levelQuiz.optional")}
                  rows={4}
                  className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-[#555] focus:outline-none focus:border-blue-500 transition-colors resize-none text-sm"
                />
                <button
                  onClick={handleExtraContinue}
                  className="w-full h-14 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-500 transition-colors"
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
                    className={`w-full min-h-[64px] py-4 rounded-xl border font-bold text-lg transition-all ${
                      val === "yes"
                        ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 active:scale-[0.98]"
                        : "border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 active:scale-[0.98]"
                    }`}
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
