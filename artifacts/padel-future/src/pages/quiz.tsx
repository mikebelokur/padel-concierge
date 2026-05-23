import { useState } from "react";
import { useLocation } from "wouter";
import { submitQuiz } from "@/lib/api";
import {
  Q1_OPTIONS, Q2_OPTIONS, Q3_OPTIONS,
  LEVEL_QUESTIONS, calcQuizLevel, downgradeLevel,
} from "@/lib/quiz";

const TOTAL = 10;

type Answers = {
  q1?: number; q2?: number; q3?: number;
  q4?: string; q4Extra?: string;
  q5?: string; q6?: string; q7?: string;
  q8?: string; q9?: string; q10?: string;
};

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="w-full h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
      <div
        className="h-full bg-[#0A84FF] rounded-full transition-all duration-300"
        style={{ width: `${((step) / TOTAL) * 100}%` }}
      />
    </div>
  );
}

export default function Quiz() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1); // 1–10
  const [answers, setAnswers] = useState<Answers>({});
  const [q4Extra, setQ4Extra] = useState("");
  const [loading, setLoading] = useState(false);
  const [showExtra, setShowExtra] = useState(false);

  const user = JSON.parse(localStorage.getItem("pf_user") || "null");
  if (!user) {
    setLocation("/");
    return null;
  }

  function setQ1(v: number) { setAnswers(a => ({ ...a, q1: v })); setStep(2); }
  function setQ2(v: number) { setAnswers(a => ({ ...a, q2: v })); setStep(3); }
  function setQ3(v: number) { setAnswers(a => ({ ...a, q3: v })); setStep(4); }

  function setLevelAnswer(key: string, val: string, hasExtra: boolean) {
    setAnswers(a => ({ ...a, [key]: val }));
    if (hasExtra) {
      setShowExtra(true);
    } else {
      advanceLevelStep();
    }
  }

  function advanceLevelStep() {
    setShowExtra(false);
    if (step < TOTAL) {
      setStep(s => s + 1);
    } else {
      finishQuiz();
    }
  }

  async function finishQuiz() {
    const levelQuestionKey = LEVEL_QUESTIONS[step - 4].key;
    const levelAnswers: Record<string, string> = {};
    LEVEL_QUESTIONS.forEach(q => {
      const v = (answers as Record<string, string>)[q.key];
      if (v) levelAnswers[q.key] = v;
    });
    const currentKey = levelQuestionKey;
    const currentVal = (answers as Record<string, string>)[currentKey];
    if (currentVal) levelAnswers[currentKey] = currentVal;

    const quizLevel = calcQuizLevel(levelAnswers);
    const realLevel = downgradeLevel(quizLevel);

    const personality = Q3_OPTIONS[answers.q3 ?? 0];

    setLoading(true);
    try {
      const result = await submitQuiz({
        userEmail: user.email,
        quizLevel, realLevel,
        personalityType: personality,
        q1Answer: answers.q1,
        q2Answer: answers.q2,
        q3Answer: answers.q3,
        q4Answer: levelAnswers.q4,
        q4Extra: q4Extra || null,
        q5Answer: levelAnswers.q5,
        q6Answer: levelAnswers.q6,
        q7Answer: levelAnswers.q7,
        q8Answer: levelAnswers.q8,
        q9Answer: levelAnswers.q9,
        q10Answer: levelAnswers.q10,
      });
      localStorage.setItem("pf_quiz", JSON.stringify(result));
      setLocation("/result");
    } catch {
      setLoading(false);
    }
  }

  function handleBack() {
    if (showExtra) { setShowExtra(false); return; }
    if (step > 1) setStep(s => s - 1);
    else setLocation("/");
  }

  const personalitySteps = [
    {
      emoji: "🎯", label: "Цель",
      question: "Почему ты начал(а) играть в падел?",
      options: Q1_OPTIONS, onSelect: setQ1, selected: answers.q1,
    },
    {
      emoji: "❤️", label: "Мотивация",
      question: "Что для тебя важнее на корте?",
      options: Q2_OPTIONS, onSelect: setQ2, selected: answers.q2,
    },
    {
      emoji: "🏆", label: "Идеал",
      question: "Как выглядит твоя идеальная игра?",
      options: Q3_OPTIONS, onSelect: setQ3, selected: answers.q3,
    },
  ];

  const isPersonality = step <= 3;
  const levelIdx = step - 4;
  const levelQ = !isPersonality ? LEVEL_QUESTIONS[levelIdx] : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">🏸</div>
          <p className="text-[#8a8a8a]">Считаем результат...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-5 py-6">
      <div className="w-full max-w-[420px] mx-auto flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={handleBack} className="text-[#8a8a8a] hover:text-white transition-colors text-sm font-medium">
            ← Назад
          </button>
          <div className="flex-1">
            <ProgressBar step={step} />
          </div>
          <span className="text-[#555] text-sm">{step}/{TOTAL}</span>
        </div>

        {/* Personality questions */}
        {isPersonality && (() => {
          const q = personalitySteps[step - 1];
          return (
            <div className="flex-1 flex flex-col">
              <div className="mb-8">
                <div className="text-4xl mb-3">{q.emoji}</div>
                <div className="text-xs text-[#0A84FF] font-medium uppercase tracking-widest mb-2">{q.label}</div>
                <h2 className="text-xl font-bold text-white leading-snug">{q.question}</h2>
              </div>
              <div className="space-y-3">
                {q.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => q.onSelect(i)}
                    className={`w-full min-h-[56px] px-4 py-3 text-left rounded-xl border transition-all text-sm font-medium ${
                      q.selected === i
                        ? "border-[#0A84FF] bg-[#0A84FF]/10 text-white"
                        : "border-[#2a2a2a] bg-[#161616] text-[#cccccc] hover:border-[#0A84FF]/50 hover:bg-[#0A84FF]/5"
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
              <div className="text-xs text-[#0A84FF] font-medium uppercase tracking-widest mb-2">{levelQ.label}</div>
              <h2 className="text-xl font-bold text-white leading-snug">{levelQ.text}</h2>
            </div>

            {showExtra ? (
              <div className="flex-1 flex flex-col gap-4">
                <p className="text-[#8a8a8a] text-sm">Как ты обычно это делаешь?</p>
                <textarea
                  value={q4Extra}
                  onChange={(e) => setQ4Extra(e.target.value)}
                  placeholder="Необязательно, но интересно..."
                  rows={4}
                  className="w-full px-4 py-3 bg-[#161616] border border-[#2a2a2a] rounded-xl text-white placeholder-[#555] focus:outline-none focus:border-[#0A84FF] transition-colors resize-none text-sm"
                />
                <button
                  onClick={advanceLevelStep}
                  className="w-full h-14 bg-[#0A84FF] text-white font-semibold rounded-xl hover:bg-[#0A84FF]/90 transition-colors"
                >
                  Продолжить →
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {["yes", "no"].map((val) => (
                  <button
                    key={val}
                    onClick={() => {
                      const isLast = step === TOTAL;
                      const hasExtra = levelQ.hasExtra;
                      setAnswers(a => ({ ...a, [levelQ.key]: val }));
                      if (hasExtra) {
                        setShowExtra(true);
                      } else if (isLast) {
                        // Need to call finishQuiz with updated answers
                        const newAnswers = { ...answers, [levelQ.key]: val };
                        const levelAnswers: Record<string, string> = {};
                        LEVEL_QUESTIONS.forEach(q => {
                          const v = (newAnswers as Record<string, string>)[q.key];
                          if (v) levelAnswers[q.key] = v;
                        });
                        const quizLevel = calcQuizLevel(levelAnswers);
                        const realLevel = downgradeLevel(quizLevel);
                        const personality = Q3_OPTIONS[newAnswers.q3 ?? 0];
                        setLoading(true);
                        submitQuiz({
                          userEmail: user.email, quizLevel, realLevel,
                          personalityType: personality,
                          q1Answer: newAnswers.q1, q2Answer: newAnswers.q2, q3Answer: newAnswers.q3,
                          q4Answer: levelAnswers.q4, q4Extra: q4Extra || null,
                          q5Answer: levelAnswers.q5, q6Answer: levelAnswers.q6,
                          q7Answer: levelAnswers.q7, q8Answer: levelAnswers.q8,
                          q9Answer: levelAnswers.q9, q10Answer: levelAnswers.q10,
                        }).then(result => {
                          localStorage.setItem("pf_quiz", JSON.stringify(result));
                          setLocation("/result");
                        }).catch(() => setLoading(false));
                      } else {
                        setStep(s => s + 1);
                      }
                    }}
                    className={`w-full min-h-[56px] py-4 rounded-xl border font-bold text-lg transition-all ${
                      val === "yes"
                        ? "border-[#30D158]/30 bg-[#30D158]/5 text-[#30D158] hover:bg-[#30D158]/10 hover:border-[#30D158]/50"
                        : "border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                    }`}
                  >
                    {val === "yes" ? "✓ Да" : "✗ Нет"}
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
