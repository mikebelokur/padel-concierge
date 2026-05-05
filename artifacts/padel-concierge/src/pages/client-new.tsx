import { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

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
      toast({ title: "Client added", description: `${form.name} has been added to your roster.` });
      qc.invalidateQueries({ queryKey: ["coaching-clients"] });
      setLocation(`/clients/${client.id}`);
    },
    onError: (e: Error) =>
      toast({ title: "Failed to add client", description: e.message, variant: "destructive" }),
  });

  const canSubmit = form.name.trim().length > 0 && form.email.trim().length > 0;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/clients">
            <button className="text-muted-foreground hover:text-foreground text-sm transition-colors">
              ← Back to Clients
            </button>
          </Link>
        </div>

        <header>
          <h1 className="text-3xl font-serif mb-1">New Client</h1>
          <p className="text-muted-foreground">Add a new coaching client to your roster.</p>
        </header>

        <Card className="bg-card border-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Client Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name <span className="text-red-400">*</span></Label>
                <Input
                  placeholder="e.g. Oleg Ivanov"
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
                <Label>Phone</Label>
                <Input
                  placeholder="+971 50 000 0000"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className="bg-background border-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label>Level</Label>
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
                <Label>Booking Pattern</Label>
                <Select value={form.bookingPattern} onValueChange={(v) => set("bookingPattern", v)}>
                  <SelectTrigger className="bg-background border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-white/10">
                    <SelectItem value="on_demand">On Demand</SelectItem>
                    <SelectItem value="recurring">Recurring (Weekly)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price per Session (AED)</Label>
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
              <Label>Notes</Label>
              <Input
                placeholder="Any initial notes about this client…"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className="bg-background border-white/10"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Link href="/clients">
            <Button variant="outline" className="border-white/10">Cancel</Button>
          </Link>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="shadow-lg shadow-primary/20"
          >
            {createMutation.isPending ? "Adding…" : "Add Client"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
