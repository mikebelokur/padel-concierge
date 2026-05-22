import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card className="w-full max-w-md bg-card border-white/5">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-serif">{t("resetPassword.title")}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("resetPassword.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <Button type="submit" className="w-full mt-2" disabled={loading}>
                {loading ? t("resetPassword.updating") : t("resetPassword.updateButton")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
