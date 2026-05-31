import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { translateError } from "@/lib/errorMessages";
import {
  listOpenPlayMatches,
  requestJoinPlayMatch,
  KIND_META,
  type PlayMatchSummary,
} from "@/lib/playMatches";

export default function PlayOpen() {
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [matches, setMatches] = useState<PlayMatchSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    try {
      setMatches(await listOpenPlayMatches());
      setError(null);
    } catch (e) {
      setError(translateError(e).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function request(id: number) {
    if (busyId) return;
    setBusyId(id);
    try {
      await requestJoinPlayMatch(id);
      setRequested((prev) => new Set(prev).add(id));
      toast({ title: t("playFlow.requestSent"), description: t("playFlow.requestSentDesc") });
    } catch (e) {
      toast({ title: t("playFlow.error"), description: translateError(e).message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto px-4 py-6">
        <button onClick={() => navigate("/play")} className="text-sm text-muted-foreground mb-4 hover:text-white">
          ‹ {t("playFlow.back")}
        </button>
        <header className="mb-6">
          <h1 className="font-serif text-2xl tracking-tight">{t("playFlow.openMatches")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("playFlow.openMatchesDesc")}</p>
        </header>

        {error && <div className="rounded-xl border border-red-500/30 p-4 text-sm text-muted-foreground">{error}</div>}

        {matches !== null && matches.length === 0 && !error && (
          <div className="rounded-xl border border-white/8 p-8 text-center">
            <div className="text-4xl mb-3">🌐</div>
            <div className="text-sm text-muted-foreground">{t("playFlow.noOpenMatches")}</div>
          </div>
        )}

        <div className="space-y-3">
          {(matches ?? []).map((m) => {
            const kind = m.kind ?? "unranked";
            const done = requested.has(m.id);
            return (
              <div key={m.id} data-testid={`open-match-${m.id}`} className="rounded-xl border border-white/10 bg-card p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {t(`playFlow.kind.${kind}.title`)} · {m.leaderName ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {m.clubName} · {m.date} {m.time}
                    </div>
                    {m.kind === "personal" && m.goal && (
                      <div className="text-xs text-white/60 mt-1">🎯 {m.goal}</div>
                    )}
                  </div>
                  <span className="text-2xl" style={{ filter: `drop-shadow(0 0 8px ${KIND_META[kind].accent}55)` }}>
                    {KIND_META[kind].icon}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono text-primary">
                    {m.participantCount}/{m.maxPlayers}
                  </span>
                  <button
                    data-testid={`button-request-${m.id}`}
                    onClick={() => request(m.id)}
                    disabled={busyId === m.id || done}
                    className="rounded-lg bg-primary text-black font-semibold px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {done ? t("playFlow.requested") : busyId === m.id ? "…" : t("playFlow.requestJoin")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
