import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch } from "@/lib/api";
import { objectUrl } from "@/lib/useUpload";

interface Club {
  id: number;
  name: string;
  logoUrl: string | null;
  photoUrl: string | null;
  address: string;
  area: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  tier: string;
  website: string | null;
  notes: string | null;
  active: boolean;
}

const TIER_LABEL: Record<string, string> = {
  premium: "★ Premium",
  standard: "Standard",
  community: "Community",
};

export default function ClubsList() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [tierFilter, setTierFilter] = useState<string>("");

  const { data: clubs = [], isLoading } = useQuery({
    queryKey: ["clubs"],
    queryFn: () => apiFetch<Club[]>("/clubs"),
  });

  const areas = useMemo(() => {
    const set = new Set<string>();
    clubs.forEach((c) => set.add(c.area));
    return Array.from(set).sort();
  }, [clubs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clubs.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.address.toLowerCase().includes(q)) return false;
      if (areaFilter && c.area !== areaFilter) return false;
      if (tierFilter && c.tier !== tierFilter) return false;
      return true;
    });
  }, [clubs, search, areaFilter, tierFilter]);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-serif mb-1">{t("clubsList.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("clubsList.subtitle")}</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder={t("clubsList.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-background border-white/10"
          />
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="h-10 rounded-md bg-background border border-white/10 px-3 text-sm"
          >
            <option value="">{t("clubsList.allAreas")}</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="h-10 rounded-md bg-background border border-white/10 px-3 text-sm"
          >
            <option value="">{t("clubsList.allTiers")}</option>
            <option value="premium">Premium</option>
            <option value="standard">Standard</option>
            <option value="community">Community</option>
          </select>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">{t("common.loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[20px] p-10 text-center bg-card border border-white/5">
            <div className="text-3xl mb-3">🏢</div>
            <div className="text-white font-medium mb-1">{t("clubsList.emptyTitle")}</div>
            <div className="text-muted-foreground text-sm">{t("clubsList.emptyHint")}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((c) => (
              <Link key={c.id} href={`/clubs/${c.id}`}>
                <a className="rounded-[20px] bg-card border border-white/5 hover:border-white/15 transition overflow-hidden block">
                  <div className="h-36 bg-gradient-to-br from-primary/10 to-accent/5 relative">
                    {c.photoUrl ? (
                      <img src={objectUrl(c.photoUrl) ?? ""} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl opacity-30">🏢</div>
                    )}
                    {c.tier === "premium" && (
                      <span className="absolute top-3 right-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-primary/30 bg-primary/10 text-primary">
                        ★ Premium
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      {c.logoUrl && <img src={objectUrl(c.logoUrl) ?? ""} alt="" className="w-7 h-7 rounded object-contain bg-white/5" />}
                      <h3 className="font-serif text-lg leading-tight truncate">{c.name}</h3>
                    </div>
                    <div className="text-xs text-muted-foreground">{c.area}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.address}</div>
                    {c.phone && (
                      <a
                        href={`tel:${c.phone.replace(/\s/g, "")}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                      >
                        📞 {c.phone}
                      </a>
                    )}
                  </div>
                </a>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export { TIER_LABEL };
