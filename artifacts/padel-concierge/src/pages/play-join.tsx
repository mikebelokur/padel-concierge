import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { translateError } from "@/lib/errorMessages";
import {
  getPlayMatchByToken,
  joinPlayMatchByToken,
  KIND_META,
  type PlayMatchSummary,
} from "@/lib/playMatches";

export default function PlayJoin() {
  const [, params] = useRoute("/join/:token");
  const [, navigate] = useLocation();
  const { user, isLoading } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const token = params?.token ?? "";
  const [summary, setSummary] = useState<PlayMatchSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) return;
    getPlayMatchByToken(token)
      .then(setSummary)
      .catch((e) => setError(translateError(e).message));
  }, [token]);

  // Redirect unauthenticated users to login, preserving the join target.
  useEffect(() => {
    if (!isLoading && !user) {
      const next = encodeURIComponent(`/join/${token}`);
      navigate(`/login?next=${next}`);
    }
  }, [isLoading, user, token, navigate]);

  async function join() {
    if (joining) return;
    setJoining(true);
    try {
      const result = await joinPlayMatchByToken(token);
      if ("pending" in result) {
        toast({ title: t("playFlow.requestSent"), description: t("playFlow.requestSentDesc") });
        navigate("/play/open");
        return;
      }
      toast({ title: t("playFlow.joined"), description: t("playFlow.joinedDesc") });
      navigate(`/play/match/${result.id}`);
    } catch (e) {
      toast({ title: t("playFlow.error"), description: translateError(e).message, variant: "destructive" });
      setJoining(false);
    }
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto px-4 py-12 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <div className="text-muted-foreground mb-5">{error}</div>
          <button onClick={() => navigate("/play")} className="rounded-lg border border-white/15 px-5 py-2.5 text-sm">
            {t("playFlow.back")}
          </button>
        </div>
      </AppLayout>
    );
  }

  if (!summary) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto px-4 py-12 text-center text-muted-foreground">{t("playFlow.loading")}</div>
      </AppLayout>
    );
  }

  const kind = summary.kind ?? "unranked";
  const full = summary.spotsLeft <= 0;
  const isOpen = summary.visibility === "open";

  return (
    <AppLayout>
      <div className="max-w-md mx-auto px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-card p-6 text-center">
          <span
            className="text-5xl inline-block mb-3"
            style={{ filter: `drop-shadow(0 0 12px ${KIND_META[kind].accent}66)` }}
          >
            {KIND_META[kind].icon}
          </span>
          <h1 className="font-serif text-2xl tracking-tight mb-1">{t("playFlow.youreInvited")}</h1>
          <p className="text-sm text-muted-foreground mb-4">
            {summary.leaderName ?? "—"} · {t(`playFlow.kind.${kind}.title`)}
          </p>

          <div className="rounded-xl bg-white/5 p-4 text-left text-sm space-y-1.5 mb-5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("playFlow.club")}</span>
              <span>{summary.clubName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("playFlow.date")}</span>
              <span>
                {summary.date} {summary.time}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("playFlow.roster")}</span>
              <span className="font-mono text-primary">
                {summary.participantCount}/{summary.maxPlayers}
              </span>
            </div>
            {kind === "personal" && summary.goal && (
              <div className="pt-1.5 border-t border-white/8">
                <span className="text-muted-foreground">🎯 {summary.goal}</span>
              </div>
            )}
          </div>

          <button
            data-testid="button-join"
            onClick={join}
            disabled={joining || full}
            className="w-full rounded-xl bg-primary text-black font-semibold h-13 py-3.5 disabled:opacity-50"
          >
            {full
              ? t("playFlow.matchFull")
              : joining
                ? t("playFlow.joining")
                : isOpen
                  ? t("playFlow.requestToJoin")
                  : t("playFlow.joinMatch")}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
