import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const navItems = [
  { href: "/dashboard", label: "nav.dashboard" },
  { href: "/matches", label: "nav.matches" },
  { href: "/bookings", label: "nav.bookings" },
  { href: "/profile", label: "nav.profile" },
  { href: "/video-analysis", label: "nav.videoAnalysis" },
  { href: "/settings", label: "nav.settings" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="w-64 border-r border-white/5 bg-card flex flex-col h-screen fixed top-0 left-0">
      <div className="p-6 font-serif text-xl border-b border-white/5">Padel Concierge</div>
      <div className="p-4 flex-1 flex flex-col gap-2 overflow-y-auto">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div className={cn(
              "px-4 py-2 rounded-md font-medium cursor-pointer transition-colors",
              location.startsWith(item.href) 
                ? "bg-primary/10 text-primary" 
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}>
              {t(item.label)}
            </div>
          </Link>
        ))}
      </div>
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif">
            {user?.name?.[0] || 'U'}
          </div>
          <div>
            <div className="font-medium text-sm">{user?.name}</div>
            <div className="text-xs text-muted-foreground capitalize">{user?.role}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
