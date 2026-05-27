import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useActiveMode, type Mode } from "@/hooks/useActiveMode";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: string[];
  modes?: Mode[];
  dividerBefore?: boolean;
  badgeKey?: string;
}

const navItems: NavItem[] = [
  { href: "/coach",         label: "Coach Hub",        icon: "🏆", modes: ["coach", "admin", "developer"] },
  { href: "/clients",       label: "My Clients",       icon: "👥", modes: ["coach", "admin", "developer"] },
  { href: "/messages",      label: "Messages",          icon: "💬", modes: ["coach", "admin", "developer"] },
  { href: "/registrations", label: "Registrations",     icon: "🆕", modes: ["admin", "developer"], badgeKey: "pending" },
  { href: "/dashboard",     label: "Dashboard",         icon: "◈",  dividerBefore: true },
  { href: "/matches",       label: "Matches",           icon: "🎾" },
  { href: "/match-requests",label: "Requests",          icon: "📨" },
  { href: "/bookings",      label: "Bookings",          icon: "📅" },
  { href: "/courts",        label: "Courts",            icon: "🏟️" },
  { href: "/members",       label: "Members",           icon: "👤" },
  { href: "/assessment",    label: "Assessment",        icon: "📊" },
  { href: "/video-analysis",label: "Video Analysis",    icon: "🎬" },
  { href: "/quiz",          label: "Archetype Quiz",    icon: "🧠" },
  { href: "/level-quiz",    label: "Level Quiz",        icon: "📊" },
  { href: "/level-quiz/admin", label: "Level Quiz Results", icon: "📋", modes: ["coach", "admin", "developer"] },
  { href: "/rules",         label: "Padel Rules",       icon: "📖", dividerBefore: true },
  { href: "/news",          label: "News & Tips",       icon: "📰" },
  { href: "/settings",      label: "Settings",          icon: "⚙️", dividerBefore: true },
  { href: "/admin",         label: "Admin Panel",       icon: "🔧", modes: ["admin", "developer"] },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { activeMode } = useActiveMode();

  const canSeeAdmin = activeMode === "admin" || activeMode === "developer";

  const { data: pendingData } = useQuery({
    queryKey: ["pending-count"],
    queryFn: () => apiFetch("/admin/registrations/count"),
    enabled: canSeeAdmin,
    refetchInterval: 30000,
  });
  const pendingCount = (pendingData as any)?.count ?? 0;

  const visibleItems = navItems.filter((item) => {
    if (item.modes) return item.modes.includes(activeMode);
    if (item.roles) return !!user?.role && item.roles.includes(user.role);
    return true;
  });

  const isOwner = user?.role === "owner";

  return (
    <div className="w-64 border-r border-white/5 bg-card flex flex-col h-screen fixed top-0 left-0 z-30">
      {/* Logo */}
      <div className="p-5 border-b border-white/5 flex-shrink-0">
        <div className="font-serif text-lg tracking-tight">Padel Concierge</div>
        <div className="text-xs text-muted-foreground mt-0.5">Private Members Club · Dubai</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-3">
        {visibleItems.map((item) => {
          const active =
            location === item.href ||
            (item.href !== "/dashboard" && item.href !== "/coach" && item.href !== "/registrations" && location.startsWith(item.href));

          const badge = item.badgeKey === "pending" && pendingCount > 0 ? pendingCount : null;

          return (
            <div key={item.href}>
              {item.dividerBefore && <div className="my-1.5 border-t border-white/5" />}
              <Link href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors mb-0.5",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <span className="text-base w-5 text-center leading-none">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {badge !== null && (
                    <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-yellow-500 text-black text-xs font-bold flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center font-serif flex-shrink-0",
              isOwner
                ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40"
                : "bg-primary/20 text-primary"
            )}
          >
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
    </div>
  );
}
