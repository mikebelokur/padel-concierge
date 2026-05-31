import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { translateError } from "@/lib/errorMessages";
import {
  createPlayMatch,
  KIND_META,
  PERSONAL_GOALS,
  type MatchGoal,
  type MatchKind,
  type MatchVisibility,
} from "@/lib/playMatches";

interface Club {
  id: number;
  name: string;
}

const VALID_KINDS: MatchKind[] = ["unranked", "competitive", "personal"];
const MIN_SLOT = 60;
const DEFAULT_SLOT = 90;
const SLOT_OPTIONS = [60, 90, 120];

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function PlayCreate() {
  const [, params] = useRoute("/play/create/:kind");
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();

  const kind = (params?.kind ?? "unranked") as MatchKind;
  const validKind = VALID_KINDS.includes(kind);

  const [clubs, setClubs] = useState<Club[]>([]);
  const [date, setDate] = useState(toDateInput(new Date()));
  const [time, setTime] = useState("");
  const [clubName, setClubName] = useState("");
  const [slotMinutes, setSlotMinutes] = useState(DEFAULT_SLOT);
  const [visibility, setVisibility] = useState<MatchVisibility>("private");
  const [goal, setGoal] = useState<MatchGoal | null>(null);
  const [styleNote, setStyleNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const minDate = useMemo(() => toDateInput(new Date()), []);

  useEffect(() => {
    apiFetch<Club[]>("/clubs")
      .then((rows) => {
        setClubs(rows);
        if (rows.length > 0) setClubName(rows[0].name);
      })
      .catch(() => setClubs([]));
  }, []);

  if (!validKind) {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto px-4 py-10 text-center text-muted-foreground">
          {t("playFlow.invalidKind")}
        </div>
      </AppLayout>
    );
  }

  const canSubmit =
    !!date &&
    !!time &&
    !!clubName.trim() &&
    slotMinutes >= MIN_SLOT &&
    (kind !== "personal" || goal !== null) &&
    !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const room = await createPlayMatch({
        kind,
        date,
        time,
        clubName: clubName.trim(),
        slotMinutes,
        visibility,
        goal: kind === "personal" ? goal : null,
        styleNote: kind === "personal" ? styleNote.trim() || null : null,
      });
      toast({ title: t("playFlow.created"), description: t("playFlow.createdDesc") });
      navigate(`/play/match/${room.id}`);
    } catch (e) {
      toast({ title: t("playFlow.error"), description: translateError(e).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const labelCls = "block mb-2 text-xs uppercase tracking-wider text-white/45";
  const inputCls =
    "w-full rounded-xl border border-white/15 bg-transparent text-white outline-none px-4 h-12 text-base focus:border-primary/60";

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate("/play")}
          className="text-sm text-muted-foreground mb-4 hover:text-white"
        >
          ‹ {t("playFlow.back")}
        </button>

        <header className="mb-6 flex items-center gap-3">
          <span className="text-3xl" style={{ filter: `drop-shadow(0 0 10px ${KIND_META[kind].accent}55)` }}>
            {KIND_META[kind].icon}
          </span>
          <div>
            <h1 className="font-serif text-2xl tracking-tight">{t(`playFlow.kind.${kind}.title`)}</h1>
            <p className="text-sm text-muted-foreground">{t(`playFlow.kind.${kind}.desc`)}</p>
          </div>
        </header>

        {/* Format note (fixed) */}
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 mb-5 text-sm text-muted-foreground">
          🎾 {t("playFlow.formatFixed")}
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>{t("playFlow.date")}</label>
            <input
              data-testid="input-date"
              type="date"
              value={date}
              min={minDate}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
              style={{ colorScheme: "dark" }}
            />
          </div>

          <div>
            <label className={labelCls}>{t("playFlow.time")}</label>
            <input
              data-testid="input-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputCls}
              style={{ colorScheme: "dark" }}
            />
          </div>

          <div>
            <label className={labelCls}>{t("playFlow.club")}</label>
            {clubs.length > 0 ? (
              <select
                data-testid="select-club"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                className={inputCls}
                style={{ colorScheme: "dark" }}
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                data-testid="input-club"
                type="text"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder={t("playFlow.clubPlaceholder")}
                className={inputCls}
              />
            )}
          </div>

          <div>
            <label className={labelCls}>{t("playFlow.slot")}</label>
            <div className="flex gap-2 flex-wrap">
              {SLOT_OPTIONS.map((m) => (
                <button
                  key={m}
                  data-testid={`slot-${m}`}
                  onClick={() => setSlotMinutes(m)}
                  className="relative rounded-lg border px-4 h-11 text-sm font-medium transition-colors"
                  style={{
                    background: slotMinutes === m ? "rgba(212,175,55,0.15)" : "transparent",
                    borderColor: slotMinutes === m ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.15)",
                    color: slotMinutes === m ? "#D4AF37" : "rgba(255,255,255,0.7)",
                  }}
                >
                  {Math.floor(m / 60)}{t("playFlow.hourShort")} {m % 60 ? `${m % 60}${t("playFlow.minShort")}` : ""}
                  {m === DEFAULT_SLOT ? (
                    <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#D4AF37" }}>
                      ★ {t("playFlow.slotRecommended")}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">{t("playFlow.slotHint")}</p>
          </div>

          <div>
            <label className={labelCls}>{t("playFlow.visibility")}</label>
            <div className="grid grid-cols-2 gap-2">
              {(["private", "open"] as MatchVisibility[]).map((v) => (
                <button
                  key={v}
                  data-testid={`visibility-${v}`}
                  onClick={() => setVisibility(v)}
                  className="rounded-xl border px-4 py-3 text-left transition-colors"
                  style={{
                    background: visibility === v ? "rgba(212,175,55,0.12)" : "transparent",
                    borderColor: visibility === v ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.12)",
                  }}
                >
                  <div className="text-sm font-medium">{t(`playFlow.visibility_${v}`)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t(`playFlow.visibility_${v}_desc`)}</div>
                </button>
              ))}
            </div>
          </div>

          {kind === "personal" && (
            <>
              <div>
                <label className={labelCls}>{t("playFlow.goal")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {PERSONAL_GOALS.map((g) => (
                    <button
                      key={g}
                      data-testid={`goal-${g}`}
                      onClick={() => setGoal(g)}
                      className="rounded-xl border px-4 py-3 text-left transition-colors text-sm font-medium"
                      style={{
                        background: goal === g ? "rgba(212,175,55,0.12)" : "transparent",
                        borderColor: goal === g ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.12)",
                        color: goal === g ? "#D4AF37" : "rgba(255,255,255,0.7)",
                      }}
                    >
                      {t(`playFlow.goalOptions.${g}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>{t("playFlow.style")}</label>
                <textarea
                  data-testid="input-style"
                  value={styleNote}
                  onChange={(e) => setStyleNote(e.target.value)}
                  placeholder={t("playFlow.stylePlaceholder")}
                  rows={3}
                  className="w-full rounded-xl border border-white/15 bg-transparent text-white outline-none px-4 py-3 text-base resize-none focus:border-primary/60 placeholder:text-white/20"
                />
              </div>
            </>
          )}
        </div>

        <button
          data-testid="button-create-match"
          onClick={submit}
          disabled={!canSubmit}
          className="w-full mt-7 rounded-xl bg-primary text-black font-semibold h-14 text-base disabled:opacity-50"
        >
          {submitting ? t("playFlow.creating") : t("playFlow.createButton")}
        </button>
      </div>
    </AppLayout>
  );
}
