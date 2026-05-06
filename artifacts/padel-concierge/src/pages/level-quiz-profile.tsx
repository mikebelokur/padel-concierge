import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { LEVEL_ORDER, type Level, Q1_OPTIONS, Q2_OPTIONS, Q3_OPTIONS } from "@/lib/level-quiz";

export default function LevelQuizProfile() {
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

  const realLevel = (result.real_level ?? "D-") as Level;
  const levelIdx = LEVEL_ORDER.indexOf(realLevel);
  const completedDate = result.completed_at
    ? new Date(result.completed_at as string).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
    : new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

  const q1 = answers?.q1 != null ? Q1_OPTIONS[answers.q1 as number] : null;
  const q2 = answers?.q2 != null ? Q2_OPTIONS[answers.q2 as number] : null;
  const q3 = answers?.q3 != null ? Q3_OPTIONS[answers.q3 as number] : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#080808] px-5 py-8">
      <div className="w-full max-w-[480px] mx-auto flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <span className="text-xl font-black text-blue-400">{realLevel}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Мой профиль</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/25 px-2.5 py-1 rounded-lg font-semibold">
                Уровень {realLevel}
              </span>
              <span className="text-xs text-[#555]">{completedDate}</span>
            </div>
          </div>
        </div>

        {/* Progress scale */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          <div className="text-xs text-[#555] uppercase tracking-widest mb-4">Прогресс</div>
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
              Следующий уровень: <span className="text-[#8a8a8a]">{LEVEL_ORDER[levelIdx + 1]}</span>
            </p>
          )}
        </div>

        {/* Personality */}
        {(q1 || q2 || q3) && (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-4">Профиль игрока</div>
            <div className="space-y-3">
              {q1 && <div className="flex items-start gap-3"><span className="text-[#555] text-sm w-24 shrink-0">Бэкграунд</span><span className="text-white text-sm">{q1}</span></div>}
              {q2 && <div className="flex items-start gap-3"><span className="text-[#555] text-sm w-24 shrink-0">Мотивация</span><span className="text-white text-sm">{q2}</span></div>}
              {q3 && <div className="flex items-start gap-3"><span className="text-[#555] text-sm w-24 shrink-0">Стиль</span><span className="text-white text-sm">{q3}</span></div>}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          <div className="text-xs text-[#555] uppercase tracking-widest mb-4">Статистика</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[#8a8a8a] text-sm">Матчей сыграно</span>
              <span className="text-white font-semibold text-sm">0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8a8a8a] text-sm">Квиз пройден</span>
              <span className="text-emerald-400 font-semibold text-sm">✅ Да</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8a8a8a] text-sm">Следующий шаг</span>
              <span className="text-amber-400 text-sm font-medium">Найти первую игру</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setLocation("/level-quiz/result")}
          className="w-full h-12 bg-transparent border border-white/10 text-[#8a8a8a] text-sm font-medium rounded-xl hover:border-white/20 hover:text-[#ccc] transition-colors"
        >
          ← Посмотреть результат теста
        </button>
      </div>
    </div>
  );
}
