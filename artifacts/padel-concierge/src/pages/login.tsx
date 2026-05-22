import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

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
        else setLocation("/dashboard");
      },
      onError: (err: any) => {
        toast({
          title: t("login.loginFailed"),
          description: err.message || t("login.invalidCredentials"),
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md bg-card border-white/5">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-serif">{t("login.title")}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("login.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("login.email")}</Label>
              <Input
                id="email"
                type="text"
                placeholder="player@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background border-white/10 focus-visible:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("login.password")}</Label>
                <Link href="/forgot-password">
                  <span className="text-xs text-muted-foreground hover:text-primary cursor-pointer transition-colors">
                    {t("login.forgotPassword")}
                  </span>
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background border-white/10 focus-visible:ring-primary"
              />
            </div>
            <Button
              type="submit"
              className="w-full mt-6"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? t("login.loggingIn") : t("login.loginButton")}
            </Button>
            <div className="text-center pt-2">
              <span className="text-sm text-muted-foreground">
                {t("login.notMember")}{" "}
                <Link href="/register">
                  <span className="text-primary hover:underline cursor-pointer">{t("login.joinNow")}</span>
                </Link>
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
