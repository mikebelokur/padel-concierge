import { useState } from "react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiFetch<{ message: string; devResetUrl?: string }>(
        "/auth/forgot-password",
        { method: "POST", body: JSON.stringify({ email }) }
      );
      setDevResetUrl(data.devResetUrl ?? null);
      setSent(true);
    } catch {
      toast({
        title: t("common.error"),
        description: t("forgotPassword.errorMsg"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-[20px] bg-card border border-white/5">
        <div className="p-6 space-y-1 text-center">
          <h1 className="text-3xl font-serif">{t("forgotPassword.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("forgotPassword.subtitle")}</p>
        </div>
        <div className="px-6 pb-6">
          {sent ? (
            <div className="text-center space-y-4 py-4">
              <div className="text-4xl">{devResetUrl ? "🔧" : "📧"}</div>

              {devResetUrl ? (
                <div className="space-y-3 text-left">
                  <p className="text-sm text-muted-foreground text-center">
                    {t("forgotPassword.devNotConfigured")}
                  </p>
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-4 space-y-2">
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
                      {t("forgotPassword.devTitle")}
                    </p>
                    <a
                      href={devResetUrl}
                      className="block text-xs text-amber-300 break-all hover:underline"
                    >
                      {devResetUrl}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {t("forgotPassword.devNote")}
                    </p>
                  </div>
                  <Link href={devResetUrl}>
                    <button className="w-full inline-flex items-center justify-center rounded-xl bg-amber-500/80 hover:bg-amber-500 text-black font-semibold h-11 text-sm transition-all">
                      {t("forgotPassword.openResetPage")}
                    </button>
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("forgotPassword.sentPrefix")}{" "}
                  <strong className="text-foreground">{email}</strong>{" "}
                  {t("forgotPassword.sentSuffix")}
                </p>
              )}

              <Link href="/login">
                <button className="w-full inline-flex items-center justify-center rounded-xl border border-white/10 bg-transparent font-medium text-foreground h-11 text-sm transition-all hover:bg-white/5">
                  {t("forgotPassword.backToLogin")}
                </button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("forgotPassword.emailLabel")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background border-white/10 focus-visible:ring-primary"
                />
              </div>
              <button
                type="submit"
                className="w-full mt-2 inline-flex items-center justify-center rounded-xl bg-primary text-black font-semibold h-11 text-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? t("forgotPassword.sending") : t("forgotPassword.sendButton")}
              </button>
              <div className="text-center">
                <Link href="/login">
                  <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                    {t("forgotPassword.backToLogin")}
                  </span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
