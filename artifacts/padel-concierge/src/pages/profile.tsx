import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGetPlayerStats, getGetPlayerStatsQueryKey } from "@workspace/api-client-react";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "wouter";
import { ARCHETYPE_META, archetypeCompatibility, type Archetype } from "@/lib/archetypes";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  reliabilityColor,
  reliabilityBarColor,
  reliabilityLabel,
  reliabilityDotClass,
  CompatBadge,
} from "@/components/ReliabilityBadge";

const CHART_COLORS = ["#D4AF37", "#64b4ff", "#6b7a99"];

interface PlayerProfile {
  userId: number;
  reliabilityScore: number;
  noShowCount: number;
  sessionStreak: number;
  behavioralFlags: string[];
  source: string;
}

interface TopMatch {
  id: number;
  name: string;
  level: string;
  archetype: string | null;
  verified: boolean;
  compatibilityScore: number;
  archetypeMatch: boolean;
}

interface FindMatchesResponse {
  matches: TopMatch[];
  noMatchesMessage: string | null;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="uppercase font-semibold mb-3"
      style={{ fontSize: "11px", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}
    >
      {children}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="rounded-[20px]"
      style={{
        background: "hsl(220 20% 6%)",
        border: "1px solid rgba(255,255,255,0.07)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  last,
  accent,
}: {
  icon?: string;
  label: string;
  value?: React.ReactNode;
  last?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between px-5"
      style={{
        minHeight: "52px",
        borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-3">
        {icon && <span style={{ fontSize: "17px" }}>{icon}</span>}
        <span style={{ fontSize: "15px", color: accent ? "#D4AF37" : "rgba(255,255,255,0.85)" }}>{label}</span>
      </div>
      {value !== undefined && (
        <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)" }}>{value}</span>
      )}
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data: stats, isLoading } = useGetPlayerStats(user?.id || 0, {
    query: { enabled: !!user?.id, queryKey: getGetPlayerStatsQueryKey(user?.id || 0) },
  });

  const { data: reliability, isLoading: reliabilityLoading } = useQuery({
    queryKey: ["player-profile", user?.id],
    queryFn: () => apiFetch<PlayerProfile>(`/players/${user!.id}/profile`),
    enabled: !!user?.id,
    retry: false,
  });

  const { data: topMatches, isLoading: matchesLoading } = useQuery({
    queryKey: ["find-matches", user?.id],
    queryFn: () => apiFetch<FindMatchesResponse>(`/users/find-matches?userId=${user!.id}`),
    enabled: !!user?.id,
    retry: false,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-6 space-y-4" style={{ paddingTop: "28px" }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-[20px] animate-pulse" style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.06)", minHeight: "96px" }} />
          ))}
        </div>
      </AppLayout>
    );
  }

  const archetype = user?.archetype as Archetype | undefined;
  const archetypeMeta = archetype ? ARCHETYPE_META[archetype] : null;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 animate-fade-up" style={{ paddingTop: "28px", paddingBottom: "40px" }}>

        {/* ── AVATAR + NAME ── */}
        <header className="mb-8">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div
              className="flex items-center justify-center flex-shrink-0 font-serif"
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "rgba(212,175,55,0.18)",
                border: "1.5px solid rgba(212,175,55,0.3)",
                color: "#D4AF37",
                fontSize: "28px",
              }}
            >
              {user?.name?.[0]}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="font-serif font-bold text-white truncate" style={{ fontSize: "24px" }}>
                {user?.name}
              </h1>

              {/* Badges row */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {/* Level */}
                <span
                  className="rounded-full px-2.5 py-0.5 font-mono font-semibold"
                  style={{ fontSize: "12px", background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.3)", color: "#D4AF37" }}
                >
                  {user?.level}
                </span>

                {/* Verified */}
                {user?.verified && (
                  <span
                    className="rounded-full px-2.5 py-0.5"
                    style={{ fontSize: "12px", background: "rgba(100,180,255,0.12)", border: "1px solid rgba(100,180,255,0.25)", color: "#64b4ff" }}
                  >
                    ✓ {t("common.certified")}
                  </span>
                )}

                {/* Archetype */}
                {archetypeMeta && (
                  <span
                    className={cn("rounded-full px-2.5 py-0.5", archetypeMeta.color, archetypeMeta.bg, archetypeMeta.border)}
                    style={{ fontSize: "12px" }}
                  >
                    {archetypeMeta.icon} {archetypeMeta.nameRu}
                  </span>
                )}

                {/* Warm-up */}
                {user?.warmUpPreference && (
                  <span
                    className="rounded-full px-2.5 py-0.5"
                    style={{ fontSize: "12px", background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.25)", color: "#fb923c" }}
                  >
                    {t("profile.warmupBadge")}
                  </span>
                )}
              </div>

              {/* Reliability inline */}
              {reliability && !reliabilityLoading && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", reliabilityDotClass(reliability.reliabilityScore))} />
                  <span className={cn("font-semibold tabular-nums", reliabilityColor(reliability.reliabilityScore))} style={{ fontSize: "13px" }}>
                    {reliability.reliabilityScore} · {reliabilityLabel(reliability.reliabilityScore)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Take quiz CTA */}
          {!archetype && (
            <Link href="/quiz">
              <div
                className="rounded-[20px] p-4 mt-4 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98]"
                style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)" }}
              >
                <div>
                  <div style={{ fontSize: "15px", color: "#D4AF37", fontWeight: 600 }}>{t("profile.takeArchetypeQuiz")}</div>
                  <div className="text-muted-foreground" style={{ fontSize: "12px" }}>Unlock archetype & smart matchmaking</div>
                </div>
                <span style={{ color: "#D4AF37", fontSize: "20px" }}>›</span>
              </div>
            </Link>
          )}
        </header>

        {/* ── LEVEL PROGRESSION ── */}
        <section className="mb-4">
          <SectionLabel>{t("profile.levelProgression")}</SectionLabel>
          <Card>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium" style={{ fontSize: "15px" }}>
                  {t("profile.currentLevel")} {user?.level}
                </span>
                <span className="text-muted-foreground" style={{ fontSize: "13px" }}>
                  {stats?.winsToNextLevel} {t("profile.winsToNext")}
                </span>
              </div>

              {/* Custom progress bar */}
              <div className="w-full rounded-full overflow-hidden" style={{ height: "6px", background: "rgba(255,255,255,0.08)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${stats?.levelProgress ?? 0}%`, background: "#D4AF37" }}
                />
              </div>

              <div className="flex justify-between" style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                {["D-", "D", "D+", "C-", "C", "C+"].map(l => <span key={l}>{l}</span>)}
              </div>
            </div>

            {/* Level confidence */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between px-5" style={{ minHeight: "60px" }}>
                <span className="text-muted-foreground" style={{ fontSize: "13px" }}>{t("profile.levelConfidence")}</span>
                <span className="font-mono font-bold" style={{ fontSize: "24px", color: "#64b4ff" }}>
                  {stats?.levelConfidence ?? 0}%
                </span>
              </div>
            </div>
          </Card>
        </section>

        {/* ── PLAY STYLE ── */}
        {(user?.levelSelf != null || user?.levelQuiz || user?.physicalSelf != null || user?.warmupFormat) && (
          <section className="mb-4">
            <SectionLabel>{t("profile.playStyle")}</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              {user?.levelSelf != null && (
                <div
                  className="rounded-[16px] p-4 text-center"
                  style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div className="text-muted-foreground mb-1" style={{ fontSize: "11px" }}>{t("profile.selfAssessed")}</div>
                  <div className="font-mono font-bold" style={{ fontSize: "28px", color: "#D4AF37" }}>{user.levelSelf}</div>
                  <div className="text-muted-foreground" style={{ fontSize: "11px" }}>/ 5.0</div>
                </div>
              )}
              {user?.levelQuiz && (
                <div
                  className="rounded-[16px] p-4 text-center"
                  style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(100,180,255,0.15)" }}
                >
                  <div className="text-muted-foreground mb-1" style={{ fontSize: "11px" }}>{t("profile.quizLevel")}</div>
                  <div className="font-mono font-bold" style={{ fontSize: "28px", color: "#64b4ff" }}>{user.levelQuiz}</div>
                  <div className="text-muted-foreground" style={{ fontSize: "11px" }}>{t("profile.certified")}</div>
                </div>
              )}
              {user?.physicalSelf != null && (
                <div
                  className="rounded-[16px] p-4 text-center"
                  style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div className="text-muted-foreground mb-1" style={{ fontSize: "11px" }}>{t("profile.physical")}</div>
                  <div className="font-mono font-bold text-white" style={{ fontSize: "28px" }}>{user.physicalSelf}</div>
                  <div className="text-muted-foreground" style={{ fontSize: "11px" }}>/ 10</div>
                </div>
              )}
              {user?.warmupFormat && (
                <div
                  className="rounded-[16px] p-4 text-center"
                  style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div className="text-muted-foreground mb-1" style={{ fontSize: "11px" }}>{t("profile.warmup")}</div>
                  <div className="text-white font-medium capitalize" style={{ fontSize: "16px", marginTop: "6px" }}>{user.warmupFormat}</div>
                  <div className="text-muted-foreground" style={{ fontSize: "11px" }}>{t("profile.format")}</div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── RELIABILITY ── */}
        <section className="mb-4">
          <SectionLabel>{t("profile.reliability")}</SectionLabel>
          <Card>
            {reliabilityLoading ? (
              <div className="p-5 animate-pulse text-muted-foreground" style={{ fontSize: "14px" }}>{t("common.loading")}</div>
            ) : !reliability ? (
              <div className="p-5 text-muted-foreground italic" style={{ fontSize: "14px" }}>{t("profile.behavioralUnavailable")}</div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Score bar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground" style={{ fontSize: "13px" }}>{t("profile.reliabilityScore")}</span>
                    <span className={cn("font-semibold tabular-nums", reliabilityColor(reliability.reliabilityScore))} style={{ fontSize: "14px" }}>
                      {reliability.reliabilityScore}/100 · {reliabilityLabel(reliability.reliabilityScore)}
                    </span>
                  </div>
                  <div className="w-full rounded-full overflow-hidden" style={{ height: "6px", background: "rgba(255,255,255,0.08)" }}>
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", reliabilityBarColor(reliability.reliabilityScore))}
                      style={{ width: `${Math.max(0, Math.min(100, reliability.reliabilityScore))}%` }}
                    />
                  </div>
                </div>

                {/* Stat cells */}
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="rounded-[14px] p-4 text-center"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="text-muted-foreground mb-1" style={{ fontSize: "11px" }}>{t("profile.noShows")}</div>
                    <div
                      className={cn("font-bold tabular-nums", reliability.noShowCount > 0 ? "text-red-400" : "text-emerald-400")}
                      style={{ fontSize: "28px" }}
                    >
                      {reliability.noShowCount}
                    </div>
                    <div className="text-muted-foreground" style={{ fontSize: "11px" }}>{t("profile.totalMissed")}</div>
                  </div>
                  <div
                    className="rounded-[14px] p-4 text-center"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="text-muted-foreground mb-1" style={{ fontSize: "11px" }}>{t("profile.sessionStreak")}</div>
                    <div
                      className={cn("font-bold tabular-nums", reliability.sessionStreak >= 3 ? "text-emerald-400" : "text-white")}
                      style={{ fontSize: "28px" }}
                    >
                      {reliability.sessionStreak}
                      {reliability.sessionStreak >= 3 && <span style={{ fontSize: "18px", marginLeft: "4px" }}>🔥</span>}
                    </div>
                    <div className="text-muted-foreground" style={{ fontSize: "11px" }}>{t("profile.consecutive")}</div>
                  </div>
                </div>

                {/* Flags */}
                {reliability.behavioralFlags.length > 0 && (
                  <div>
                    <div className="text-muted-foreground mb-2" style={{ fontSize: "12px" }}>{t("profile.flags")}</div>
                    <div className="flex flex-wrap gap-2">
                      {reliability.behavioralFlags.map(flag => (
                        <span
                          key={flag}
                          className="rounded-full px-2.5 py-0.5"
                          style={{ fontSize: "12px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#fbbf24" }}
                        >
                          ⚑ {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </section>

        {/* ── TOP COMPATIBILITY ── */}
        <section className="mb-4">
          <SectionLabel>{t("profile.topCompatibility")}</SectionLabel>
          <Card>
            {!archetype ? (
              <div className="p-5">
                <p className="text-muted-foreground mb-4" style={{ fontSize: "14px" }}>{t("profile.takeQuizUnlock")}</p>
                <Link href="/quiz">
                  <button
                    className="rounded-full font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ height: "44px", padding: "0 20px", fontSize: "14px", background: "#D4AF37", color: "#000" }}
                  >
                    {t("profile.takeQuiz")}
                  </button>
                </Link>
              </div>
            ) : matchesLoading ? (
              <div className="p-5 animate-pulse text-muted-foreground" style={{ fontSize: "14px" }}>{t("common.loading")}</div>
            ) : !topMatches?.matches?.length ? (
              <div className="p-5 text-muted-foreground italic" style={{ fontSize: "14px" }}>
                {topMatches?.noMatchesMessage ?? t("profile.noCompatible")}
              </div>
            ) : (
              <div>
                {topMatches.matches.map((match, i) => {
                  const compatNote = archetype && match.archetype
                    ? archetypeCompatibility(archetype, match.archetype as Archetype)
                    : null;
                  const isLast = i === topMatches.matches.length - 1;
                  return (
                    <div
                      key={match.id}
                      className="flex items-start gap-3 px-5 py-4"
                      style={{
                        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)",
                        background: match.archetypeMatch ? "rgba(212,175,55,0.04)" : "transparent",
                      }}
                    >
                      <div
                        className="flex items-center justify-center flex-shrink-0 font-serif"
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          background: match.archetypeMatch ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.08)",
                          color: match.archetypeMatch ? "#D4AF37" : "rgba(255,255,255,0.7)",
                          fontSize: "16px",
                        }}
                      >
                        {match.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-white font-medium" style={{ fontSize: "15px" }}>{match.name}</span>
                          {match.verified && <span style={{ fontSize: "12px", color: "#64b4ff" }}>✓</span>}
                          {match.archetypeMatch && (
                            <span
                              className="rounded-full px-2 py-0.5"
                              style={{ fontSize: "11px", background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.25)", color: "#D4AF37" }}
                            >
                              {t("profile.archetypeMatch")}
                            </span>
                          )}
                          <CompatBadge pct={match.compatibilityScore} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-muted-foreground" style={{ fontSize: "12px" }}>{match.level}</span>
                          {match.archetype && (() => {
                            const meta = ARCHETYPE_META[match.archetype as Archetype];
                            return meta ? (
                              <span
                                className={cn("rounded-full px-2 py-0.5 text-xs border", meta.color, meta.bg, meta.border)}
                                style={{ fontSize: "11px" }}
                              >
                                {meta.icon} {meta.nameRu}
                              </span>
                            ) : null;
                          })()}
                        </div>
                        {compatNote && (
                          <div className="text-muted-foreground/60 truncate mt-0.5" style={{ fontSize: "11px" }}>{compatNote}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </section>

        {/* ── CHARTS ── */}
        <section className="mb-4">
          <SectionLabel>{t("profile.winTrend")}</SectionLabel>
          <Card style={{ padding: "20px" }}>
            <div style={{ height: "200px" }}>
              {stats?.winTrend && stats.winTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.winTrend}>
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" fontSize={11} />
                    <YAxis stroke="rgba(255,255,255,0.2)" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(220 20% 8%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "12px" }} />
                    <Line type="monotone" dataKey="winRate" stroke="#D4AF37" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="text-3xl mb-3">📈</div>
                  <div className="text-white font-medium mb-1" style={{ fontSize: "17px" }}>
                    {t("profile.noWinTrendTitle")}
                  </div>
                  <div className="text-muted-foreground" style={{ fontSize: "14px" }}>
                    {t("profile.noWinTrendHint")}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>

        <section className="mb-4">
          <SectionLabel>{t("profile.formatBreakdown")}</SectionLabel>
          <Card style={{ padding: "20px" }}>
            <div style={{ height: "200px" }}>
              {stats?.formatBreakdown && stats.formatBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.formatBreakdown}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={75}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="format"
                    >
                      {stats.formatBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "hsl(220 20% 8%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="text-3xl mb-3">🥧</div>
                  <div className="text-white font-medium mb-1" style={{ fontSize: "17px" }}>
                    {t("profile.noFormatTitle")}
                  </div>
                  <div className="text-muted-foreground" style={{ fontSize: "14px" }}>
                    {t("profile.noFormatHint")}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>

        {/* ── SETTINGS ROW — account actions ── */}
        <section className="mb-4">
          <SectionLabel>Account</SectionLabel>
          <Card>
            <Link href="/quiz">
              <SettingsRow icon="🧠" label="Retake Archetype Quiz" last />
            </Link>
          </Card>
        </section>

      </div>
    </AppLayout>
  );
}
