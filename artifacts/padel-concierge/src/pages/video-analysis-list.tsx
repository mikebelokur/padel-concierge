import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useListVideoAnalyses, useCreateVideoAnalysis } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function VideoAnalysisList() {
  const { user } = useAuth();
  const { data: analyses, refetch } = useListVideoAnalyses({ userId: user?.id });
  const createAnalysis = useCreateVideoAnalysis();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    videoUrl: "",
    playerShirtColor: "",
    analysisQuery: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const payload = {
      ...formData,
      userId: user.id,
      videoUrl: formData.videoUrl || "https://example.com/video.mp4"
    };

    createAnalysis.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "Analysis Submitted", description: "Our coaches will review it shortly." });
        setFormData({ videoUrl: "", playerShirtColor: "", analysisQuery: "" });
        refetch();
      },
      onError: () => {
        toast({ title: "Submission Failed", variant: "destructive" });
      }
    });
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5 sm:space-y-8">
        <header>
          <h1 className="text-3xl font-serif mb-2">Video Analysis</h1>
          <p className="text-muted-foreground">Upload match footage for professional breakdown.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-[20px] bg-card border border-white/5">
              <div className="px-6 pt-5 pb-3">
                <div className="text-base font-medium">New Submission</div>
              </div>
              <div className="px-6 pb-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Video File (MP4, max 50MB)</Label>
                    <Input type="file" accept="video/mp4" className="bg-background border-white/10" />
                  </div>
                  <div className="space-y-2">
                    <Label>Your Shirt Color</Label>
                    <Input
                      placeholder="e.g. Black t-shirt, white shorts"
                      value={formData.playerShirtColor}
                      onChange={e => setFormData({...formData, playerShirtColor: e.target.value})}
                      required
                      className="bg-background border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>What to focus on?</Label>
                    <Textarea
                      placeholder="e.g. My backhand volleys feel weak"
                      value={formData.analysisQuery}
                      onChange={e => setFormData({...formData, analysisQuery: e.target.value})}
                      className="bg-background border-white/10 min-h-[100px]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center rounded-xl bg-primary text-black font-semibold h-11 text-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={createAnalysis.isPending}
                  >
                    {createAnalysis.isPending ? "Uploading..." : "Submit for Analysis"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-serif text-xl mb-4">Past Submissions</h3>
            {analyses?.map(analysis => (
              <div key={analysis.id} className="rounded-[20px] bg-card border border-white/5">
                <div className="p-6 flex justify-between items-center">
                  <div>
                    <div className="font-medium mb-1">Analysis #{analysis.id}</div>
                    <div className="text-sm text-muted-foreground">{analysis.uploadDate}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${
                      analysis.status === 'completed'
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : "bg-white/5 text-muted-foreground border-white/10"
                    }`}>
                      {analysis.status}
                    </span>
                    {analysis.status === 'completed' && (
                      <Link href={`/video-analysis/${analysis.id}`}>
                        <button className="inline-flex items-center justify-center rounded-xl bg-white/10 text-foreground font-medium px-4 h-9 text-sm transition-all hover:bg-white/15">
                          View Report
                        </button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {analyses?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground border border-white/5 rounded-lg border-dashed">
                No analyses submitted yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
