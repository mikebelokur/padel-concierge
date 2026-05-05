import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUpdateUser } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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

  const handleSave = () => {
    if (!user) return;
    updateUser.mutate({ id: user.id, data: formData }, {
      onSuccess: () => {
        toast({ title: "Settings updated", description: "Your profile has been saved." });
      },
      onError: () => {
        toast({ title: "Update failed", variant: "destructive" });
      }
    });
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-5 sm:space-y-8">
        <header>
          <h1 className="text-3xl font-serif mb-2">{t('nav.settings')}</h1>
          <p className="text-muted-foreground">Manage your account preferences.</p>
        </header>

        <Card className="bg-card border-white/5">
          <CardHeader>
            <CardTitle>Language</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button 
                variant={language === 'en' ? 'default' : 'outline'} 
                onClick={() => setLanguage('en')}
                className={language !== 'en' ? 'border-white/10' : ''}
              >
                English
              </Button>
              <Button 
                variant={language === 'ru' ? 'default' : 'outline'} 
                onClick={() => setLanguage('ru')}
                className={language !== 'ru' ? 'border-white/10' : ''}
              >
                Русский
              </Button>
              <Button 
                variant={language === 'ar' ? 'default' : 'outline'} 
                onClick={() => setLanguage('ar')}
                className={language !== 'ar' ? 'border-white/10' : ''}
              >
                العربية
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-white/5">
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData(s => ({...s, name: e.target.value}))} 
                className="bg-background border-white/10" 
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input 
                value={formData.phone} 
                onChange={e => setFormData(s => ({...s, phone: e.target.value}))} 
                className="bg-background border-white/10" 
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
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
              {updateUser.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
