import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

type UserType = "real_user" | "seed_test" | "beta_tester";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  level: string;
  userType: UserType;
  matchesPlayed: number;
  verified: boolean;
  createdAt: string;
}

const TYPE_STYLES: Record<UserType, { color: string; bg: string; border: string }> = {
  real_user:    { color: "#D4AF37",  bg: "rgba(212,175,55,0.10)",  border: "rgba(212,175,55,0.30)" },
  seed_test:    { color: "#94a3b8",  bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.20)" },
  beta_tester:  { color: "#64b4ff",  bg: "rgba(100,180,255,0.10)", border: "rgba(100,180,255,0.30)" },
};

const ROLE_STYLES: Record<string, { color: string }> = {
  owner:  { color: "#D4AF37" },
  admin:  { color: "#818cf8" },
  coach:  { color: "#fb923c" },
  player: { color: "rgba(255,255,255,0.40)" },
};

const ALL_TYPES: UserType[] = ["real_user", "seed_test", "beta_tester"];

export default function AdminUsers() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<"all" | UserType>("all");
  const [search, setSearch] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<{ user: AdminUser; newType: UserType } | null>(null);

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users-seg"],
    queryFn: () => apiFetch<AdminUser[]>("/admin/users"),
    refetchInterval: 30000,
  });

  const mutation = useMutation({
    mutationFn: ({ id, userType }: { id: number; userType: UserType }) =>
      apiFetch(`/admin/users/${id}/user-type`, {
        method: "PATCH",
        body: JSON.stringify({ userType }),
      }),
    onSuccess: () => {
      toast({ title: t("userSegmentation.toastSuccess") });
      qc.invalidateQueries({ queryKey: ["admin-users-seg"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setConfirmTarget(null);
    },
    onError: () => {
      toast({ title: t("userSegmentation.toastError"), variant: "destructive" });
      setConfirmTarget(null);
    },
  });

  const counts: Record<UserType, number> = { real_user: 0, seed_test: 0, beta_tester: 0 };
  for (const u of users) counts[u.userType as UserType] = (counts[u.userType as UserType] ?? 0) + 1;

  const filtered = users.filter(u => {
    if (filter !== "all" && u.userType !== filter) return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-5 animate-fade-up" style={{ paddingTop: "28px", paddingBottom: "40px" }}>

        {/* Header */}
        <header className="mb-6">
          <h1 className="font-serif font-bold text-white mb-1" style={{ fontSize: "26px" }}>
            {t("userSegmentation.title")}
          </h1>
          <p className="text-muted-foreground" style={{ fontSize: "15px" }}>
            {t("userSegmentation.subtitle")}
          </p>
        </header>

        {/* Count cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {ALL_TYPES.map(type => {
            const s = TYPE_STYLES[type];
            return (
              <div
                key={type}
                className="rounded-2xl p-4 flex flex-col gap-1"
                style={{ background: s.bg, border: `1px solid ${s.border}` }}
              >
                <span className="text-2xl font-bold font-mono" style={{ color: s.color }}>
                  {counts[type]}
                </span>
                <span className="text-xs font-medium leading-tight" style={{ color: s.color, opacity: 0.85 }}>
                  {t(`userSegmentation.counts.${type}`)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Filter chips + search */}
        <div className="flex flex-col gap-3 mb-5">
          <div className="flex gap-2 flex-wrap">
            {(["all", ...ALL_TYPES] as const).map(chip => (
              <button
                key={chip}
                onClick={() => setFilter(chip)}
                className="rounded-full text-sm font-medium px-3 py-1.5 transition-all"
                style={{
                  background: filter === chip
                    ? (chip === "all" ? "#D4AF37" : TYPE_STYLES[chip].bg)
                    : "rgba(255,255,255,0.05)",
                  color: filter === chip
                    ? (chip === "all" ? "#000" : TYPE_STYLES[chip].color)
                    : "rgba(255,255,255,0.50)",
                  border: `1px solid ${filter === chip
                    ? (chip === "all" ? "#D4AF37" : TYPE_STYLES[chip].border)
                    : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {t(`userSegmentation.filter.${chip}`)}
                {chip !== "all" && (
                  <span className="ml-1.5 opacity-60 text-xs font-mono">{counts[chip]}</span>
                )}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="rounded-xl px-3.5 py-2.5 text-sm bg-transparent text-white placeholder:text-muted-foreground outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}
          />
        </div>

        {/* User list */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No users found</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(user => {
              const typeStyle = TYPE_STYLES[user.userType as UserType] ?? TYPE_STYLES.real_user;
              const roleStyle = ROLE_STYLES[user.role] ?? ROLE_STYLES.player;
              return (
                <div
                  key={user.id}
                  className="rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-serif flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}
                  >
                    {user.name[0]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-white truncate">{user.name}</span>
                      {user.verified && (
                        <span style={{ color: "#D4AF37", fontSize: "11px" }}>✓</span>
                      )}
                      <span
                        className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                        style={{ color: roleStyle.color, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        {user.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                      <span className="text-xs font-mono text-muted-foreground/60">{user.level}</span>
                    </div>
                  </div>

                  {/* Type selector */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: typeStyle.color, background: typeStyle.bg, border: `1px solid ${typeStyle.border}` }}
                    >
                      {t(`userSegmentation.typeLabel.${user.userType}`)}
                    </span>
                    <div className="flex gap-1">
                      {ALL_TYPES.filter(t => t !== user.userType).map(newType => (
                        <button
                          key={newType}
                          onClick={() => setConfirmTarget({ user, newType })}
                          className="text-xs px-2 py-0.5 rounded-full transition-all hover:opacity-100 opacity-50"
                          style={{
                            color: TYPE_STYLES[newType].color,
                            background: TYPE_STYLES[newType].bg,
                            border: `1px solid ${TYPE_STYLES[newType].border}`,
                          }}
                        >
                          → {t(`userSegmentation.typeLabel.${newType}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Confirm modal */}
        <AlertDialog open={!!confirmTarget} onOpenChange={open => !open && setConfirmTarget(null)}>
          <AlertDialogContent
            style={{ background: "hsl(220 20% 6%)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                {t("userSegmentation.confirmTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                {confirmTarget &&
                  t("userSegmentation.confirmDesc")
                    .replace("{{name}}", confirmTarget.user.name)
                    .replace("{{type}}", t(`userSegmentation.typeLabel.${confirmTarget.newType}`))}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
              >
                {t("userSegmentation.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={mutation.isPending}
                onClick={() => confirmTarget && mutation.mutate({ id: confirmTarget.user.id, userType: confirmTarget.newType })}
                className="rounded-full font-semibold"
                style={{ background: "#D4AF37", color: "#000" }}
              >
                {mutation.isPending ? t("userSegmentation.saving") : t("userSegmentation.confirmButton")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </AppLayout>
  );
}
