import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { translateError } from "@/lib/errorMessages";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { login: authLogin } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        authLogin(data.token, data.user);
        if (data.user.role === "owner" || data.user.role === "admin") setLocation("/admin");
        else if (data.user.role === "coach") setLocation("/coach");
        else if (!data.user.archetype) setLocation("/assessment?reason=incomplete");
        else setLocation("/dashboard");
      },
      onError: (err: unknown) => {
        const translated = translateError(err);
        toast({
          title: t("login.loginFailed"),
          description: translated.message,
          variant: "destructive",
        });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-black px-6"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="w-full max-w-sm animate-fade-up">
        {/* Logo mark */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 mb-5">
            <span className="text-3xl">🎾</span>
          </div>
          <h1
            className="font-serif font-bold text-white mb-2"
            style={{ fontSize: "32px", lineHeight: "1.15" }}
          >
            {t("login.title")}
          </h1>
          <p className="text-muted-foreground" style={{ fontSize: "15px" }}>
            {t("login.subtitle")}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-[20px] p-6 border border-white/8"
          style={{ background: "hsl(220 20% 6%)" }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field */}
            <div>
              <label
                htmlFor="email"
                className="block text-white font-medium mb-2"
                style={{ fontSize: "15px" }}
              >
                {t("login.email")}
              </label>
              <input
                id="email"
                type="text"
                placeholder="player@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder:text-white/30 transition-all focus:border-primary/60 focus:bg-white/8 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]"
                style={{ height: "56px", fontSize: "17px" }}
              />
            </div>

            {/* Password field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="text-white font-medium"
                  style={{ fontSize: "15px" }}
                >
                  {t("login.password")}
                </label>
                <Link href="/forgot-password">
                  <span
                    className="text-primary hover:text-primary/80 cursor-pointer transition-colors"
                    style={{ fontSize: "15px" }}
                  >
                    {t("login.forgotPassword")}
                  </span>
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder:text-white/30 transition-all focus:border-primary/60 focus:bg-white/8 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]"
                style={{ height: "56px", fontSize: "17px" }}
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loginMutation.isPending || !email || !password}
              className="w-full rounded-[14px] bg-primary text-black font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{ height: "56px", fontSize: "17px" }}
            >
              {loginMutation.isPending ? t("login.loggingIn") : t("login.loginButton")}
            </button>
          </form>
        </div>

        {/* Sign up link */}
        <p className="text-center mt-6" style={{ fontSize: "15px" }}>
          <span className="text-muted-foreground">{t("login.notMember")} </span>
          <Link href="/register">
            <span className="text-primary font-medium hover:text-primary/80 cursor-pointer transition-colors">
              {t("login.joinNow")}
            </span>
          </Link>
        </p>
      </div>
    </div>
  );
}
