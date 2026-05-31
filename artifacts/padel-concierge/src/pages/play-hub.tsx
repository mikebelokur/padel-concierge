import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  listMyPlayMatchInvites,
  respondPlayMatchInvite,
  KIND_META,
  type MatchKind,
  type PlayMatchInvite,
} from "@/lib/playMatches";
import { useToast } from "@/hooks/use-toast";
import { translateError } from "@/lib/errorMessages";

const KINDS: MatchKind[] = ["unranked", "competitive", "personal"];

export default function PlayHub() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [invites, setInvites] = useState<PlayMatchInvite[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function loadInvites() {
    try {
      setInvites(await listMyPlayMatchInvites());
    } catch {
      /* non-fatal */
    }
  }

  useEffect(() => {
    void loadInvites();
  }, []);

  async function respond(inv: PlayMatchInvite, accept: boolean) {
    if (busyId) return;
    setBusyId(inv.matchId);
    try {
      await respondPlayMatchInvite(inv.matchId, accept);
      await loadInvites();
      if (accept) navigate(`/play/match/${inv.matchId}`);
    } catch (e) {
      toast({ title: t("playFlow.error"), description: translateError(e).message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="font-serif text-2xl tracking-tight">{t("playFlow.hubTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("playFlow.hubSubtitle")}</p>
        </header>

        {/* Incoming invitations */}
        {invites.length > 0 && (
          <section className="mb-7">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              {t("playFlow.invitationsTitle")}
            </h2>
            <div className="space-y-3">
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  data-testid={`invite-${inv.matchId}`}
                  className="rounded-xl border border-primary/30 bg-card p-4"
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {inv.match.leaderName ?? "—"} · {t(`playFlow.kind.${inv.match.kind ?? "unranked"}.title`)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {inv.match.clubName} · {inv.match.date} {inv.match.time} ·{" "}
                        {inv.match.participantCount}/{inv.match.maxPlayers}
                      </div>
                    </div>
                    <span className="text-2xl">{KIND_META[inv.match.kind ?? "unranked"].icon}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      data-testid={`button-accept-${inv.matchId}`}
                      onClick={() => respond(inv, true)}
                      disabled={busyId === inv.matchId}
                      className="flex-1 rounded-lg bg-primary text-black font-semibold py-2.5 text-sm disabled:opacity-60"
                    >
                      {t("playFlow.accept")}
                    </button>
                    <button
                      data-testid={`button-decline-${inv.matchId}`}
                      onClick={() => respond(inv, false)}
                      disabled={busyId === inv.matchId}
                      className="flex-1 rounded-lg border border-white/15 text-white/70 font-medium py-2.5 text-sm disabled:opacity-60"
                    >
                      {t("playFlow.decline")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Match-type cards */}
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          {t("playFlow.createTitle")}
        </h2>
        <div className="grid grid-cols-1 gap-3">
          {KINDS.map((kind) => (
            <Link key={kind} href={`/play/create/${kind}`}>
              <div
                data-testid={`card-kind-${kind}`}
                className="cursor-pointer rounded-xl border border-white/10 bg-card hover:border-primary/40 hover:bg-white/5 transition-colors p-5 flex gap-4 items-start"
              >
                <span
                  className="text-3xl leading-none flex-shrink-0"
                  style={{ filter: `drop-shadow(0 0 10px ${KIND_META[kind].accent}55)` }}
                >
                  {KIND_META[kind].icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-base">{t(`playFlow.kind.${kind}.title`)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t(`playFlow.kind.${kind}.desc`)}</div>
                </div>
                <span className="text-white/30 text-xl">›</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Secondary destinations */}
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground mt-7 mb-3">
          {t("playFlow.browseTitle")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/play/open">
            <div
              data-testid="card-open-matches"
              className="cursor-pointer rounded-xl border border-white/10 bg-card hover:border-primary/40 hover:bg-white/5 transition-colors p-4 flex gap-3 items-start"
            >
              <span className="text-2xl leading-none">🌐</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{t("playFlow.openMatches")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("playFlow.openMatchesDesc")}</div>
              </div>
            </div>
          </Link>
          <Link href="/matches">
            <div
              data-testid="card-my-matches"
              className="cursor-pointer rounded-xl border border-white/10 bg-card hover:border-primary/40 hover:bg-white/5 transition-colors p-4 flex gap-3 items-start"
            >
              <span className="text-2xl leading-none">🎾</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{t("play.myMatches")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("play.myMatchesDesc")}</div>
              </div>
            </div>
          </Link>
          <Link href="/find-match">
            <div
              data-testid="card-find-match"
              className="cursor-pointer rounded-xl border border-white/10 bg-card hover:border-primary/40 hover:bg-white/5 transition-colors p-4 flex gap-3 items-start"
            >
              <span className="text-2xl leading-none">🎯</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{t("play.findMatch")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("play.findMatchDesc")}</div>
              </div>
            </div>
          </Link>
          <Link href="/match-requests">
            <div
              data-testid="card-requests"
              className="cursor-pointer rounded-xl border border-white/10 bg-card hover:border-primary/40 hover:bg-white/5 transition-colors p-4 flex gap-3 items-start"
            >
              <span className="text-2xl leading-none">📨</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{t("play.requests")}</div>
                <div className="text-xs text-muted-foreground mt-1">{t("play.requestsDesc")}</div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
