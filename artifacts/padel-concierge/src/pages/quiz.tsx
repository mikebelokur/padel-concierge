import { useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ──────────────────────────────────────────── */
/*  QUIZ DATA                                   */
/* ──────────────────────────────────────────── */

const PERSONALITY_QUESTIONS = [
  {
    id: "q1",
    text: "Почему ты начал(а) играть в падел?",
    options: [
      { id: "friends",  label: "Друзья позвали" },
      { id: "insta",    label: "Instagram / Соцсети" },
      { id: "sport",    label: "Хотел(а) активный спорт" },
      { id: "tennis",   label: "Теннисный бэкграунд" },
      { id: "other",    label: "Другое" },
    ],
  },
  {
    id: "q2",
    text: "Что для тебя важнее на корте?",
    options: [
      { id: "win",      label: "Выиграть" },
      { id: "fun",      label: "Хорошо провести время" },
      { id: "improve",  label: "Улучшить игру" },
      { id: "social",   label: "Найти компанию" },
    ],
  },
  {
    id: "q3",
    text: "Как выглядит твоя идеальная игра?",
    options: [
      { id: "intense",  label: "Интенсивный матч на результат" },
      { id: "casual",   label: "Спокойно с друзьями" },
      { id: "coached",  label: "С тренером / с разбором" },
      { id: "any",      label: "Любая игра — главное играть" },
    ],
  },
];

interface LevelQ {
  id: string;
  text: string;
  correctAnswer: boolean;
  wrongExplanation: string;
  hintAfterAnswer?: string;  // only for Q4
}

const LEVEL_QUESTIONS: LevelQ[] = [
  {
    id: "q4",
    text: "Лучше подождать нужный момент и только потом бить — даже если это значит пропустить несколько мячей?",
    correctAnswer: true,
    wrongExplanation: "терпение и выбор момента",
    hintAfterAnswer: "Расскажи, когда ты обычно торопишься с ударом?",
  },
  {
    id: "q5",
    text: "После удара по стеклу — нужно сразу занять позицию у сетки?",
    correctAnswer: true,
    wrongExplanation: "позицию после стекла",
  },
  {
    id: "q6",
    text: "Когда партнёр ошибся — лучше сразу сказать ему что он сделал не так?",
    correctAnswer: false,
    wrongExplanation: "командную психологию",
  },
  {
    id: "q7",
    text: "Смэш изо всей силы — всегда лучший выбор, когда мяч высоко?",
    correctAnswer: false,
    wrongExplanation: "тактику смэша",
  },
  {
    id: "q8",
    text: "Три ошибки подряд — это нормально, менять всю тактику игры не стоит?",
    correctAnswer: true,
    wrongExplanation: "стабильность и ментальную устойчивость",
  },
  {
    id: "q9",
    text: "Позиция на корте важнее силы удара?",
    correctAnswer: true,
    wrongExplanation: "приоритет позиции над силой",
  },
  {
    id: "q10",
    text: "Против слабых соперников можно расслабиться и не думать о тактике?",
    correctAnswer: false,
    wrongExplanation: "концентрацию против любых соперников",
  },
];

/* ──────────────────────────────────────────── */
/*  LEVEL LOGIC                                 */
/* ──────────────────────────────────────────── */

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
  D:  { color: "text-slate-400",  bg: "bg-slate-500/10",  border: "border-slate-500/30",  title: "Начинающий" },
  "D+":{ color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", title: "Начинающий+" },
  C:  { color: "text-cyan-400",   bg: "bg-cyan-500/10",   border: "border-cyan-500/30",   title: "Любитель" },
  "C+":{ color: "text-blue-400",  bg: "bg-blue-500/10",   border: "border-blue-500/30",   title: "Уверенный игрок" },
  B:  { color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  title: "Продвинутый" },
};

/* ──────────────────────────────────────────── */
/*  STATE TYPES                                 */
/* ──────────────────────────────────────────── */

type Phase = "intro" | "personality" | "level" | "result";

interface Answers {
  personality: Record<string, string>;
  level: Record<string, boolean | null>;
  q4text?: string;
}

/* ──────────────────────────────────────────── */
/*  RESULT TEXT BUILDER                         */
/* ──────────────────────────────────────────── */

function buildResult(answers: Answers, finalLevel: Level, rawLevel: Level, wrongTopics: string[]) {
  const motivation = answers.personality["q2"];
  const style = answers.personality["q3"];

  const motivationNote =
    motivation === "win"     ? "Ты нацелен(а) на результат — это хорошо. Но без понимания тактики победы будет меньше." :
    motivation === "fun"     ? "Тебе важно удовольствие — отлично. Правильная тактика делает игру ещё приятнее." :
    motivation === "improve" ? "Ты хочешь расти — именно для таких игроков этот анализ." :
                               "Ты ищешь компанию — и правильный уровень поможет найти лучших партнёров.";

  const styleNote =
    style === "intense"  ? "Интенсивные матчи требуют грамотной позиции — без этого ты быстро выдохнешься." :
    style === "casual"   ? "Даже в casual-играх базовая тактика делает тебя более ценным партнёром." :
    style === "coached"  ? "Тренерский формат — лучшее решение. Именно там убираются эти пробелы быстрее всего." :
                           "Любая игра — хорошо. Но осознанная игра приносит прогресс.";

  const wrongList = wrongTopics.length > 0
    ? `Твои зоны роста: **${wrongTopics.join(", ")}**.`
    : "По тактическим вопросам ты показал(а) отличный результат!";

  const honestNote = rawLevel !== finalLevel
    ? `Изначально ты набрал(а) на уровень **${rawLevel}**, но мы снизили на ступень — это честнее. В падел 80% игроков переоценивают себя. Лучше прийти на ${finalLevel} и удивить всех, чем прийти на ${rawLevel} и разочаровать партнёра.`
    : `Ты набрал(а) минимальный балл — начинаем с базы. Это честный старт.`;

  return { motivationNote, styleNote, wrongList, honestNote };
}

/* ──────────────────────────────────────────── */
/*  COMPONENTS                                  */
/* ──────────────────────────────────────────── */

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

/* ──────────────────────────────────────────── */
/*  MAIN PAGE                                   */
/* ──────────────────────────────────────────── */

export default function Quiz() {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<Phase>("intro");
  const [pIndex, setPIndex] = useState(0);   // personality question index
  const [lIndex, setLIndex] = useState(0);   // level question index
  const [answers, setAnswers] = useState<Answers>({ personality: {}, level: {} });
  const [q4text, setQ4text] = useState("");
  const [showQ4Input, setShowQ4Input] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<boolean | null>(null); // for feedback flash

  const totalSteps = PERSONALITY_QUESTIONS.length + LEVEL_QUESTIONS.length;
  const currentStep = phase === "personality" ? pIndex : phase === "level" ? PERSONALITY_QUESTIONS.length + lIndex : totalSteps;

  /* ── PERSONALITY ANSWER ── */
  function handlePersonality(optionId: string) {
    const qId = PERSONALITY_QUESTIONS[pIndex].id;
    const updated = { ...answers.personality, [qId]: optionId };
    setAnswers((a) => ({ ...a, personality: updated }));
    if (pIndex < PERSONALITY_QUESTIONS.length - 1) {
      setPIndex((i) => i + 1);
    } else {
      setPhase("level");
    }
  }

  /* ── LEVEL ANSWER ── */
  function handleLevel(answer: boolean) {
    const q = LEVEL_QUESTIONS[lIndex];
    setLastAnswer(answer);

    const updated = { ...answers.level, [q.id]: answer };
    setAnswers((a) => ({ ...a, level: updated }));

    if (q.hintAfterAnswer) {
      setShowQ4Input(true);
      return;
    }
    advanceLevel(updated);
  }

  function advanceLevel(levelAnswers?: Record<string, boolean | null>) {
    const la = levelAnswers ?? answers.level;
    setShowQ4Input(false);
    setLastAnswer(null);
    if (lIndex < LEVEL_QUESTIONS.length - 1) {
      setLIndex((i) => i + 1);
    } else {
      setAnswers((a) => ({ ...a, level: la, q4text }));
      setPhase("result");
    }
  }

  /* ── CALC RESULT ── */
  const score = LEVEL_QUESTIONS.filter(
    (q) => answers.level[q.id] === q.correctAnswer
  ).length;

  const wrongTopics = LEVEL_QUESTIONS
    .filter((q) => answers.level[q.id] !== q.correctAnswer && answers.level[q.id] !== undefined)
    .map((q) => q.wrongExplanation);

  const rawLevel = calcRawLevel(score);
  const finalLevel = downgrade(rawLevel);
  const levelMeta = LEVEL_LABELS[finalLevel];
  const resultText = buildResult(answers, finalLevel, rawLevel, wrongTopics);

  /* ──────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* ── INTRO ── */}
        {phase === "intro" && (
          <div className="text-center space-y-6">
            <div className="text-6xl mb-4">🎾</div>
            <h1 className="text-3xl font-serif">Узнай свой уровень в падел</h1>
            <p className="text-muted-foreground leading-relaxed">
              10 вопросов — 3 минуты. Честный ответ о твоём уровне игры с объяснением зон роста.
            </p>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-300 text-left">
              ⚠️ Мы намеренно занижаем результат на одну ступень. Это честнее — 80% игроков переоценивают себя в падел.
            </div>
            <Button
              size="lg"
              className="w-full mt-2 text-base"
              onClick={() => setPhase("personality")}
            >
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

        {/* ── PERSONALITY QUESTIONS ── */}
        {phase === "personality" && (
          <div className="space-y-6">
            <ProgressBar current={pIndex + 1} total={totalSteps} />
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Вопрос {pIndex + 1} / {totalSteps} · О тебе
            </div>
            <h2 className="text-xl font-serif leading-snug">
              {PERSONALITY_QUESTIONS[pIndex].text}
            </h2>
            <div className="space-y-3">
              {PERSONALITY_QUESTIONS[pIndex].options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handlePersonality(opt.id)}
                  className="w-full text-left px-4 py-3.5 rounded-xl border border-white/10 bg-white/3 hover:border-primary/40 hover:bg-primary/5 transition-all text-sm font-medium"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── LEVEL QUESTIONS ── */}
        {phase === "level" && (
          <div className="space-y-6">
            <ProgressBar current={PERSONALITY_QUESTIONS.length + lIndex + 1} total={totalSteps} />
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Вопрос {PERSONALITY_QUESTIONS.length + lIndex + 1} / {totalSteps} · Тактика
            </div>
            <h2 className="text-xl font-serif leading-snug">
              {LEVEL_QUESTIONS[lIndex].text}
            </h2>

            {!showQ4Input ? (
              <div className="flex gap-3">
                <button
                  onClick={() => handleLevel(true)}
                  className="flex-1 py-4 rounded-xl border border-green-500/30 bg-green-500/5 hover:bg-green-500/15 text-green-400 font-semibold text-lg transition-all"
                >
                  ✅ Да
                </button>
                <button
                  onClick={() => handleLevel(false)}
                  className="flex-1 py-4 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 text-red-400 font-semibold text-lg transition-all"
                >
                  ❌ Нет
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Show feedback */}
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
                  value={q4text}
                  onChange={(e) => setQ4text(e.target.value)}
                />
                <Button className="w-full" onClick={() => advanceLevel()}>
                  Продолжить →
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── RESULT ── */}
        {phase === "result" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-5xl mb-4">🏆</div>
              <h2 className="text-2xl font-serif mb-2">Твой уровень</h2>
              <div className={cn(
                "inline-flex items-center gap-2 px-5 py-2.5 rounded-full border text-2xl font-mono font-bold mb-1",
                levelMeta.bg, levelMeta.border, levelMeta.color
              )}>
                {finalLevel}
              </div>
              <div className={cn("text-sm mt-1", levelMeta.color)}>{levelMeta.title}</div>
            </div>

            {/* Score */}
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <div className="text-3xl font-mono text-primary mb-1">{score} / {LEVEL_QUESTIONS.length}</div>
              <div className="text-xs text-muted-foreground">правильных тактических ответов</div>
            </div>

            {/* Honest note */}
            <div className="bg-yellow-500/8 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-200 leading-relaxed">
              {resultText.honestNote
                .split("**")
                .map((part, i) =>
                  i % 2 === 1 ? <strong key={i} className="text-yellow-300">{part}</strong> : part
                )}
            </div>

            {/* What to work on */}
            {wrongTopics.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Зоны роста</div>
                <div className="flex flex-wrap gap-2">
                  {wrongTopics.map((t) => (
                    <span key={t} className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Personality insights */}
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Про тебя</div>
              <p className="text-sm text-muted-foreground leading-relaxed">{resultText.motivationNote}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{resultText.styleNote}</p>
            </div>

            {/* Per-question breakdown */}
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Разбор по вопросам</div>
              {LEVEL_QUESTIONS.map((q) => {
                const given = answers.level[q.id];
                const correct = given === q.correctAnswer;
                return (
                  <div key={q.id} className={cn(
                    "flex items-start gap-3 px-3 py-2.5 rounded-lg text-xs",
                    correct ? "bg-green-500/5 border border-green-500/15" : "bg-red-500/5 border border-red-500/15"
                  )}>
                    <span className="mt-0.5 flex-shrink-0">{correct ? "✅" : "❌"}</span>
                    <span className={correct ? "text-muted-foreground" : "text-foreground"}>
                      {q.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            <div className="space-y-3 pt-2">
              <Button
                size="lg"
                className="w-full bg-primary text-primary-foreground"
                onClick={() => navigate("/dashboard")}
              >
                Перейти к платформе
              </Button>
              <button
                onClick={() => {
                  setPhase("intro");
                  setPIndex(0);
                  setLIndex(0);
                  setAnswers({ personality: {}, level: {} });
                  setQ4text("");
                  setShowQ4Input(false);
                  setLastAnswer(null);
                }}
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
