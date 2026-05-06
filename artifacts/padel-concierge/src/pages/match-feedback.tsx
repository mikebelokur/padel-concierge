import { useState } from "react";
import { useRoute, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const POSITIVE_TRAITS = [
  "Позитивный и весёлый",
  "Хороший игрок",
  "Надёжный партнёр",
  "Прогрессирует",
  "Поддерживает команду",
  "Честная игра",
];

const NEGATIVE_TRAITS = [
  "Часто ругается",
  "Не слушает советы",
  "Агрессивный",
  "Опоздал",
  "Ушёл раньше времени",
];

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="text-2xl transition-transform hover:scale-110"
        >
          <span className={(hover || value) >= star ? "text-yellow-400" : "text-white/20"}>★</span>
        </button>
      ))}
    </div>
  );
}

interface PlayerFeedback {
  rating: number;
  traits: string[];
  comment: string;
}

export default function MatchFeedback() {
  const [, params] = useRoute("/match-feedback/:id");
  const matchId = params?.id;
  const { toast } = useToast();

  const { data: match, isLoading } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => apiFetch(`/matches/${matchId}`),
    enabled: !!matchId,
  });

  const [feedbacks, setFeedbacks] = useState<Record<number, PlayerFeedback>>({});
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(feedbacks);
      await Promise.all(
        entries.map(([userId, fb]) =>
          apiFetch("/match-feedback", {
            method: "POST",
            body: JSON.stringify({
              matchId: parseInt(matchId!),
              aboutUserId: parseInt(userId),
              rating: fb.rating,
              traits: fb.traits,
              comment: fb.comment,
            }),
          })
        )
      );
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Отзыв отправлен анонимно ✓" });
    },
  });

  function updateFeedback(userId: number, field: keyof PlayerFeedback, value: PlayerFeedback[keyof PlayerFeedback]) {
    setFeedbacks(prev => ({
      ...prev,
      [userId]: { rating: 5, traits: [], comment: "", ...prev[userId], [field]: value },
    }));
  }

  function toggleTrait(userId: number, trait: string) {
    const current = feedbacks[userId]?.traits ?? [];
    const updated = current.includes(trait) ? current.filter(t => t !== trait) : [...current, trait];
    updateFeedback(userId, "traits", updated);
  }

  if (isLoading) return <AppLayout><div className="p-8 text-muted-foreground">Загрузка…</div></AppLayout>;
  if (!match) return <AppLayout><div className="p-8 text-muted-foreground">Матч не найден</div></AppLayout>;

  const m = match as any;
  const players: Array<{ userId: number; name: string; level: string }> = m.players ?? [];

  if (submitted) {
    return (
      <AppLayout>
        <div className="p-8 max-w-md mx-auto text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h1 className="text-2xl font-serif">Спасибо!</h1>
          <p className="text-muted-foreground">Твой анонимный отзыв отправлен. Это помогает нам делать матчи лучше.</p>
          <Link href="/matches"><Button className="mt-4">← К матчам</Button></Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Анонимный отзыв</div>
            <h1 className="text-2xl font-serif">Как прошёл матч?</h1>
            <p className="text-sm text-muted-foreground mt-1">{m.clubName} · {m.date}</p>
          </div>
          <Link href="/matches"><Button variant="outline" size="sm" className="border-white/10">← Назад</Button></Link>
        </div>

        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">
          🔒 Твоё имя будет скрыто. Авторы отзывов не раскрываются.
        </div>

        {players.map(player => {
          const fb = feedbacks[player.userId] ?? { rating: 5, traits: [], comment: "" };
          return (
            <Card key={player.userId} className="bg-card border-white/5">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif">
                    {player.name[0]}
                  </div>
                  <div>
                    <div className="font-medium">{player.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{player.level}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Общая оценка</div>
                  <StarRating
                    value={fb.rating}
                    onChange={v => updateFeedback(player.userId, "rating", v)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Что отметить?</div>
                  <div className="flex flex-wrap gap-2">
                    {POSITIVE_TRAITS.map(trait => (
                      <button
                        key={trait}
                        onClick={() => toggleTrait(player.userId, trait)}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-full border transition-colors",
                          fb.traits.includes(trait)
                            ? "border-green-500/40 bg-green-500/10 text-green-400"
                            : "border-white/10 text-muted-foreground hover:border-white/20"
                        )}
                      >
                        ✓ {trait}
                      </button>
                    ))}
                    {NEGATIVE_TRAITS.map(trait => (
                      <button
                        key={trait}
                        onClick={() => toggleTrait(player.userId, trait)}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-full border transition-colors",
                          fb.traits.includes(trait)
                            ? "border-red-500/40 bg-red-500/10 text-red-400"
                            : "border-white/10 text-muted-foreground hover:border-white/20"
                        )}
                      >
                        ✗ {trait}
                      </button>
                    ))}
                  </div>
                </div>

                <Textarea
                  placeholder="Дополнительный комментарий (необязательно)…"
                  value={fb.comment}
                  onChange={e => updateFeedback(player.userId, "comment", e.target.value)}
                  rows={2}
                  className="bg-background border-white/10 resize-none text-sm"
                />
              </CardContent>
            </Card>
          );
        })}

        <Button
          className="w-full shadow-lg shadow-primary/20"
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending || players.length === 0}
        >
          {submitMutation.isPending ? "Отправка…" : "📨 Отправить отзыв анонимно"}
        </Button>
      </div>
    </AppLayout>
  );
}
