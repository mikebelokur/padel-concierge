import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { useUpdateUser } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ARCHETYPE_META, type Archetype } from "@/lib/archetypes";

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
      onError: () => {
        toast({ title: t("settings.updateFailed"), variant: "destructive" });
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

        <Card className="bg-card border-white/5">
          <CardHeader>
            <CardTitle>{t("settings.language")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant={language === "en" ? "default" : "outline"}
                onClick={() => handleLanguageChange("en")}
                className={language !== "en" ? "border-white/10" : ""}
              >
                English
              </Button>
              <Button
                variant={language === "ru" ? "default" : "outline"}
                onClick={() => handleLanguageChange("ru")}
                className={language !== "ru" ? "border-white/10" : ""}
              >
                Русский
              </Button>
            </div>
          </CardContent>
        </Card>

        {(() => {
          const archetype = user?.archetype as Archetype | undefined;
          const meta = archetype ? ARCHETYPE_META[archetype] : null;
          return (
            <Card className="bg-card border-white/5">
              <CardHeader>
                <CardTitle>{t("settings.playerArchetype")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                      <Button variant="outline" size="sm" className="border-white/10">
                        {t("settings.retakeTest")}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{t("settings.archetypeNotSet")}</p>
                    <Link href="/quiz">
                      <Button size="sm" className="ml-4 shrink-0">{t("settings.takeTest")}</Button>
                    </Link>
                  </div>
                )}
                {user?.warmUpPreference && (
                  <div className="flex items-center gap-2 text-sm text-orange-400 border-t border-white/5 pt-3">
                    <span>🔥</span>
                    <span>{t("settings.preferWarmup")}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        <Card className="bg-card border-white/5">
          <CardHeader>
            <CardTitle>{t("settings.profileDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <Button
              className="mt-4"
              onClick={handleSave}
              disabled={updateUser.isPending}
            >
              {updateUser.isPending ? t("settings.saving") : t("settings.saveChanges")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
