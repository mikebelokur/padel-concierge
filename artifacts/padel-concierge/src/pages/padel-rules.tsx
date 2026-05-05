import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Lang = "ru" | "en" | "ar";

const CATEGORY_ICONS: Record<string, string> = {
  scoring: "🎯",
  serve: "🎾",
  ball: "⚡",
  walls: "🧱",
  net: "🔲",
  faults: "🚫",
  general: "📋",
};

export default function PadelRules() {
  const [lang, setLang] = useState<Lang>("ru");
  const [search, setSearch] = useState("");

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["padel-rules", search],
    queryFn: () => apiFetch(`/padel-rules${search ? `?q=${encodeURIComponent(search)}` : ""}`),
  });

  const grouped = (rules as any[]).reduce((acc: Record<string, any[]>, rule: any) => {
    const cat = rule.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(rule);
    return acc;
  }, {});

  const getTitle = (rule: any) => lang === "ru" ? rule.titleRu : lang === "ar" ? rule.titleAr : rule.titleEn;
  const getText = (rule: any) => lang === "ru" ? rule.ruleRu : lang === "ar" ? rule.ruleAr : rule.ruleEn;

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-serif mb-1">Правила Падела</h1>
          <p className="text-muted-foreground">Official padel rules reference</p>
        </div>

        <div className="flex items-center gap-3">
          <Input
            placeholder="Поиск правил… / Search rules…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-background border-white/10"
          />
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {(["ru", "en", "ar"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${lang === l ? "bg-primary text-white" : "text-muted-foreground hover:bg-white/5"}`}
              >
                {l === "ru" ? "РУ" : l === "en" ? "EN" : "AR"}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading rules…</div>
        ) : (
          Object.entries(grouped).map(([category, catRules]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{CATEGORY_ICONS[category] ?? "📋"}</span>
                <h2 className="text-lg font-serif capitalize">{category}</h2>
                <Badge variant="outline" className="text-xs border-white/10">{catRules.length} rules</Badge>
              </div>
              <div className="space-y-3">
                {catRules.map((rule: any) => (
                  <Card key={rule.id} className="bg-card border-white/5">
                    <CardContent className={`p-4 ${lang === "ar" ? "text-right" : ""}`} dir={lang === "ar" ? "rtl" : "ltr"}>
                      <h3 className="font-medium mb-2">{getTitle(rule)}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{getText(rule)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}
