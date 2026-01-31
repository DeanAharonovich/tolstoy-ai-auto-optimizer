import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Video, Loader2, Upload, Image, CheckCircle, Zap, Shield, Target } from "lucide-react";
import { useCreateTest } from "@/hooks/use-tests";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { api } from "@shared/routes";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  productName: z.string().min(1, "Product name is required"),
  targetPopulation: z.coerce.number().min(1, "Must be at least 1"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  variants: z.array(z.object({
    name: z.string().min(1, "Variant name required"),
    videoUrl: z.string().min(1, "Video file is required"),
    thumbnailUrl: z.string().min(1, "Thumbnail is required"),
    description: z.string().optional(),
  })).min(2, "At least 2 variants are required").max(3, "Maximum 3 variants allowed"),
  // Autonomous Optimization Settings
  autonomousOptimization: z.boolean().default(false),
  minSampleSize: z.coerce.number().min(10, "Minimum 10 views").default(100),
  killSwitchThreshold: z.coerce.number().min(5).max(100).default(30),
  autoWinThreshold: z.coerce.number().min(10).max(200).default(50),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
  isEditing?: boolean;
}

export function CreateTestDialog({ open, onOpenChange, initialData, isEditing }: CreateTestDialogProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createTest = useCreateTest();
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const disabled = isEditing && initialData?.status !== 'draft';
  
  const { register, control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      productName: "",
      targetPopulation: 1000,
      startTime: new Date().toISOString().slice(0, 16),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      variants: [
        { name: "Variant A", videoUrl: "", thumbnailUrl: "", description: "" },
        { name: "Variant B", videoUrl: "", thumbnailUrl: "", description: "" },
      ],
      autonomousOptimization: false,
      minSampleSize: 100,
      killSwitchThreshold: 30,
      autoWinThreshold: 50,
    },
  });
  
  const autonomousOptimization = watch("autonomousOptimization");

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        productName: initialData.productName,
        targetPopulation: initialData.targetPopulation,
        startTime: new Date(initialData.startTime).toISOString().slice(0, 16),
        endTime: new Date(initialData.endTime).toISOString().slice(0, 16),
        variants: initialData.variants.map((v: any) => ({
          name: v.name,
          videoUrl: v.videoUrl,
          thumbnailUrl: v.thumbnailUrl,
          description: v.description || "",
        })),
        autonomousOptimization: initialData.autonomousOptimization ?? false,
        minSampleSize: initialData.minSampleSize ?? 100,
        killSwitchThreshold: initialData.killSwitchThreshold ?? 30,
        autoWinThreshold: initialData.autoWinThreshold ?? 50,
      });
    }
  }, [initialData, reset]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });

  const variants = watch("variants");

  const handleFileUpload = async (file: File, variantIndex: number, type: "video" | "thumbnail") => {
    if (disabled) return;
    const uploadKey = `${variantIndex}-${type}`;
    setUploadingFiles(prev => ({ ...prev, [uploadKey]: true }));

    try {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!response.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await response.json();
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setValue(`variants.${variantIndex}.${type === "video" ? "videoUrl" : "thumbnailUrl"}`, objectPath, { shouldValidate: true });
      toast({ title: "File Uploaded", description: "Uploaded successfully." });
    } catch (error) {
      toast({ title: "Upload Failed", description: "Failed to upload file.", variant: "destructive" });
    } finally {
      setUploadingFiles(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (disabled) return;
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
      };
      if (isEditing) {
        const res = await fetch(`/api/tests/${initialData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update test");
        queryClient.invalidateQueries({ queryKey: [api.tests.list.path] });
        queryClient.invalidateQueries({ queryKey: [api.tests.get.path, initialData.id] });
      } else {
        await createTest.mutateAsync(payload);
      }
      toast({ title: isEditing ? "Test Updated" : "Test Created", description: "Saved successfully." });
      onOpenChange(false);
      if (!isEditing) setLocation("/");
    } catch (error) {
      toast({ title: "Error", description: "Failed to save test", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">{isEditing ? "Edit A/B Test" : "Create New A/B Test"}</DialogTitle>
          <DialogDescription>
            {disabled ? "This test is already running or completed and cannot be edited." : "Configure your video experiment details and upload variants."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Test Name</Label>
              <Input {...register("name")} disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input {...register("productName")} disabled={disabled} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Target Audience Size</Label>
              <Input type="number" {...register("targetPopulation")} disabled={disabled} />
            </div>
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input type="datetime-local" {...register("startTime")} disabled={disabled} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input type="datetime-local" {...register("endTime")} disabled={disabled} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Variants (2-3 required)</Label>
                {errors.variants?.message && (
                  <p className="text-sm text-red-500 mt-1">{errors.variants.message}</p>
                )}
              </div>
              {!disabled && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    if (fields.length >= 3) {
                      toast({ title: "Maximum Reached", description: "You can only have up to 3 variants per test.", variant: "destructive" });
                      return;
                    }
                    append({ name: `Variant ${String.fromCharCode(65 + fields.length)}`, videoUrl: "", thumbnailUrl: "", description: "" });
                  }}
                  disabled={fields.length >= 3}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Variant
                </Button>
              )}
            </div>
            
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3 relative group">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-slate-700">Variant {index + 1}</h4>
                  {!disabled && fields.length > 2 && (
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => remove(index)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Name</Label>
                    <Input {...register(`variants.${index}.name`)} disabled={disabled} />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Video File</Label>
                    <div className="relative">
                      <input type="file" accept="video/*" className="hidden" id={`video-${index}`} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file, index, "video"); }} />
                      <Button type="button" variant="outline" className="w-full justify-start bg-white" onClick={() => document.getElementById(`video-${index}`)?.click()} disabled={disabled || uploadingFiles[`${index}-video`]}>
                        {uploadingFiles[`${index}-video`] ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : variants[index]?.videoUrl ? <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" /> : <Video className="w-4 h-4 mr-2 text-slate-400" />}
                        {variants[index]?.videoUrl ? "Uploaded" : "Upload video"}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-slate-500">Thumbnail Image</Label>
                    <div className="relative">
                      <input type="file" accept="image/*" className="hidden" id={`thumbnail-${index}`} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file, index, "thumbnail"); }} />
                      <Button type="button" variant="outline" className="w-full justify-start bg-white" onClick={() => document.getElementById(`thumbnail-${index}`)?.click()} disabled={disabled || uploadingFiles[`${index}-thumbnail`]}>
                        {uploadingFiles[`${index}-thumbnail`] ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : variants[index]?.thumbnailUrl ? <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" /> : <Image className="w-4 h-4 mr-2 text-slate-400" />}
                        {variants[index]?.thumbnailUrl ? "Uploaded" : "Upload thumbnail"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Automation & Guardrails Section */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <Label className="text-base font-medium">Autonomous Optimization</Label>
                  <p className="text-xs text-slate-500">AI-powered guardrails to protect brand revenue</p>
                </div>
              </div>
              <Switch
                checked={autonomousOptimization}
                onCheckedChange={(checked) => setValue("autonomousOptimization", checked)}
                disabled={disabled}
                data-testid="switch-autonomous-optimization"
              />
            </div>
            
            {autonomousOptimization && (
              <div className="space-y-4 pl-8 pt-2 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500 flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      Min. Sample Size
                    </Label>
                    <Input 
                      type="number" 
                      {...register("minSampleSize")} 
                      disabled={disabled}
                      data-testid="input-min-sample-size"
                    />
                    <p className="text-[10px] text-slate-400">Views before AI acts</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-red-500" />
                      Kill Switch (%)
                    </Label>
                    <Input 
                      type="number" 
                      {...register("killSwitchThreshold")} 
                      disabled={disabled}
                      data-testid="input-kill-switch-threshold"
                    />
                    <p className="text-[10px] text-slate-400">Disable if below avg</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-emerald-500" />
                      Auto-Win (%)
                    </Label>
                    <Input 
                      type="number" 
                      {...register("autoWinThreshold")} 
                      disabled={disabled}
                      data-testid="input-auto-win-threshold"
                    />
                    <p className="text-[10px] text-slate-400">Promote if uplift exceeds</p>
                  </div>
                </div>
                
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  <p className="font-medium mb-1">How it works:</p>
                  <ul className="text-xs space-y-1 text-amber-700">
                    <li>• <strong>Kill Switch:</strong> Variants performing {watch("killSwitchThreshold") || 30}% below average will be automatically disabled</li>
                    <li>• <strong>Auto-Win:</strong> Variants with {watch("autoWinThreshold") || 50}% uplift (statistically significant) will be promoted as winner</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            {!disabled && (
              <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Test"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
