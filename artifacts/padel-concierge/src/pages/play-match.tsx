import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { translateError } from "@/lib/errorMessages";
import {
  getPlayMatchRoom,
  invitePlayMatchFriends,
  respondPlayMatchJoinRequest,
  cancelPlayMatch,
  removePlayMatchParticipant,
  KIND_META,
  type PlayMatchRoom,
} from "@/lib/playMatches";

interface SimpleUser {
  id: number;
  name: string;
  level: string | null;
  favouritePlayers: number[];
}

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function PlayMatch() {
  const [, params] = useRoute("/play/match/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const matchId = Number(params?.id);
  const [room, setRoom] = useState<PlayMatchRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [friends, setFriends] = useState<SimpleUser[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    { type: "cancel" } | { type: "remove"; userId: number; name: string } | null
  >(null);

  async function load() {
    try {
      setRoom(await getPlayMatchRoom(matchId));
      setError(null);
    } catch (e) {
      setError(translateError(e).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (Number.isFinite(matchId)) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const isLeader = room?.myRole === "leader";

  const inviteLink = useMemo(() => {
    if (!room?.inviteToken) return "";
    return `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/join/${room.inviteToken}`;
  }, [room?.inviteToken]);

  async function openInvitePicker() {
    setShowInvite(true);
    if (friends.length === 0) {
      try {
        const all = await apiFetch<SimpleUser[]>("/users");
        const favIds = new Set((user?.favouritePlayers ?? []) as number[]);
        const participantIds = new Set((room?.participants ?? []).map((p) => p.userId));
        const list = all
          .filter((u) => u.id !== user?.id && !participantIds.has(u.id) && favIds.has(u.id))
          .sort((a, b) => a.name.localeCompare(b.name));
        setFriends(list);
      } catch (e) {
        toast({ title: t("playFlow.error"), description: translateError(e).message, variant: "destructive" });
      }
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendInvites() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      const updated = await invitePlayMatchFriends(matchId, Array.from(selected));
      setRoom(updated);
      setSelected(new Set());
      setShowInvite(false);
      toast({ title: t("playFlow.invitesSent") });
    } catch (e) {
      toast({ title: t("playFlow.error"), description: translateError(e).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function respondRequest(requestId: number, approve: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      setRoom(await respondPlayMatchJoinRequest(matchId, requestId, approve));
    } catch (e) {
      toast({ title: t("playFlow.error"), description: translateError(e).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function runConfirm() {
    if (!confirmAction || busy) return;
    setBusy(true);
    try {
      if (confirmAction.type === "cancel") {
        setRoom(await cancelPlayMatch(matchId));
        toast({ title: t("playFlow.matchCancelled") });
      } else {
        setRoom(await removePlayMatchParticipant(matchId, confirmAction.userId));
        toast({ title: t("playFlow.removed") });
      }
      setConfirmAction(null);
    } catch (e) {
      toast({ title: t("playFlow.error"), description: translateError(e).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: t("playFlow.copyFailed"), variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto px-4 py-10 text-center text-muted-foreground">{t("playFlow.loading")}</div>
      </AppLayout>
    );
  }

  if (error || !room) {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto px-4 py-10 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <div className="text-muted-foreground mb-5">{error ?? t("playFlow.notFound")}</div>
          <button onClick={() => navigate("/play")} className="rounded-lg border border-white/15 px-5 py-2.5 text-sm">
            {t("playFlow.back")}
          </button>
        </div>
      </AppLayout>
    );
  }

  const kind = room.kind ?? "unranked";
  const slots = Array.from({ length: room.maxPlayers });
  const isCancelled = room.status === "cancelled";
  const isForming = room.status === "forming";

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto px-4 py-6">
        <button onClick={() => navigate("/play")} className="text-sm text-muted-foreground mb-4 hover:text-white">
          ‹ {t("playFlow.back")}
        </button>

        {/* Header */}
        <header className="mb-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl" style={{ filter: `drop-shadow(0 0 10px ${KIND_META[kind].accent}55)` }}>
              {KIND_META[kind].icon}
            </span>
            <div className="min-w-0">
              <h1 className="font-serif text-2xl tracking-tight">{t(`playFlow.kind.${kind}.title`)}</h1>
              <p className="text-sm text-muted-foreground truncate">
                {room.clubName} · {room.date} {room.time}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap text-xs">
            <span className="rounded-full bg-white/8 px-3 py-1">{room.format}</span>
            <span className="rounded-full bg-white/8 px-3 py-1">
              {Math.floor((room.slotMinutes ?? 0) / 60)}{t("playFlow.hourShort")}
              {(room.slotMinutes ?? 0) % 60 ? ` ${(room.slotMinutes ?? 0) % 60}${t("playFlow.minShort")}` : ""}
            </span>
            <span className="rounded-full bg-white/8 px-3 py-1">{t(`playFlow.visibility_${room.visibility}`)}</span>
          </div>
        </header>

        {/* Cancelled banner */}
        {isCancelled && (
          <div
            data-testid="banner-cancelled"
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 mb-5 text-sm text-red-300"
          >
            {t("playFlow.matchCancelledBanner")}
          </div>
        )}

        {/* Personal goal / vibe */}
        {kind === "personal" && (room.goal || room.styleNote) && (
          <div className="rounded-xl border border-white/10 bg-card p-4 mb-5">
            {room.goal && (
              <div className="mb-2">
                <div className="text-xs uppercase tracking-wider text-white/45 mb-1">{t("playFlow.goal")}</div>
                <div className="text-sm">{t(`playFlow.goalOptions.${room.goal}`)}</div>
              </div>
            )}
            {room.styleNote && (
              <div>
                <div className="text-xs uppercase tracking-wider text-white/45 mb-1">{t("playFlow.style")}</div>
                <div className="text-sm text-muted-foreground">{room.styleNote}</div>
              </div>
            )}
          </div>
        )}

        {/* Roster */}
        <section className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground">{t("playFlow.roster")}</h2>
            <span className="text-sm font-mono text-primary">
              {room.participantCount}/{room.maxPlayers}
            </span>
          </div>
          <div className="space-y-2">
            {slots.map((_, i) => {
              const p = room.participants[i];
              if (!p) {
                return (
                  <div
                    key={`empty-${i}`}
                    data-testid={`slot-empty-${i}`}
                    className="rounded-xl border border-dashed border-white/12 px-4 py-3 text-sm text-white/30"
                  >
                    {t("playFlow.openSlot")}
                  </div>
                );
              }
              return (
                <div
                  key={p.userId}
                  data-testid={`participant-${p.userId}`}
                  className="rounded-xl border border-white/10 bg-card px-4 py-3 flex items-center gap-3"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-serif font-bold text-primary flex-shrink-0"
                    style={{ background: "rgba(212,175,55,0.12)", fontSize: "14px" }}
                  >
                    {initials(p.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    {p.level && <div className="text-xs text-muted-foreground">{p.level}</div>}
                  </div>
                  {p.role === "leader" && (
                    <span className="text-xs rounded-full bg-primary/15 text-primary px-2.5 py-0.5">
                      {t("playFlow.leader")}
                    </span>
                  )}
                  {isLeader && isForming && p.role !== "leader" && (
                    <button
                      data-testid={`remove-${p.userId}`}
                      onClick={() => setConfirmAction({ type: "remove", userId: p.userId, name: p.name })}
                      disabled={busy}
                      aria-label={t("playFlow.remove")}
                      className="text-xs rounded-lg border border-white/15 text-white/60 hover:text-red-300 hover:border-red-400/40 px-2.5 py-1 disabled:opacity-50"
                    >
                      {t("playFlow.remove")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Leader: pending join requests */}
        {isLeader && room.joinRequests.length > 0 && (
          <section className="mb-5">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              {t("playFlow.requestsQueue")}
            </h2>
            <div className="space-y-2">
              {room.joinRequests.map((r) => (
                <div
                  key={r.id}
                  data-testid={`join-request-${r.id}`}
                  className="rounded-xl border border-primary/25 bg-card px-4 py-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.name}</div>
                    {r.level && <div className="text-xs text-muted-foreground">{r.level}</div>}
                  </div>
                  <button
                    data-testid={`approve-${r.id}`}
                    onClick={() => respondRequest(r.id, true)}
                    disabled={busy}
                    className="rounded-lg bg-primary text-black font-semibold px-3 py-2 text-xs disabled:opacity-60"
                  >
                    {t("playFlow.approve")}
                  </button>
                  <button
                    data-testid={`reject-${r.id}`}
                    onClick={() => respondRequest(r.id, false)}
                    disabled={busy}
                    className="rounded-lg border border-white/15 text-white/70 px-3 py-2 text-xs disabled:opacity-60"
                  >
                    {t("playFlow.reject")}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Leader: invite controls */}
        {isLeader && isForming && (
          <section className="space-y-3">
            {room.spotsLeft > 0 && (
              <>
                <button
                  data-testid="button-invite-friends"
                  onClick={openInvitePicker}
                  className="w-full rounded-xl bg-primary text-black font-semibold h-13 py-3.5 text-sm"
                >
                  {t("playFlow.inviteFriends")}
                </button>
                <button
                  data-testid="button-copy-link"
                  onClick={copyLink}
                  className="w-full rounded-xl border border-white/15 text-white font-medium py-3.5 text-sm"
                >
                  {copied ? t("playFlow.linkCopied") : t("playFlow.copyLink")}
                </button>
              </>
            )}
            <button
              data-testid="button-cancel-match"
              onClick={() => setConfirmAction({ type: "cancel" })}
              className="w-full rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10 font-medium py-3.5 text-sm"
            >
              {t("playFlow.cancelMatch")}
            </button>
          </section>
        )}
      </div>

      {/* Confirm dialog (cancel match / remove player) */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setConfirmAction(null);
          }}
        >
          <div
            data-testid="confirm-dialog"
            className="w-full max-w-md rounded-t-[28px] sm:rounded-[28px] p-6"
            style={{
              background: "hsl(220 20% 10%)",
              border: "1px solid rgba(255,255,255,0.1)",
              paddingBottom: "max(24px, env(safe-area-inset-bottom))",
            }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5 sm:hidden" style={{ background: "rgba(255,255,255,0.2)" }} />
            <h2 className="font-serif font-bold text-white mb-2 text-xl">
              {confirmAction.type === "cancel" ? t("playFlow.cancelMatchTitle") : t("playFlow.removePlayerTitle")}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {confirmAction.type === "cancel"
                ? t("playFlow.cancelMatchDesc")
                : t("playFlow.removePlayerDesc").replace("{{name}}", confirmAction.name)}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={busy}
                className="flex-1 rounded-xl border border-white/12 text-white/70 font-medium h-12 disabled:opacity-50"
              >
                {confirmAction.type === "cancel" ? t("playFlow.keepMatch") : t("playFlow.cancel")}
              </button>
              <button
                data-testid="confirm-action"
                onClick={runConfirm}
                disabled={busy}
                className="flex-1 rounded-xl bg-red-500 text-white font-semibold h-12 disabled:opacity-50"
              >
                {busy
                  ? "…"
                  : confirmAction.type === "cancel"
                    ? t("playFlow.confirmCancel")
                    : t("playFlow.confirmRemove")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite picker dialog */}
      {showInvite && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setShowInvite(false);
          }}
        >
          <div
            className="w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] p-6 max-h-[80vh] flex flex-col"
            style={{
              background: "hsl(220 20% 10%)",
              border: "1px solid rgba(255,255,255,0.1)",
              paddingBottom: "max(24px, env(safe-area-inset-bottom))",
            }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5 sm:hidden" style={{ background: "rgba(255,255,255,0.2)" }} />
            <h2 className="font-serif font-bold text-white mb-4 text-xl">{t("playFlow.inviteFriends")}</h2>

            <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-2">
              {friends.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-6">{t("playFlow.noFriends")}</div>
              )}
              {friends.map((f) => {
                const isSel = selected.has(f.id);
                const isFav = ((user?.favouritePlayers ?? []) as number[]).includes(f.id);
                return (
                  <button
                    key={f.id}
                    data-testid={`friend-${f.id}`}
                    onClick={() => toggle(f.id)}
                    className="w-full rounded-xl border px-4 py-3 flex items-center gap-3 text-left transition-colors"
                    style={{
                      background: isSel ? "rgba(212,175,55,0.12)" : "transparent",
                      borderColor: isSel ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.12)",
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-serif font-bold text-primary flex-shrink-0"
                      style={{ background: "rgba(212,175,55,0.12)", fontSize: "14px" }}
                    >
                      {initials(f.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {isFav && "★ "}
                        {f.name}
                      </div>
                      {f.level && <div className="text-xs text-muted-foreground">{f.level}</div>}
                    </div>
                    {isSel && <span className="text-primary">✓</span>}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowInvite(false)}
                disabled={busy}
                className="flex-1 rounded-xl border border-white/12 text-white/70 font-medium h-12 disabled:opacity-50"
              >
                {t("playFlow.cancel")}
              </button>
              <button
                data-testid="button-send-invites"
                onClick={sendInvites}
                disabled={busy || selected.size === 0}
                className="flex-1 rounded-xl bg-primary text-black font-semibold h-12 disabled:opacity-50"
              >
                {busy ? "…" : `${t("playFlow.send")} (${selected.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
