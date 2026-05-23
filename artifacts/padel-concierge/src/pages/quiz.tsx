import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch } from "@/lib/api";
import { calcArchetype, getWarmUpPreference, ARCHETYPE_META } from "@/lib/archetypes";

// ─── BACKGROUND IMAGES (Unsplash) ──────────────────────────────────────────
const BG = [
  "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1516802273409-68526ee1bdd6?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1536329583941-14287ec6fc4e?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1599474924187-334a4ae5051f?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1610484826967-09c5720778c7?auto=format&fit=crop&w=1920&q=80",
];
const INTRO_BG = "https://images.unsplash.com/photo-1599474924187-334a4ae5051f?auto=format&fit=crop&w=1920&q=80";
const RESULT_BG = "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1920&q=80";

// ─── QUESTION METADATA (IDs only — text comes from i18n) ────────────────────
const ARCHETYPE_QUESTIONS = [
  { id: "aq1", emoji: "🎯", optionIds: ["analyze", "laugh"] },
  { id: "aq2", emoji: "❤️", optionIds: ["win", "vibe"] },
  { id: "aq3", emoji: "🏆", optionIds: ["push", "fun"] },
  { id: "aq4", emoji: "⚡", optionIds: ["known", "new"] },
  { id: "aq5", emoji: "🪟", optionIds: ["pro", "hobby"] },
  { id: "aq6", emoji: "🤝", optionIds: ["warmup", "jumpin"] },
];

interface LevelQ {
  id: string; emoji: string;
  correctAnswer: boolean;
  wrongExplanation: string;
  hintAfterAnswer?: string;
}

const LEVEL_QUESTIONS: LevelQ[] = [
  { id: "lq1", emoji: "💥", correctAnswer: true,  wrongExplanation: "терпение и выбор момента", hintAfterAnswer: "lq1.hint" },
  { id: "lq2", emoji: "🧠", correctAnswer: true,  wrongExplanation: "позицию после стекла" },
  { id: "lq3", emoji: "📍", correctAnswer: false, wrongExplanation: "командную психологию" },
  { id: "lq4", emoji: "🎭", correctAnswer: false, wrongExplanation: "тактику смэша" },
  { id: "lq5", emoji: "⚖️", correctAnswer: true,  wrongExplanation: "стабильность и ментальную устойчивость" },
  { id: "lq6", emoji: "🎯", correctAnswer: true,  wrongExplanation: "приоритет позиции над силой" },
  { id: "lq7", emoji: "🔥", correctAnswer: false, wrongExplanation: "концентрацию против любых соперников" },
];

type Level = "D" | "D+" | "C" | "C+" | "B";
const LEVELS: Level[] = ["D", "D+", "C", "C+", "B"];
const MATCHES_TO_NEXT: Record<Level, number | null> = { D: 3, "D+": 5, C: 8, "C+": 12, B: null };

function calcRawLevel(score: number): Level {
  if (score <= 1) return "D";
  if (score <= 3) return "D+";
  if (score <= 5) return "C";
  if (score === 6) return "C+";
  return "B";
}
function downgrade(level: Level): Level {
  const idx = LEVELS.indexOf(level);
  return LEVELS[Math.max(0, idx - 1)];
}

type Phase = "intro" | "archetype" | "level" | "result";
type FeedbackState = "correct" | "wrong" | null;

function GoldDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap px-4">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={cn(
          "rounded-full transition-all duration-400",
          i < current
            ? "w-2.5 h-2.5 bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
            : i === current
            ? "w-3 h-3 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,1)] ring-2 ring-amber-400/30"
            : "w-2 h-2 bg-white/20"
        )} />
      ))}
    </div>
  );
}

function CinematicSlide({ bgUrl, children, visible }: { bgUrl: string; children: React.ReactNode; visible: boolean }) {
  return (
    <div className="fixed inset-0 bg-black z-[100]" style={{ backgroundImage: `url(${bgUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0" style={{ height: "60%", background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.97) 100%)" }} />
      <div className="relative z-10 h-full flex flex-col" style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s ease" }}>
        {children}
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="flex items-center justify-between px-5 pt-safe pt-4 pb-2 relative z-10">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-lg">🐻</div>
        <div className="leading-none">
          <div className="text-[10px] text-amber-400/70 font-medium tracking-widest uppercase">Mikhail Bear</div>
          <div className="text-xs text-white/60 font-medium">Padel Coach</div>
        </div>
      </div>
      <div className="text-center absolute left-1/2 -translate-x-1/2">
        <div className="text-xs tracking-[0.25em] text-amber-400 font-bold uppercase">Padel Future</div>
      </div>
      <div className="w-9" />
    </div>
  );
}

function EmojiIcon({ emoji }: { emoji: string }) {
  return (
    <div className="flex justify-center mb-3">
      <div className="w-14 h-14 rounded-full bg-amber-400/20 border-2 border-amber-400/60 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(251,191,36,0.3)]">
        {emoji}
      </div>
    </div>
  );
}

export default function Quiz() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>("intro");
  const [aIndex, setAIndex] = useState(0);
  const [lIndex, setLIndex] = useState(0);
  const [archetypeAnswers, setArchetypeAnswers] = useState<Record<string, string>>({});
  const [levelAnswers, setLevelAnswers] = useState<Record<string, boolean | null>>({});
  const [lq1text, setLq1text] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  const [visible, setVisible] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [yesFlash, setYesFlash] = useState(false);
  const [noFlash, setNoFlash] = useState(false);

  const totalSteps = ARCHETYPE_QUESTIONS.length + LEVEL_QUESTIONS.length;
  const currentStep =
    phase === "archetype" ? aIndex :
    phase === "level" ? ARCHETYPE_QUESTIONS.length + lIndex : 0;

  const currentBg =
    phase === "intro" ? INTRO_BG :
    phase === "result" ? RESULT_BG :
    BG[currentStep] ?? BG[0];

  useEffect(() => {
    if (phase === "result" && user?.id && !saved) {
      const archetype = calcArchetype(archetypeAnswers);
      const warmUpPreference = getWarmUpPreference(archetypeAnswers);
      apiFetch(`/users/${user.id}/archetype`, {
        method: "POST",
        body: JSON.stringify({ archetype, warmUpPreference }),
      }).then(() => setSaved(true)).catch(() => {});
    }
  }, [phase]);

  const fadeTransition = useCallback((fn: () => void) => {
    setVisible(false);
    setTimeout(() => { fn(); setVisible(true); }, 280);
  }, []);

  function handleArchetype(optionId: string) {
    const qId = ARCHETYPE_QUESTIONS[aIndex].id;
    const updated = { ...archetypeAnswers, [qId]: optionId };
    setArchetypeAnswers(updated);
    fadeTransition(() => {
      if (aIndex < ARCHETYPE_QUESTIONS.length - 1) setAIndex((i) => i + 1);
      else { setPhase("level"); setLIndex(0); }
    });
  }

  function handleLevel(answer: boolean) {
    const q = LEVEL_QUESTIONS[lIndex];
    const isCorrect = answer === q.correctAnswer;
    if (answer) { setYesFlash(true); setTimeout(() => setYesFlash(false), 600); }
    else { setNoFlash(true); setTimeout(() => setNoFlash(false), 600); }
    setFeedback(isCorrect ? "correct" : "wrong");
    setLastAnswer(answer);
    const updated = { ...levelAnswers, [q.id]: answer };
    setLevelAnswers(updated);
    if (q.hintAfterAnswer) {
      setTimeout(() => { setShowHint(true); setFeedback(null); }, 700);
      return;
    }
    setTimeout(() => {
      setFeedback(null);
      fadeTransition(() => {
        if (lIndex < LEVEL_QUESTIONS.length - 1) setLIndex((i) => i + 1);
        else setPhase("result");
      });
    }, 700);
  }

  function advanceLevel() {
    setShowHint(false); setLastAnswer(null); setFeedback(null);
    fadeTransition(() => {
      if (lIndex < LEVEL_QUESTIONS.length - 1) setLIndex((i) => i + 1);
      else setPhase("result");
    });
  }

  const score = LEVEL_QUESTIONS.filter(q => levelAnswers[q.id] === q.correctAnswer).length;
  const wrongTopics = LEVEL_QUESTIONS
    .filter(q => levelAnswers[q.id] !== q.correctAnswer && levelAnswers[q.id] !== undefined)
    .map(q => q.wrongExplanation);
  const rawLevel = calcRawLevel(score);
  const finalLevel = downgrade(rawLevel);
  const archetype = calcArchetype(archetypeAnswers);
  const warmUp = getWarmUpPreference(archetypeAnswers);
  const archetypeMeta = ARCHETYPE_META[archetype];
  const matchesToNext = MATCHES_TO_NEXT[finalLevel];

  function handleRestart() {
    setPhase("intro"); setAIndex(0); setLIndex(0);
    setArchetypeAnswers({}); setLevelAnswers({});
    setLq1text(""); setShowHint(false); setLastAnswer(null);
    setSaved(false); setFeedback(null); setVisible(true);
  }

  // ── INTRO ──
  if (phase === "intro") {
    return (
      <CinematicSlide bgUrl={INTRO_BG} visible={visible}>
        <TopBar />
        <div className="flex-1 flex flex-col justify-end px-5 pb-10">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🎾</div>
            <h1 className="text-3xl font-serif font-bold text-white leading-tight mb-3" style={{whiteSpace: "pre-line"}}>
              {t("quiz.intro.title")}
            </h1>
            <p className="text-white/60 text-sm leading-relaxed" style={{whiteSpace: "pre-line"}}>
              {t("quiz.intro.subtitle")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-2xl border border-amber-400/20 bg-black/40 backdrop-blur-sm p-4 text-center">
              <div className="text-2xl mb-1">🧩</div>
              <div className="text-amber-400 text-xs font-semibold uppercase tracking-wider">{t("quiz.intro.archetypeBlock")}</div>
              <div className="text-white/80 text-sm mt-1">{t("quiz.intro.archetypeLabel")}</div>
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-black/40 backdrop-blur-sm p-4 text-center">
              <div className="text-2xl mb-1">📊</div>
              <div className="text-amber-400 text-xs font-semibold uppercase tracking-wider">{t("quiz.intro.levelBlock")}</div>
              <div className="text-white/80 text-sm mt-1">{t("quiz.intro.levelLabel")}</div>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm p-4 mb-6 text-center">
            <p className="text-amber-200 text-xs leading-relaxed">{t("quiz.intro.warning")}</p>
          </div>
          <button
            onClick={() => fadeTransition(() => setPhase("archetype"))}
            className="w-full py-4 rounded-2xl bg-amber-400 text-black font-bold text-base shadow-[0_0_30px_rgba(251,191,36,0.4)] hover:bg-amber-300 active:scale-[0.98] transition-all"
          >
            {t("quiz.intro.startButton")}
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full mt-3 py-3 text-white/40 text-sm hover:text-white/60 transition-colors"
          >
            {t("quiz.intro.skipButton")}
          </button>
        </div>
      </CinematicSlide>
    );
  }

  // ── ARCHETYPE QUESTION ──
  if (phase === "archetype") {
    const q = ARCHETYPE_QUESTIONS[aIndex];
    return (
      <CinematicSlide bgUrl={currentBg} visible={visible}>
        <TopBar />
        <div className="px-5 pt-4">
          <GoldDots current={currentStep} total={totalSteps} />
          <div className="text-center mt-2">
            <span className="text-[10px] text-amber-400/60 uppercase tracking-widest">
              {t("quiz.archetypeSection")} · {aIndex + 1} / {ARCHETYPE_QUESTIONS.length}
            </span>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-end px-5 pb-10">
          <EmojiIcon emoji={q.emoji} />
          <h2 className="text-white text-2xl font-serif font-bold text-center leading-snug mb-8">
            {t(`quiz.${q.id}.text`)}
          </h2>
          <div className="space-y-3">
            {q.optionIds.map((optId, idx) => (
              <button
                key={optId}
                onClick={() => handleArchetype(optId)}
                className="w-full text-left px-5 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm hover:border-amber-400/50 hover:bg-amber-400/10 active:scale-[0.98] transition-all text-white font-medium leading-snug flex items-center gap-3"
                style={{ minHeight: "80px", fontSize: "17px" }}
              >
                <span className="text-amber-400 font-bold flex-shrink-0" style={{ fontSize: "15px" }}>{idx === 0 ? "A" : "B"}</span>
                {t(`quiz.${q.id}.${idx === 0 ? "a" : "b"}`)}
              </button>
            ))}
          </div>
        </div>
      </CinematicSlide>
    );
  }

  // ── LEVEL QUESTION ──
  if (phase === "level") {
    const q = LEVEL_QUESTIONS[lIndex];
    const isCorrect = feedback === "correct";
    return (
      <CinematicSlide bgUrl={currentBg} visible={visible}>
        <div className={cn("absolute inset-0 z-20 pointer-events-none transition-opacity duration-300", feedback === "correct" ? "opacity-100" : "opacity-0")}
          style={{ background: "radial-gradient(ellipse at center, rgba(34,197,94,0.25) 0%, transparent 70%)" }} />
        <div className={cn("absolute inset-0 z-20 pointer-events-none transition-opacity duration-300", feedback === "wrong" ? "opacity-100" : "opacity-0")}
          style={{ background: "radial-gradient(ellipse at center, rgba(239,68,68,0.2) 0%, transparent 70%)" }} />

        <TopBar />
        <div className="px-5 pt-4 relative z-30">
          <GoldDots current={currentStep} total={totalSteps} />
          <div className="text-center mt-2">
            <span className="text-[10px] text-amber-400/60 uppercase tracking-widest">
              {t("quiz.tacticsSection")} · {lIndex + 1} / {LEVEL_QUESTIONS.length}
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-end px-5 pb-10 relative z-30">
          <EmojiIcon emoji={q.emoji} />
          <h2 className="text-white text-xl font-serif font-bold text-center leading-snug mb-8">
            {t(`quiz.${q.id}.text`)}
          </h2>

          {!showHint ? (
            <div className="flex gap-3">
              <button
                onClick={() => !feedback && handleLevel(true)}
                disabled={!!feedback}
                className={cn(
                  "flex-1 rounded-2xl border font-bold transition-all duration-300 active:scale-[0.97]",
                  yesFlash && isCorrect
                    ? "border-green-400 bg-green-500/30 text-green-300 shadow-[0_0_30px_rgba(34,197,94,0.6)] scale-[1.02]"
                    : yesFlash && !isCorrect
                    ? "border-red-400 bg-red-500/20 text-red-300"
                    : "border-green-500/40 bg-green-500/10 text-green-400 hover:border-green-400/60 hover:bg-green-500/20"
                )}
                style={{ minHeight: "80px", fontSize: "22px" }}
              >
                {t("common.yes")}
              </button>
              <button
                onClick={() => !feedback && handleLevel(false)}
                disabled={!!feedback}
                className={cn(
                  "flex-1 rounded-2xl border font-bold transition-all duration-300 active:scale-[0.97]",
                  noFlash && !isCorrect && feedback !== null
                    ? "border-red-400 bg-red-500/20 text-red-300"
                    : noFlash && isCorrect
                    ? "border-green-400 bg-green-500/30 text-green-300 shadow-[0_0_30px_rgba(34,197,94,0.6)] scale-[1.02]"
                    : "border-red-500/40 bg-red-500/10 text-red-400 hover:border-red-400/60 hover:bg-red-500/20"
                )}
                style={{ minHeight: "80px", fontSize: "22px" }}
              >
                {t("common.no")}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={cn(
                "px-4 py-3 rounded-xl border text-sm text-center",
                lastAnswer === q.correctAnswer
                  ? "border-green-500/40 bg-green-500/15 text-green-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-300"
              )}>
                {lastAnswer === q.correctAnswer
                  ? t("quiz.lq1.correct")
                  : t("quiz.lq1.wrong")}
              </div>
              {q.hintAfterAnswer && (
                <p className="text-white/50 text-sm text-center">{t(`quiz.${q.id}.hint`)}</p>
              )}
              <textarea
                className="w-full bg-white/8 border border-white/15 rounded-xl p-3 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-amber-400/40 backdrop-blur-sm"
                rows={2}
                placeholder={t("quiz.optionalNote")}
                value={lq1text}
                onChange={(e) => setLq1text(e.target.value)}
              />
              <button
                onClick={advanceLevel}
                className="w-full py-4 rounded-2xl bg-amber-400 text-black font-bold text-sm hover:bg-amber-300 active:scale-[0.98] transition-all"
              >
                {t("quiz.continueBtn")}
              </button>
            </div>
          )}
        </div>
      </CinematicSlide>
    );
  }

  // ── RESULT ──
  return (
    <CinematicSlide bgUrl={RESULT_BG} visible={visible}>
      <TopBar />
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-6 pb-10 space-y-5">

          {/* Level hero */}
          <div className="text-center py-8">
            <div className="text-xs text-amber-400/60 uppercase tracking-[0.3em] mb-3">{t("quiz.result.yourLevel")}</div>
            <div className="text-8xl font-mono font-black text-amber-400 leading-none drop-shadow-[0_0_40px_rgba(251,191,36,0.6)]">
              {finalLevel}
            </div>
            <div className="text-white/70 text-lg mt-2 font-serif">{t(`quiz.levels.${finalLevel}`)}</div>
            {matchesToNext !== null ? (
              <div className="mt-3 inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 rounded-full px-4 py-1.5">
                <span className="text-amber-400 text-xs font-semibold">{t("quiz.result.matchesToNext")}:</span>
                <span className="text-white text-xs font-bold">{matchesToNext}</span>
              </div>
            ) : (
              <div className="mt-3 inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/30 rounded-full px-4 py-1.5">
                <span className="text-amber-400 text-xs font-semibold">{t("quiz.result.topLevel")}</span>
              </div>
            )}
          </div>

          {/* Archetype card */}
          <div className="rounded-2xl border border-white/15 bg-black/50 backdrop-blur-sm p-5 text-center">
            <div className="text-3xl mb-2">{archetypeMeta.icon}</div>
            <div className="text-xs text-white/40 uppercase tracking-wider mb-1">{t("quiz.result.archetype")}</div>
            <div className="text-lg font-serif font-semibold text-white mb-2">{archetypeMeta.nameRu}</div>
            <p className="text-white/50 text-xs leading-relaxed mb-3">{archetypeMeta.desc}</p>
            <div className={cn(
              "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border",
              warmUp ? "text-orange-300 bg-orange-500/10 border-orange-500/20" : "text-slate-400 bg-slate-500/10 border-slate-500/20"
            )}>
              {warmUp ? t("quiz.result.preferWarmup") : t("quiz.result.jumpsIn")}
            </div>
          </div>

          {/* Score */}
          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-4 flex items-center gap-4">
            <div className="text-center flex-shrink-0">
              <div className="text-2xl font-mono font-bold text-white">{score}<span className="text-white/30 text-base">/{LEVEL_QUESTIONS.length}</span></div>
              <div className="text-xs text-white/40 mt-0.5">{t("quiz.result.correct")}</div>
            </div>
            <div className="flex-1 space-y-1.5">
              {LEVEL_QUESTIONS.map((q) => {
                const correct = levelAnswers[q.id] === q.correctAnswer;
                return (
                  <div key={q.id} className="flex items-center gap-2">
                    <span className="text-xs flex-shrink-0">{correct ? "✅" : "❌"}</span>
                    <span className="text-xs text-white/40 truncate">{t(`quiz.${q.id}.text`).slice(0, 45)}…</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Downgraded notice */}
          {rawLevel !== finalLevel && (
            <div className="rounded-2xl border border-orange-500/40 bg-orange-500/8 p-4">
              <p className="text-orange-200 text-sm leading-relaxed text-center">
                {t("quiz.result.downgradedNote", { raw: rawLevel })}
              </p>
            </div>
          )}

          {/* Growth areas */}
          {wrongTopics.length > 0 && (
            <div>
              <div className="text-xs text-white/30 uppercase tracking-wider mb-2 text-center">{t("quiz.result.growthAreas")}</div>
              <div className="flex flex-wrap gap-2 justify-center">
                {wrongTopics.map((topic) => (
                  <span key={topic} className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Save status */}
          {saved && user && (
            <div className="text-center text-xs text-green-400/70 bg-green-500/5 border border-green-500/15 rounded-xl p-3">
              {t("quiz.result.saved")}
            </div>
          )}
          {!user && (
            <div className="text-center text-xs text-white/40 bg-white/5 border border-white/8 rounded-xl p-3">
              {t("quiz.result.loginToSave")}
            </div>
          )}

          {/* CTAs */}
          <div className="space-y-3 pt-2">
            <button
              onClick={() => navigate("/match-requests")}
              className="w-full py-4 rounded-2xl bg-amber-400 text-black font-bold text-base shadow-[0_0_30px_rgba(251,191,36,0.4)] hover:bg-amber-300 active:scale-[0.98] transition-all"
            >
              {t("quiz.result.findPartner")}
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full py-3 rounded-2xl border border-white/15 bg-white/5 text-white/70 font-medium text-sm hover:bg-white/10 active:scale-[0.98] transition-all"
            >
              {t("quiz.result.toDashboard")}
            </button>
            <button
              onClick={handleRestart}
              className="w-full py-2 text-white/30 text-sm hover:text-white/50 transition-colors"
            >
              {t("quiz.result.retake")}
            </button>
          </div>
        </div>
      </div>
    </CinematicSlide>
  );
}
