import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

interface Question {
  text: string;
  options: { label: string; points: number }[];
}

const LEVEL_KEYS: Record<string, string> = {
  "1.0": "lv10", "1.5": "lv15", "2.0": "lv20", "2.5": "lv25",
  "3.0": "lv30", "3.5": "lv35", "4.0": "lv40", "4.5": "lv45", "5.0": "lv50",
};

function scoreToLevel(score: number): string {
  if (score <= 4) return "1.0";
  if (score <= 8) return "1.5";
  if (score <= 12) return "2.0";
  if (score <= 16) return "2.5";
  if (score <= 20) return "3.0";
  if (score <= 24) return "3.5";
  if (score <= 28) return "4.0";
  if (score <= 32) return "4.5";
  return "5.0";
}

export default function Assessment() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const QUESTIONS: Question[] = [
    {
      text: t("assessment.q1.text"),
      options: [
        { label: t("assessment.q1.opt0"), points: 0 },
        { label: t("assessment.q1.opt1"), points: 1 },
        { label: t("assessment.q1.opt2"), points: 2 },
        { label: t("assessment.q1.opt3"), points: 3 },
        { label: t("assessment.q1.opt4"), points: 4 },
      ],
    },
    {
      text: t("assessment.q2.text"),
      options: [
        { label: t("assessment.q2.opt0"), points: 0 },
        { label: t("assessment.q2.opt1"), points: 1 },
        { label: t("assessment.q2.opt2"), points: 2 },
        { label: t("assessment.q2.opt3"), points: 3 },
        { label: t("assessment.q2.opt4"), points: 4 },
      ],
    },
    {
      text: t("assessment.q3.text"),
      options: [
        { label: t("assessment.q3.opt0"), points: 0 },
        { label: t("assessment.q3.opt1"), points: 1 },
        { label: t("assessment.q3.opt2"), points: 2 },
        { label: t("assessment.q3.opt3"), points: 3 },
        { label: t("assessment.q3.opt4"), points: 4 },
      ],
    },
    {
      text: t("assessment.q4.text"),
      options: [
        { label: t("assessment.q4.opt0"), points: 0 },
        { label: t("assessment.q4.opt1"), points: 1 },
        { label: t("assessment.q4.opt2"), points: 2 },
        { label: t("assessment.q4.opt3"), points: 3 },
      ],
    },
    {
      text: t("assessment.q5.text"),
      options: [
        { label: t("assessment.q5.opt0"), points: 0 },
        { label: t("assessment.q5.opt1"), points: 1 },
        { label: t("assessment.q5.opt2"), points: 2 },
        { label: t("assessment.q5.opt3"), points: 3 },
      ],
    },
    {
      text: t("assessment.q6.text"),
      options: [
        { label: t("assessment.q6.opt0"), points: 0 },
        { label: t("assessment.q6.opt1"), points: 1 },
        { label: t("assessment.q6.opt2"), points: 2 },
        { label: t("assessment.q6.opt3"), points: 3 },
      ],
    },
    {
      text: t("assessment.q7.text"),
      options: [
        { label: t("assessment.q7.opt0"), points: 0 },
        { label: t("assessment.q7.opt1"), points: 1 },
        { label: t("assessment.q7.opt2"), points: 2 },
        { label: t("assessment.q7.opt3"), points: 3 },
      ],
    },
    {
      text: t("assessment.q8.text"),
      options: [
        { label: t("assessment.q8.opt0"), points: 0 },
        { label: t("assessment.q8.opt1"), points: 1 },
        { label: t("assessment.q8.opt2"), points: 2 },
        { label: t("assessment.q8.opt3"), points: 3 },
      ],
    },
    {
      text: t("assessment.q9.text"),
      options: [
        { label: t("assessment.q9.opt0"), points: 0 },
        { label: t("assessment.q9.opt1"), points: 1 },
        { label: t("assessment.q9.opt2"), points: 2 },
        { label: t("assessment.q9.opt3"), points: 3 },
      ],
    },
    {
      text: t("assessment.q10.text"),
      options: [
        { label: t("assessment.q10.opt0"), points: 0 },
        { label: t("assessment.q10.opt1"), points: 1 },
        { label: t("assessment.q10.opt2"), points: 2 },
        { label: t("assessment.q10.opt3"), points: 3 },
      ],
    },
  ];

  function levelDescription(level: string) {
    const key = LEVEL_KEYS[level] ?? "lv10";
    return {
      label: t(`assessment.levelLabels.${key}`),
      desc: t(`assessment.levelDescs.${key}`),
    };
  }

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: (data: { userId: number; answers: number[]; score: number }) =>
      apiFetch("/assessments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: t("assessment.toastTitle"), description: t("assessment.toastDesc") });
      setTimeout(() => setLocation("/dashboard"), 2500);
    },
    onError: (e: Error) =>
      toast({ title: t("assessment.toastError"), description: e.message, variant: "destructive" }),
  });

  const handleNext = () => {
    if (selected === null) return;
    const newAnswers = [...answers, selected];
    if (step < QUESTIONS.length - 1) {
      setAnswers(newAnswers);
      setStep((s) => s + 1);
      setSelected(null);
    } else {
      const score = newAnswers.reduce((s, a) => s + a, 0);
      const computedLevel = scoreToLevel(score);
      setResult(computedLevel);
      if (user?.id) {
        submitMutation.mutate({ userId: user.id, answers: newAnswers, score });
      }
    }
  };

  const handleBack = () => {
    if (step === 0) return;
    const prev = [...answers];
    prev.pop();
    setAnswers(prev);
    setStep((s) => s - 1);
    setSelected(null);
  };

  if (result) {
    const { label, desc } = levelDescription(result);
    return (
      <AppLayout>
        <div className="p-4 sm:p-8 max-w-2xl mx-auto">
          <div className="text-center space-y-6 py-8 sm:py-12">
            <div className="inline-block">
              <div className="w-28 h-28 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto">
                <div className="font-serif text-3xl text-primary">{result}</div>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm mb-2 tracking-widest uppercase">
                {t("assessment.resultWptLevel")}
              </div>
              <h1 className="text-4xl font-serif mb-3">{label}</h1>
              <p className="text-muted-foreground max-w-sm mx-auto">{desc}</p>
            </div>
            <span
              className="inline-flex items-center px-4 py-1.5 rounded-full border text-sm"
              style={{ background: "rgba(0,212,255,0.1)", borderColor: "rgba(0,212,255,0.25)", color: "#00d4ff" }}
            >
              {t("assessment.resultComplete", { level: result })}
            </span>
            <div className="text-sm text-muted-foreground">
              {submitMutation.isPending ? t("assessment.saving") : t("assessment.saved")}
            </div>
            <button
              onClick={() => setLocation("/dashboard")}
              className="inline-flex items-center justify-center rounded-xl bg-primary text-black font-semibold px-6 h-11 text-sm transition-all hover:bg-primary/90 shadow-lg shadow-primary/20"
            >
              {t("assessment.goToDashboard")}
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const q = QUESTIONS[step];
  const progress = (step / QUESTIONS.length) * 100;

  return (
    <AppLayout>
      <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-5 sm:space-y-8">
        <header>
          <h1 className="text-3xl font-serif mb-2">{t("assessment.title")}</h1>
          <p className="text-muted-foreground">{t("assessment.subtitle")}</p>
        </header>

        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("assessment.questionOf", { current: step + 1, total: QUESTIONS.length })}</span>
            <span>{t("assessment.percentComplete", { percent: Math.round(progress) })}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-[20px] bg-card border border-white/5">
          <div className="p-8 space-y-6">
            <h2 className="text-xl font-serif leading-relaxed">{q.text}</h2>
            <div className="space-y-3">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setSelected(opt.points)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selected === opt.points
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-white/8 bg-background/50 text-foreground/80 hover:border-white/20 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${
                        selected === opt.points ? "border-primary bg-primary" : "border-white/20"
                      }`}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              {step > 0 && (
                <button
                  onClick={handleBack}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-transparent font-medium text-muted-foreground px-4 h-11 text-sm transition-all hover:bg-white/5 hover:text-foreground"
                >
                  {t("assessment.back")}
                </button>
              )}
              <button
                className="flex-1 inline-flex items-center justify-center rounded-xl bg-primary text-black font-semibold h-11 text-sm transition-all hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={selected === null}
                onClick={handleNext}
              >
                {step === QUESTIONS.length - 1 ? t("assessment.seeMyLevel") : t("assessment.nextQuestion")}
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {t("assessment.disclaimer")}
        </p>
      </div>
    </AppLayout>
  );
}
