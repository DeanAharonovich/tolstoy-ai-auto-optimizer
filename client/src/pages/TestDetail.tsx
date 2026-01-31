import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useTest, useTestAnalytics, useAnalyzeTest, useApplyWinner, useActivityLog, useEvaluateTest } from "@/hooks/use-tests";
import { ArrowLeft, Clock, Users, PlayCircle, BarChart2, Lightbulb, Loader2, Share2, RefreshCw, Trophy, CheckCircle2, Play, Square, Edit2, ImageOff, VideoOff, Sparkles, TrendingUp, Target, ArrowUpRight, ChevronRight, Zap, Shield, Activity, Bot, XCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreateTestDialog } from "@/components/CreateTestDialog";
import { queryClient } from "@/lib/queryClient";

const FALLBACK_THUMBNAILS = [
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=60",
];

function isValidUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/objects/')) return true;
  if (url.startsWith('http://') || url.startsWith('https://')) return true;
  return false;
}

export default function TestDetail() {
  const [, params] = useRoute("/tests/:id");
  const id = parseInt(params?.id || "0");
  
  const { data: test, isLoading: isTestLoading, refetch: refetchTest } = useTest(id);
  const [timeRange, setTimeRange] = useState<'1h' | '1d' | '1w' | '1m'>('1w');
  const { data: analytics, isLoading: isAnalyticsLoading, refetch: refetchAnalytics } = useTestAnalytics(id, timeRange);
  const { mutate: analyze, isPending: isAnalyzing, data: analysis } = useAnalyzeTest();
  const { mutate: applyWinner, isPending: isApplyingWinner } = useApplyWinner();
  const { data: activityLog, refetch: refetchActivityLog } = useActivityLog(id);
  const { mutate: evaluateTest, isPending: isEvaluating } = useEvaluateTest();
  const { toast } = useToast();
  const [selectedWinner, setSelectedWinner] = useState<number | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const handleRefresh = () => {
    refetchTest();
    refetchAnalytics();
    refetchActivityLog();
  };
  
  const handleEvaluate = () => {
    evaluateTest(id, {
      onSuccess: () => {
        toast({ title: "Evaluation Complete", description: "AI has analyzed the test performance." });
        refetchTest();
        refetchActivityLog();
      },
      onError: (error) => {
        toast({ title: "Evaluation Failed", description: error.message, variant: "destructive" });
      }
    });
  };

  const handleStartTest = async () => {
    setIsStarting(true);
    try {
      const res = await fetch(`/api/tests/${id}/start`, { method: 'POST' });
      if (!res.ok) throw new Error("Failed to start test");
      toast({ title: "Test Started", description: "Experiment is now collecting live data." });
      refetchTest();
    } catch (err) {
      toast({ title: "Error", description: "Could not start test", variant: "destructive" });
    } finally {
      setIsStarting(false);
    }
  };

  const handleImageError = (variantId: number) => {
    setImageErrors(prev => ({ ...prev, [variantId]: true }));
  };

  const getThumbnailUrl = (variant: any, idx: number): string => {
    if (imageErrors[variant.id]) {
      return FALLBACK_THUMBNAILS[idx % FALLBACK_THUMBNAILS.length];
    }
    if (isValidUrl(variant.thumbnailUrl)) {
      return variant.thumbnailUrl;
    }
    return FALLBACK_THUMBNAILS[idx % FALLBACK_THUMBNAILS.length];
  };

  const hasValidVideo = (variant: any): boolean => {
    return isValidUrl(variant.videoUrl) && !variant.videoUrl.includes('example.com');
  };

  if (isTestLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3 bg-slate-100" />
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="h-32 rounded-xl bg-slate-100" />
          <Skeleton className="h-32 rounded-xl bg-slate-100" />
          <Skeleton className="h-32 rounded-xl bg-slate-100" />
        </div>
        <Skeleton className="h-96 rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (!test) return <div className="text-center p-12">Test not found</div>;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link href="/" className="inline-flex items-center text-sm text-slate-500 hover:text-indigo-600 mb-2 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-display font-bold text-slate-900">{test.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center">
              <span className={cn(
                "w-2 h-2 rounded-full mr-2",
                test.status === 'running' ? "bg-emerald-500 animate-pulse" : 
                test.status === 'draft' ? "bg-slate-400" : "bg-blue-500"
              )} />
              {test.status === 'draft' ? "Not Started" : test.status.charAt(0).toUpperCase() + test.status.slice(1).replace('_', ' ')}
            </span>
            {test.autonomousOptimization && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium" data-testid="badge-autonomous-guardrails">
                <Zap className="w-3 h-3" />
                Autonomous Guardrails
              </span>
            )}
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-1.5" />
              {Math.ceil((new Date(test.endTime).getTime() - new Date(test.startTime).getTime()) / (1000 * 60 * 60 * 24))} days duration
            </span>
            <span className="flex items-center">
              <Users className="w-4 h-4 mr-1.5" />
              {test.targetPopulation.toLocaleString()} targeted
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {test.status === 'draft' && (
             <Button 
               onClick={handleStartTest} 
               disabled={isStarting}
               className="bg-emerald-600 hover:bg-emerald-700 text-white"
             >
               {isStarting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
               Start Test
             </Button>
           )}
           <Button variant="outline" size="sm" onClick={handleRefresh}>
             <RefreshCw className="w-4 h-4 mr-2" /> Refresh Data
           </Button>
           {test.status === 'running' && test.autonomousOptimization && (
             <Button 
               variant="outline" 
               size="sm" 
               onClick={handleEvaluate} 
               disabled={isEvaluating}
               data-testid="button-evaluate-now"
             >
               {isEvaluating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
               Evaluate Now
             </Button>
           )}
           <Button 
             variant={test.status === 'draft' ? "default" : "outline"} 
             size="sm" 
             onClick={() => setIsEditOpen(true)}
             className={cn(test.status === 'draft' ? "bg-indigo-600 text-white" : "")}
           >
             <Edit2 className="w-4 h-4 mr-2" /> 
             {test.status === 'draft' ? "Edit Configuration" : "View Configuration"}
           </Button>
        </div>
      </div>

      {/* Variants Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {test.variants.map((variant, idx) => {
          const isWinner = test.winnerVariantId === variant.id;
          const isSelected = selectedWinner === variant.id;
          const thumbUrl = getThumbnailUrl(variant, idx);
          const canPlayVideo = hasValidVideo(variant);
          
          return (
            <div 
              key={variant.id} 
              className={cn(
                "group relative bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all",
                isWinner ? "border-emerald-500 ring-2 ring-emerald-500/20" : 
                isSelected ? "border-indigo-500 ring-2 ring-indigo-500/20" : 
                variant.variantStatus === 'disabled' ? "border-red-300 opacity-60" : "border-slate-100"
              )}
              data-testid={`card-variant-${variant.id}`}
            >
              {/* Winner Badge */}
              {isWinner && (
                <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 items-end">
                  <div className="flex items-center gap-1 bg-emerald-500 text-white px-2 py-1 rounded-full text-xs font-medium" data-testid={`badge-winner-${variant.id}`}>
                    <Trophy className="w-3 h-3" />
                    Winner
                  </div>
                  {variant.variantStatus === 'winner' && variant.statusReason && (
                    <div className="flex items-center gap-1 bg-amber-500 text-white px-2 py-0.5 rounded-full text-[10px] font-medium" data-testid={`badge-system-promoted-${variant.id}`}>
                      <Bot className="w-2.5 h-2.5" />
                      System Promoted
                    </div>
                  )}
                </div>
              )}
              {/* Disabled Badge */}
              {variant.variantStatus === 'disabled' && (
                <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 items-end">
                  <div className="flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium" data-testid={`badge-disabled-${variant.id}`}>
                    <XCircle className="w-3 h-3" />
                    Disabled
                  </div>
                  <div className="flex items-center gap-1 bg-amber-500 text-white px-2 py-0.5 rounded-full text-[10px] font-medium">
                    <Bot className="w-2.5 h-2.5" />
                    AI Kill Switch
                  </div>
                </div>
              )}
              <div className="aspect-video bg-slate-100 relative overflow-hidden">
                <img 
                  src={thumbUrl} 
                  alt={variant.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  onError={() => handleImageError(variant.id)}
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  {canPlayVideo ? (
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="text-white bg-black/40 hover:bg-black/60 rounded-full h-12 w-12"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewVideo(variant.videoUrl);
                      }}
                    >
                      <PlayCircle className="w-8 h-8" />
                    </Button>
                  ) : (
                    <div className="text-white/60 flex flex-col items-center gap-1">
                      <VideoOff className="w-6 h-6" />
                      <span className="text-xs">No video</span>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
                   <div className="flex flex-col gap-1">
                     <span className="font-medium bg-black/50 px-2 py-1 rounded text-sm backdrop-blur-sm w-fit">{variant.name}</span>
                     {test.status === 'running' && (
                       <span className="text-[10px] bg-indigo-600/80 px-2 py-0.5 rounded backdrop-blur-sm w-fit flex items-center gap-1">
                         <Users className="w-3 h-3" />
                         {(analytics?.filter(a => a.variantId === variant.id).pop()?.views ?? 0).toLocaleString()} impressions
                       </span>
                     )}
                   </div>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-900">{variant.name}</h4>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-1">{variant.description || "No description provided."}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Chart Section */}
      {test.status !== 'draft' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-display font-semibold text-slate-900 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-600" />
                Performance Analytics
              </h3>
              <p className="text-sm text-slate-500">Real-time conversion metrics comparison</p>
            </div>
            <Tabs defaultValue="1w" onValueChange={(v) => setTimeRange(v as any)} className="w-auto">
              <TabsList className="bg-slate-100 p-1 rounded-lg">
                {['1h', '1d', '1w', '1m'].map(t => (
                  <TabsTrigger key={t} value={t} className="px-3 py-1.5 text-xs font-medium rounded-md data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all">
                    {t.toUpperCase()}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="h-[400px] w-full">
            {isAnalyticsLoading ? (
              <div className="h-full w-full flex items-center justify-center bg-slate-50 rounded-xl">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="timestamp" tickFormatter={(ts) => format(new Date(ts), timeRange === '1h' ? 'HH:mm' : 'MMM d')} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    dx={-10} 
                    domain={[0, 'auto']}
                    allowDataOverflow={false}
                  />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} labelStyle={{ color: '#64748b', fontSize: '12px', marginBottom: '8px' }} labelFormatter={(ts) => format(new Date(ts), 'PPP p')} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  {test.variants.map((v, i) => (
                    <Line 
                      key={v.id}
                      type="monotone" 
                      dataKey={(data: any) => data.variantId === v.id ? data.views : null} 
                      name={`${v.name} Views`}
                      stroke={['#4f46e5', '#10b981', '#f59e0b'][i % 3]} 
                      strokeWidth={3} 
                      dot={false} 
                      activeDot={{ r: 6, strokeWidth: 0 }} 
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* AI Insights Section */}
      {test.status !== 'draft' && (
        <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-indigo-900/90 via-purple-900/80 to-slate-900/90 shadow-xl backdrop-blur-xl">
          {/* Glass overlay effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg shadow-amber-500/20">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-semibold text-white flex items-center gap-2">
                    AI Insights Engine
                    <span className="text-[10px] px-2 py-0.5 bg-amber-400/20 text-amber-300 rounded-full font-medium">BETA</span>
                  </h3>
                  <p className="text-sm text-slate-300/80">Powered by advanced analytics & machine learning</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => analyze(id)}
                disabled={isAnalyzing}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm"
                data-testid="button-regenerate-analysis"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {analysis ? 'Regenerate Analysis' : 'Generate Analysis'}
              </Button>
            </div>

            {/* Loading State */}
            {isAnalyzing && (
              <div className="space-y-4">
                <div className="h-4 bg-white/10 rounded-full animate-pulse w-3/4" />
                <div className="h-4 bg-white/10 rounded-full animate-pulse w-1/2" />
                <div className="h-4 bg-white/10 rounded-full animate-pulse w-2/3" />
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="h-24 bg-white/5 rounded-xl animate-pulse" />
                  <div className="h-24 bg-white/5 rounded-xl animate-pulse" />
                  <div className="h-24 bg-white/5 rounded-xl animate-pulse" />
                </div>
              </div>
            )}

            {/* No Analysis State */}
            {!isAnalyzing && !analysis && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Lightbulb className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-300 mb-2">No analysis generated yet</p>
                <p className="text-sm text-slate-400">Click "Generate Analysis" to get AI-powered insights</p>
              </div>
            )}

            {/* Analysis Results */}
            {!isAnalyzing && analysis && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid="text-analysis-summary">
                  <p className="text-white/90 leading-relaxed">{analysis.summary}</p>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analysis.metrics.map((metric, idx) => (
                    <div 
                      key={metric.variantName}
                      data-testid={`card-metric-${idx}`}
                      className={cn(
                        "p-4 rounded-xl border transition-all",
                        idx === 0 
                          ? "bg-white/5 border-white/10" 
                          : metric.uplift && metric.uplift > 0 
                            ? "bg-emerald-500/10 border-emerald-400/30"
                            : "bg-white/5 border-white/10"
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-white/80">{metric.variantName}</span>
                        {idx > 0 && metric.uplift !== undefined && (
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1",
                            metric.uplift > 0 
                              ? "bg-emerald-400/20 text-emerald-300" 
                              : metric.uplift < 0 
                                ? "bg-red-400/20 text-red-300"
                                : "bg-slate-400/20 text-slate-300"
                          )}>
                            {metric.uplift > 0 ? <TrendingUp className="w-3 h-3" /> : null}
                            {metric.uplift > 0 ? '+' : ''}{metric.uplift.toFixed(1)}%
                          </span>
                        )}
                        {idx === 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-400/20 text-slate-300">Control</span>
                        )}
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">{metric.conversionRate.toFixed(2)}%</div>
                      <div className="text-xs text-slate-400">
                        {metric.conversions.toLocaleString()} / {metric.views.toLocaleString()} conversions
                      </div>
                    </div>
                  ))}
                </div>

                {/* Significance Badge */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10" data-testid="text-statistical-significance">
                  <Target className="w-5 h-5 text-indigo-400" />
                  <div className="flex-1">
                    <span className="text-sm text-white/80">{analysis.statisticalSignificance}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          analysis.confidence >= 95 ? "bg-emerald-400" : 
                          analysis.confidence >= 80 ? "bg-amber-400" : "bg-slate-400"
                        )}
                        style={{ width: `${Math.min(100, analysis.confidence)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{analysis.confidence}%</span>
                  </div>
                </div>

                {/* Winning Variant Reasoning */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-400/20" data-testid="text-winning-reasoning">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-emerald-400/20 rounded-lg mt-0.5">
                      <Trophy className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-emerald-300 mb-1">Why the Winner Performed Better</h4>
                      <p className="text-sm text-white/70 leading-relaxed">{analysis.winningVariantReasoning}</p>
                    </div>
                  </div>
                </div>

                {/* Revenue Growth Estimate */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-400/20" data-testid="text-revenue-growth">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-400/20 rounded-lg">
                      <ArrowUpRight className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Estimated Revenue Growth</p>
                      <p className="text-xl font-bold text-white">{analysis.estimatedRevenueGrowth}</p>
                    </div>
                  </div>
                </div>

                {/* Next Steps */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid="section-next-steps">
                  <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    Recommended Next Steps
                  </h4>
                  <ul className="space-y-2">
                    {analysis.nextSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-white/70" data-testid={`text-next-step-${idx}`}>
                        <ChevronRight className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Activity Log Section */}
      {test.status !== 'draft' && test.autonomousOptimization && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4" data-testid="section-activity-log">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-display font-semibold text-slate-900 flex items-center gap-2">
                AI Activity Log
                {activityLog && activityLog.length > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">
                    {activityLog.length} events
                  </span>
                )}
              </h3>
              <p className="text-sm text-slate-500">Autonomous actions taken by the AI optimization engine</p>
            </div>
          </div>
          
          {(!activityLog || activityLog.length === 0) ? (
            <div className="text-center py-8 text-slate-400" data-testid="activity-log-empty">
              <Bot className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No autonomous actions taken yet</p>
              <p className="text-xs mt-1">The AI will log actions here when it disables variants or promotes winners</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {activityLog.map((entry) => (
                <div 
                  key={entry.id} 
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border",
                    entry.action === 'disabled_variant' ? "bg-red-50 border-red-200" :
                    entry.action === 'promoted_winner' ? "bg-emerald-50 border-emerald-200" :
                    "bg-slate-50 border-slate-200"
                  )}
                  data-testid={`activity-log-entry-${entry.id}`}
                >
                  <div className={cn(
                    "p-1.5 rounded-lg mt-0.5",
                    entry.action === 'disabled_variant' ? "bg-red-100 text-red-600" :
                    entry.action === 'promoted_winner' ? "bg-emerald-100 text-emerald-600" :
                    "bg-indigo-100 text-indigo-600"
                  )}>
                    {entry.action === 'disabled_variant' ? <Shield className="w-4 h-4" /> :
                     entry.action === 'promoted_winner' ? <Trophy className="w-4 h-4" /> :
                     <Bot className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">{entry.message}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {format(new Date(entry.timestamp), 'PPp')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Finish Test Section */}
      {test.status === "running" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-display font-semibold text-slate-900">Finish Experiment</h3>
              <p className="text-sm text-slate-500">Select the winning variant to implement permanently.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {test.variants.map((variant) => (
              <Button
                key={variant.id}
                variant="outline"
                className={cn(
                  "h-auto py-4 px-6 flex flex-col items-center gap-2 border-2 transition-all",
                  selectedWinner === variant.id ? "border-indigo-600 bg-indigo-50/50" : "border-slate-100 hover:border-slate-200"
                )}
                onClick={() => setSelectedWinner(variant.id)}
              >
                <span className="font-semibold text-slate-900">{variant.name}</span>
                {selectedWinner === variant.id && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
              </Button>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-50">
            <Button 
              onClick={() => {
                if (!selectedWinner) {
                  toast({ title: "Select a winner", description: "Please choose which variant to implement.", variant: "destructive" });
                  return;
                }
                applyWinner({ testId: id, winnerVariantId: selectedWinner }, {
                  onSuccess: () => {
                    toast({ title: "Winner Applied", description: "100% of traffic will now be directed to the winning variant." });
                    setSelectedWinner(null);
                  }
                });
              }}
              disabled={!selectedWinner || isApplyingWinner}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[200px]"
            >
              {isApplyingWinner ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trophy className="w-4 h-4 mr-2" />}
              Apply Winner & Finish Test
            </Button>
          </div>
        </div>
      )}

      {/* Legacy Selection Logic Removed - Replaced by Footer Section above */}
      {test.status === "winner_applied" && (
        <div className="flex items-center justify-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <p className="text-emerald-700 font-medium">
            Winner applied! 100% traffic is now directed to {test.variants.find(v => v.id === test.winnerVariantId)?.name}.
          </p>
        </div>
      )}

      {/* Video Preview Dialog */}
      <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black overflow-hidden border-none">
          <video src={previewVideo || ""} controls autoPlay className="w-full h-full aspect-video" />
        </DialogContent>
      </Dialog>

      <CreateTestDialog 
        open={isEditOpen} 
        onOpenChange={setIsEditOpen} 
        initialData={test}
        isEditing={true}
      />
    </div>
  );
}
