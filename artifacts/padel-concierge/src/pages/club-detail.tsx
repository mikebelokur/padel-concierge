import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { translateError } from "@/lib/errorMessages";
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

        <ClubSlotsSection clubId={club.id} />
      </div>
    </AppLayout>
  );
}

interface ClubSlot {
  id: number;
  clubId: number;
  date: string;
  startTime: string;
  endTime: string;
  courtNumber: string | null;
  priceAed: string | null;
  levelSuitability: string | null;
  notes: string | null;
  status: "open" | "taken" | "cancelled";
  interestedUserIds: number[];
  interestedCount: number;
}

function ClubSlotsSection({ clubId }: { clubId: number }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const key = ["club-slots", clubId];

  const { data: slots = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<ClubSlot[]>(`/clubs/${clubId}/slots`),
  });

  const interestMutation = useMutation({
    mutationFn: (slotId: number) =>
      apiFetch(`/slots/${slotId}/interest`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: t("clubDetail.interestRegistered") });
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) =>
      toast({
        title: t("common.error"),
        description: translateError(e).message,
        variant: "destructive",
      }),
  });

  const bookMutation = useMutation({
    mutationFn: (slotId: number) =>
      apiFetch(`/slots/${slotId}/book`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: t("clubDetail.bookedToast") });
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e) =>
      toast({
        title: t("common.error"),
        description: translateError(e).message,
        variant: "destructive",
      }),
  });

  const grouped = slots.reduce<Record<string, ClubSlot[]>>((acc, s) => {
    (acc[s.date] ||= []).push(s);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort();

  function formatDate(d: string): string {
    try {
      const dt = new Date(d + "T00:00:00");
      const locale = language === "ru" ? "ru-RU" : "en-GB";
      return dt.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
    } catch {
      return d;
    }
  }

  return (
    <section className="rounded-[20px] bg-card border border-white/5 p-5">
      <h2 className="font-serif text-lg mb-3">{t("clubDetail.availableSlots")}</h2>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : dates.length === 0 ? (
        <div className="text-sm text-muted-foreground">{t("clubDetail.slotsEmpty")}</div>
      ) : (
        <div className="space-y-4">
          {dates.map((d) => (
            <div key={d}>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {formatDate(d)}
              </div>
              <ul className="space-y-2">
                {grouped[d].map((s) => {
                  const alreadyInterested = !!user && s.interestedUserIds.includes(user.id);
                  const isTaken = s.status === "taken";
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-black/30 border border-white/5 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {s.startTime}–{s.endTime}
                          {s.courtNumber && (
                            <span className="text-muted-foreground">
                              {" "}· {t("clubDetail.court")} {s.courtNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                          {s.priceAed && <span>{s.priceAed} AED</span>}
                          {s.levelSuitability && <span>· {s.levelSuitability}</span>}
                          {s.notes && <span>· {s.notes}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {isTaken ? (
                          <span className="rounded-lg border border-white/10 text-muted-foreground text-xs px-3 py-2 text-center">
                            {t("clubDetail.taken")}
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => bookMutation.mutate(s.id)}
                              disabled={bookMutation.isPending}
                              className="rounded-lg bg-primary text-black font-semibold text-xs px-3 py-2 hover:bg-primary/90 disabled:opacity-60"
                              style={{ minHeight: "36px" }}
                            >
                              {bookMutation.isPending ? t("common.loading") : t("clubDetail.book")}
                            </button>
                            <button
                              onClick={() => !alreadyInterested && interestMutation.mutate(s.id)}
                              disabled={alreadyInterested || interestMutation.isPending}
                              className={
                                alreadyInterested
                                  ? "rounded-lg border border-white/10 text-muted-foreground text-xs px-3 py-2"
                                  : "rounded-lg border border-white/10 text-foreground/80 text-xs px-3 py-2 hover:border-primary/40 disabled:opacity-60"
                              }
                              style={{ minHeight: "36px" }}
                            >
                              {alreadyInterested
                                ? t("clubDetail.interestedDone")
                                : t("clubDetail.interested")}
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
