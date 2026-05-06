import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { LEVEL_ORDER, LEVEL_DESCRIPTIONS, type Level, Q1_OPTIONS, Q2_OPTIONS, Q3_OPTIONS } from "@/lib/level-quiz";

export default function LevelQuizResult() {
  const [, setLocation] = useLocation();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown> | null>(null);

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
  const desc = LEVEL_DESCRIPTIONS[realLevel] ?? "";

  const q1 = answers?.q1 != null ? Q1_OPTIONS[answers.q1 as number] : null;
  const q2 = answers?.q2 != null ? Q2_OPTIONS[answers.q2 as number] : null;
  const q3 = answers?.q3 != null ? Q3_OPTIONS[answers.q3 as number] : null;

  function retake() {
    sessionStorage.removeItem("lq_result");
    sessionStorage.removeItem("lq_answers");
    sessionStorage.removeItem("lq_session");
    setLocation("/level-quiz");
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#080808] px-5 py-8">
      <div className="w-full max-w-[480px] mx-auto flex flex-col gap-6">

        {/* Big level */}
        <div className="text-center pt-4">
          <div className="text-xs text-blue-400 font-medium uppercase tracking-widest mb-3">Твой уровень</div>
          <div className="text-[96px] font-black text-white leading-none mb-3">{realLevel}</div>
          <p className="text-[#8a8a8a] text-sm leading-relaxed">{desc}</p>
          {quizLevel !== realLevel && (
            <p className="text-xs text-[#444] mt-2">Тест: {quizLevel} → Рабочий: {realLevel}</p>
          )}
        </div>

        {/* Honest message */}
        <div className="border-l-4 border-amber-500 bg-amber-500/5 rounded-r-xl px-4 py-4">
          <p className="text-[#ccc] text-sm leading-relaxed">
            Это твой уровень в идеальных условиях. В реальной игре сложнее: партнёр влияет на половину розыгрышей, эмоции не всегда стабильны, техника под давлением работает иначе. Рабочий уровень — на ступень ниже. Это не плохо — это честно. Именно отсюда начинается настоящий рост.
          </p>
        </div>

        {/* Level scale */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          <div className="text-xs text-[#555] uppercase tracking-widest mb-4">Шкала развития</div>
          <div className="flex items-end gap-1.5">
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
        </div>

        {/* Personality */}
        {(q1 || q2 || q3) && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-4">Профиль игрока</div>
            <div className="space-y-3">
              {q1 && <div className="flex gap-3"><span className="text-[#555] text-sm w-24 shrink-0">Бэкграунд</span><span className="text-white text-sm">{q1}</span></div>}
              {q2 && <div className="flex gap-3"><span className="text-[#555] text-sm w-24 shrink-0">Мотивация</span><span className="text-white text-sm">{q2}</span></div>}
              {q3 && <div className="flex gap-3"><span className="text-[#555] text-sm w-24 shrink-0">Стиль</span><span className="text-white text-sm">{q3}</span></div>}
            </div>
          </div>
        )}

        <button
          onClick={() => setLocation("/level-quiz/profile")}
          className="w-full h-14 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-base rounded-xl transition-colors"
        >
          Перейти в профиль →
        </button>

        <button
          onClick={retake}
          className="w-full h-11 bg-transparent border border-white/10 text-[#8a8a8a] text-sm font-medium rounded-xl hover:border-white/20 hover:text-[#ccc] transition-colors"
        >
          Пройти тест заново
        </button>
      </div>
    </div>
  );
}
