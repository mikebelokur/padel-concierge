import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tok = params.get("token");
    if (tok) setToken(tok);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: t("resetPassword.passwordsMismatch"), variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: t("resetPassword.passwordTooShort"), variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
      setTimeout(() => setLocation("/login"), 2500);
    } catch (err: any) {
      toast({
        title: t("resetPassword.resetFailed"),
        description: err.message || t("resetPassword.tokenExpired"),
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
          <h1 className="text-3xl font-serif">{t("resetPassword.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("resetPassword.subtitle")}</p>
        </div>
        <div className="px-6 pb-6">
          {done ? (
            <div className="text-center space-y-4 py-4">
              <div className="text-4xl">✅</div>
              <p className="text-sm text-muted-foreground">{t("resetPassword.successText")}</p>
            </div>
          ) : !token ? (
            <div className="text-center py-4 text-sm text-destructive">
              {t("resetPassword.invalidToken")}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t("resetPassword.newPassword")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t("resetPassword.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-background border-white/10 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">{t("resetPassword.confirmPassword")}</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder={t("resetPassword.confirmPlaceholder")}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="bg-background border-white/10 focus-visible:ring-primary"
                />
              </div>
              <button
                type="submit"
                className="w-full mt-2 inline-flex items-center justify-center rounded-xl bg-primary text-black font-semibold h-11 text-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? t("resetPassword.updating") : t("resetPassword.updateButton")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
