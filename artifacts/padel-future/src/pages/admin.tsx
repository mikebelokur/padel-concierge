import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import AdminGuard from "@/components/AdminGuard";
import { getAdminUsers, getAdminCsvUrl, type AdminUser, type OnboardingStatus } from "@/lib/api";

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STATUS_LABELS: Record<OnboardingStatus, string> = {
  pending: "Ожидает",
  approved: "Одобрен",
  verified: "Верифицирован",
};

const STATUS_COLORS: Record<OnboardingStatus, string> = {
  pending: "text-[#FFB84D] bg-[#FFB84D]/10 border-[#FFB84D]/25",
  approved: "text-[#0A84FF] bg-[#0A84FF]/10 border-[#0A84FF]/25",
  verified: "text-[#30D158] bg-[#30D158]/10 border-[#30D158]/25",
};

function StatusBadge({ status }: { status: OnboardingStatus }) {
  return (
    <span className={`inline-flex items-center text-xs border px-2 py-0.5 rounded font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function LevelBadge({ levelSelf }: { levelSelf: number | null }) {
  if (levelSelf === null) return <span className="text-[#555]">—</span>;
  return (
    <span className="inline-block text-xs bg-[#0A84FF]/15 text-[#0A84FF] border border-[#0A84FF]/25 px-2 py-0.5 rounded font-bold tabular-nums">
      {levelSelf}
    </span>
  );
}

function getMyRole(): string {
  const token = localStorage.getItem("token");
  if (!token) return "player";
  try {
    const payload = JSON.parse(atob(token.replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role ?? "player";
  } catch {
    return "player";
  }
}

function AdminContent() {
  const [, setLocation] = useLocation();
  const role = getMyRole();
  const isCoach = role === "coach";
  const [data, setData] = useState<{ users: AdminUser[]; total: number; page: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (s: string, st: string, p: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminUsers({ search: s, status: st, page: p, limit: 20 });
      setData(res);
    } catch {
      setError("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(search, status, page);
  }, [status, page, load]);

  function handleSearchChange(v: string) {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load(v, status, 1);
    }, 300);
  }

  function handleStatusChange(v: string) {
    setStatus(v);
    setPage(1);
  }

  function handleExport() {
    const token = localStorage.getItem("token") ?? "";
    const url = getAdminCsvUrl();
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const burl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = burl;
        a.download = "pf-users.csv";
        a.click();
        URL.revokeObjectURL(burl);
      });
  }

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">Padel Future — Пользователи</h1>
            {data && (
              <p className="text-[#8a8a8a] text-sm mt-1">
                Всего: <span className="text-white font-semibold">{data.total}</span>
              </p>
            )}
          </div>
          <button
            onClick={handleExport}
            className="h-9 px-4 bg-[#0A84FF]/10 border border-[#0A84FF]/30 text-[#0A84FF] text-sm rounded-lg hover:bg-[#0A84FF]/20 transition-colors whitespace-nowrap"
          >
            Экспорт CSV
          </button>
        </div>

        <div className="flex gap-3 mb-5 flex-wrap">
          <input
            type="search"
            placeholder="Поиск по имени или email..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1 min-w-[200px] h-10 px-4 bg-[#161616] border border-[#2a2a2a] rounded-xl text-white placeholder-[#555] text-sm focus:outline-none focus:border-[#0A84FF] transition-colors"
          />
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="h-10 px-3 bg-[#161616] border border-[#2a2a2a] rounded-xl text-sm text-[#8a8a8a] focus:outline-none focus:border-[#0A84FF] transition-colors"
          >
            <option value="">Все статусы</option>
            <option value="pending">Ожидает</option>
            <option value="approved">Одобрен</option>
            <option value="verified">Верифицирован</option>
          </select>
        </div>

        {error && (
          <div className="text-red-400 text-sm text-center py-8">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-[#555] text-sm">Загрузка...</div>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="block md:hidden space-y-3">
              {data?.users.map((row) => (
                <div key={row.id} className="bg-[#161616] border border-[#2a2a2a] rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div>
                      <div className="font-semibold text-white">{row.name}</div>
                      {row.email && <div className="text-[#555] text-xs mt-0.5">{row.email}</div>}
                    </div>
                    <StatusBadge status={row.onboardingStatus} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#8a8a8a] mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[#555]">Уровень:</span>
                      <LevelBadge levelSelf={row.levelSelf} />
                    </div>
                    <span>{fmt(row.created_at)}</span>
                  </div>
                  <button
                    onClick={() => setLocation(`/admin/users/${row.id}`)}
                    className="mt-3 w-full h-8 text-xs bg-[#161616] border border-[#2a2a2a] text-[#8a8a8a] rounded-lg hover:border-[#0A84FF]/40 hover:text-white transition-colors"
                  >
                    Подробнее →
                  </button>
                </div>
              ))}
              {!data?.users.length && !loading && (
                <div className="text-center text-[#555] py-12 text-sm">Нет пользователей</div>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-[#161616] border border-[#2a2a2a] rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    {["Имя", ...(!isCoach ? ["Email"] : []), "Город", "Дата регистрации", "Уровень (0–100)", "Статус", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#555] uppercase tracking-widest whitespace-nowrap">
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
                      </td>
                      {!isCoach && (
                        <td className="px-4 py-3 text-[#8a8a8a] max-w-[180px] truncate">
                          {row.email ?? <span className="text-[#555]">—</span>}
                        </td>
                      )}
                      <td className="px-4 py-3 text-[#8a8a8a]">
                        {row.location_name ?? <span className="text-[#555]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[#8a8a8a] whitespace-nowrap">{fmt(row.created_at)}</td>
                      <td className="px-4 py-3">
                        <LevelBadge levelSelf={row.levelSelf} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.onboardingStatus} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setLocation(`/admin/users/${row.id}`)}
                          className="text-xs text-[#0A84FF] hover:text-[#0A84FF]/70 transition-colors whitespace-nowrap"
                        >
                          Подробнее →
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!data?.users.length && (
                    <tr>
                      <td colSpan={isCoach ? 6 : 7} className="px-4 py-12 text-center text-[#555]">
                        Нет пользователей
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-9 px-4 bg-[#161616] border border-[#2a2a2a] text-[#8a8a8a] text-sm rounded-lg disabled:opacity-40 hover:border-[#0A84FF]/40 hover:text-white transition-colors"
                >
                  ← Назад
                </button>
                <span className="text-[#555] text-sm">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-9 px-4 bg-[#161616] border border-[#2a2a2a] text-[#8a8a8a] text-sm rounded-lg disabled:opacity-40 hover:border-[#0A84FF]/40 hover:text-white transition-colors"
                >
                  Далее →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  return (
    <AdminGuard>
      <AdminContent />
    </AdminGuard>
  );
}
