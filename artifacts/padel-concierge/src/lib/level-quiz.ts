export const LEVEL_ORDER = ["D-", "D", "D+", "C-", "C", "C+"] as const;
export type Level = (typeof LEVEL_ORDER)[number];

export const LEVEL_DESCRIPTIONS: Record<Level, string> = {
  "D-": "Ты только начинаешь — самый интересный момент. Всё впереди.",
  D: "Ты понимаешь базу падела. Несколько ключевых привычек — и рост будет заметным.",
  "D+": "Есть понимание, но инстинкты опережают логику. Сейчас закладывается фундамент.",
  "C-": "Хорошая база. Несколько деталей делают большую разницу.",
  C: "Ты думаешь правильно. Нужна стабильность под давлением.",
  "C+": "Сильный игрок. Главная задача — найти достойных партнёров.",
};

export const CORRECT: Record<string, "yes" | "no"> = {
  q4: "yes", q5: "yes", q6: "no", q7: "no",
  q8: "yes", q9: "yes", q10: "no",
};

export function calcQuizLevel(answers: Record<string, string>): Level {
  const keys = ["q4", "q5", "q6", "q7", "q8", "q9", "q10"];
  const correct = keys.filter((k) => answers[k] === CORRECT[k]).length;
  if (correct === 7) return "C+";
  if (correct === 6) return "C";
  if (correct === 5) return "C-";
  if (correct === 4) return "D+";
  if (correct === 3) return "D";
  return "D-";
}

export function downgradeLevel(level: Level): Level {
  const idx = LEVEL_ORDER.indexOf(level);
  return LEVEL_ORDER[Math.max(0, idx - 1)] as Level;
}


export const LEVEL_QUESTIONS = [
  { key: "q4", emoji: "⚡", label: "Удар",      text: "Когда мяч летит к тебе — лучше подождать нужный момент и только потом бить?", hasExtra: true },
  { key: "q5", emoji: "🪟", label: "Стекло",    text: "После отскока от стекла — нужно сразу занять позицию у сетки?",              hasExtra: false },
  { key: "q6", emoji: "🤝", label: "Партнёр",   text: "Когда партнёр ошибается — лучше сразу сказать ему что он сделал не так?",    hasExtra: false },
  { key: "q7", emoji: "💥", label: "Смэш",      text: "Смэш изо всей силы — всегда лучший выбор когда мяч летит высоко?",           hasExtra: false },
  { key: "q8", emoji: "🧠", label: "Голова",    text: "Три ошибки подряд — это нормально, менять всю игру из-за этого не стоит?",   hasExtra: false },
  { key: "q9", emoji: "📍", label: "Позиция",   text: "Позиция на корте важнее силы удара?",                                        hasExtra: false },
  { key: "q10", emoji: "🎭", label: "Стратегия", text: "Против слабых соперников можно расслабиться и не думать о тактике?",        hasExtra: false },
];

export function generateSessionId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
