import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { translateError } from "@/lib/errorMessages";

interface Club {
  id: number;
  name: string;
  area: string;
}

interface Slot {
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
  recurringSeriesId: string | null;
  interestedCount: number;
  interestedUserIds: number[];
}

interface NewSlotForm {
  startTime: string;
  endTime: string;
  courtNumber: string;
  priceAed: string;
  levelSuitability: string;
  notes: string;
  repeatWeekly: boolean;
  repeatUntil: string;
}

const EMPTY_NEW: NewSlotForm = {
  startTime: "",
  endTime: "",
  courtNumber: "",
  priceAed: "",
  levelSuitability: "",
  notes: "",
  repeatWeekly: false,
  repeatUntil: "",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminSlots() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [clubId, setClubId] = useState<number | null>(null);
  const [date, setDate] = useState<string>(todayISO());
  const [form, setForm] = useState<NewSlotForm>(EMPTY_NEW);

  const { data: clubs = [] } = useQuery({
    queryKey: ["slots-clubs"],
    queryFn: () => apiFetch<Club[]>("/clubs"),
  });

  // Auto-select first club
  if (clubId == null && clubs.length > 0) {
    setClubId(clubs[0].id);
  }

  const slotsKey = ["club-slots-admin", clubId, date];
  const { data: slots = [], isLoading } = useQuery({
    queryKey: slotsKey,
    queryFn: () =>
      apiFetch<Slot[]>(`/clubs/${clubId}/slots?includeAll=true&date=${date}`),
    enabled: clubId != null,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<Slot | { count: number; slots: Slot[] }>(
        `/clubs/${clubId}/slots`,
        {
          method: "POST",
          body: JSON.stringify({ ...body, date }),
        },
      ),
    onSuccess: (resp) => {
      const count =
        resp && typeof resp === "object" && "count" in resp
          ? (resp as { count: number }).count
          : 1;
      toast({
        title:
          count > 1
            ? t("adminSlots.toastAddedSeries", { count })
            : t("adminSlots.toastAdded"),
      });
      setForm(EMPTY_NEW);
      qc.invalidateQueries({ queryKey: slotsKey });
    },
    onError: (e) =>
      toast({
        title: t("common.error"),
        description: translateError(e).message,
        variant: "destructive",
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ slotId, scope }: { slotId: number; scope: "this" | "future" }) =>
      apiFetch<{ futureCancelled?: number }>(
        `/slots/${slotId}?scope=${scope}`,
        { method: "DELETE" },
      ),
    onSuccess: (resp, vars) => {
      const extra = resp?.futureCancelled ?? 0;
      toast({
        title:
          vars.scope === "future" && extra > 0
            ? t("adminSlots.toastCancelledSeries", { count: extra + 1 })
            : t("adminSlots.toastCancelled"),
      });
      qc.invalidateQueries({ queryKey: slotsKey });
    },
  });

  function handleCancel(slot: Slot) {
    if (slot.recurringSeriesId) {
      const choice = window.prompt(
        t("adminSlots.confirmCancelSeriesPrompt"),
        "1",
      );
      if (choice == null) return;
      const trimmed = choice.trim();
      if (trimmed === "1") {
        cancelMutation.mutate({ slotId: slot.id, scope: "this" });
      } else if (trimmed === "2") {
        cancelMutation.mutate({ slotId: slot.id, scope: "future" });
      }
      return;
    }
    if (window.confirm(t("adminSlots.confirmCancel"))) {
      cancelMutation.mutate({ slotId: slot.id, scope: "this" });
    }
  }

  const visibleSlots = useMemo(
    () => slots.filter((s) => s.status !== "cancelled"),
    [slots],
  );

  function handleAdd() {
    if (!form.startTime || !form.endTime) {
      toast({
        title: t("common.error"),
        description: t("adminSlots.timeRequired"),
        variant: "destructive",
      });
      return;
    }
    if (form.repeatWeekly) {
      if (!form.repeatUntil) {
        toast({
          title: t("common.error"),
          description: t("adminSlots.repeatUntilRequired"),
          variant: "destructive",
        });
        return;
      }
      if (form.repeatUntil < date) {
        toast({
          title: t("common.error"),
          description: t("adminSlots.repeatUntilTooEarly"),
          variant: "destructive",
        });
        return;
      }
    }
    createMutation.mutate({
      startTime: form.startTime,
      endTime: form.endTime,
      courtNumber: form.courtNumber || null,
      priceAed: form.priceAed || null,
      levelSuitability: form.levelSuitability || null,
      notes: form.notes || null,
      repeatWeekly: form.repeatWeekly,
      repeatUntil: form.repeatWeekly ? form.repeatUntil : undefined,
    });
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
        <header>
          <h1 className="text-2xl sm:text-3xl font-serif mb-1">{t("adminSlots.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("adminSlots.subtitle")}</p>
        </header>

        <div className="rounded-[20px] bg-card border border-white/5 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-muted-foreground">{t("adminSlots.club")}</span>
              <select
                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 h-11 text-sm"
                value={clubId ?? ""}
                onChange={(e) => setClubId(parseInt(e.target.value, 10))}
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.area}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">{t("adminSlots.date")}</span>
              <input
                type="date"
                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 h-11 text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Add new slot */}
        <div className="rounded-[20px] bg-card border border-white/5 p-4 space-y-3">
          <h2 className="font-serif text-base">{t("adminSlots.addSlot")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs text-muted-foreground">{t("adminSlots.startTime")}</span>
              <input
                type="time"
                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 h-11 text-sm"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">{t("adminSlots.endTime")}</span>
              <input
                type="time"
                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 h-11 text-sm"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">{t("adminSlots.court")}</span>
              <input
                type="text"
                placeholder="1"
                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 h-11 text-sm"
                value={form.courtNumber}
                onChange={(e) => setForm((f) => ({ ...f, courtNumber: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">{t("adminSlots.priceAed")}</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="200"
                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 h-11 text-sm"
                value={form.priceAed}
                onChange={(e) => setForm((f) => ({ ...f, priceAed: e.target.value }))}
              />
            </label>
            <label className="block col-span-2 sm:col-span-1">
              <span className="text-xs text-muted-foreground">{t("adminSlots.level")}</span>
              <input
                type="text"
                placeholder="C–C+"
                className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 h-11 text-sm"
                value={form.levelSuitability}
                onChange={(e) => setForm((f) => ({ ...f, levelSuitability: e.target.value }))}
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-muted-foreground">{t("adminSlots.notes")}</span>
            <input
              type="text"
              className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 h-11 text-sm"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <div className="rounded-lg bg-black/30 border border-white/5 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.repeatWeekly}
                onChange={(e) =>
                  setForm((f) => ({ ...f, repeatWeekly: e.target.checked }))
                }
              />
              <span>{t("adminSlots.repeatWeekly")}</span>
            </label>
            {form.repeatWeekly && (
              <label className="block">
                <span className="text-xs text-muted-foreground">
                  {t("adminSlots.repeatUntil")}
                </span>
                <input
                  type="date"
                  min={date}
                  className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 h-11 text-sm"
                  value={form.repeatUntil}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, repeatUntil: e.target.value }))
                  }
                />
                <span className="block mt-1 text-xs text-muted-foreground">
                  {t("adminSlots.repeatHint")}
                </span>
              </label>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={createMutation.isPending}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-primary text-black font-semibold px-5 text-sm hover:bg-primary/90 disabled:opacity-60"
            style={{ minHeight: "44px" }}
          >
            {createMutation.isPending ? t("common.loading") : `+ ${t("adminSlots.addSlot")}`}
          </button>
        </div>

        {/* Existing slots */}
        <div className="rounded-[20px] bg-card border border-white/5 p-4 space-y-3">
          <h2 className="font-serif text-base">{t("adminSlots.existing")}</h2>
          {isLoading ? (
            <div className="text-muted-foreground text-sm">{t("common.loading")}</div>
          ) : visibleSlots.length === 0 ? (
            <div className="text-muted-foreground text-sm">{t("adminSlots.empty")}</div>
          ) : (
            <ul className="space-y-2">
              {visibleSlots.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-black/30 border border-white/5 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {s.startTime}–{s.endTime}
                      {s.courtNumber && (
                        <span className="text-muted-foreground"> · {t("adminSlots.court")} {s.courtNumber}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                      {s.priceAed && <span>{s.priceAed} AED</span>}
                      {s.levelSuitability && <span>· {s.levelSuitability}</span>}
                      {s.notes && <span>· {s.notes}</span>}
                    </div>
                    {s.interestedCount > 0 && (
                      <div className="text-xs text-primary mt-1">
                        🔥 {t("adminSlots.interested", { count: s.interestedCount })}
                      </div>
                    )}
                    {s.recurringSeriesId && (
                      <div className="text-xs text-muted-foreground mt-1">
                        ↻ {t("adminSlots.recurringBadge")}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleCancel(s)}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                  >
                    {t("adminSlots.cancel")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
