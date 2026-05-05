export const ARCHETYPES = [
  "competitive-improver",
  "social-enjoyer",
  "pro-ambitious",
  "balanced-competitor",
  "casual-recreational",
] as const;

export type Archetype = (typeof ARCHETYPES)[number];

export const ARCHETYPE_META: Record<Archetype, {
  name: string;
  nameRu: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  desc: string;
}> = {
  "pro-ambitious": {
    name: "Pro-Ambitious",
    nameRu: "Будущий профи",
    icon: "🚀",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    desc: "Ты нацелен(а) на профессиональный уровень. Анализируешь каждое поражение, думаешь о победе и хочешь расти до максимума.",
  },
  "competitive-improver": {
    name: "Competitive Improver",
    nameRu: "Конкурентный игрок",
    icon: "🏆",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    desc: "Ты серьёзно подходишь к игре — анализируешь, хочешь побеждать и открыт(а) к новым соперникам. Отличный партнёр для серьёзных матчей.",
  },
  "balanced-competitor": {
    name: "Balanced Competitor",
    nameRu: "Сбалансированный игрок",
    icon: "⚖️",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    desc: "Ты совмещаешь конкурентный дух с удовольствием от игры. Идеально адаптируешься к любому партнёру и любой ситуации.",
  },
  "social-enjoyer": {
    name: "Social Enjoyer",
    nameRu: "Социальный игрок",
    icon: "🤝",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    desc: "Тебе важны атмосфера и энергия на корте. Ты делаешь каждую игру приятной и создаёшь отличную командную динамику.",
  },
  "casual-recreational": {
    name: "Casual Recreational",
    nameRu: "Casual-игрок",
    icon: "😎",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    desc: "Падел — твой способ расслабиться и отдохнуть. Ты создаёшь лёгкую атмосферу на корте и наслаждаешься самим процессом.",
  },
};

export function calcArchetype(answers: Record<string, string>): Archetype {
  let score = 0;
  if (answers.aq1 === "analyze") score++;
  if (answers.aq2 === "win") score++;
  if (answers.aq3 === "push") score++;
  if (answers.aq4 === "new") score++;
  if (answers.aq5 === "pro") score++;

  const isPro = answers.aq5 === "pro";
  if (isPro && score >= 4) return "pro-ambitious";
  if (score >= 4) return "competitive-improver";
  if (score === 3) return "balanced-competitor";
  if (score >= 2) return "social-enjoyer";
  return "casual-recreational";
}

export function getWarmUpPreference(answers: Record<string, string>): boolean {
  return answers.aq6 === "warmup";
}

export function archetypeCompatibility(a: Archetype, b: Archetype): string {
  if (a === b) return "Идеальное совпадение — одинаковый стиль игры!";
  const competitive = new Set(["pro-ambitious", "competitive-improver"]);
  const social = new Set(["social-enjoyer", "casual-recreational"]);
  if (competitive.has(a) && competitive.has(b)) return "Хорошая совместимость — оба нацелены на результат";
  if (social.has(a) && social.has(b)) return "Хорошая совместимость — оба ценят атмосферу";
  if (a === "balanced-competitor" || b === "balanced-competitor") return "Универсальная совместимость";
  return "Разные стили — интересный вызов для обоих";
}
