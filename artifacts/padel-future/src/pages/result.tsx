import { useLocation } from "wouter";
import { LEVEL_ORDER, LEVEL_DESCRIPTIONS, type Level, Q1_OPTIONS, Q2_OPTIONS, Q3_OPTIONS } from "@/lib/quiz";

export default function Result() {
  const [, setLocation] = useLocation();

  const user = JSON.parse(localStorage.getItem("pf_user") || "null");
  const quiz = JSON.parse(localStorage.getItem("pf_quiz") || "null");

  if (!user || !quiz) {
    setLocation("/");
    return null;
  }

  const realLevel = quiz.real_level as Level;
  const quizLevel = quiz.quiz_level as Level;
  const desc = LEVEL_DESCRIPTIONS[realLevel] ?? "";

  const levelIdx = LEVEL_ORDER.indexOf(realLevel);

  const q1Label = quiz.q1_answer != null ? Q1_OPTIONS[quiz.q1_answer] : null;
  const q2Label = quiz.q2_answer != null ? Q2_OPTIONS[quiz.q2_answer] : null;
  const q3Label = quiz.q3_answer != null ? Q3_OPTIONS[quiz.q3_answer] : null;

  return (
    <div className="min-h-screen flex flex-col px-5 py-8">
      <div className="w-full max-w-[420px] mx-auto flex flex-col gap-6">
        {/* Big level display */}
        <div className="text-center pt-4">
          <div className="text-xs text-[#0A84FF] font-medium uppercase tracking-widest mb-3">Твой уровень</div>
          <div className="text-8xl font-black text-white tracking-tight mb-2">{realLevel}</div>
          <div className="text-[#8a8a8a] text-sm leading-relaxed">{desc}</div>
          {quizLevel !== realLevel && (
            <div className="text-xs text-[#555] mt-1">Тест: {quizLevel} → Рабочий: {realLevel}</div>
          )}
        </div>

        {/* Honest message */}
        <div className="border-l-4 border-[#FFB84D] bg-[#FFB84D]/5 rounded-r-xl px-4 py-4">
          <p className="text-[#cccccc] text-sm leading-relaxed">
            Это твой уровень в идеальных условиях. В реальной игре сложнее: партнёр влияет на половину розыгрышей, эмоции не всегда стабильны, техника под давлением работает иначе. Рабочий уровень — на ступень ниже. Это не плохо — это честно. Именно отсюда начинается настоящий рост.
          </p>
        </div>

        {/* Level scale */}
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
          <div className="text-xs text-[#555] uppercase tracking-widest mb-4">Шкала развития</div>
          <div className="flex items-end gap-1">
            {LEVEL_ORDER.map((lvl, i) => (
              <div key={lvl} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t-sm transition-all ${
                    i === levelIdx
                      ? "bg-[#0A84FF] h-8"
                      : i < levelIdx
                      ? "bg-[#0A84FF]/30 h-4"
                      : "bg-[#2a2a2a] h-4"
                  }`}
                />
                <span className={`text-xs font-bold ${i === levelIdx ? "text-[#0A84FF]" : "text-[#555]"}`}>
                  {lvl}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Personality profile */}
        {(q1Label || q2Label || q3Label) && (
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-4">Профиль игрока</div>
            <div className="space-y-3">
              {q1Label && (
                <div className="flex gap-3">
                  <span className="text-[#555] text-sm">Бэкграунд</span>
                  <span className="text-white text-sm font-medium">{q1Label}</span>
                </div>
              )}
              {q2Label && (
                <div className="flex gap-3">
                  <span className="text-[#555] text-sm">Мотивация</span>
                  <span className="text-white text-sm font-medium">{q2Label}</span>
                </div>
              )}
              {q3Label && (
                <div className="flex gap-3">
                  <span className="text-[#555] text-sm">Стиль</span>
                  <span className="text-white text-sm font-medium">{q3Label}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => setLocation("/profile")}
          className="w-full h-14 bg-[#0A84FF] text-white font-semibold text-base rounded-xl hover:bg-[#0A84FF]/90 active:bg-[#0A84FF]/80 transition-colors"
        >
          Перейти в мой профиль →
        </button>
      </div>
    </div>
  );
}
