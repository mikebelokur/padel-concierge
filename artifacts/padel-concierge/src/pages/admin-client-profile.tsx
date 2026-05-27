import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api";
import { FoundingMemberPill, FoundingMemberRibbon, isFoundingMember, foundingAvatarStyle } from "@/components/FoundingMemberBadge";

type Profile = {
  hero: {
    id: number; name: string; email: string; phone: string; avatar: string | null;
    memberNumber: number; badge: string | null; level: string; archetype: string | null;
    source: string; isOnline: boolean; lastActive: string | null; role: string; inviteStatus: string;
    coachingClientId: number | null;
  };
  stats: { totalSessions: number; trainingsAttended: number; revenueAed: number; lastSeen: string | null };
  timeline: Array<{ id: string; type: string; at: string; title: string; detail?: string }>;
  skills: { history: Array<{ at: string; level: string }>; currentArchetype: string | null };
  package: { type: string; total: number; used: number } | null;
  notes: { text: string; tags: string[] };
};

const TYPE_ICONS: Record<string, string> = {
  session: "🎾",
  training: "👥",
  post_match_note: "📝",
  message: "💬",
  assessment: "📊",
  notification: "🔔",
};

function relTime(iso: string | null, lang: string): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return lang === "ru" ? "только что" : "just now";
  if (min < 60) return lang === "ru" ? `${min} мин назад` : `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return lang === "ru" ? `${h} ч назад` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return lang === "ru" ? `${d} дн назад` : `${d}d ago`;
}

export default function AdminClientProfile() {
  const params = useParams<{ userId: string }>();
  const userId = parseInt(params.userId ?? "0", 10);
  const { i18n } = useTranslation();
  const lang = i18n.language === "ru" ? "ru" : "en";
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<Profile>({
    queryKey: ["admin-client-profile", userId],
    queryFn: () => apiFetch(`/admin/users/${userId}/profile`),
    enabled: userId > 0,
  });

  const [notesDraft, setNotesDraft] = useState("");
  useEffect(() => { if (data?.notes.text !== undefined) setNotesDraft(data.notes.text); }, [data?.notes.text]);

  const saveNotes = useMutation({
    mutationFn: (notes: string) =>
      apiFetch(`/admin/users/${userId}/notes`, { method: "PATCH", body: JSON.stringify({ notes }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-client-profile", userId] }),
  });

  if (isLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading…</div></AppLayout>;
  if (error || !data) return <AppLayout><div className="p-6 text-center text-red-400">{lang === "ru" ? "Игрок не найден" : "Player not found"}</div></AppLayout>;

  const { hero, stats, timeline, skills, package: pkg, notes } = data;
  const isFounder = isFoundingMember(hero.memberNumber, hero.badge);
  const initials = hero.name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <AppLayout>
      <div className="p-4 max-w-3xl mx-auto space-y-4 pb-24">
        {/* HERO */}
        <div
          className="rounded-3xl p-5"
          style={{
            background: isFounder ? "linear-gradient(180deg, rgba(212,175,55,0.06), rgba(255,255,255,0.02))" : "rgba(255,255,255,0.03)",
            border: isFounder ? "1px solid rgba(212,175,55,0.45)" : "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {isFounder && <div className="mb-3"><FoundingMemberRibbon /></div>}
          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-serif flex-shrink-0"
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.85)",
                ...(foundingAvatarStyle(hero.memberNumber, hero.badge) ?? {}),
              }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-serif text-white">{hero.name}</h1>
                <FoundingMemberPill memberNumber={hero.memberNumber} badge={hero.badge} size="md" />
                {hero.isOnline && <span className="w-2 h-2 rounded-full bg-emerald-400" title="online" />}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                <span>{hero.email}</span>
                <span>·</span>
                <span className="font-mono">{hero.level}</span>
                {hero.archetype && <><span>·</span><span>{hero.archetype}</span></>}
                <span>·</span>
                <span>{hero.source === "coach_added" ? (lang === "ru" ? "добавлен тренером" : "coach added") : (lang === "ru" ? "сам зарегистрировался" : "self signup")}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <Link href={`/messages?userId=${hero.id}`}><a className="text-center rounded-xl py-2 text-xs" style={{ background: "rgba(255,255,255,0.05)", color: "#D4AF37" }}>{lang === "ru" ? "Сообщение" : "Message"}</a></Link>
            {hero.coachingClientId ? (
              <Link href={`/clients/${hero.coachingClientId}`}><a className="text-center rounded-xl py-2 text-xs" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.8)" }}>{lang === "ru" ? "Карточка клиента" : "Client card"}</a></Link>
            ) : (
              <span className="text-center rounded-xl py-2 text-xs opacity-40" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)" }}>{lang === "ru" ? "Не клиент" : "Not a client"}</span>
            )}
            <button className="text-center rounded-xl py-2 text-xs" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.8)" }}>{lang === "ru" ? "Тренировка" : "Mark training"}</button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label={lang === "ru" ? "Сессии" : "Sessions"} value={String(stats.totalSessions)} />
          <Stat label={lang === "ru" ? "Группы" : "Trainings"} value={String(stats.trainingsAttended)} />
          <Stat label={lang === "ru" ? "Доход (AED)" : "Revenue (AED)"} value={String(stats.revenueAed)} />
          <Stat label={lang === "ru" ? "Был" : "Last seen"} value={relTime(stats.lastSeen, lang)} />
        </div>

        {/* PACKAGE */}
        {pkg && (
          <Section title={lang === "ru" ? "Пакет занятий" : "Sessions package"}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">{pkg.type}</span>
              <span className="font-mono text-sm" style={{ color: "#D4AF37" }}>{pkg.used}/{pkg.total}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full" style={{ width: `${pkg.total ? Math.min(100, (pkg.used / pkg.total) * 100) : 0}%`, background: "#D4AF37" }} />
            </div>
          </Section>
        )}

        {/* SKILLS */}
        <Section title={lang === "ru" ? "Прогресс уровня" : "Skill progression"}>
          {skills.history.length === 0 ? (
            <div className="text-xs text-muted-foreground">{lang === "ru" ? "Нет данных об уровне" : "No level history"}</div>
          ) : (
            <div className="flex items-end gap-2 h-16">
              {skills.history.map((p, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{p.level}</span>
                  <div className="w-full" style={{ height: 24 + i * 4, background: "rgba(212,175,55,0.4)", borderRadius: 4 }} />
                </div>
              ))}
            </div>
          )}
          {skills.currentArchetype && <div className="mt-3 text-xs text-muted-foreground">{lang === "ru" ? "Архетип:" : "Archetype:"} <span className="text-white">{skills.currentArchetype}</span></div>}
        </Section>

        {/* TIMELINE */}
        <Section title={lang === "ru" ? "История" : "Timeline"}>
          {timeline.length === 0 ? (
            <div className="text-xs text-muted-foreground">{lang === "ru" ? "Пока нет событий" : "No events yet"}</div>
          ) : (
            <ul className="space-y-2">
              {timeline.map(item => (
                <li key={item.id} className="flex items-start gap-3 rounded-xl p-2" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <span className="text-base flex-shrink-0">{TYPE_ICONS[item.type] ?? "•"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{item.title}</div>
                    {item.detail && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.detail}</div>}
                    <div className="text-[10px] text-muted-foreground/60 mt-0.5">{new Date(item.at).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB", { timeZone: "Asia/Dubai" })}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* NOTES */}
        <Section title={lang === "ru" ? "Заметки тренера" : "Coach notes"}>
          <textarea
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            rows={4}
            className="w-full rounded-xl p-3 text-sm bg-transparent border focus:outline-none"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "white" }}
            placeholder={lang === "ru" ? "Заметки о игроке…" : "Notes about the player…"}
          />
          {notes.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {notes.tags.map(tag => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }}>{tag}</span>
              ))}
            </div>
          )}
          <button
            disabled={saveNotes.isPending || notesDraft === notes.text}
            onClick={() => saveNotes.mutate(notesDraft)}
            className="mt-2 rounded-xl px-4 py-2 text-xs disabled:opacity-40"
            style={{ background: "#D4AF37", color: "#0a0a0a" }}
          >
            {saveNotes.isPending ? "…" : lang === "ru" ? "Сохранить" : "Save"}
          </button>
        </Section>
      </div>
    </AppLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-serif text-white mt-0.5">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{title}</h2>
      {children}
    </div>
  );
}
