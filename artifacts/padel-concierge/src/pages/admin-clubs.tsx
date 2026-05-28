import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { translateError } from "@/lib/errorMessages";
import { useUpload, objectUrl } from "@/lib/useUpload";

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

interface ClubForm {
  name: string;
  address: string;
  area: string;
  phone: string;
  lat: string;
  lng: string;
  tier: string;
  website: string;
  notes: string;
  active: boolean;
  logoUrl: string | null;
  photoUrl: string | null;
  openingHoursText: string;
}

const EMPTY_FORM: ClubForm = {
  name: "", address: "", area: "", phone: "",
  lat: "", lng: "", tier: "premium", website: "", notes: "",
  active: true, logoUrl: null, photoUrl: null, openingHoursText: "",
};

function openingHoursToText(oh: unknown): string {
  if (!oh || typeof oh !== "object") return "";
  return Object.entries(oh as Record<string, string>)
    .map(([day, hours]) => `${day}: ${hours}`)
    .join("\n");
}

function openingHoursFromText(text: string): Record<string, string> | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const result: Record<string, string> = {};
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const day = line.slice(0, idx).trim();
    const hours = line.slice(idx + 1).trim();
    if (day && hours) result[day] = hours;
  }
  return Object.keys(result).length === 0 ? null : result;
}

export default function AdminClubs() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { uploadFile, isUploading } = useUpload();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ClubForm>(EMPTY_FORM);

  const { data: clubs = [], isLoading } = useQuery({
    queryKey: ["clubs-admin"],
    queryFn: () => apiFetch<Club[]>("/clubs?includeInactive=true"),
  });

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(c: Club) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      address: c.address,
      area: c.area,
      phone: c.phone ?? "",
      lat: c.lat == null ? "" : String(c.lat),
      lng: c.lng == null ? "" : String(c.lng),
      tier: c.tier,
      website: c.website ?? "",
      notes: c.notes ?? "",
      active: c.active,
      logoUrl: c.logoUrl,
      photoUrl: c.photoUrl,
      openingHoursText: openingHoursToText(c.openingHours),
    });
    setShowForm(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        address: form.address.trim(),
        area: form.area.trim(),
        phone: form.phone.trim() || null,
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
        tier: form.tier,
        website: form.website.trim() || null,
        notes: form.notes.trim() || null,
        active: form.active,
        logoUrl: form.logoUrl,
        photoUrl: form.photoUrl,
        openingHours: openingHoursFromText(form.openingHoursText),
      };
      if (editingId) {
        return apiFetch(`/clubs/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      return apiFetch("/clubs", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      toast({ title: t("clubsAdmin.toastSaved") });
      qc.invalidateQueries({ queryKey: ["clubs-admin"] });
      qc.invalidateQueries({ queryKey: ["clubs"] });
      setShowForm(false);
    },
    onError: (e: unknown) =>
      toast({ title: t("common.error"), description: translateError(e).message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/clubs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: t("clubsAdmin.toastDeleted") });
      qc.invalidateQueries({ queryKey: ["clubs-admin"] });
      qc.invalidateQueries({ queryKey: ["clubs"] });
    },
  });

  async function handleFileUpload(field: "logoUrl" | "photoUrl", file: File) {
    const res = await uploadFile(file);
    if (res) setForm((f) => ({ ...f, [field]: res.objectPath }));
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif mb-1">{t("clubsAdmin.title")}</h1>
            <p className="text-muted-foreground text-sm">{t("clubsAdmin.subtitle")}</p>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-xl bg-primary text-black font-semibold px-5 text-sm hover:bg-primary/90"
            style={{ minHeight: "44px" }}
            onClick={openCreate}
          >
            + {t("clubsAdmin.addClub")}
          </button>
        </header>

        {isLoading ? (
          <div className="text-muted-foreground">{t("common.loading")}</div>
        ) : clubs.length === 0 ? (
          <div className="rounded-[20px] p-10 text-center bg-card border border-white/5">
            <div className="text-3xl mb-3">🏢</div>
            <div className="text-white font-medium mb-1">{t("clubsAdmin.emptyTitle")}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clubs.map((c) => (
              <div key={c.id} className="rounded-[20px] bg-card border border-white/5 overflow-hidden">
                <div className="flex">
                  {c.photoUrl ? (
                    <img src={objectUrl(c.photoUrl) ?? ""} alt="" className="w-28 h-28 object-cover shrink-0" />
                  ) : (
                    <div className="w-28 h-28 bg-gradient-to-br from-primary/10 to-accent/5 flex items-center justify-center shrink-0 text-3xl">🏢</div>
                  )}
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {c.logoUrl && (
                            <img src={objectUrl(c.logoUrl) ?? ""} alt="" className="w-6 h-6 rounded object-contain bg-white/5" />
                          )}
                          <h3 className="font-serif text-lg truncate">{c.name}</h3>
                        </div>
                        <div className="text-xs text-muted-foreground">{c.area} · {c.address}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-white/10 text-muted-foreground">{c.tier}</span>
                          {!c.active && <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-destructive/30 text-destructive">{t("clubsAdmin.inactive")}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          className="rounded-lg border border-white/10 px-3 py-1 text-xs hover:border-primary/40"
                          onClick={() => openEdit(c)}
                        >
                          {t("clubsAdmin.edit")}
                        </button>
                        <button
                          className="rounded-lg border border-destructive/30 text-destructive px-3 py-1 text-xs hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(t("clubsAdmin.confirmDelete", { name: c.name }))) deleteMutation.mutate(c.id);
                          }}
                        >
                          {t("clubsAdmin.delete")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="bg-card border-white/10 text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">
                {editingId ? t("clubsAdmin.editClub") : t("clubsAdmin.addClub")}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
              className="space-y-4 mt-2"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label>{t("clubsAdmin.fieldName")}</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-background border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label>{t("clubsAdmin.fieldArea")}</Label>
                  <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} required className="bg-background border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label>{t("clubsAdmin.fieldTier")}</Label>
                  <select
                    value={form.tier}
                    onChange={(e) => setForm({ ...form, tier: e.target.value })}
                    className="w-full h-10 rounded-md bg-background border border-white/10 px-3 text-sm"
                  >
                    <option value="premium">premium</option>
                    <option value="standard">standard</option>
                    <option value="community">community</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>{t("clubsAdmin.fieldAddress")}</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required className="bg-background border-white/10" />
                </div>
                <div className="space-y-2">
                  <Label>{t("clubsAdmin.fieldPhone")}</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-background border-white/10" placeholder="+971 ..." />
                </div>
                <div className="space-y-2">
                  <Label>{t("clubsAdmin.fieldWebsite")}</Label>
                  <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="bg-background border-white/10" placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <Label>{t("clubsAdmin.fieldLat")}</Label>
                  <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} className="bg-background border-white/10" inputMode="decimal" />
                </div>
                <div className="space-y-2">
                  <Label>{t("clubsAdmin.fieldLng")}</Label>
                  <Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} className="bg-background border-white/10" inputMode="decimal" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>{t("clubsAdmin.fieldOpeningHours")}</Label>
                  <textarea
                    value={form.openingHoursText}
                    onChange={(e) => setForm({ ...form, openingHoursText: e.target.value })}
                    placeholder={t("clubsAdmin.openingHoursPlaceholder")}
                    className="w-full rounded-md bg-background border border-white/10 px-3 py-2 text-sm min-h-[100px] font-mono"
                  />
                  <p className="text-xs text-muted-foreground">{t("clubsAdmin.openingHoursHint")}</p>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>{t("clubsAdmin.fieldNotes")}</Label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full rounded-md bg-background border border-white/10 px-3 py-2 text-sm min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("clubsAdmin.fieldLogo")}</Label>
                  <div className="flex items-center gap-3">
                    {form.logoUrl && (
                      <img src={objectUrl(form.logoUrl) ?? ""} alt="" className="w-12 h-12 rounded object-contain bg-white/5 border border-white/10" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleFileUpload("logoUrl", f);
                      }}
                      className="text-xs text-muted-foreground"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("clubsAdmin.fieldPhoto")}</Label>
                  <div className="flex items-center gap-3">
                    {form.photoUrl && (
                      <img src={objectUrl(form.photoUrl) ?? ""} alt="" className="w-16 h-12 rounded object-cover bg-white/5 border border-white/10" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleFileUpload("photoUrl", f);
                      }}
                      className="text-xs text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  <input
                    id="club-active"
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  />
                  <Label htmlFor="club-active" className="cursor-pointer">{t("clubsAdmin.fieldActive")}</Label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
                <button
                  type="button"
                  className="rounded-xl border border-white/10 px-4 text-sm"
                  style={{ minHeight: "44px" }}
                  onClick={() => setShowForm(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending || isUploading}
                  className="rounded-xl bg-primary text-black font-semibold px-5 text-sm disabled:opacity-50"
                  style={{ minHeight: "44px" }}
                >
                  {saveMutation.isPending ? t("common.loading") : t("common.save")}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
