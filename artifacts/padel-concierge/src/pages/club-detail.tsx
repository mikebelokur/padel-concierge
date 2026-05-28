import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
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
  openingHours: unknown;
}

export default function ClubDetail() {
  const [, params] = useRoute<{ id: string }>("/clubs/:id");
  const { t } = useLanguage();
  const id = params?.id ? parseInt(params.id, 10) : NaN;

  const { data: club, isLoading, isError } = useQuery({
    queryKey: ["club", id],
    queryFn: () => apiFetch<Club>(`/clubs/${id}`),
    enabled: Number.isFinite(id),
  });

  if (isLoading) {
    return <AppLayout><div className="p-6 text-muted-foreground">{t("common.loading")}</div></AppLayout>;
  }
  if (isError || !club) {
    return (
      <AppLayout>
        <div className="p-6 max-w-3xl mx-auto space-y-4">
          <div className="text-muted-foreground">{t("clubDetail.notFound")}</div>
          <Link href="/clubs"><a className="text-primary underline text-sm">← {t("clubDetail.backToList")}</a></Link>
        </div>
      </AppLayout>
    );
  }

  const tel = club.phone?.replace(/\s/g, "");
  const mapsUrl = club.lat != null && club.lng != null
    ? `https://www.google.com/maps?q=${club.lat},${club.lng}`
    : `https://www.google.com/maps?q=${encodeURIComponent(club.address)}`;
  const embedSrc = club.lat != null && club.lng != null
    ? `https://www.google.com/maps?q=${club.lat},${club.lng}&z=15&output=embed`
    : `https://www.google.com/maps?q=${encodeURIComponent(club.address)}&z=15&output=embed`;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <Link href="/clubs"><a className="text-sm text-muted-foreground hover:text-foreground">← {t("clubDetail.backToList")}</a></Link>

        <div className="rounded-[20px] overflow-hidden bg-card border border-white/5">
          <div className="h-56 bg-gradient-to-br from-primary/10 to-accent/5 relative">
            {club.photoUrl ? (
              <img src={objectUrl(club.photoUrl) ?? ""} alt={club.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl opacity-30">🏢</div>
            )}
            {club.tier === "premium" && (
              <span className="absolute top-4 right-4 inline-flex items-center px-3 py-1 rounded-full text-xs border border-primary/30 bg-primary/15 text-primary">
                ★ Premium
              </span>
            )}
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              {club.logoUrl && <img src={objectUrl(club.logoUrl) ?? ""} alt="" className="w-12 h-12 rounded-lg object-contain bg-white/5 border border-white/10" />}
              <div>
                <h1 className="font-serif text-2xl leading-tight">{club.name}</h1>
                <div className="text-sm text-muted-foreground">{club.area}</div>
              </div>
            </div>

            <div className="text-sm">
              <div className="text-muted-foreground mb-1">{t("clubDetail.address")}</div>
              <div>{club.address}</div>
            </div>

            {!!club.openingHours && typeof club.openingHours === "object" && Object.keys(club.openingHours as Record<string, string>).length > 0 && (
              <div className="text-sm">
                <div className="text-muted-foreground mb-1">{t("clubDetail.openingHours")}</div>
                <ul className="space-y-0.5">
                  {Object.entries(club.openingHours as Record<string, string>).map(([day, hours]) => (
                    <li key={day} className="flex justify-between gap-3">
                      <span className="text-foreground/80">{day}</span>
                      <span className="text-foreground/90 font-mono text-xs">{hours}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {club.notes && (
              <div className="text-sm whitespace-pre-line text-foreground/90">{club.notes}</div>
            )}

            <div className="flex flex-wrap gap-3">
              {tel && (
                <a
                  href={`tel:${tel}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary text-black font-semibold px-5 text-sm"
                  style={{ minHeight: "44px" }}
                >
                  📞 {t("clubDetail.call")}
                </a>
              )}
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 text-sm hover:border-primary/40"
                style={{ minHeight: "44px" }}
              >
                🗺️ {t("clubDetail.directions")}
              </a>
              {club.website && (
                <a
                  href={club.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 text-sm hover:border-primary/40"
                  style={{ minHeight: "44px" }}
                >
                  🌐 {t("clubDetail.website")}
                </a>
              )}
            </div>
          </div>
        </div>

        <section className="rounded-[20px] overflow-hidden bg-card border border-white/5">
          <h2 className="font-serif text-lg p-4 pb-2">{t("clubDetail.location")}</h2>
          <div className="aspect-video w-full">
            <iframe
              title={`${club.name} map`}
              src={embedSrc}
              className="w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>

        <section className="rounded-[20px] bg-card border border-white/5 p-5">
          <h2 className="font-serif text-lg mb-2">{t("clubDetail.availableSlots")}</h2>
          <div className="text-sm text-muted-foreground">
            {t("clubDetail.slotsEmpty")}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
