import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { calcArchetype, getWarmUpPreference, ARCHETYPE_META } from "@/lib/archetypes";

const ARCHETYPE_QUESTIONS = [
  {
    id: "aq1",
    text: "После поражения в матче — что ты делаешь?",
    options: [
      { id: "analyze", label: "🧠 Разбираю ошибки и думаю, как улучшиться" },
      { id: "laugh",   label: "😄 Смеюсь, отпускаю и перехожу к следующей игре" },
    ],
  },
  {
    id: "aq2",
    text: "Когда ты на корте — о чём думаешь?",
    options: [
      { id: "win",  label: "🏆 О победе — думаю о тактике и результате" },
      { id: "vibe", label: "⚡ Об энергии и атмосфере с партнёром" },
    ],
  },
  {
    id: "aq3",
    text: "Зачем ты играешь в падел?",
    options: [
      { id: "push", label: "💪 Чтобы нагрузиться и проверить свои пределы" },
      { id: "fun",  label: "😌 Ради удовольствия и отдыха от работы" },
    ],
  },
  {
    id: "aq4",
    text: "С кем ты предпочитаешь играть?",
    options: [
      { id: "known", label: "👫 С теми, кого уже знаю и кому доверяю" },
      { id: "new",   label: "🌍 Открыт(а) знакомиться с новыми игроками" },
    ],
  },
  {
    id: "aq5",
    text: "Какова твоя цель в падел?",
    options: [
      { id: "pro",   label: "🚀 Расти до профессионального уровня" },
      { id: "hobby", label: "🎯 Падел — это моё развлечение и хобби" },
    ],
  },
  {
    id: "aq6",
    text: "Перед матчем — как ты готовишься?",
    options: [
      { id: "warmup", label: "🔥 Разминаюсь 10 минут — это важно" },
      { id: "jumpin", label: "⚡ Прыгаю сразу в игру — зачем ждать?" },
    ],
  },
];

interface LevelQ {
  id: string;
  text: string;
  correctAnswer: boolean;
  wrongExplanation: string;
  hintAfterAnswer?: string;
}

const LEVEL_QUESTIONS: LevelQ[] = [
  {
    id: "lq1",
    text: "Лучше подождать нужный момент и только потом бить — даже если это значит пропустить несколько мячей?",
    correctAnswer: true,
    wrongExplanation: "терпение и выбор момента",
    hintAfterAnswer: "Расскажи, когда ты обычно торопишься с ударом?",
  },
  {
    id: "lq2",
    text: "После удара по стеклу — нужно сразу занять позицию у сетки?",
    correctAnswer: true,
    wrongExplanation: "позицию после стекла",
  },
  {
    id: "lq3",
    text: "Когда партнёр ошибся — лучше сразу сказать ему что он сделал не так?",
    correctAnswer: false,
    wrongExplanation: "командную психологию",
  },
  {
    id: "lq4",
    text: "Смэш изо всей силы — всегда лучший выбор, когда мяч высоко?",
    correctAnswer: false,
    wrongExplanation: "тактику смэша",
  },
  {
    id: "lq5",
    text: "Три ошибки подряд — это нормально, менять всю тактику не стоит?",
    correctAnswer: true,
    wrongExplanation: "стабильность и ментальную устойчивость",
  },
  {
    id: "lq6",
    text: "Позиция на корте важнее силы удара?",
    correctAnswer: true,
    wrongExplanation: "приоритет позиции над силой",
  },
  {
    id: "lq7",
    text: "Против слабых соперников можно расслабиться и не думать о тактике?",
    correctAnswer: false,
    wrongExplanation: "концентрацию против любых соперников",
  },
];

type Level = "D" | "D+" | "C" | "C+" | "B";
const LEVELS: Level[] = ["D", "D+", "C", "C+", "B"];

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

const LEVEL_LABELS: Record<Level, { color: string; bg: string; border: string; title: string }> = {
  D:    { color: "text-slate-400",  bg: "bg-slate-500/10",  border: "border-slate-500/30",  title: "Начинающий" },
  "D+": { color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", title: "Начинающий+" },
  C:    { color: "text-cyan-400",   bg: "bg-cyan-500/10",   border: "border-cyan-500/30",   title: "Любитель" },
  "C+": { color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/30",   title: "Уверенный игрок" },
  B:    { color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  title: "Продвинутый" },
};

type Phase = "intro" | "archetype" | "level" | "result";

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="w-full bg-white/5 rounded-full h-1.5 mb-6">
      <div
        className="h-1.5 rounded-full bg-primary transition-all duration-500"
        style={{ width: `${(current / total) * 100}%` }}
      />
    </div>
  );
}

export default function Quiz() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("intro");
  const [aIndex, setAIndex] = useState(0);
  const [lIndex, setLIndex] = useState(0);
  const [archetypeAnswers, setArchetypeAnswers] = useState<Record<string, string>>({});
  const [levelAnswers, setLevelAnswers] = useState<Record<string, boolean | null>>({});
  const [lq1text, setLq1text] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);

  const totalSteps = ARCHETYPE_QUESTIONS.length + LEVEL_QUESTIONS.length;

  function handleArchetype(optionId: string) {
    const qId = ARCHETYPE_QUESTIONS[aIndex].id;
    const updated = { ...archetypeAnswers, [qId]: optionId };
    setArchetypeAnswers(updated);
    if (aIndex < ARCHETYPE_QUESTIONS.length - 1) {
      setAIndex((i) => i + 1);
    } else {
      setPhase("level");
    }
  }

  function handleLevel(answer: boolean) {
    const q = LEVEL_QUESTIONS[lIndex];
    setLastAnswer(answer);
    const updated = { ...levelAnswers, [q.id]: answer };
    setLevelAnswers(updated);
    if (q.hintAfterAnswer) {
      setShowHint(true);
      return;
    }
    advanceLevel(updated);
  }

  function advanceLevel(la?: Record<string, boolean | null>) {
    const answers = la ?? levelAnswers;
    setShowHint(false);
    setLastAnswer(null);
    if (lIndex < LEVEL_QUESTIONS.length - 1) {
      setLIndex((i) => i + 1);
    } else {
      setLevelAnswers(answers);
      setPhase("result");
    }
  }

  useEffect(() => {
    if (phase === "result" && user?.id && !saved) {
      const archetype = calcArchetype(archetypeAnswers);
      const warmUpPreference = getWarmUpPreference(archetypeAnswers);
      apiFetch(`/users/${user.id}/archetype`, {
        method: "POST",
        body: JSON.stringify({ archetype, warmUpPreference }),
      })
        .then(() => setSaved(true))
        .catch(() => {});
    }
  }, [phase]);

  const score = LEVEL_QUESTIONS.filter(q => levelAnswers[q.id] === q.correctAnswer).length;
  const wrongTopics = LEVEL_QUESTIONS
    .filter(q => levelAnswers[q.id] !== q.correctAnswer && levelAnswers[q.id] !== undefined)
    .map(q => q.wrongExplanation);
  const rawLevel = calcRawLevel(score);
  const finalLevel = downgrade(rawLevel);
  const levelMeta = LEVEL_LABELS[finalLevel];
  const archetype = calcArchetype(archetypeAnswers);
  const warmUp = getWarmUpPreference(archetypeAnswers);
  const archetypeMeta = ARCHETYPE_META[archetype];

  function handleRestart() {
    setPhase("intro");
    setAIndex(0);
    setLIndex(0);
    setArchetypeAnswers({});
    setLevelAnswers({});
    setLq1text("");
    setShowHint(false);
    setLastAnswer(null);
    setSaved(false);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* INTRO */}
        {phase === "intro" && (
          <div className="text-center space-y-6">
            <div className="text-6xl mb-4">🎾</div>
            <h1 className="text-3xl font-serif">Узнай свой уровень и стиль игры</h1>
            <p className="text-muted-foreground leading-relaxed">
              13 вопросов — 4 минуты. Твой архетип игрока + тактический уровень для умного подбора партнёров.
            </p>
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="bg-white/5 rounded-xl p-3.5 border border-white/8">
                <div className="text-lg mb-1">🧩</div>
                <div className="text-xs text-muted-foreground mb-0.5">6 вопросов</div>
                <div className="text-sm font-medium">Архетип игрока</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3.5 border border-white/8">
                <div className="text-lg mb-1">📊</div>
                <div className="text-xs text-muted-foreground mb-0.5">7 вопросов</div>
                <div className="text-sm font-medium">Тактический уровень</div>
              </div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-300 text-left">
              ⚠️ Архетип сохраняется в твоём профиле и используется при подборе партнёров — отвечай честно.
            </div>
            <Button size="lg" className="w-full mt-2 text-base" onClick={() => setPhase("archetype")}>
              Начать тест →
            </Button>
            <button
              onClick={() => navigate("/dashboard")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Пропустить
            </button>
          </div>
        )}

        {/* ARCHETYPE QUESTIONS */}
        {phase === "archetype" && (
          <div className="space-y-6">
            <ProgressBar current={aIndex + 1} total={totalSteps} />
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                Вопрос {aIndex + 1} / {totalSteps} · Стиль игры
              </div>
              <div className="text-xs text-muted-foreground/40">Раздел 1 из 2</div>
            </div>
            <h2 className="text-xl font-serif leading-snug">
              {ARCHETYPE_QUESTIONS[aIndex].text}
            </h2>
            <div className="space-y-3">
              {ARCHETYPE_QUESTIONS[aIndex].options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleArchetype(opt.id)}
                  className="w-full text-left px-4 py-4 rounded-xl border border-white/10 bg-white/3 hover:border-primary/50 hover:bg-primary/5 active:scale-[0.99] transition-all text-sm font-medium leading-snug"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 justify-center">
              {ARCHETYPE_QUESTIONS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 rounded-full transition-all",
                    i < aIndex ? "w-4 bg-primary/60" :
                    i === aIndex ? "w-6 bg-primary" : "w-4 bg-white/10"
                  )}
                />
              ))}
            </div>
          </div>
        )}

        {/* LEVEL QUESTIONS */}
        {phase === "level" && (
          <div className="space-y-6">
            <ProgressBar current={ARCHETYPE_QUESTIONS.length + lIndex + 1} total={totalSteps} />
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                Вопрос {ARCHETYPE_QUESTIONS.length + lIndex + 1} / {totalSteps} · Тактика
              </div>
              <div className="text-xs text-muted-foreground/40">Раздел 2 из 2</div>
            </div>
            <h2 className="text-xl font-serif leading-snug">
              {LEVEL_QUESTIONS[lIndex].text}
            </h2>
            {!showHint ? (
              <div className="flex gap-3">
                <button
                  onClick={() => handleLevel(true)}
                  className="flex-1 py-5 rounded-xl border border-green-500/30 bg-green-500/5 hover:bg-green-500/15 text-green-400 font-semibold text-lg transition-all active:scale-[0.99]"
                >
                  ✅ Да
                </button>
                <button
                  onClick={() => handleLevel(false)}
                  className="flex-1 py-5 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 text-red-400 font-semibold text-lg transition-all active:scale-[0.99]"
                >
                  ❌ Нет
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={cn(
                  "px-4 py-3 rounded-xl border text-sm",
                  lastAnswer === LEVEL_QUESTIONS[lIndex].correctAnswer
                    ? "border-green-500/30 bg-green-500/10 text-green-300"
                    : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                )}>
                  {lastAnswer === LEVEL_QUESTIONS[lIndex].correctAnswer
                    ? "✅ Верно! Терпение — ключ в падел."
                    : "💡 В падел торопливый удар — чаще ошибка, чем решение."}
                </div>
                <p className="text-sm text-muted-foreground">{LEVEL_QUESTIONS[lIndex].hintAfterAnswer}</p>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50"
                  rows={3}
                  placeholder="Необязательно, но интересно..."
                  value={lq1text}
                  onChange={(e) => setLq1text(e.target.value)}
                />
                <Button className="w-full" onClick={() => advanceLevel()}>
                  Продолжить →
                </Button>
              </div>
            )}
          </div>
        )}

        {/* RESULT */}
        {phase === "result" && (
          <div className="space-y-5">

            {/* Archetype banner */}
            <div className={cn(
              "rounded-2xl border p-5 text-center",
              archetypeMeta.bg, archetypeMeta.border
            )}>
              <div className="text-4xl mb-2">{archetypeMeta.icon}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Твой архетип</div>
              <div className={cn("text-xl font-serif font-semibold mb-2", archetypeMeta.color)}>
                {archetypeMeta.nameRu}
                <span className="ml-2 text-xs font-sans font-normal text-muted-foreground/60">
                  ({archetypeMeta.name})
                </span>
              </div>
              <p className="text-xs text-muted-foreground/80 leading-relaxed mb-3">{archetypeMeta.desc}</p>
              <div className={cn(
                "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border",
                warmUp
                  ? "text-orange-300 bg-orange-500/10 border-orange-500/20"
                  : "text-slate-400 bg-slate-500/10 border-slate-500/20"
              )}>
                {warmUp ? "🔥 Предпочитает разминку перед игрой" : "⚡ Прыгает сразу в игру"}
              </div>
            </div>

            {/* Level row */}
            <div className="bg-white/5 rounded-2xl border border-white/8 p-5 flex items-center gap-4">
              <div className="text-center flex-shrink-0">
                <div className={cn(
                  "inline-flex items-center justify-center w-16 h-16 rounded-full border text-2xl font-mono font-bold",
                  levelMeta.bg, levelMeta.border, levelMeta.color
                )}>
                  {finalLevel}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground mb-0.5">Тактический уровень</div>
                <div className={cn("font-serif text-lg", levelMeta.color)}>{levelMeta.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {score} из {LEVEL_QUESTIONS.length} тактических ответов верно
                </div>
              </div>
            </div>

            {/* Honest note */}
            {rawLevel !== finalLevel && (
              <div className="bg-yellow-500/8 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-200 leading-relaxed">
                Изначально уровень <strong className="text-yellow-300">{rawLevel}</strong>, но мы снизили на ступень — 80% игроков переоценивают себя.
              </div>
            )}

            {/* Growth areas */}
            {wrongTopics.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Зоны роста</div>
                <div className="flex flex-wrap gap-2">
                  {wrongTopics.map((t) => (
                    <span key={t} className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Question breakdown */}
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Разбор по вопросам</div>
              <div className="space-y-1.5">
                {LEVEL_QUESTIONS.map((q) => {
                  const given = levelAnswers[q.id];
                  const correct = given === q.correctAnswer;
                  return (
                    <div key={q.id} className={cn(
                      "flex items-start gap-3 px-3 py-2.5 rounded-lg text-xs",
                      correct ? "bg-green-500/5 border border-green-500/15" : "bg-red-500/5 border border-red-500/15"
                    )}>
                      <span className="mt-0.5 flex-shrink-0">{correct ? "✅" : "❌"}</span>
                      <span className={correct ? "text-muted-foreground" : "text-foreground"}>{q.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Saved note */}
            {saved && user && (
              <div className="text-center text-xs text-green-400/80 bg-green-500/5 border border-green-500/15 rounded-xl p-3">
                ✓ Архетип сохранён в профиле — используется при подборе партнёров
              </div>
            )}
            {!user && (
              <div className="text-center text-xs text-muted-foreground bg-white/5 border border-white/8 rounded-xl p-3">
                Войди в аккаунт, чтобы сохранить архетип и найти партнёров
              </div>
            )}

            {/* CTAs */}
            <div className="space-y-3 pt-1">
              <Button size="lg" className="w-full shadow-lg shadow-primary/20" onClick={() => navigate("/match-requests")}>
                Найти партнёра по архетипу →
              </Button>
              <Button variant="outline" size="lg" className="w-full border-white/10" onClick={() => navigate("/dashboard")}>
                На главную
              </Button>
              <button
                onClick={handleRestart}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Пройти снова
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
