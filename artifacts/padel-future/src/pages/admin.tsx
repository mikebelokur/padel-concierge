import { useEffect, useState } from "react";
import { getAdmin } from "@/lib/api";

interface Row {
  id: number;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  real_level: string | null;
  quiz_level: string | null;
  personality_type: string | null;
  quiz_completed_at: string | null;
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Admin() {
  const [data, setData] = useState<{ users: Row[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdmin()
      .then(setData)
      .catch(() => setError("Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#555]">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Padel Future — Admin</h1>
            <p className="text-[#8a8a8a] text-sm mt-1">
              Всего игроков: <span className="text-white font-semibold">{data?.total ?? 0}</span>
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="h-9 px-4 bg-[#161616] border border-[#2a2a2a] text-[#8a8a8a] text-sm rounded-lg hover:border-[#0A84FF]/40 hover:text-white transition-colors"
          >
            Обновить
          </button>
        </div>

        {/* Mobile cards */}
        <div className="block md:hidden space-y-3">
          {data?.users.map((row) => (
            <div key={row.id} className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-white">{row.name}</span>
                {row.real_level ? (
                  <span className="text-xs bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/25 px-2 py-0.5 rounded font-bold">
                    {row.real_level}
                  </span>
                ) : (
                  <span className="text-xs text-[#555]">—</span>
                )}
              </div>
              <div className="space-y-1 text-sm text-[#8a8a8a]">
                <div>{row.email}</div>
                {row.phone && <div>{row.phone}</div>}
                <div className="flex gap-4 pt-1">
                  <span>Квиз: {row.quiz_level ?? "—"}</span>
                  <span>Рег: {fmt(row.created_at)}</span>
                </div>
                {row.personality_type && (
                  <div className="text-[#555] text-xs truncate">{row.personality_type}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-[#161616] border border-[#2a2a2a] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {["Имя", "Рабочий уровень", "Квиз уровень", "Профиль", "Телефон", "Дата"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#555] uppercase tracking-widest">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.users.map((row, i) => (
                <tr
                  key={row.id}
                  className={`border-b border-[#2a2a2a]/60 hover:bg-white/[0.02] transition-colors ${
                    i === (data.users.length - 1) ? "border-b-0" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{row.name}</div>
                    <div className="text-[#555] text-xs">{row.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {row.real_level ? (
                      <span className="inline-block text-xs bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/25 px-2 py-0.5 rounded font-bold">
                        {row.real_level}
                      </span>
                    ) : (
                      <span className="text-[#555]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#8a8a8a]">{row.quiz_level ?? "—"}</td>
                  <td className="px-4 py-3 text-[#8a8a8a] max-w-[160px] truncate">{row.personality_type ?? "—"}</td>
                  <td className="px-4 py-3 text-[#8a8a8a]">{row.phone || "—"}</td>
                  <td className="px-4 py-3 text-[#8a8a8a]">{fmt(row.created_at)}</td>
                </tr>
              ))}
              {!data?.users.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#555]">Нет данных</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
