import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  global_news:        { label: "Global News", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  coaching_tip:       { label: "Coaching Tip", color: "text-accent bg-accent/10 border-accent/20" },
  student_achievement:{ label: "Student Win", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  wpt_news:           { label: "WPT", color: "text-primary bg-primary/10 border-primary/20" },
};

export default function PadelNews() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "coaching_tip" });

  const { data: news = [], isLoading } = useQuery({
    queryKey: ["padel-news"],
    queryFn: () => apiFetch("/padel-news"),
  });

  const postNews = useMutation({
    mutationFn: () => apiFetch("/padel-news", {
      method: "POST",
      body: JSON.stringify({ ...form, author: user?.name ?? "Misha" }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["padel-news"] });
      setOpen(false);
      setForm({ title: "", content: "", category: "coaching_tip" });
      toast({ title: "Post published!" });
    },
  });

  const canPost = user?.role === "coach" || user?.role === "admin" || user?.role === "owner";

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif mb-1">Padel News</h1>
            <p className="text-muted-foreground">WPT updates, coaching tips, and student highlights</p>
          </div>
          {canPost && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button className="inline-flex items-center justify-center rounded-xl bg-primary text-black font-semibold px-4 h-9 text-sm transition-all hover:bg-primary/90">
                  + Post
                </button>
              </DialogTrigger>
              <DialogContent className="bg-card border-white/10">
                <DialogHeader>
                  <DialogTitle>New Post</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(CATEGORY_LABELS).map(([val, { label, color }]) => (
                        <button
                          key={val}
                          onClick={() => setForm(f => ({ ...f, category: val }))}
                          className={`px-3 py-1 rounded-full text-xs border transition-colors ${form.category === val ? color : "border-white/10 text-muted-foreground"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Post title"
                      className="bg-background border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Content</Label>
                    <Textarea
                      value={form.content}
                      onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
                      placeholder="Write your post…"
                      className="bg-background border-white/10"
                      rows={5}
                    />
                  </div>
                  <button
                    className="w-full inline-flex items-center justify-center rounded-xl bg-primary text-black font-semibold h-11 text-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => postNews.mutate()}
                    disabled={!form.title || !form.content || postNews.isPending}
                  >
                    Publish
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-4">
            {(news as any[]).map((item: any) => {
              const cat = CATEGORY_LABELS[item.category] ?? { label: item.category, color: "text-muted-foreground bg-white/5 border-white/10" };
              return (
                <div key={item.id} className="rounded-[20px] bg-card border border-white/5 hover:border-white/10 transition-colors">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${cat.color}`}>{cat.label}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <h3 className="font-serif text-lg mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{item.content}</p>
                    <div className="mt-3 pt-3 border-t border-white/5 text-xs text-muted-foreground">
                      By {item.author}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
