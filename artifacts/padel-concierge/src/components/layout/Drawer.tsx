import { useAuth } from "@/contexts/AuthContext";
import { useDrawer } from "@/contexts/DrawerContext";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: string[];
  dividerBefore?: boolean;
  badgeKey?: string;
}

const navItems: NavItem[] = [
  { href: "/coach",          label: "Coach Hub",      icon: "🏆", roles: ["coach", "admin", "owner"] },
  { href: "/clients",        label: "My Clients",     icon: "👥", roles: ["coach", "admin", "owner"] },
  { href: "/messages",       label: "Messages",        icon: "💬", roles: ["coach", "admin", "owner"] },
  { href: "/registrations",  label: "Registrations",  icon: "🆕", roles: ["admin", "owner"], badgeKey: "pending" },
  { href: "/dashboard",      label: "Dashboard",       icon: "◈",  dividerBefore: true },
  { href: "/matches",        label: "Matches",         icon: "🎾" },
  { href: "/match-requests", label: "Requests",        icon: "📨" },
  { href: "/bookings",       label: "Bookings",        icon: "📅" },
  { href: "/courts",         label: "Courts",          icon: "🏟️" },
  { href: "/members",        label: "Members",         icon: "👤" },
  { href: "/assessment",     label: "Assessment",      icon: "📊" },
  { href: "/video-analysis", label: "Video Analysis",  icon: "🎬" },
  { href: "/rules",          label: "Padel Rules",     icon: "📖", dividerBefore: true },
  { href: "/news",           label: "News & Tips",     icon: "📰" },
  { href: "/settings",       label: "Settings",        icon: "⚙️",  dividerBefore: true },
  { href: "/admin",          label: "Admin Panel",     icon: "🔧", roles: ["admin", "owner"] },
];

export function Drawer() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { open, openDrawer, closeDrawer } = useDrawer();

  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";
  const isOwner = user?.role === "owner";

  const { data: pendingData } = useQuery({
    queryKey: ["pending-count"],
    queryFn: () => apiFetch("/admin/registrations/count"),
    enabled: isOwnerOrAdmin,
    refetchInterval: 30000,
  });
  const pendingCount = (pendingData as any)?.count ?? 0;

  const visibleItems = navItems.filter(
    (item) => !item.roles || (user?.role && item.roles.includes(user.role))
  );

  return (
    <>
      {/* ── TOP BAR ─────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-card/95 backdrop-blur-sm border-b border-white/5 flex items-center px-4 gap-3 lg:pl-68">
        {/* Hamburger — mobile only */}
        <button
          onClick={openDrawer}
          aria-label="Open menu"
          className="lg:hidden w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-md hover:bg-white/5 transition-colors flex-shrink-0"
        >
          <span className="block w-5 h-0.5 bg-foreground rounded-full" />
          <span className="block w-5 h-0.5 bg-foreground rounded-full" />
          <span className="block w-5 h-0.5 bg-foreground rounded-full" />
        </button>

        {/* Logo */}
        <div className="flex-1 flex items-center gap-2 lg:hidden">
          <span className="font-serif text-base tracking-tight">Padel Concierge</span>
        </div>

        {/* Pending badge — mobile */}
        {isOwnerOrAdmin && pendingCount > 0 && (
          <Link href="/registrations">
            <div className="lg:hidden flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-2.5 py-1 cursor-pointer">
              <span className="text-yellow-400 text-xs font-bold">{pendingCount}</span>
              <span className="text-yellow-400 text-xs">new</span>
            </div>
          </Link>
        )}

        {/* Avatar — mobile */}
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
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 h-screen w-64 bg-card border-r border-white/5 z-30">
        <div className="h-14 flex items-center px-5 border-b border-white/5 flex-shrink-0">
          <div>
            <div className="font-serif text-base tracking-tight">Padel Concierge</div>
            <div className="text-xs text-muted-foreground">Private Members Club · Dubai</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-3">
          <NavList items={visibleItems} location={location} pendingCount={pendingCount} />
        </nav>
        <UserFooter user={user} isOwner={isOwner} logout={logout} />
      </aside>

      {/* ── MOBILE OVERLAY ──────────────────────────── */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 z-40 bg-black/70 transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={closeDrawer}
      />

      {/* ── MOBILE DRAWER ───────────────────────────── */}
      <aside
        className={cn(
          "lg:hidden fixed top-0 left-0 h-full w-72 z-50 bg-card border-r border-white/5 flex flex-col",
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
        <nav className="flex-1 overflow-y-auto py-2 px-3">
          <NavList items={visibleItems} location={location} pendingCount={pendingCount} />
        </nav>
        <UserFooter user={user} isOwner={isOwner} logout={logout} />
      </aside>
    </>
  );
}

function NavList({
  items,
  location,
  pendingCount,
}: {
  items: NavItem[];
  location: string;
  pendingCount: number;
}) {
  return (
    <>
      {items.map((item) => {
        const active =
          location === item.href ||
          (item.href !== "/dashboard" &&
            item.href !== "/coach" &&
            item.href !== "/registrations" &&
            location.startsWith(item.href));

        const badge = item.badgeKey === "pending" && pendingCount > 0 ? pendingCount : null;

        return (
          <div key={item.href}>
            {item.dividerBefore && <div className="my-1.5 border-t border-white/5" />}
            <Link href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium cursor-pointer transition-colors mb-0.5",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <span className="text-base w-5 text-center leading-none flex-shrink-0">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {badge !== null && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-yellow-500 text-black text-xs font-bold flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </div>
            </Link>
          </div>
        );
      })}
    </>
  );
}

function UserFooter({ user, isOwner, logout }: { user: any; isOwner: boolean; logout: () => void }) {
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
        Sign out
      </button>
    </div>
  );
}
