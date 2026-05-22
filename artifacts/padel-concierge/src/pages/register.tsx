import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const LEVELS = [
  { value: "1.0", label: "1.0 — Complete Beginner" },
  { value: "1.5", label: "1.5 — Beginner" },
  { value: "2.0", label: "2.0 — Novice" },
  { value: "2.5", label: "2.5 — Developing" },
  { value: "3.0", label: "3.0 — Intermediate" },
  { value: "3.5", label: "3.5 — Upper Intermediate" },
  { value: "4.0", label: "4.0 — Advanced" },
  { value: "4.5", label: "4.5 — Elite Amateur" },
  { value: "5.0", label: "5.0 — Professional" },
];

const GOAL_KEYS = ["Play", "Compete", "Improve", "Fitness"] as const;
const INTENSITY_KEYS = ["Casual", "Active-Dynamic", "Competitive", "Professional"] as const;

export default function Register() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { login: authLogin } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    level: "2.0",
    goal: "Play",
    intensity: "Active-Dynamic",
    locationName: "Dubai",
  });

  const update = (k: string, v: string) => setFormData((p) => ({ ...p, [k]: v }));

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        authLogin(data.token, data.user);
        toast({ title: t("register.welcomeToast"), description: t("register.welcomeToastDesc") });
        setLocation("/assessment");
      },
      onError: (err: any) =>
        toast({ title: t("register.registrationFailed"), description: err?.message ?? t("common.continue"), variant: "destructive" }),
    },
  });

  const handleSubmit = () => {
    if (formData.password !== formData.confirmPassword) {
      toast({ title: t("register.passwordsMismatch"), variant: "destructive" });
      return;
    }
    const { confirmPassword, ...rest } = formData;
    registerMutation.mutate({ data: { ...rest, phone: rest.phone || "N/A" } });
  };

  const steps = [
    { label: t("register.stepAccount") },
    { label: t("register.stepProfile") },
    { label: t("register.stepLocation") },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md bg-card border-white/5">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-serif">{t("register.title")}</CardTitle>
          <CardDescription className="text-muted-foreground">{t("register.subtitle")}</CardDescription>
          <div className="flex gap-2 pt-1">
            {steps.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    i + 1 === step
                      ? "bg-primary text-white"
                      : i + 1 < step
                      ? "bg-primary/30 text-primary"
                      : "bg-white/10 text-muted-foreground"
                  }`}
                >
                  {i + 1 < step ? "✓" : i + 1}
                </div>
                <span className={`text-xs ${i + 1 === step ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                {i < steps.length - 1 && <div className="w-6 h-px bg-white/10 ml-1" />}
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("register.fullName")}</Label>
                <Input
                  placeholder={t("register.namePlaceholder")}
                  value={formData.name}
                  onChange={(e) => update("name", e.target.value)}
                  className="bg-background border-white/10 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("register.email")}</Label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="bg-background border-white/10 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("register.phone")}</Label>
                <Input
                  placeholder="+971 50 000 0000"
                  value={formData.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  className="bg-background border-white/10 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("register.password")}</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => update("password", e.target.value)}
                  className="bg-background border-white/10 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("register.confirmPassword")}</Label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  className="bg-background border-white/10 focus-visible:ring-primary"
                />
              </div>
              <Button
                className="w-full mt-2"
                onClick={() => setStep(2)}
                disabled={!formData.name || !formData.email || !formData.password}
              >
                {t("register.continue")}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t("register.alreadyMember")}{" "}
                <Link href="/login">
                  <span className="text-primary hover:underline cursor-pointer">{t("register.signIn")}</span>
                </Link>
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("register.selfAssessedLevel")}</Label>
                <p className="text-xs text-muted-foreground">{t("register.levelNote")}</p>
                <select
                  className="w-full p-2.5 bg-background border border-white/10 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={formData.level}
                  onChange={(e) => update("level", e.target.value)}
                >
                  {LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t("register.primaryGoal")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {GOAL_KEYS.map((g) => (
                    <button
                      key={g}
                      onClick={() => update("goal", g)}
                      className={`p-2.5 rounded-md border text-sm transition-colors ${
                        formData.goal === g
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-white/10 text-muted-foreground hover:border-white/20"
                      }`}
                    >
                      {t(`register.goals.${g}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("register.playIntensity")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {INTENSITY_KEYS.map((intensity) => (
                    <button
                      key={intensity}
                      onClick={() => update("intensity", intensity)}
                      className={`p-2.5 rounded-md border text-sm transition-colors ${
                        formData.intensity === intensity
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-white/10 text-muted-foreground hover:border-white/20"
                      }`}
                    >
                      {t(`register.intensities.${intensity}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" className="border-white/10" onClick={() => setStep(1)}>{t("register.back")}</Button>
                <Button className="flex-1" onClick={() => setStep(3)}>{t("register.continue")}</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("register.cityArea")}</Label>
                <Input
                  placeholder={t("register.cityPlaceholder")}
                  value={formData.locationName}
                  onChange={(e) => update("locationName", e.target.value)}
                  className="bg-background border-white/10 focus-visible:ring-primary"
                />
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="text-sm font-medium mb-1">{t("register.almostThere")}</div>
                <div className="text-xs text-muted-foreground">{t("register.almostThereDesc")}</div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" className="border-white/10" onClick={() => setStep(2)}>{t("register.back")}</Button>
                <Button
                  className="flex-1 shadow-lg shadow-primary/20"
                  onClick={handleSubmit}
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? t("register.creatingAccount") : t("register.createAccount")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
