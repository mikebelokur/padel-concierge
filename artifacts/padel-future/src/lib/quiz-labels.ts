import { Q1_OPTIONS, Q2_OPTIONS, Q3_OPTIONS, LEVEL_QUESTIONS, CORRECT } from "./quiz";

export interface QuizQuestionMeta {
  key: string;
  label: string;
  text: string;
  type: "choice" | "yesno";
  options?: string[];
  correctAnswer?: "yes" | "no";
}

export const QUIZ_QUESTIONS: QuizQuestionMeta[] = [
  {
    key: "q1",
    label: "Бэкграунд",
    text: "Как ты пришёл(а) в падел?",
    type: "choice",
    options: Q1_OPTIONS,
  },
  {
    key: "q2",
    label: "Мотивация",
    text: "Что для тебя важнее всего в игре?",
    type: "choice",
    options: Q2_OPTIONS,
  },
  {
    key: "q3",
    label: "Стиль",
    text: "Какой формат тебе ближе всего?",
    type: "choice",
    options: Q3_OPTIONS,
  },
  ...LEVEL_QUESTIONS.map((q) => ({
    key: q.key,
    label: q.label,
    text: q.text,
    type: "yesno" as const,
    correctAnswer: CORRECT[q.key],
  })),
];

export function getAnswerLabel(q: QuizQuestionMeta, raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return "—";
  if (q.type === "choice" && q.options) {
    const idx = typeof raw === "number" ? raw : parseInt(String(raw), 10);
    return isNaN(idx) ? String(raw) : (q.options[idx] ?? String(raw));
  }
  if (q.type === "yesno") {
    return raw === "yes" ? "Да" : raw === "no" ? "Нет" : String(raw);
  }
  return String(raw);
}

export function isCorrectAnswer(q: QuizQuestionMeta, raw: string | number | null | undefined): boolean | null {
  if (q.type !== "yesno" || !q.correctAnswer) return null;
  if (raw === null || raw === undefined) return null;
  return raw === q.correctAnswer;
}
