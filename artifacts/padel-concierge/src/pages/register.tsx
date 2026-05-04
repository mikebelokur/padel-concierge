import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
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

const GOALS = ["Play", "Compete", "Improve", "Fitness"];
const INTENSITIES = ["Casual", "Active-Dynamic", "Competitive", "Professional"];

export default function Register() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { login: authLogin } = useAuth();
  const { toast } = useToast();

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
        toast({ title: "Welcome to Padel Concierge!", description: "Take the skill assessment to get your official WPT level." });
        setLocation("/assessment");
      },
      onError: (err: any) =>
        toast({ title: "Registration failed", description: err?.message ?? "Please try again", variant: "destructive" }),
    },
  });

  const handleSubmit = () => {
    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    const { confirmPassword, ...rest } = formData;
    registerMutation.mutate({ data: { ...rest, phone: rest.phone || "N/A" } });
  };

  const steps = [
    { label: "Account" },
    { label: "Profile" },
    { label: "Location" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md bg-card border-white/5">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-serif">Join Padel Concierge</CardTitle>
          <CardDescription className="text-muted-foreground">The private members club for serious padel players.</CardDescription>
          {/* Step Indicators */}
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
                <Label>Full Name</Label>
                <Input
                  placeholder="Alexei Petrov"
                  value={formData.name}
                  onChange={(e) => update("name", e.target.value)}
                  className="bg-background border-white/10 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="bg-background border-white/10 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone (optional)</Label>
                <Input
                  placeholder="+971 50 000 0000"
                  value={formData.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  className="bg-background border-white/10 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => update("password", e.target.value)}
                  className="bg-background border-white/10 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
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
                Continue
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already a member?{" "}
                <Link href="/login">
                  <span className="text-primary hover:underline cursor-pointer">Sign in</span>
                </Link>
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Self-Assessed WPT Level</Label>
                <p className="text-xs text-muted-foreground">Don't worry — you'll take an official assessment after joining.</p>
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
                <Label>Primary Goal</Label>
                <div className="grid grid-cols-2 gap-2">
                  {GOALS.map((g) => (
                    <button
                      key={g}
                      onClick={() => update("goal", g)}
                      className={`p-2.5 rounded-md border text-sm transition-colors ${
                        formData.goal === g
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-white/10 text-muted-foreground hover:border-white/20"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Play Intensity</Label>
                <div className="grid grid-cols-2 gap-2">
                  {INTENSITIES.map((i) => (
                    <button
                      key={i}
                      onClick={() => update("intensity", i)}
                      className={`p-2.5 rounded-md border text-sm transition-colors ${
                        formData.intensity === i
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-white/10 text-muted-foreground hover:border-white/20"
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" className="border-white/10" onClick={() => setStep(1)}>Back</Button>
                <Button className="flex-1" onClick={() => setStep(3)}>Continue</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>City / Area</Label>
                <Input
                  placeholder="Dubai Marina"
                  value={formData.locationName}
                  onChange={(e) => update("locationName", e.target.value)}
                  className="bg-background border-white/10 focus-visible:ring-primary"
                />
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="text-sm font-medium mb-1">Almost there!</div>
                <div className="text-xs text-muted-foreground">
                  After joining, you'll complete a 10-question skill assessment to receive your official WPT level badge.
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" className="border-white/10" onClick={() => setStep(2)}>Back</Button>
                <Button
                  className="flex-1 shadow-lg shadow-primary/20"
                  onClick={handleSubmit}
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? "Creating account..." : "Create Account"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
