import { useState } from "react";
import { useRoute, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function MatchLog() {
  const [, params] = useRoute("/match-log/:id");
  const matchId = params?.id;
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: match, isLoading } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => apiFetch(`/matches/${matchId}`),
    enabled: !!matchId,
  });

  const [setScores, setSetScores] = useState("");
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [conflict, setConflict] = useState(false);
  const [overallNote, setOverallNote] = useState("");
  const [absentIds, setAbsentIds] = useState<Set<number>>(new Set());
  const [initialized, setInitialized] = useState(false);

  if (match && !initialized) {
    setSetScores((match as any).setScores ?? "");
    setRatings((match as any).playerRatings ?? {});
    setConflict((match as any).conflictOccurred ?? false);
    setOverallNote((match as any).overallNote ?? "");
    setInitialized(true);
  }

  function toggleAbsent(userId: number) {
    setAbsentIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const saveMutation = useMutation({
    mutationFn: () => apiFetch(`/matches/${matchId}`, {
      method: "PATCH",
      body: JSON.stringify({
        setScores,
        playerRatings: ratings,
        conflictOccurred: conflict,
        overallNote,
        status: "completed",
        absentPlayerIds: [...absentIds],
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match", matchId] });
      const noShowCount = absentIds.size;
      toast({
        title: "Матч сохранён ✓",
        description: noShowCount > 0
          ? `Зафиксировано неявок: ${noShowCount}`
          : undefined,
      });
    },
  });

  if (isLoading) return <AppLayout><div className="p-8 text-muted-foreground">Загрузка…</div></AppLayout>;
  if (!match) return <AppLayout><div className="p-8 text-muted-foreground">Матч не найден</div></AppLayout>;

  const m = match as any;
  const players: Array<{ userId: number; name: string; level: string }> = m.players ?? [];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif">Заполнить результат</h1>
            <p className="text-sm text-muted-foreground mt-1">{m.clubName} · {m.date} · {m.time}</p>
          </div>
          <Link href="/matches">
            <button className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-transparent font-medium text-foreground px-5 h-11 text-sm transition-all hover:bg-white/5">
              ← Назад
            </button>
          </Link>
        </div>

        {/* Players */}
        <div className="rounded-xl bg-card border border-white/5">
          <div className="px-4 pt-4 pb-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Участники</div>
          </div>
          <div className="px-4 pb-4 flex flex-wrap gap-2">
            {players.map(p => (
              <span key={p.userId} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs border border-white/10 text-foreground">
                {p.name} <span className="ml-1 text-muted-foreground font-mono">{p.level}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Absent players */}
        <div className={cn("rounded-xl border", absentIds.size > 0 ? "bg-amber-500/5 border-amber-500/20" : "bg-card border-white/5")}>
          <div className="px-4 pt-4 pb-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Неявки</div>
          </div>
          <div className="px-4 pb-4 space-y-3">
            <p className="text-xs text-muted-foreground">Отметь игроков, которые не пришли на матч</p>
            {players.map(p => {
              const absent = absentIds.has(p.userId);
              return (
                <label
                  key={p.userId}
                  className={cn(
                    "flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2 transition-colors",
                    absent ? "bg-amber-500/10" : "hover:bg-white/5"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={absent}
                    onChange={() => toggleAbsent(p.userId)}
                    className="w-4 h-4 accent-amber-400 cursor-pointer"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <span className={cn("text-sm font-medium", absent && "line-through text-muted-foreground")}>
                      {p.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{p.level}</span>
                  </div>
                  {absent && <span className="text-xs text-amber-400 font-medium">не явился</span>}
                </label>
              );
            })}
            {absentIds.size > 0 && (
              <div className="text-xs text-amber-400 pt-1">
                ⚠ {absentIds.size} {absentIds.size === 1 ? "игрок не явился" : "игрока(-ов) не явилось"} — будет зафиксировано при сохранении
              </div>
            )}
          </div>
        </div>

        {/* Set scores */}
        <div className="rounded-xl bg-card border border-white/5">
          <div className="p-4 space-y-3">
            <Label className="text-sm font-medium">Счёт по сетам</Label>
            <Input
              placeholder="например: 6-4, 6-3"
              value={setScores}
              onChange={e => setSetScores(e.target.value)}
              className="bg-background border-white/10 font-mono"
            />
            <p className="text-xs text-muted-foreground">Запиши счёт каждого сета через запятую</p>
          </div>
        </div>

        {/* Per-player ratings */}
        <div className="rounded-xl bg-card border border-white/5">
          <div className="px-4 pt-4 pb-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Оценки игроков</div>
          </div>
          <div className="px-4 pb-4 space-y-4">
            {players.map(p => (
              <div key={p.userId} className="flex items-center gap-4">
                <div className="w-32 shrink-0">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{p.level}</div>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={0.5}
                    value={ratings[p.userId] ?? 7}
                    onChange={e => setRatings(prev => ({ ...prev, [p.userId]: parseFloat(e.target.value) }))}
                    className="flex-1 accent-primary"
                  />
                  <span className={cn(
                    "w-10 text-center font-mono text-sm font-semibold rounded px-1",
                    (ratings[p.userId] ?? 7) >= 8 ? "text-green-400" :
                    (ratings[p.userId] ?? 7) >= 6 ? "text-primary" : "text-amber-400"
                  )}>
                    {(ratings[p.userId] ?? 7).toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conflict */}
        <div className={cn("rounded-xl border", conflict ? "bg-red-500/5 border-red-500/20" : "bg-card border-white/5")}>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Был конфликт на корте?</div>
                <div className="text-xs text-muted-foreground mt-0.5">Ругань, агрессия, споры</div>
              </div>
              <div className="flex gap-2">
                <button
                  className={cn(
                    "inline-flex items-center justify-center rounded-lg px-3 h-11 text-sm font-medium transition-all",
                    !conflict ? "bg-primary text-black" : "border border-white/10 text-foreground hover:bg-white/5"
                  )}
                  onClick={() => setConflict(false)}
                >
                  ✓ Нет
                </button>
                <button
                  className={cn(
                    "inline-flex items-center justify-center rounded-lg px-3 h-11 text-sm font-medium transition-all",
                    conflict ? "bg-destructive text-white" : "border border-white/10 text-foreground hover:bg-white/5"
                  )}
                  onClick={() => setConflict(true)}
                >
                  🚩 Да
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Overall note */}
        <div className="rounded-xl bg-card border border-white/5">
          <div className="p-4 space-y-3">
            <Label className="text-sm font-medium">Общая заметка тренера</Label>
            <Textarea
              placeholder="Общее впечатление от матча, рекомендации, наблюдения…"
              value={overallNote}
              onChange={e => setOverallNote(e.target.value)}
              rows={3}
              className="bg-background border-white/10 resize-none"
            />
          </div>
        </div>

        <button
          className="w-full inline-flex items-center justify-center rounded-xl bg-primary text-black font-semibold h-11 text-sm transition-all hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Сохранение…" : "💾 Сохранить результат матча"}
        </button>

        {(m.setScores || m.overallNote) && (
          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <div className="p-4 space-y-2 text-sm">
              <div className="text-emerald-400 font-medium text-xs uppercase tracking-wider mb-2">Сохранено ранее</div>
              {m.setScores && <div><span className="text-muted-foreground">Счёт: </span><span className="font-mono">{m.setScores}</span></div>}
              {m.conflictOccurred && <div className="text-red-400">⚠ Конфликт был зафиксирован</div>}
              {m.overallNote && <div><span className="text-muted-foreground">Заметка: </span>{m.overallNote}</div>}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
