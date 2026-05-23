import { useEffect, useState } from "react";
import { getLevelQuizAdmin } from "@/lib/level-quiz-api";
import { LEVEL_ORDER } from "@/lib/level-quiz";
import { useLanguage } from "@/contexts/LanguageContext";

interface Row {
  id: number;
  session_id: string;
  real_level: string | null;
  quiz_level: string | null;
  personality_type: string | null;
  q1_answer: number | null;
  q2_answer: number | null;
  q3_answer: number | null;
  completed_at: string | null;
}

const LOCALE_MAP: Record<string, string> = {
  en: "en-GB",
  ru: "ru-RU",
};

function fmtDate(d: string | null, locale: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString(locale, {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function LevelBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-[#555]">—</span>;
  const colorIdx = LEVEL_ORDER.indexOf(level as any);
  const colors = [
    "bg-red-500/15 text-red-400 border-red-500/25",
    "bg-orange-500/15 text-orange-400 border-orange-500/25",
    "bg-amber-500/15 text-amber-400 border-amber-500/25",
    "bg-blue-500/15 text-blue-400 border-blue-500/25",
    "bg-violet-500/15 text-violet-400 border-violet-500/25",
    "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  ];
  const cls = colors[colorIdx] ?? "bg-white/10 text-white border-white/20";
  return (
    <span className={`inline-block text-xs border px-2 py-0.5 rounded font-bold ${cls}`}>{level}</span>
  );
}

export default function LevelQuizAdmin() {
  const [data, setData] = useState<{ results: Row[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { t, language } = useLanguage();

  const locale = LOCALE_MAP[language] ?? "en-GB";

  useEffect(() => {
    getLevelQuizAdmin()
      .then(setData)
      .catch(() => setError(t("levelQuizAdmin.errorLoading")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-[#555]">{t("common.loading")}</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-red-400">{error}</div>
    </div>
  );

  const headers = [
    t("levelQuizAdmin.colWorking"),
    t("levelQuizAdmin.colQuiz"),
    t("levelQuizAdmin.colBackground"),
    t("levelQuizAdmin.colMotivation"),
    t("levelQuizAdmin.colStyle"),
    t("levelQuizAdmin.colDate"),
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Level Quiz — Results</h1>
          <p className="text-[#8a8a8a] text-sm mt-0.5">
            {t("levelQuizAdmin.totalCompletions")} <span className="text-white font-semibold">{data?.total ?? 0}</span>
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="h-9 px-4 bg-white/[0.04] border border-white/10 text-[#8a8a8a] text-sm rounded-lg hover:text-white hover:border-white/20 transition-colors"
        >
          {t("levelQuizAdmin.refresh")}
        </button>
      </div>

      {/* Level distribution */}
      {data && data.results.length > 0 && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-6">
          <div className="text-xs text-[#555] uppercase tracking-widest mb-3">{t("levelQuizAdmin.levelDistribution")}</div>
          <div className="flex gap-3 flex-wrap">
            {LEVEL_ORDER.map(lvl => {
              const count = data.results.filter(r => r.real_level === lvl).length;
              if (!count) return null;
              return (
                <div key={lvl} className="flex items-center gap-1.5">
                  <LevelBadge level={lvl} />
                  <span className="text-[#8a8a8a] text-xs">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {headers.map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#555] uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.results.map((row, i) => (
              <tr
                key={row.id}
                className={`hover:bg-white/[0.02] transition-colors ${i < (data.results.length - 1) ? "border-b border-white/[0.06]" : ""}`}
              >
                <td className="px-4 py-3"><LevelBadge level={row.real_level} /></td>
                <td className="px-4 py-3 text-[#8a8a8a]">{row.quiz_level ?? "—"}</td>
                <td className="px-4 py-3 text-[#8a8a8a] text-xs">{row.q1_answer != null ? t(`levelQuiz.q1Options.${row.q1_answer}`) : "—"}</td>
                <td className="px-4 py-3 text-[#8a8a8a] text-xs">{row.q2_answer != null ? t(`levelQuiz.q2Options.${row.q2_answer}`) : "—"}</td>
                <td className="px-4 py-3 text-[#8a8a8a] text-xs">{row.q3_answer != null ? t(`levelQuiz.q3Options.${row.q3_answer}`) : "—"}</td>
                <td className="px-4 py-3 text-[#555] text-xs whitespace-nowrap">{fmtDate(row.completed_at, locale)}</td>
              </tr>
            ))}
            {!data?.results.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#555]">{t("levelQuizAdmin.noResults")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
