import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDrawer } from "@/contexts/DrawerContext";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/NotificationBell";
import { useActiveMode } from "@/hooks/useActiveMode";
import { ModeSwitcher } from "@/components/layout/ModeSwitcher";
import { getNavConfig, type NavEntry } from "@/lib/navConfig";

export function Drawer() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { open, openDrawer, closeDrawer } = useDrawer();
  const { language, setLanguage, t } = useLanguage();
  const { activeMode } = useActiveMode();

  const canSeeAdmin = activeMode === "admin" || activeMode === "developer";
  const isOwner = user?.role === "owner";
  const navConfig = getNavConfig(activeMode);

  const { data: pendingData } = useQuery({
    queryKey: ["pending-count"],
    queryFn: () => apiFetch("/admin/registrations/count"),
    enabled: canSeeAdmin,
    refetchInterval: 30000,
  });
  const pendingCount = (pendingData as any)?.count ?? 0;

  const getLastVisit = () => localStorage.getItem("matchRequestsLastVisit") ?? "";

  const { data: pendingRequestsData } = useQuery({
    queryKey: ["pending-requests-count", user?.id],
    queryFn: () => {
      const since = getLastVisit();
      const qs = since ? `?since=${encodeURIComponent(since)}` : "";
      return apiFetch<{ count: number }>(`/match-requests/pending-count${qs}`);
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });
  const pendingRequestsCount = (pendingRequestsData as any)?.count ?? 0;

  const handleLanguageSwitch = (lang: Language) => {
    setLanguage(lang);
    if (user?.id) {
      apiFetch(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ language: lang }),
      }).catch(() => {});
    }
  };

  const LangToggle = () => (
    <div className="flex items-center gap-0.5 bg-white/5 rounded-md px-1 py-0.5">
      <button
        onClick={() => handleLanguageSwitch("en")}
        className={cn(
          "px-2 py-0.5 rounded text-xs font-semibold transition-colors",
          language === "en"
            ? "bg-primary text-black"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        EN
      </button>
      <span className="text-white/20 text-xs">|</span>
      <button
        onClick={() => handleLanguageSwitch("ru")}
        className={cn(
          "px-2 py-0.5 rounded text-xs font-semibold transition-colors",
          language === "ru"
            ? "bg-primary text-black"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        RU
      </button>
    </div>
  );

  const badgeFor = (item: NavEntry): number | null => {
    if (item.badgeKey === "pending" && pendingCount > 0) return pendingCount;
    if (item.badgeKey === "pendingRequests" && pendingRequestsCount > 0)
      return pendingRequestsCount;
    return null;
  };

  const bottomTabs: NavEntry[] = [...navConfig.primary, ...navConfig.tertiary];

  return (
    <>
      {/* ── TOP BAR ─────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-black/95 backdrop-blur-sm border-b border-white/5 flex items-center px-4 gap-3 lg:pl-68">
        <button
          onClick={openDrawer}
          aria-label="Open menu"
          className="lg:hidden w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-md hover:bg-white/5 transition-colors flex-shrink-0"
        >
          <span className="block w-5 h-0.5 bg-foreground rounded-full" />
          <span className="block w-5 h-0.5 bg-foreground rounded-full" />
          <span className="block w-5 h-0.5 bg-foreground rounded-full" />
        </button>

        <div className="flex-1 flex items-center gap-2 lg:hidden">
          <span className="font-serif text-base tracking-tight">Padel Concierge</span>
        </div>

        {canSeeAdmin && pendingCount > 0 && (
          <Link href="/registrations">
            <div className="lg:hidden flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-2.5 py-1 cursor-pointer">
              <span className="text-yellow-400 text-xs font-bold">{pendingCount}</span>
              <span className="text-yellow-400 text-xs">{t("common.new")}</span>
            </div>
          </Link>
        )}

        <ModeSwitcher />
        <NotificationBell />
        <LangToggle />

        <button
          onClick={openDrawer}
          className={cn(
            "lg:hidden w-8 h-8 rounded-full flex items-center justify-center font-serif text-sm flex-shrink-0",
            isOwner ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40" : "bg-primary/20 text-primary"
          )}
        >
          {user?.name?.[0] ?? "?"}
        </button>
      </header>

      {/* ── DESKTOP SIDEBAR ─────────────────────────── */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 h-screen w-64 bg-black border-r border-white/5 z-30">
        <div className="h-14 flex items-center justify-between px-5 border-b border-white/5 flex-shrink-0">
          <div>
            <div className="font-serif text-base tracking-tight">Padel Concierge</div>
            <div className="text-xs text-muted-foreground">Private Members Club · Dubai</div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <LangToggle />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-3">
          <NavList
            primary={navConfig.primary}
            extras={navConfig.drawerExtras}
            tertiary={navConfig.tertiary}
            location={location}
            badgeFor={badgeFor}
            t={t}
          />
        </nav>
        <UserFooter user={user} isOwner={isOwner} logout={logout} t={t} />
      </aside>

      {/* ── MOBILE OVERLAY ──────────────────────────── */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 z-40 bg-black/80 transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={closeDrawer}
      />

      {/* ── MOBILE DRAWER ───────────────────────────── */}
      <aside
        className={cn(
          "lg:hidden fixed top-0 left-0 h-full w-72 z-50 bg-black border-r border-white/5 flex flex-col",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-white/5 flex-shrink-0">
          <div className="font-serif text-base">Padel Concierge</div>
          <button
            onClick={closeDrawer}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-3" onClick={closeDrawer}>
          <NavList
            primary={navConfig.primary}
            extras={navConfig.drawerExtras}
            tertiary={navConfig.tertiary}
            location={location}
            badgeFor={badgeFor}
            t={t}
          />
        </nav>
        <UserFooter user={user} isOwner={isOwner} logout={logout} t={t} />
      </aside>

      {/* ── iOS BOTTOM TAB BAR ── mobile only ── */}
      {user && (
        <nav
          data-testid="bottom-nav"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch"
          style={{
            background: "rgba(0,0,0,0.92)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {bottomTabs.map((item) => {
            const active =
              location === item.href ||
              (item.href !== "/dashboard" && location.startsWith(item.href + "/")) ||
              (item.href !== "/dashboard" && location === item.href);
            const badge = badgeFor(item);
            return (
              <Link key={item.href} href={item.href}>
                <div
                  data-testid={`tab-${item.href.replace(/\W+/g, "-")}`}
                  className="flex flex-col items-center justify-center transition-all cursor-pointer"
                  style={{
                    flex: 1,
                    minHeight: "56px",
                    padding: "10px 0 8px",
                    minWidth: 0,
                  }}
                >
                  <div className="relative">
                    <span style={{ fontSize: 22, lineHeight: 1, opacity: active ? 1 : 0.55 }}>
                      {item.icon}
                    </span>
                    {badge !== null && (
                      <span
                        className="absolute flex items-center justify-center font-bold"
                        style={{
                          top: "-3px",
                          right: "-8px",
                          minWidth: "16px",
                          height: "16px",
                          padding: "0 4px",
                          borderRadius: "8px",
                          fontSize: "9px",
                          background: "#D4AF37",
                          color: "#000",
                          lineHeight: 1,
                        }}
                      >
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </div>
                  <span
                    className="mt-1 font-medium leading-none truncate px-1"
                    style={{
                      fontSize: "10px",
                      color: active ? "#D4AF37" : "rgba(255,255,255,0.4)",
                      maxWidth: "100%",
                    }}
                  >
                    {t(item.labelKey)}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}

function NavList({
  primary,
  extras,
  tertiary,
  location,
  badgeFor,
  t,
}: {
  primary: NavEntry[];
  extras: NavEntry[];
  tertiary: NavEntry[];
  location: string;
  badgeFor: (item: NavEntry) => number | null;
  t: (key: string) => string;
}) {
  const renderItem = (item: NavEntry) => {
    const active =
      location === item.href ||
      (item.href !== "/dashboard" &&
        item.href !== "/coach" &&
        item.href !== "/registrations" &&
        location.startsWith(item.href + "/"));
    const badge = badgeFor(item);
    return (
      <Link key={item.href} href={item.href}>
        <div
          data-testid={`nav-${item.href.replace(/\W+/g, "-")}`}
          className={cn(
            "flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-md text-sm font-medium cursor-pointer transition-colors mb-0.5",
            active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          )}
        >
          <span className="text-base w-5 text-center leading-none flex-shrink-0">{item.icon}</span>
          <span className="flex-1">{t(item.labelKey)}</span>
          {badge !== null && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-yellow-500 text-black text-xs font-bold flex items-center justify-center">
              {badge}
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <>
      {primary.map(renderItem)}
      {extras.length > 0 && <div className="my-1.5 border-t border-white/5" />}
      {extras.map(renderItem)}
      {tertiary.length > 0 && <div className="my-1.5 border-t border-white/5" />}
      {tertiary.map(renderItem)}
    </>
  );
}

function UserFooter({
  user,
  isOwner,
  logout,
  t,
}: {
  user: any;
  isOwner: boolean;
  logout: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="p-4 border-t border-white/5 flex-shrink-0">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center font-serif flex-shrink-0",
          isOwner ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40" : "bg-primary/20 text-primary"
        )}>
          {user?.name?.[0] ?? "U"}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-sm truncate flex items-center gap-1.5">
            {isOwner && <span className="text-yellow-400 text-base leading-none">👑</span>}
            {user?.name}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className={cn("capitalize", isOwner && "text-yellow-400")}>{user?.role}</span>
            {user?.verified && <span className="text-accent">· ✓</span>}
            {user?.level && <span className="font-mono">· WPT {user.level}</span>}
          </div>
        </div>
      </div>
      <button
        onClick={logout}
        className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
      >
        {t("common.signOut")}
      </button>
    </div>
  );
}
