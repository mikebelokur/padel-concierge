import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

interface Question {
  text: string;
  options: { label: string; points: number }[];
}

const QUESTIONS: Question[] = [
  {
    text: "How long have you been playing padel?",
    options: [
      { label: "Less than 6 months", points: 0 },
      { label: "6–12 months", points: 1 },
      { label: "1–3 years", points: 2 },
      { label: "3–5 years", points: 3 },
      { label: "5+ years", points: 4 },
    ],
  },
  {
    text: "How often do you play per week?",
    options: [
      { label: "Less than once a week", points: 0 },
      { label: "Once a week", points: 1 },
      { label: "2–3 times a week", points: 2 },
      { label: "4–5 times a week", points: 3 },
      { label: "Daily or more", points: 4 },
    ],
  },
  {
    text: "Have you participated in padel tournaments?",
    options: [
      { label: "Never", points: 0 },
      { label: "Local / club tournaments", points: 1 },
      { label: "Regional competitions", points: 2 },
      { label: "National events", points: 3 },
      { label: "International / WPT events", points: 4 },
    ],
  },
  {
    text: "How consistent is your forehand drive?",
    options: [
      { label: "I'm still learning it", points: 0 },
      { label: "I can do it but it's inconsistent", points: 1 },
      { label: "Reliable in normal rallies", points: 2 },
      { label: "Controlled with power & direction", points: 3 },
    ],
  },
  {
    text: "How confident are you with your backhand?",
    options: [
      { label: "Very uncomfortable", points: 0 },
      { label: "Basic slice only", points: 1 },
      { label: "Consistent slice and drive", points: 2 },
      { label: "Advanced — slice, drive, and counter", points: 3 },
    ],
  },
  {
    text: "Rate your net volley control:",
    options: [
      { label: "I avoid the net", points: 0 },
      { label: "Comfortable with basic volleys", points: 1 },
      { label: "Good volley placement", points: 2 },
      { label: "Aggressive, precise volleys under pressure", points: 3 },
    ],
  },
  {
    text: "Can you execute a bandeja?",
    options: [
      { label: "What is a bandeja?", points: 0 },
      { label: "I know it but can't execute it yet", points: 1 },
      { label: "Yes, in open situations", points: 2 },
      { label: "Yes, reliably under pressure", points: 3 },
    ],
  },
  {
    text: "How do you handle pressure in close matches?",
    options: [
      { label: "I fall apart under pressure", points: 0 },
      { label: "I get nervous but manage", points: 1 },
      { label: "I stay composed most of the time", points: 2 },
      { label: "I raise my level under pressure", points: 3 },
    ],
  },
  {
    text: "How would you describe your tactical understanding?",
    options: [
      { label: "I just try to return the ball", points: 0 },
      { label: "Basic patterns (cross, lob)", points: 1 },
      { label: "I use positions and patterns intentionally", points: 2 },
      { label: "Deep tactical game — control the point structure", points: 3 },
    ],
  },
  {
    text: "What is your strongest aspect of the game?",
    options: [
      { label: "I don't have a clear strength yet", points: 0 },
      { label: "Defense — I keep the ball in play", points: 1 },
      { label: "One specific shot (serve, volley, etc.)", points: 2 },
      { label: "All-round — comfortable in all areas", points: 3 },
    ],
  },
];

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

function levelDescription(level: string) {
  const descriptions: Record<string, { label: string; desc: string }> = {
    "1.0": { label: "Newcomer", desc: "You're just starting your padel journey. Focus on fundamentals." },
    "1.5": { label: "Beginner", desc: "You have basic shots. Consistency will come with regular practice." },
    "2.0": { label: "Novice", desc: "You're building your game. Work on positioning and net play." },
    "2.5": { label: "Developing", desc: "Good fundamentals. Start developing tactical patterns." },
    "3.0": { label: "Intermediate", desc: "Solid all-round game. Focus on pressure situations and advanced shots." },
    "3.5": { label: "Upper Intermediate", desc: "Strong player with good tactical awareness. Push toward competitive play." },
    "4.0": { label: "Advanced", desc: "Excellent player ready for serious competition." },
    "4.5": { label: "Elite Amateur", desc: "Near-professional level. You dominate most amateur games." },
    "5.0": { label: "Professional", desc: "Professional or near-professional standard. Exceptional all-round game." },
  };
  return descriptions[level] ?? { label: "Player", desc: "" };
}

export default function Assessment() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: (data: { userId: number; answers: number[]; score: number }) =>
      apiFetch("/assessments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Assessment saved!", description: "Your WPT level has been updated." });
      setTimeout(() => setLocation("/dashboard"), 2500);
    },
    onError: (e: Error) =>
      toast({ title: "Could not save", description: e.message, variant: "destructive" }),
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
        <div className="p-8 max-w-2xl mx-auto">
          <div className="text-center space-y-6 py-12">
            <div className="inline-block">
              <div className="w-28 h-28 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto">
                <div className="font-serif text-3xl text-primary">{result}</div>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm mb-2 tracking-widest uppercase">Your WPT Level</div>
              <h1 className="text-4xl font-serif mb-3">{label}</h1>
              <p className="text-muted-foreground max-w-sm mx-auto">{desc}</p>
            </div>
            <Badge className="bg-accent/20 text-accent border-accent/30 text-sm px-4 py-1.5">
              WPT {result} — Assessment Complete
            </Badge>
            <div className="text-sm text-muted-foreground">
              {submitMutation.isPending ? "Saving your level..." : "Your profile has been updated. Redirecting to dashboard..."}
            </div>
            <Button onClick={() => setLocation("/dashboard")} className="shadow-lg shadow-primary/20">
              Go to Dashboard
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const q = QUESTIONS[step];
  const progress = ((step) / QUESTIONS.length) * 100;

  return (
    <AppLayout>
      <div className="p-8 max-w-2xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-serif mb-2">Skill Assessment</h1>
          <p className="text-muted-foreground">Answer 10 questions to calculate your official WPT level.</p>
        </header>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Question {step + 1} of {QUESTIONS.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <Card className="bg-card border-white/5">
          <CardContent className="p-8 space-y-6">
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
                <Button
                  variant="outline"
                  className="border-white/10 text-muted-foreground"
                  onClick={handleBack}
                >
                  Back
                </Button>
              )}
              <Button
                className="flex-1 shadow-lg shadow-primary/20"
                disabled={selected === null}
                onClick={handleNext}
              >
                {step === QUESTIONS.length - 1 ? "See My Level" : "Next Question"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Your level can be verified and adjusted by a certified coach after your first match.
        </p>
      </div>
    </AppLayout>
  );
}
