import { useMemo, useState } from "react";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useListGroupTrainings,
  useCreateGroupTraining,
  useUpdateGroupTraining,
  useCancelGroupTraining,
  useListGroupTrainingBookings,
  getListGroupTrainingsQueryKey,
  getListGroupTrainingBookingsQueryKey,
  listGroupTrainingBookings,
  type GroupTraining,
} from "@workspace/api-client-react";

const CATEGORIES = ["D-", "D", "D+", "C-", "C", "C+", "B-"] as const;
const COURTS = ["Padel 360", "Rukan", "Dubai Hills", "Dubai Sports City"];

type FormState = {
  date: string;
  time: string;
  durationMinutes: number;
  category: string;
  courtName: string;
  courtAddress: string;
  maxParticipants: number;
  priceAed: string;
  descriptionEn: string;
  descriptionRu: string;
  isRecurring: boolean;
};

function blankForm(): FormState {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    date: tomorrow.toISOString().slice(0, 10),
    time: "19:00",
    durationMinutes: 90,
    category: "D",
    courtName: "Padel 360",
    courtAddress: "",
    maxParticipants: 4,
    priceAed: "175",
    descriptionEn: "",
    descriptionRu: "",
    isRecurring: false,
  };
}

function formFromTraining(t: GroupTraining): FormState {
  const dt = new Date(t.dateTime);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
    durationMinutes: t.durationMinutes,
    category: t.category,
    courtName: t.courtName,
    courtAddress: t.courtAddress ?? "",
    maxParticipants: t.maxParticipants,
    priceAed: String(t.priceAed),
    descriptionEn: t.descriptionEn ?? "",
    descriptionRu: t.descriptionRu ?? "",
    isRecurring: t.isRecurring,
  };
}

function toIsoLocal(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const CARD_BG = "hsl(220 20% 6%)";
const CARD_BORDER = "1px solid rgba(255,255,255,0.06)";

function StatCard({ label, value, gold }: { label: string; value: string | number; gold?: boolean }) {
  return (
    <div className="rounded-[20px]" style={{ background: CARD_BG, border: CARD_BORDER }}>
      <div className="p-4">
        <div className="text-muted-foreground mb-2" style={{ fontSize: "11px" }}>{label}</div>
        <div className="font-mono font-semibold" style={{ fontSize: "22px", color: gold ? "#D4AF37" : "white" }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status, t }: { status: string; t: (k: string) => string }) {
  const colorMap: Record<string, { fg: string; bg: string }> = {
    open: { fg: "#4ade80", bg: "rgba(74,222,128,0.12)" },
    full: { fg: "#D4AF37", bg: "rgba(212,175,55,0.12)" },
    cancelled: { fg: "#f87171", bg: "rgba(248,113,113,0.12)" },
    completed: { fg: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
    booked: { fg: "#4ade80", bg: "rgba(74,222,128,0.12)" },
    attended: { fg: "#4ade80", bg: "rgba(74,222,128,0.12)" },
    no_show: { fg: "#f87171", bg: "rgba(248,113,113,0.12)" },
  };
  const c = colorMap[status] ?? { fg: "#94a3b8", bg: "rgba(148,163,184,0.12)" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
      style={{ color: c.fg, background: c.bg, border: `1px solid ${c.fg}40` }}
    >
      {t(`coachTrainings.status.${status}`)}
    </span>
  );
}

function TrainingForm({
  mode,
  initial,
  onSubmit,
  saving,
}: {
  mode: "create" | "edit";
  initial: FormState;
  onSubmit: (f: FormState) => void;
  saving: boolean;
}) {
  const { t } = useLanguage();
  const [f, setF] = useState<FormState>(initial);

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(f);
  };

  const fieldCls = "w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#D4AF37]/50";
  const labelCls = "text-muted-foreground mb-1 block";

  return (
    <form onSubmit={handle} className="space-y-3" style={{ fontSize: "13px" }}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t("coachTrainings.form.date")}</label>
          <input
            type="date"
            value={f.date}
            onChange={(e) => setF({ ...f, date: e.target.value })}
            className={fieldCls}
            required
          />
        </div>
        <div>
          <label className={labelCls}>{t("coachTrainings.form.time")}</label>
          <input
            type="time"
            value={f.time}
            onChange={(e) => setF({ ...f, time: e.target.value })}
            className={fieldCls}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t("coachTrainings.form.duration")}</label>
          <input
            type="number"
            min={30}
            max={240}
            step={15}
            value={f.durationMinutes}
            onChange={(e) => setF({ ...f, durationMinutes: parseInt(e.target.value, 10) || 90 })}
            className={fieldCls}
            required
          />
        </div>
        <div>
          <label className={labelCls}>{t("coachTrainings.form.category")}</label>
          <select
            value={f.category}
            onChange={(e) => setF({ ...f, category: e.target.value })}
            className={fieldCls}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>{t("coachTrainings.form.court")}</label>
        <input
          list="court-options"
          value={f.courtName}
          onChange={(e) => setF({ ...f, courtName: e.target.value })}
          className={fieldCls}
          required
        />
        <datalist id="court-options">
          {COURTS.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>

      <div>
        <label className={labelCls}>{t("coachTrainings.form.courtAddress")}</label>
        <input
          type="text"
          value={f.courtAddress}
          onChange={(e) => setF({ ...f, courtAddress: e.target.value })}
          className={fieldCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t("coachTrainings.form.maxParticipants")}</label>
          <input
            type="number"
            min={1}
            max={8}
            value={f.maxParticipants}
            onChange={(e) => setF({ ...f, maxParticipants: parseInt(e.target.value, 10) || 4 })}
            className={fieldCls}
            required
          />
        </div>
        <div>
          <label className={labelCls}>{t("coachTrainings.form.price")}</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={f.priceAed}
            onChange={(e) => setF({ ...f, priceAed: e.target.value })}
            className={fieldCls}
            required
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>{t("coachTrainings.form.descEn")}</label>
        <textarea
          rows={2}
          value={f.descriptionEn}
          onChange={(e) => setF({ ...f, descriptionEn: e.target.value })}
          className={fieldCls}
        />
      </div>
      <div>
        <label className={labelCls}>{t("coachTrainings.form.descRu")}</label>
        <textarea
          rows={2}
          value={f.descriptionRu}
          onChange={(e) => setF({ ...f, descriptionRu: e.target.value })}
          className={fieldCls}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={f.isRecurring}
          onChange={(e) => setF({ ...f, isRecurring: e.target.checked })}
          className="accent-[#D4AF37]"
        />
        <span className="text-white">{t("coachTrainings.form.recurring")}</span>
        <span className="text-muted-foreground ml-1">— {t("coachTrainings.form.recurringHint")}</span>
      </label>

      <DialogFooter className="pt-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold text-black transition-all active:scale-[0.97] disabled:opacity-50"
          style={{ background: "#D4AF37", height: "44px", paddingLeft: "20px", paddingRight: "20px", fontSize: "14px" }}
        >
          {saving ? t("coachTrainings.form.saving") : t("coachTrainings.form.save")}
        </button>
      </DialogFooter>
    </form>
  );
}

function BookingsPanel({ trainingId }: { trainingId: string }) {
  const { t } = useLanguage();
  const { data: bookings = [], isLoading } = useListGroupTrainingBookings(trainingId);
  if (isLoading) {
    return <div className="text-muted-foreground text-sm py-3">…</div>;
  }
  const active = (bookings as any[]).filter((b) => b.status !== "cancelled");
  if (active.length === 0) {
    return <div className="text-muted-foreground text-sm py-3">{t("coachTrainings.noBookings")}</div>;
  }
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: CARD_BORDER }}>
      {active.map((b, i) => (
        <div
          key={b.id}
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: i === 0 ? "none" : CARD_BORDER }}
        >
          <div>
            <div className="text-white text-sm font-medium">{b.player?.name ?? `#${b.userId}`}</div>
            <div className="text-muted-foreground" style={{ fontSize: "12px" }}>
              {b.player?.email ?? ""}{b.player?.phone ? ` · ${b.player.phone}` : ""}
            </div>
          </div>
          <StatusPill status={b.status} t={t} />
        </div>
      ))}
    </div>
  );
}

export default function CoachGroupTrainings() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: trainings = [], isLoading } = useListGroupTrainings();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTraining, setEditTraining] = useState<GroupTraining | null>(null);
  const [detailTraining, setDetailTraining] = useState<GroupTraining | null>(null);

  const createMut = useCreateGroupTraining({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListGroupTrainingsQueryKey() });
        toast({ title: t("coachTrainings.form.createSuccess") });
        setCreateOpen(false);
      },
      onError: () => toast({ title: t("coachTrainings.form.saveError"), variant: "destructive" }),
    },
  });

  const updateMut = useUpdateGroupTraining({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListGroupTrainingsQueryKey() });
        toast({ title: t("coachTrainings.form.updateSuccess") });
        setEditTraining(null);
      },
      onError: () => toast({ title: t("coachTrainings.form.saveError"), variant: "destructive" }),
    },
  });

  const cancelMut = useCancelGroupTraining({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListGroupTrainingsQueryKey() });
        toast({ title: t("coachTrainings.cancelToast") });
        setDetailTraining(null);
      },
      onError: () => toast({ title: t("coachTrainings.cancelError"), variant: "destructive" }),
    },
  });

  const myId = user?.id;
  const myTrainings = useMemo(
    () =>
      (trainings as GroupTraining[]).filter(
        (tr) => (user?.role === "admin" || user?.role === "owner") ? true : tr.coachId === myId,
      ),
    [trainings, myId, user?.role],
  );

  const now = Date.now();
  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 7);
  const lastWeekStart = addDays(weekStart, -7);

  const thisWeek = myTrainings.filter((tr) => {
    const ts = new Date(tr.dateTime).getTime();
    return ts >= weekStart.getTime() && ts < weekEnd.getTime() && tr.status !== "cancelled";
  });
  const lastWeek = myTrainings.filter((tr) => {
    const ts = new Date(tr.dateTime).getTime();
    return ts >= lastWeekStart.getTime() && ts < weekStart.getTime() && tr.status !== "cancelled";
  });
  const upcoming = myTrainings
    .filter((tr) => new Date(tr.dateTime).getTime() >= now && tr.status !== "cancelled")
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  const bookingsThisWeek = thisWeek.reduce((acc, tr) => acc + (tr.bookedCount ?? 0), 0);
  const revenueThisWeek = thisWeek.reduce(
    (acc, tr) => acc + (tr.bookedCount ?? 0) * Number(tr.priceAed),
    0,
  );

  // No-shows: fetch bookings for each last-week training
  const noShowQueries = useQueries({
    queries: lastWeek.map((tr) => ({
      queryKey: getListGroupTrainingBookingsQueryKey(tr.id),
      queryFn: () => listGroupTrainingBookings(tr.id),
    })),
  });
  const noShowsLastWeek = noShowQueries.reduce((acc, q) => {
    const list = (q.data as any[] | undefined) ?? [];
    return acc + list.filter((b) => b.status === "no_show").length;
  }, 0);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(language === "ru" ? "ru-RU" : "en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleCreate = (f: FormState) => {
    createMut.mutate({
      data: {
        dateTime: toIsoLocal(f.date, f.time),
        durationMinutes: f.durationMinutes,
        category: f.category,
        courtName: f.courtName,
        courtAddress: f.courtAddress || null,
        maxParticipants: f.maxParticipants,
        priceAed: f.priceAed,
        descriptionEn: f.descriptionEn || null,
        descriptionRu: f.descriptionRu || null,
        isRecurring: f.isRecurring,
        recurringPattern: f.isRecurring
          ? JSON.stringify({
              freq: "WEEKLY",
              weekday: new Date(toIsoLocal(f.date, f.time)).getDay(),
              time: f.time,
              tz: "Asia/Dubai",
            })
          : null,
      } as any,
    });
  };

  const handleUpdate = (f: FormState) => {
    if (!editTraining) return;
    updateMut.mutate({
      id: editTraining.id,
      data: {
        dateTime: toIsoLocal(f.date, f.time),
        durationMinutes: f.durationMinutes,
        category: f.category,
        courtName: f.courtName,
        courtAddress: f.courtAddress || null,
        maxParticipants: f.maxParticipants,
        priceAed: f.priceAed,
        descriptionEn: f.descriptionEn || null,
        descriptionRu: f.descriptionRu || null,
        isRecurring: f.isRecurring,
        recurringPattern: f.isRecurring
          ? JSON.stringify({
              freq: "WEEKLY",
              weekday: new Date(toIsoLocal(f.date, f.time)).getDay(),
              time: f.time,
              tz: "Asia/Dubai",
            })
          : null,
      } as any,
    });
  };

  const handleCancel = (tr: GroupTraining) => {
    const count = tr.bookedCount ?? 0;
    if (!window.confirm(t("coachTrainings.cancelConfirm", { count }))) return;
    cancelMut.mutate({ id: tr.id });
  };

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 max-w-5xl mx-auto" style={{ paddingTop: "24px", paddingBottom: "40px" }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-serif font-bold text-white mb-0.5" style={{ fontSize: "28px" }}>
              {t("coachTrainings.title")}
            </h1>
            <p className="text-muted-foreground" style={{ fontSize: "14px" }}>
              {t("coachTrainings.subtitle")}
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold text-black transition-all active:scale-[0.97]"
            style={{ background: "#D4AF37", height: "44px", paddingLeft: "16px", paddingRight: "16px", fontSize: "14px" }}
          >
            {t("coachTrainings.newButton")}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label={t("coachTrainings.statSessions")} value={thisWeek.length} />
          <StatCard label={t("coachTrainings.statBookings")} value={bookingsThisWeek} />
          <StatCard label={t("coachTrainings.statRevenue")} value={`${revenueThisWeek.toFixed(0)} AED`} gold />
          <StatCard label={t("coachTrainings.statNoShows")} value={noShowsLastWeek} />
        </div>

        <h2 className="font-medium text-muted-foreground uppercase tracking-wider mb-3" style={{ fontSize: "11px", paddingLeft: "4px" }}>
          {t("coachTrainings.upcomingHeader")}
        </h2>

        <div
          className="rounded-[20px] overflow-hidden mb-6"
          style={{ background: CARD_BG, border: CARD_BORDER }}
        >
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">…</div>
          ) : upcoming.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">{t("coachTrainings.noUpcoming")}</div>
          ) : (
            upcoming.map((tr, i) => (
              <button
                key={tr.id}
                onClick={() => setDetailTraining(tr)}
                className="w-full flex items-center justify-between px-5 cursor-pointer transition-colors hover:bg-white/[0.03] text-left"
                style={{
                  minHeight: "64px",
                  borderTop: i === 0 ? "none" : CARD_BORDER,
                }}
              >
                <div>
                  <div className="text-white font-medium" style={{ fontSize: "14px" }}>
                    {formatDateTime(tr.dateTime)} · {tr.category}
                  </div>
                  <div className="text-muted-foreground" style={{ fontSize: "12px" }}>
                    {tr.courtName} · {tr.durationMinutes} min · {Number(tr.priceAed).toFixed(0)} AED
                    {tr.isRecurring ? " · ↻" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-white" style={{ fontSize: "13px" }}>
                    {t("coachTrainings.openSlots", { count: tr.bookedCount ?? 0, max: tr.maxParticipants })}
                  </span>
                  <StatusPill status={tr.status} t={t} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md" style={{ background: CARD_BG, border: CARD_BORDER }}>
          <DialogHeader>
            <DialogTitle className="text-white">{t("coachTrainings.form.createTitle")}</DialogTitle>
          </DialogHeader>
          <TrainingForm
            mode="create"
            initial={blankForm()}
            onSubmit={handleCreate}
            saving={createMut.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTraining} onOpenChange={(o) => !o && setEditTraining(null)}>
        <DialogContent className="max-w-md" style={{ background: CARD_BG, border: CARD_BORDER }}>
          <DialogHeader>
            <DialogTitle className="text-white">{t("coachTrainings.form.editTitle")}</DialogTitle>
          </DialogHeader>
          {editTraining && (
            <TrainingForm
              mode="edit"
              initial={formFromTraining(editTraining)}
              onSubmit={handleUpdate}
              saving={updateMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Detail / bookings / cancel dialog */}
      <Dialog open={!!detailTraining} onOpenChange={(o) => !o && setDetailTraining(null)}>
        <DialogContent className="max-w-lg" style={{ background: CARD_BG, border: CARD_BORDER }}>
          {detailTraining && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white">
                  {formatDateTime(detailTraining.dateTime)} · {detailTraining.category}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-muted-foreground" style={{ fontSize: "13px" }}>
                  {detailTraining.courtName}
                  {detailTraining.courtAddress ? ` · ${detailTraining.courtAddress}` : ""} · {detailTraining.durationMinutes} min · {Number(detailTraining.priceAed).toFixed(0)} AED
                </div>
                <div>
                  <div className="text-muted-foreground uppercase tracking-wider mb-2" style={{ fontSize: "11px" }}>
                    {t("coachTrainings.bookingsHeader")}
                  </div>
                  <BookingsPanel trainingId={detailTraining.id} />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      const tr = detailTraining;
                      setDetailTraining(null);
                      setEditTraining(tr);
                    }}
                    className="flex-1 rounded-xl font-semibold text-white transition-all active:scale-[0.97]"
                    style={{ background: "rgba(255,255,255,0.06)", height: "44px", fontSize: "14px", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    {t("coachTrainings.editButton")}
                  </button>
                  <button
                    onClick={() => handleCancel(detailTraining)}
                    disabled={cancelMut.isPending}
                    className="flex-1 rounded-xl font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
                    style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", height: "44px", fontSize: "14px", border: "1px solid rgba(248,113,113,0.3)" }}
                  >
                    {t("coachTrainings.cancelButton")}
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
