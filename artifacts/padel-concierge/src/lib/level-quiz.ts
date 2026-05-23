export const LEVEL_ORDER = ["D-", "D", "D+", "C-", "C", "C+"] as const;
export type Level = (typeof LEVEL_ORDER)[number];

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
  { key: "q4",  emoji: "⚡", hasExtra: true  },
  { key: "q5",  emoji: "🪟", hasExtra: false },
  { key: "q6",  emoji: "🤝", hasExtra: false },
  { key: "q7",  emoji: "💥", hasExtra: false },
  { key: "q8",  emoji: "🧠", hasExtra: false },
  { key: "q9",  emoji: "📍", hasExtra: false },
  { key: "q10", emoji: "🎭", hasExtra: false },
];

export function generateSessionId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
