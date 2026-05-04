import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useListVideoAnalyses, useCreateVideoAnalysis } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    
    // Use a placeholder URL if empty for demo purposes
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
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-serif mb-2">Video Analysis</h1>
          <p className="text-muted-foreground">Upload match footage for professional breakdown.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-card border-white/5">
              <CardHeader>
                <CardTitle>New Submission</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Video File (MP4, max 50MB)</Label>
                    <Input type="file" accept="video/mp4" className="bg-background border-white/10" />
                  </div>
                  <div className="space-y-2">
                    <Label>Your Shirt Color</Label>
                    <Input 
                      placeholder="e.g. Black t-short, white shorts" 
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
                  <Button type="submit" className="w-full" disabled={createAnalysis.isPending}>
                    {createAnalysis.isPending ? "Uploading..." : "Submit for Analysis"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-serif text-xl mb-4">Past Submissions</h3>
            {analyses?.map(analysis => (
              <Card key={analysis.id} className="bg-card border-white/5">
                <CardContent className="p-6 flex justify-between items-center">
                  <div>
                    <div className="font-medium mb-1">Analysis #{analysis.id}</div>
                    <div className="text-sm text-muted-foreground">{analysis.uploadDate}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className={
                      analysis.status === 'completed' ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-white/5 text-muted-foreground border-white/10"
                    }>
                      {analysis.status}
                    </Badge>
                    {analysis.status === 'completed' && (
                      <Link href={`/video-analysis/${analysis.id}`}>
                        <Button variant="secondary" size="sm">View Report</Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
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
