import { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { translateError } from "@/lib/errorMessages";

const LEVELS = ["D", "D+", "C-", "C", "C+", "B", "B+", "A"];

export default function ClientNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    level: "C",
    bookingPattern: "on_demand",
    pricePerSession: "700",
    notes: "",
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch("/coaching/clients", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          pricePerSession: parseInt(form.pricePerSession) || 700,
        }),
      }),
    onSuccess: (client: any) => {
      toast({ title: "Клиент добавлен", description: `${form.name} добавлен в ваш список.` });
      qc.invalidateQueries({ queryKey: ["coaching-clients"] });
      setLocation(`/clients/${client.id}`);
    },
    onError: (e: unknown) =>
      toast({ title: "Ошибка", description: translateError(e).message, variant: "destructive" }),
  });

  const canSubmit = form.name.trim().length > 0 && form.email.trim().length > 0;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/clients">
            <button className="text-muted-foreground hover:text-foreground text-sm transition-colors">
              ← К клиентам
            </button>
          </Link>
        </div>

        <header>
          <h1 className="text-3xl font-serif mb-1">Новый клиент</h1>
          <p className="text-muted-foreground">Добавьте нового ученика в ваш список.</p>
        </header>

        <div className="rounded-[20px] bg-card border border-white/5">
          <div className="px-6 pt-5 pb-3">
            <div className="text-base font-medium">Данные клиента</div>
          </div>
          <div className="px-6 pb-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Имя <span className="text-red-400">*</span></Label>
                <Input
                  placeholder="напр. Олег Иванов"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="bg-background border-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label>Email <span className="text-red-400">*</span></Label>
                <Input
                  type="email"
                  placeholder="client@email.com"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className="bg-background border-white/10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Телефон</Label>
                <Input
                  placeholder="+971 50 000 0000"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className="bg-background border-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label>Уровень</Label>
                <Select value={form.level} onValueChange={(v) => set("level", v)}>
                  <SelectTrigger className="bg-background border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-white/10">
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Формат занятий</Label>
                <Select value={form.bookingPattern} onValueChange={(v) => set("bookingPattern", v)}>
                  <SelectTrigger className="bg-background border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-white/10">
                    <SelectItem value="on_demand">По запросу</SelectItem>
                    <SelectItem value="recurring">Регулярные (еженедельно)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Цена за занятие (AED)</Label>
                <Input
                  type="number"
                  min="0"
                  step="50"
                  placeholder="700"
                  value={form.pricePerSession}
                  onChange={(e) => set("pricePerSession", e.target.value)}
                  className="bg-background border-white/10 font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Примечания</Label>
              <Input
                placeholder="Начальные заметки о клиенте…"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className="bg-background border-white/10"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Link href="/clients">
            <button className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-transparent font-medium text-foreground px-5 h-11 text-sm transition-all hover:bg-white/5">
              Отмена
            </button>
          </Link>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="inline-flex items-center justify-center rounded-xl bg-primary text-black font-semibold px-5 h-11 text-sm transition-all hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? "Добавляем…" : "Добавить клиента"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
