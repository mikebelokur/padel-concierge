import { useLocation } from "wouter";
import { LEVEL_ORDER, type Level, Q2_OPTIONS, Q3_OPTIONS, Q1_OPTIONS } from "@/lib/quiz";

export default function Profile() {
  const [, setLocation] = useLocation();

  const user = JSON.parse(localStorage.getItem("pf_user") || "null");
  const quiz = JSON.parse(localStorage.getItem("pf_quiz") || "null");

  if (!user) {
    setLocation("/");
    return null;
  }

  const realLevel = (quiz?.real_level ?? "D-") as Level;
  const levelIdx = LEVEL_ORDER.indexOf(realLevel);
  const initials = user.name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const registeredDate = new Date(user.created_at).toLocaleDateString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  const q1Label = quiz?.q1_answer != null ? Q1_OPTIONS[quiz.q1_answer] : null;
  const q2Label = quiz?.q2_answer != null ? Q2_OPTIONS[quiz.q2_answer] : null;
  const q3Label = quiz?.q3_answer != null ? Q3_OPTIONS[quiz.q3_answer] : null;

  return (
    <div className="min-h-screen flex flex-col px-5 py-8">
      <div className="w-full max-w-[420px] mx-auto flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#0A84FF]/20 border border-[#0A84FF]/30 flex items-center justify-center">
            <span className="text-xl font-bold text-[#0A84FF]">{initials}</span>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">{user.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/25 px-2.5 py-1 rounded-lg font-semibold">
                Уровень {realLevel}
              </span>
              <span className="text-xs text-[#555]">{registeredDate}</span>
            </div>
          </div>
        </div>

        {/* Progress scale */}
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
          <div className="text-xs text-[#555] uppercase tracking-widest mb-4">Прогресс</div>
          <div className="relative">
            <div className="flex items-end gap-1 mb-3">
              {LEVEL_ORDER.map((lvl, i) => (
                <div key={lvl} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-sm ${
                      i === levelIdx
                        ? "bg-[#0A84FF] h-8"
                        : i < levelIdx
                        ? "bg-[#0A84FF]/30 h-5"
                        : "bg-[#2a2a2a] h-3"
                    }`}
                  />
                  <span className={`text-xs font-bold ${i === levelIdx ? "text-[#0A84FF]" : "text-[#555]"}`}>
                    {lvl}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {levelIdx < LEVEL_ORDER.length - 1 && (
            <p className="text-xs text-[#555] mt-1">
              Следующий уровень: <span className="text-[#8a8a8a]">{LEVEL_ORDER[levelIdx + 1]}</span>
            </p>
          )}
        </div>

        {/* Player profile */}
        {quiz && (q1Label || q2Label || q3Label) && (
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-4">Профиль игрока</div>
            <div className="space-y-3">
              {q1Label && (
                <div className="flex items-start gap-3">
                  <span className="text-[#555] text-sm w-24 shrink-0">Бэкграунд</span>
                  <span className="text-white text-sm font-medium">{q1Label}</span>
                </div>
              )}
              {q2Label && (
                <div className="flex items-start gap-3">
                  <span className="text-[#555] text-sm w-24 shrink-0">Мотивация</span>
                  <span className="text-white text-sm font-medium">{q2Label}</span>
                </div>
              )}
              {q3Label && (
                <div className="flex items-start gap-3">
                  <span className="text-[#555] text-sm w-24 shrink-0">Стиль</span>
                  <span className="text-white text-sm font-medium">{q3Label}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
          <div className="text-xs text-[#555] uppercase tracking-widest mb-4">Статистика</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[#8a8a8a] text-sm">Матчей сыграно</span>
              <span className="text-white font-semibold text-sm">0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8a8a8a] text-sm">Квиз пройден</span>
              <span className="text-[#30D158] font-semibold text-sm">{quiz ? "✅ Да" : "— Нет"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8a8a8a] text-sm">Следующий шаг</span>
              <span className="text-[#FFB84D] text-sm font-medium">Найти первую игру</span>
            </div>
          </div>
        </div>

        {!quiz && (
          <button
            onClick={() => setLocation("/quiz")}
            className="w-full h-14 bg-[#0A84FF] text-white font-semibold text-base rounded-xl hover:bg-[#0A84FF]/90 transition-colors"
          >
            Пройти тест на уровень →
          </button>
        )}

        <button
          onClick={() => setLocation("/result")}
          className="w-full h-12 bg-[#161616] border border-[#2a2a2a] text-[#8a8a8a] font-medium text-sm rounded-xl hover:border-[#0A84FF]/40 hover:text-[#cccccc] transition-colors"
        >
          Посмотреть результат теста
        </button>
      </div>
    </div>
  );
}
