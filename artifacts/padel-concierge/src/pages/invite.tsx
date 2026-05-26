import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface InviteInfo {
  name: string;
  email: string;
  memberNumber: number;
  badge: string | null;
  inviteStatus: string;
  expiresAt: string | null;
}

export default function Invite() {
  const [, params] = useRoute("/invite/:token");
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const { language } = useLanguage();
  const ru = language === "ru";

  const token = params?.token ?? "";
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<InviteInfo>(`/invite/${token}`)
      .then(setInfo)
      .catch((e: any) => setError(e?.message ?? (ru ? "Ссылка недействительна или истекла" : "Invite invalid or expired")));
  }, [token, ru]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(ru ? "Пароль не короче 8 символов" : "Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError(ru ? "Пароли не совпадают" : "Passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiFetch<{ token: string; user: any }>(`/invite/${token}/accept`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      login(result.token, result.user);
      navigate("/dashboard");
    } catch (e: any) {
      setError(e?.message ?? (ru ? "Не удалось активировать" : "Failed to activate"));
      setSubmitting(false);
    }
  }

  if (error && !info) {
    return (
      <div style={{ minHeight: "100vh", background: "#080c14" }} className="flex items-center justify-center px-5">
        <div className="max-w-sm w-full text-center rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎾</div>
          <h1 className="font-serif text-white mb-2" style={{ fontSize: 22 }}>
            {ru ? "Приглашение недействительно" : "Invite not valid"}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">{error}</p>
          <a href="/login" className="inline-block rounded-full px-5 py-2.5 font-semibold text-sm" style={{ background: "#D4AF37", color: "#000" }}>
            {ru ? "Войти" : "Sign in"}
          </a>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div style={{ minHeight: "100vh", background: "#080c14" }} className="flex items-center justify-center text-muted-foreground">
        {ru ? "Загрузка…" : "Loading…"}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080c14" }} className="flex items-center justify-center px-5 py-10">
      <div className="max-w-sm w-full rounded-2xl p-7" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.20)" }}>
        <div className="text-center mb-6">
          <div style={{ fontSize: 38 }}>🎾</div>
          <p className="text-xs font-mono mt-2" style={{ color: "#D4AF37", letterSpacing: "0.15em" }}>
            PADEL CONCIERGE · DUBAI
          </p>
          <h1 className="font-serif text-white mt-3" style={{ fontSize: 24 }}>
            {ru ? `Добро пожаловать, ${info.name}` : `Welcome, ${info.name}`}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {ru
              ? `Вы — участник №${info.memberNumber}. Задайте пароль, чтобы войти.`
              : `You're member #${info.memberNumber}. Set a password to sign in.`}
          </p>
        </div>

        <form onSubmit={handleAccept} className="flex flex-col gap-3">
          <label className="text-xs text-muted-foreground">{info.email}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={ru ? "Пароль (мин. 8 символов)" : "Password (min. 8 chars)"}
            className="rounded-xl px-3.5 py-2.5 text-sm bg-transparent text-white placeholder:text-muted-foreground outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
            autoComplete="new-password"
            required
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={ru ? "Повторите пароль" : "Confirm password"}
            className="rounded-xl px-3.5 py-2.5 text-sm bg-transparent text-white placeholder:text-muted-foreground outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
            autoComplete="new-password"
            required
          />
          {error && <div className="text-xs text-red-400">{error}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full px-5 py-3 font-semibold text-sm mt-1 disabled:opacity-50"
            style={{ background: "#D4AF37", color: "#000" }}
          >
            {submitting ? (ru ? "Активация…" : "Activating…") : (ru ? "Активировать аккаунт" : "Activate account")}
          </button>
        </form>
      </div>
    </div>
  );
}
