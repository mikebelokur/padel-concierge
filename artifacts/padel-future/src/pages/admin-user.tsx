import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import AdminGuard from "@/components/AdminGuard";
import { getAdminUser, type AdminUserDetail, type OnboardingStatus } from "@/lib/api";
import { QUIZ_QUESTIONS, getAnswerLabel, isCorrectAnswer } from "@/lib/quiz-labels";

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STATUS_LABELS: Record<OnboardingStatus, string> = {
  pending: "Ожидает проверки",
  approved: "Одобрен",
  verified: "Верифицирован",
};

const STATUS_COLORS: Record<OnboardingStatus, string> = {
  pending: "text-[#FFB84D]",
  approved: "text-[#0A84FF]",
  verified: "text-[#30D158]",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#2a2a2a]/60 last:border-b-0">
      <span className="text-[#555] text-sm w-36 shrink-0">{label}</span>
      <span className="text-white text-sm font-medium flex-1 break-words">{value ?? "—"}</span>
    </div>
  );
}

function AdminUserContent() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.id) return;
    getAdminUser(params.id)
      .then(setDetail)
      .catch(() => setError("Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#555] text-sm">Загрузка...</div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400 text-sm">{error || "Пользователь не найден"}</div>
      </div>
    );
  }

  const { user, quizResult, matches } = detail;
  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const correctCount = quizResult
    ? QUIZ_QUESTIONS.filter((q) => q.type === "yesno" && isCorrectAnswer(q, quizResult[`${q.key}_answer`] as string) === true).length
    : 0;
  const totalYesNo = QUIZ_QUESTIONS.filter((q) => q.type === "yesno").length;

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <button
          onClick={() => setLocation("/admin")}
          className="flex items-center gap-1.5 text-sm text-[#555] hover:text-[#8a8a8a] transition-colors"
        >
          ← Назад к списку
        </button>

        {/* Profile card */}
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-[#0A84FF]/15 border border-[#0A84FF]/25 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-[#0A84FF]">{initials}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{user.name}</h1>
              <p className="text-[#555] text-sm mt-0.5">ID #{user.id}</p>
            </div>
          </div>

          <div className="text-xs text-[#555] uppercase tracking-widest mb-3">Профиль</div>
          <div>
            {user.email && <InfoRow label="Email" value={user.email} />}
            {user.phone && <InfoRow label="Телефон" value={user.phone} />}
            <InfoRow label="Город" value={user.location_name ?? "—"} />
            <InfoRow label="Район" value={user.neighbourhood ?? "—"} />
            <InfoRow label="Регистрация" value={fmt(user.created_at)} />
            <InfoRow
              label="Статус"
              value={
                <span className={`font-semibold ${STATUS_COLORS[user.onboardingStatus]}`}>
                  {STATUS_LABELS[user.onboardingStatus]}
                </span>
              }
            />
            <InfoRow
              label="Уровень (0–100)"
              value={
                user.levelSelf !== null ? (
                  <span className="bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/25 px-2 py-0.5 rounded font-bold text-xs tabular-nums">
                    {user.levelSelf}
                  </span>
                ) : "—"
              }
            />
            {quizResult && (
              <>
                <InfoRow
                  label="Уровень (квиз)"
                  value={
                    <span className="bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/25 px-2 py-0.5 rounded font-bold text-xs">
                      {quizResult.real_level as string}
                    </span>
                  }
                />
                <InfoRow label="Тип игрока" value={quizResult.personality_type as string} />
                <InfoRow label="Квиз пройден" value={fmt(quizResult.completed_at as string)} />
              </>
            )}
            {!quizResult && <InfoRow label="Квиз" value={<span className="text-[#FFB84D]">Не пройден</span>} />}
            <InfoRow
              label="Доступность"
              value={
                user.availability && user.availability.length > 0
                  ? user.availability.join(", ")
                  : <span className="text-[#555]">Не указана</span>
              }
            />
          </div>
        </div>

        {/* Quiz responses card */}
        {quizResult && (
          <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs text-[#555] uppercase tracking-widest">Ответы квиза</div>
              <div className="text-xs text-[#8a8a8a]">
                Правильных: <span className="text-white font-semibold">{correctCount}</span>/{totalYesNo}
              </div>
            </div>

            <div className="space-y-3">
              {QUIZ_QUESTIONS.map((q) => {
                const rawKey = `${q.key}_answer`;
                const raw = quizResult[rawKey];
                const label = getAnswerLabel(q, raw as string | number | null);
                const correct = isCorrectAnswer(q, raw as string | number | null);

                return (
                  <div
                    key={q.key}
                    className={`rounded-xl p-3.5 border ${
                      correct === true
                        ? "bg-[#30D158]/5 border-[#30D158]/20"
                        : correct === false
                        ? "bg-[#FF453A]/5 border-[#FF453A]/20"
                        : "bg-[#2a2a2a]/30 border-[#2a2a2a]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-[#8a8a8a] uppercase tracking-wider">{q.label}</span>
                      {correct === true && <span className="text-[#30D158] text-xs font-semibold shrink-0">✓ Верно</span>}
                      {correct === false && <span className="text-[#FF453A] text-xs font-semibold shrink-0">✗ Неверно</span>}
                    </div>
                    <p className="text-white text-sm leading-relaxed mb-2">{q.text}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-[#8a8a8a]">Ответ:</span>
                      <span className="text-xs font-medium text-white bg-[#2a2a2a] border border-[#3a3a3a] px-2 py-0.5 rounded">
                        {raw === null || raw === undefined ? "—" : label}
                      </span>
                      {correct === false && q.correctAnswer && (
                        <>
                          <span className="text-xs text-[#555]">Правильно:</span>
                          <span className="text-xs font-medium text-[#30D158] bg-[#30D158]/10 border border-[#30D158]/20 px-2 py-0.5 rounded">
                            {q.correctAnswer === "yes" ? "Да" : "Нет"}
                          </span>
                        </>
                      )}
                    </div>
                    {q.key === "q4" && !!quizResult.q4_extra && (
                      <p className="text-xs text-[#555] mt-1.5">Примечание: {quizResult.q4_extra as string}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 p-3 bg-[#0A84FF]/8 border border-[#0A84FF]/20 rounded-xl">
              <div className="text-xs text-[#555] uppercase tracking-wider mb-1">Итог</div>
              <p className="text-sm text-[#8a8a8a]">
                Набрано <span className="text-white font-semibold">{correctCount}</span> из {totalYesNo} правильных ответов →{" "}
                <span className="text-[#0A84FF] font-semibold">{quizResult.quiz_level as string}</span>
                {quizResult.real_level !== quizResult.quiz_level && (
                  <span className="text-[#555]">
                    {" "}(скорректирован до <span className="text-white">{quizResult.real_level as string}</span>)
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Match history card */}
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-5">
          <div className="text-xs text-[#555] uppercase tracking-widest mb-4">История матчей</div>
          {matches && matches.length > 0 ? (
            <div className="space-y-2">
              {(matches as Array<Record<string, unknown>>).map((m, i) => {
                const clubName = String((m.club_name ?? m.clubName) ?? "—");
                const matchDate = fmt(m.date != null ? String(m.date) : null);
                const matchStatus = m.status ? String(m.status) : null;
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[#2a2a2a]/60 last:border-b-0">
                    <div>
                      <span className="text-white text-sm">{clubName}</span>
                      {matchStatus && <span className="text-[#555] text-xs ml-2">({matchStatus})</span>}
                    </div>
                    <span className="text-[#555] text-xs">{matchDate}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[#555] text-sm">Нет матчей</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminUser() {
  return (
    <AdminGuard>
      <AdminUserContent />
    </AdminGuard>
  );
}
