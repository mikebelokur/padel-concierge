import { AppLayout } from "@/components/layout/AppLayout";
import { useGetVideoAnalysis, getGetVideoAnalysisQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function VideoAnalysisDetail() {
  const params = useParams();
  const id = Number(params.id);
  const { data: analysis, isLoading } = useGetVideoAnalysis(id, {
    query: { enabled: !!id, queryKey: getGetVideoAnalysisQueryKey(id) }
  });

  if (isLoading) return <AppLayout><div className="p-8">Loading report...</div></AppLayout>;
  if (!analysis || !analysis.analysisReport) return <AppLayout><div className="p-8">Report not found or not completed</div></AppLayout>;

  const report = analysis.analysisReport;

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <header className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-serif mb-2">Analysis Report #{analysis.id}</h1>
            <p className="text-muted-foreground">Delivered on {analysis.deliveredAt}</p>
          </div>
          <Badge className="bg-primary/20 text-primary hover:bg-primary/30 text-sm px-3 py-1">
            Identity: {report.playerIdentity}
          </Badge>
        </header>

        <Card className="bg-card border-white/5 overflow-hidden">
          <div className="bg-primary/10 border-b border-white/5 p-6">
            <h3 className="font-serif text-xl text-primary mb-2">Cover Insight</h3>
            <p className="text-lg leading-relaxed">{report.coverInsight}</p>
          </div>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-serif text-lg mb-4 text-green-400">Strengths</h4>
              <ul className="space-y-2">
                {report.strengths?.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm"><span className="text-green-500">•</span> <span>{s}</span></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-serif text-lg mb-4 text-red-400">Key Errors</h4>
              <ul className="space-y-2">
                {report.keyErrors?.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm"><span className="text-red-500">•</span> <span>{s}</span></li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Decision Quality", val: report.decisionQuality },
            { label: "Positioning", val: report.positioning },
            { label: "Shot Selection", val: report.shotSelection },
            { label: "Tempo Consistency", val: report.tempoConsistency }
          ].map((metric, i) => (
            <Card key={i} className="bg-card border-white/5 text-center">
              <CardContent className="p-6">
                <div className="text-4xl font-mono text-accent mb-2">{metric.val}%</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{metric.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-card border-white/5">
          <CardHeader>
            <CardTitle>Action Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {report.actionPlan?.map((step, i) => (
                <div key={i} className="flex gap-4 items-start p-4 rounded-lg bg-background border border-white/5">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center font-mono text-primary text-sm">
                    {i + 1}
                  </div>
                  <div className="pt-1 text-sm">{step}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
