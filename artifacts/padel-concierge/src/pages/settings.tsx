import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { useUpdateUser } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ARCHETYPE_META, type Archetype } from "@/lib/archetypes";
import { translateError } from "@/lib/errorMessages";

export default function Settings() {
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const updateUser = useUpdateUser();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    locationName: user?.locationName || "",
  });
  const [reminderOptOut, setReminderOptOut] = useState<boolean>(Boolean((user as any)?.reminderOptOut));
  const [savingOptOut, setSavingOptOut] = useState(false);

  const handleReminderOptOutChange = async (next: boolean) => {
    if (!user) return;
    const prev = reminderOptOut;
    setReminderOptOut(next);
    setSavingOptOut(true);
    try {
      await apiFetch(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ reminderOptOut: next }),
      });
      toast({
        title: next ? "Напоминания отключены" : "Напоминания включены",
        description: next
          ? "Мы больше не будем присылать письма о настройке профиля."
          : "Вы снова будете получать письма о настройке профиля.",
      });
    } catch (e: unknown) {
      setReminderOptOut(prev);
      toast({ title: t("settings.updateFailed"), description: translateError(e).message, variant: "destructive" });
    } finally {
      setSavingOptOut(false);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    if (user?.id) {
      apiFetch(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ language: lang }),
      }).catch(() => {});
    }
  };

  const handleSave = () => {
    if (!user) return;
    updateUser.mutate({ id: user.id, data: formData }, {
      onSuccess: () => {
        toast({ title: t("settings.settingsUpdated"), description: t("settings.profileSaved") });
      },
      onError: (e: unknown) => {
        toast({ title: t("settings.updateFailed"), description: translateError(e).message, variant: "destructive" });
      }
    });
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-5 sm:space-y-8">
        <header>
          <h1 className="text-3xl font-serif mb-2">{t("settings.title")}</h1>
          <p className="text-muted-foreground">{t("settings.subtitle")}</p>
        </header>

        <div className="rounded-[20px] bg-card border border-white/5">
          <div className="px-6 pt-5 pb-3">
            <div className="text-base font-medium">{t("settings.language")}</div>
          </div>
          <div className="px-6 pb-6 space-y-4">
            <div className="flex gap-4">
              <button
                onClick={() => handleLanguageChange("en")}
                className={language === "en"
                  ? "inline-flex items-center justify-center rounded-xl bg-primary text-black font-semibold px-5 h-11 text-sm transition-all hover:bg-primary/90"
                  : "inline-flex items-center justify-center rounded-xl border border-white/10 bg-transparent font-medium text-foreground px-5 h-11 text-sm transition-all hover:bg-white/5"}
              >
                English
              </button>
              <button
                onClick={() => handleLanguageChange("ru")}
                className={language === "ru"
                  ? "inline-flex items-center justify-center rounded-xl bg-primary text-black font-semibold px-5 h-11 text-sm transition-all hover:bg-primary/90"
                  : "inline-flex items-center justify-center rounded-xl border border-white/10 bg-transparent font-medium text-foreground px-5 h-11 text-sm transition-all hover:bg-white/5"}
              >
                Русский
              </button>
            </div>
          </div>
        </div>

        {(() => {
          const archetype = user?.archetype as Archetype | undefined;
          const meta = archetype ? ARCHETYPE_META[archetype] : null;
          return (
            <div className="rounded-[20px] bg-card border border-white/5">
              <div className="px-6 pt-5 pb-3">
                <div className="text-base font-medium">{t("settings.playerArchetype")}</div>
              </div>
              <div className="px-6 pb-6 space-y-4">
                {meta ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{meta.icon}</span>
                      <div>
                        <div className={`font-medium ${meta.color}`}>{language === "ru" ? meta.nameRu : meta.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{language === "ru" ? meta.name : meta.nameRu}</div>
                      </div>
                    </div>
                    <Link href="/quiz">
                      <button className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-transparent font-medium text-foreground px-4 h-9 text-sm transition-all hover:bg-white/5">
                        {t("settings.retakeTest")}
                      </button>
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{t("settings.archetypeNotSet")}</p>
                    <Link href="/quiz">
                      <button className="ml-4 shrink-0 inline-flex items-center justify-center rounded-xl bg-primary text-black font-semibold px-4 h-9 text-sm transition-all hover:bg-primary/90">
                        {t("settings.takeTest")}
                      </button>
                    </Link>
                  </div>
                )}
                {user?.warmUpPreference && (
                  <div className="flex items-center gap-2 text-sm text-orange-400 border-t border-white/5 pt-3">
                    <span>🔥</span>
                    <span>{t("settings.preferWarmup")}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        <div className="rounded-[20px] bg-card border border-white/5">
          <div className="px-6 pt-5 pb-3">
            <div className="text-base font-medium">Email-уведомления</div>
          </div>
          <div className="px-6 pb-6">
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">Напоминания о настройке профиля</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Мы присылаем email, пока вы не пройдёте опрос архетипа. Отключите, если не хотите больше получать такие письма.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!reminderOptOut}
                onClick={() => handleReminderOptOutChange(!reminderOptOut)}
                disabled={savingOptOut}
                className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
                style={{ background: reminderOptOut ? "rgba(255,255,255,0.15)" : "#D4AF37" }}
              >
                <span
                  className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                  style={{ transform: reminderOptOut ? "translateX(2px)" : "translateX(22px)" }}
                />
              </button>
            </label>
          </div>
        </div>

        <div className="rounded-[20px] bg-card border border-white/5">
          <div className="px-6 pt-5 pb-3">
            <div className="text-base font-medium">{t("settings.profileDetails")}</div>
          </div>
          <div className="px-6 pb-6 space-y-4">
            <div className="space-y-2">
              <Label>{t("settings.name")}</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData(s => ({...s, name: e.target.value}))}
                className="bg-background border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.phone")}</Label>
              <Input
                value={formData.phone}
                onChange={e => setFormData(s => ({...s, phone: e.target.value}))}
                className="bg-background border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.location")}</Label>
              <Input
                value={formData.locationName}
                onChange={e => setFormData(s => ({...s, locationName: e.target.value}))}
                className="bg-background border-white/10"
              />
            </div>
            <button
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary text-black font-semibold px-5 h-11 text-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSave}
              disabled={updateUser.isPending}
            >
              {updateUser.isPending ? t("settings.saving") : t("settings.saveChanges")}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
