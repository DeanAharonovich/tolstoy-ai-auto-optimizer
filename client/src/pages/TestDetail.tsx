import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useTest, useTestAnalytics, useAnalyzeTest, useApplyWinner } from "@/hooks/use-tests";
import { ArrowLeft, Clock, Users, PlayCircle, BarChart2, Lightbulb, Loader2, Share2, RefreshCw, Trophy, CheckCircle2, Play, Square, Edit2, ImageOff, VideoOff } from "lucide-react";
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
  const { toast } = useToast();
  const [selectedWinner, setSelectedWinner] = useState<number | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const handleRefresh = () => {
    refetchTest();
    refetchAnalytics();
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
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center">
              <span className={cn(
                "w-2 h-2 rounded-full mr-2",
                test.status === 'running' ? "bg-emerald-500 animate-pulse" : 
                test.status === 'draft' ? "bg-slate-400" : "bg-blue-500"
              )} />
              {test.status === 'draft' ? "Not Started" : test.status.charAt(0).toUpperCase() + test.status.slice(1).replace('_', ' ')}
            </span>
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-1.5" />
              {test.durationDays} days duration
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
                "group relative bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer",
                isWinner ? "border-emerald-500 ring-2 ring-emerald-500/20" : 
                isSelected ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-100"
              )}
              onClick={() => test.status !== "winner_applied" && setSelectedWinner(variant.id)}
            >
              {isWinner && (
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-emerald-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                  <Trophy className="w-3 h-3" />
                  Winner
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
                   <span className="font-medium bg-black/50 px-2 py-1 rounded text-sm backdrop-blur-sm">{variant.name}</span>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-900">{variant.name}</h4>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-1">{variant.description || "No description provided."}</p>
                </div>
                {isSelected && test.status !== "winner_applied" && (
                  <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                )}
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
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} labelStyle={{ color: '#64748b', fontSize: '12px', marginBottom: '8px' }} labelFormatter={(ts) => format(new Date(ts), 'PPP p')} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Line type="monotone" dataKey="views" stroke="#4f46e5" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="conversions" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Apply Winner Button */}
      {test.status === "running" && (
        <div className="flex items-center justify-center gap-4 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100">
          <div className="text-center">
            <h3 className="font-display font-semibold text-slate-900">Ready to apply the winner?</h3>
            <p className="text-sm text-slate-500 mt-1">
              {selectedWinner 
                ? `You selected ${test.variants.find(v => v.id === selectedWinner)?.name}. Click to apply and direct 100% traffic.`
                : "Select a variant above to apply as the winner."}
            </p>
          </div>
          <Button 
            onClick={() => {
              if (!selectedWinner) return;
              applyWinner({ testId: id, winnerVariantId: selectedWinner }, {
                onSuccess: () => {
                  toast({ title: "Winner Applied", description: "100% of traffic will now be directed to the winning variant." });
                }
              });
            }}
            disabled={!selectedWinner || isApplyingWinner}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isApplyingWinner ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trophy className="w-4 h-4 mr-2" />}
            Apply Winner
          </Button>
        </div>
      )}

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
