import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "◈" },
  { href: "/matches", label: "Matches", icon: "🎾" },
  { href: "/match-requests", label: "Requests", icon: "📨" },
  { href: "/bookings", label: "Bookings", icon: "📅" },
  { href: "/courts", label: "Courts", icon: "🏟️" },
  { href: "/members", label: "Members", icon: "👥" },
  { href: "/profile", label: "Profile", icon: "👤" },
  { href: "/assessment", label: "Assessment", icon: "📊" },
  { href: "/video-analysis", label: "Video Analysis", icon: "🎬" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
  { href: "/coach", label: "Coach Console", icon: "🏆", roles: ["coach", "admin", "owner"] },
  { href: "/admin", label: "Admin Panel", icon: "🔧", roles: ["admin", "owner"] },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const visibleItems = navItems.filter(
    (item) => !item.roles || (user?.role && item.roles.includes(user.role))
  );

  const isOwner = user?.role === "owner";

  return (
    <div className="w-64 border-r border-white/5 bg-card flex flex-col h-screen fixed top-0 left-0 z-30">
      {/* Logo */}
      <div className="p-6 border-b border-white/5 flex-shrink-0">
        <div className="font-serif text-lg tracking-tight">Padel Concierge</div>
        <div className="text-xs text-muted-foreground mt-0.5">Private Members Club</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {visibleItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors mb-0.5",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <span className="text-base w-5 text-center leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            </Link>
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
              {isOwner && <span title="Owner" className="text-yellow-400 text-base leading-none">👑</span>}
              {user?.name}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className={cn("capitalize", isOwner && "text-yellow-400")}>{user?.role}</span>
              {user?.verified && <span className="text-accent">· ✓</span>}
              {user?.level && <span className="font-mono">· {user.level}</span>}
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
