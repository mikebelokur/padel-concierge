import { apiFetch } from "@/lib/api";

export async function submitLevelQuiz(data: Record<string, unknown>) {
  return apiFetch("/pf/quiz", { method: "POST", body: JSON.stringify(data) });
}

export async function getLevelQuizAdmin() {
  return apiFetch("/pf/admin");
}
