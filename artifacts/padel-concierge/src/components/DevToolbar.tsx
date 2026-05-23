import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const ROLE_COLORS: Record<string, string> = {
  owner:  "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  admin:  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  coach:  "bg-purple-500/20 text-purple-300 border-purple-500/30",
  player: "bg-green-500/20 text-green-300 border-green-500/30",
};

const QUICK_ACCOUNTS = [
  { label: "Misha",  subtitle: "owner",  icon: "👑", creds: { username: "admin",                    password: "MISHA_JR9N3UZT" } },
  { label: "Admin",  subtitle: "admin",  icon: "🔧", creds: { email: "admin@padelconcierge.com",     password: "admin123" } },
  { label: "Coach",  subtitle: "coach",  icon: "🏆", creds: { email: "coach@padelconcierge.com",     password: "coach123" } },
  { label: "Player", subtitle: "player", icon: "🎾", creds: { email: "player@padelconcierge.com",    password: "player123" } },
];

const WPT_LEVELS = ["1.0","1.5","2.0","2.5","3.0","3.5","4.0","4.5","5.0"];
const COACH_LEVELS = ["D","D+","C-","C","C+","B","B+","A"];

const QUICK_PAGES = [
  ["/dashboard", "Dashboard"],
  ["/coach", "Coach Hub"],
  ["/clients", "Clients"],
  ["/messages", "Messages"],
  ["/matches", "Matches"],
  ["/match-requests", "Requests"],
  ["/quiz", "Quiz"],
  ["/assessment", "Assessment"],
  ["/admin", "Admin Panel"],
  ["/registrations", "Registrations"],
  ["/courts", "Courts"],
  ["/members", "Members"],
  ["/video-analysis", "Video Analysis"],
  ["/news", "News"],
  ["/rules", "Rules"],
  ["/settings", "Settings"],
  ["/profile", "Profile"],
];

export function DevToolbar() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"accounts" | "pages" | "user">("accounts");
  const [switching, setSwitching] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [level, setLevel] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const { user, login, logout } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user) setLevel(user.level ?? "");
  }, [user]);

  const isAdminOrAbove = user?.role === "owner" || user?.role === "admin";
  if (!isAdminOrAbove) return null;

  function flash(msg: string) {
    setFeedback(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFeedback(null), 2000);
  }

  async function switchAccount(acct: typeof QUICK_ACCOUNTS[0]) {
    setSwitching(acct.label);
    try {
      const data = await apiFetch<{ token: string; user: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(acct.creds),
      });
      login(data.token, data.user);
      qc.clear();
      flash(`✓ Switched to ${acct.label}`);
      setLocation("/dashboard");
    } catch {
      flash(`✗ Login failed`);
    } finally {
      setSwitching(null);
    }
  }

  async function toggleVerified() {
    if (!user) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const newVerified = !user.verified;
      await apiFetch(`/admin/users/${user.id}/level`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ level: user.level ?? "C" }),
      });
      qc.invalidateQueries();
      flash(newVerified ? "✓ Verified" : "✓ Unverified");
    } catch {
      flash("✗ Failed");
    } finally {
      setSaving(false);
    }
  }

  async function setUserLevel(newLevel: string) {
    if (!user) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      await apiFetch(`/admin/users/${user.id}/level`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ level: newLevel }),
      });
      setLevel(newLevel);
      qc.invalidateQueries();
      flash(`✓ Level → ${newLevel}`);
    } catch {
      flash("✗ Failed");
    } finally {
      setSaving(false);
    }
  }

  async function resetArchetype() {
    if (!user) return;
    setSaving(true);
    try {
      await apiFetch(`/users/${user.id}/archetype`, {
        method: "POST",
        body: JSON.stringify({ archetype: null, warmUpPreference: false }),
      });
      qc.invalidateQueries();
      flash("✓ Archetype cleared");
    } catch {
      flash("✗ Failed");
    } finally {
      setSaving(false);
    }
  }

  function navigate(path: string) {
    setLocation(path);
    setOpen(false);
  }

  const isActive = (label: string) =>
    user && QUICK_ACCOUNTS.find(a => a.label === label)?.subtitle === user.role;

  return (
    <div className="fixed bottom-24 right-4 z-[9999] flex flex-col items-end gap-2 lg:bottom-4">
      {feedback && (
        <div className="bg-black/90 border border-white/10 text-green-400 text-xs px-3 py-1.5 rounded-full font-mono shadow-xl">
          {feedback}
        </div>
      )}

      {open && (
        <div className="w-72 bg-[#0a0f1a] border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-yellow-400 font-semibold tracking-wider">DEV TOOLBAR</span>
            </div>
            {user && (
              <div className={cn("text-xs px-2 py-0.5 rounded border font-mono", ROLE_COLORS[user.role] ?? "text-muted-foreground")}>
                {user.role}
              </div>
            )}
          </div>

          {user && (
            <div className="px-4 py-2.5 bg-white/2 border-b border-white/5 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-serif flex-shrink-0">
                {user.name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user.name}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {user.level} · {user.verified ? "✓ verified" : "unverified"}
                  {user.archetype && <> · {user.archetype.split("-")[0]}</>}
                </div>
              </div>
              <button
                onClick={() => { logout(); qc.clear(); setLocation("/"); flash("Logged out"); }}
                className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
              >
                out
              </button>
            </div>
          )}

          <div className="flex border-b border-white/5">
            {(["accounts", "pages", "user"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 py-2 text-xs font-mono capitalize transition-colors",
                  tab === t ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "accounts" && (
            <div className="p-3 space-y-2">
              {QUICK_ACCOUNTS.map((acct) => (
                <button
                  key={acct.label}
                  onClick={() => switchAccount(acct)}
                  disabled={!!switching}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all",
                    isActive(acct.label)
                      ? "border-primary/40 bg-primary/10"
                      : "border-white/5 bg-white/2 hover:border-white/15 hover:bg-white/5"
                  )}
                >
                  <span className="text-xl">{acct.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{acct.label}</div>
                    <div className="text-xs text-muted-foreground font-mono">{acct.subtitle}</div>
                  </div>
                  {isActive(acct.label) && (
                    <span className="text-xs text-primary font-mono">active</span>
                  )}
                  {switching === acct.label && (
                    <div className="w-3.5 h-3.5 border border-primary/40 border-t-primary rounded-full animate-spin" />
                  )}
                </button>
              ))}
            </div>
          )}

          {tab === "pages" && (
            <div className="p-3 max-h-72 overflow-y-auto">
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_PAGES.map(([path, label]) => (
                  <button
                    key={path}
                    onClick={() => navigate(path)}
                    className="px-2.5 py-1.5 rounded-md border border-white/5 bg-white/2 hover:border-primary/30 hover:bg-primary/5 text-left text-xs text-muted-foreground hover:text-foreground transition-all font-mono"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "user" && (
            <div className="p-3 space-y-4">
              {!user ? (
                <p className="text-xs text-muted-foreground text-center py-4">Not logged in</p>
              ) : (
                <>
                  <div>
                    <div className="text-xs text-muted-foreground mb-2 font-mono uppercase tracking-wider">Set Level</div>
                    <div className="flex flex-wrap gap-1.5">
                      {[...COACH_LEVELS, ...WPT_LEVELS].map((l) => (
                        <button
                          key={l}
                          onClick={() => setUserLevel(l)}
                          disabled={saving}
                          className={cn(
                            "px-2 py-0.5 rounded border text-xs font-mono transition-all",
                            (user.level === l || level === l)
                              ? "border-primary bg-primary/20 text-primary"
                              : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground"
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-2 font-mono uppercase tracking-wider">Verification</div>
                    <button
                      onClick={toggleVerified}
                      disabled={saving}
                      className={cn(
                        "w-full py-2 rounded-lg border text-xs font-mono transition-all",
                        user.verified
                          ? "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400"
                          : "border-white/10 bg-white/5 text-muted-foreground hover:border-green-500/30 hover:text-green-400"
                      )}
                    >
                      {user.verified ? "✓ Verified — click to unverify" : "Unverified — click to verify"}
                    </button>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-2 font-mono uppercase tracking-wider">Archetype</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 rounded-lg border border-white/5 bg-white/2 text-xs font-mono text-muted-foreground">
                        {user.archetype ?? "none"}
                      </div>
                      <button
                        onClick={resetArchetype}
                        disabled={saving || !user.archetype}
                        className="px-2.5 py-2 rounded-lg border border-white/10 text-xs text-muted-foreground hover:border-red-500/30 hover:text-red-400 transition-all disabled:opacity-30"
                      >
                        clear
                      </button>
                      <button
                        onClick={() => navigate("/quiz")}
                        className="px-2.5 py-2 rounded-lg border border-white/10 text-xs text-muted-foreground hover:border-primary/30 hover:text-primary transition-all"
                      >
                        quiz →
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-2 font-mono uppercase tracking-wider">Jump to role view</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {QUICK_ACCOUNTS.map((acct) => (
                        <button
                          key={acct.label}
                          onClick={() => switchAccount(acct)}
                          disabled={!!switching || isActive(acct.label) === true}
                          className={cn(
                            "py-1.5 rounded-md border text-xs font-mono transition-all",
                            isActive(acct.label)
                              ? "border-primary/30 text-primary bg-primary/10 opacity-50 cursor-default"
                              : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                          )}
                        >
                          {acct.icon} {acct.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-muted-foreground/40 font-mono">dev mode</span>
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
            >
              close ×
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-mono font-semibold shadow-xl transition-all",
          open
            ? "bg-primary border-primary text-black shadow-primary/30"
            : "bg-[#0a0f1a]/90 border-white/10 text-yellow-400 hover:border-yellow-500/40 shadow-black/50 backdrop-blur-sm"
        )}
      >
        <span className="text-sm">⚡</span>
        <span>DEV</span>
        {user && (
          <span className={cn("px-1.5 py-0.5 rounded text-xs border", ROLE_COLORS[user.role] ?? "text-muted-foreground")}>
            {user.role}
          </span>
        )}
      </button>
    </div>
  );
}
