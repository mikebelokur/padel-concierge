import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const LEVEL_COLORS: Record<string, string> = {
  "C+": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "C":  "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  "B":  "text-green-400 bg-green-500/10 border-green-500/20",
};

export default function Clients() {
  const [search, setSearch] = useState("");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["coaching-clients"],
    queryFn: () => apiFetch("/coaching/clients"),
  });

  const filtered = (clients as any[]).filter(
    (c: any) => !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif mb-1">Clients</h1>
            <p className="text-muted-foreground">{(clients as any[]).length} coaching clients</p>
          </div>
          <Link href="/clients/new">
            <Button size="sm" className="gap-1">+ New Client</Button>
          </Link>
        </div>

        <Input
          placeholder="Search clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm bg-background border-white/10"
        />

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((client: any) => (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <Card className="bg-card border-white/5 hover:border-primary/30 transition-colors cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-serif text-lg flex-shrink-0">
                        {client.avatarInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{client.name}</span>
                          <Badge variant="outline" className={cn("text-xs", LEVEL_COLORS[client.level] ?? "")}>
                            Level {client.level}
                          </Badge>
                          {client.status === "active" && (
                            <span className="text-xs text-green-400">● active</span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {client.phone && <span className="mr-3">📱 {client.phone}</span>}
                          <span className="capitalize">{client.bookingPattern.replace("_", " ")}</span>
                          {client.pricePerSession && <span className="ml-3">💰 {client.pricePerSession} AED/session</span>}
                        </div>
                      </div>
                      <div className="text-right text-sm flex-shrink-0">
                        <div className="font-mono text-foreground">{client.totalSessions} sessions</div>
                        <div className="text-xs text-muted-foreground">{client.totalRevenue} AED total</div>
                      </div>
                    </div>
                    {client.nextSessionPlan && (
                      <div className="mt-3 pt-3 border-t border-white/5 text-xs text-muted-foreground">
                        📋 Next: {client.nextSessionPlan}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
