import { useState, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Video, Loader2, Upload, Image, CheckCircle } from "lucide-react";
import { useCreateTest } from "@/hooks/use-tests";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  productName: z.string().min(1, "Product name is required"),
  targetPopulation: z.coerce.number().min(1, "Must be at least 1"),
  durationDays: z.coerce.number().min(1, "Must be at least 1 day"),
  variants: z.array(z.object({
    name: z.string().min(1, "Variant name required"),
    videoUrl: z.string().min(1, "Video file is required"),
    thumbnailUrl: z.string().min(1, "Thumbnail is required"),
    description: z.string().optional(),
  })).min(2, "At least 2 variants are required"),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTestDialog({ open, onOpenChange }: CreateTestDialogProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createTest = useCreateTest();
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  
  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      productName: "",
      targetPopulation: 1000,
      durationDays: 7,
      variants: [
        { name: "Variant A", videoUrl: "", thumbnailUrl: "", description: "" },
        { name: "Variant B", videoUrl: "", thumbnailUrl: "", description: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });

  const variants = watch("variants");

  const handleFileUpload = async (
    file: File,
    variantIndex: number,
    type: "video" | "thumbnail"
  ) => {
    const uploadKey = `${variantIndex}-${type}`;
    setUploadingFiles(prev => ({ ...prev, [uploadKey]: true }));

    try {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });

      if (!response.ok) throw new Error("Failed to get upload URL");

      const { uploadURL, objectPath } = await response.json();

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      const fieldName = type === "video" ? "videoUrl" : "thumbnailUrl";
      setValue(`variants.${variantIndex}.${fieldName}`, objectPath);

      toast({
        title: "File Uploaded",
        description: `${type === "video" ? "Video" : "Thumbnail"} uploaded successfully.`,
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingFiles(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  const onSubmit = async (data: FormValues) => {
    try {
      await createTest.mutateAsync(data);
      toast({
        title: "Test Created",
        description: "Your A/B test has been successfully scheduled.",
      });
      onOpenChange(false);
      setLocation("/");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create test",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">Create New A/B Test</DialogTitle>
          <DialogDescription>
            Configure your video experiment details and upload variants.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Test Name</Label>
              <Input id="name" {...register("name")} placeholder="e.g. Summer Sale Video Copy" data-testid="input-test-name" />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="productName">Product Name</Label>
              <Input id="productName" {...register("productName")} placeholder="e.g. Premium Plan" data-testid="input-product-name" />
              {errors.productName && <p className="text-sm text-red-500">{errors.productName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="targetPopulation">Target Audience Size</Label>
              <Input type="number" id="targetPopulation" {...register("targetPopulation")} data-testid="input-target-population" />
              {errors.targetPopulation && <p className="text-sm text-red-500">{errors.targetPopulation.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationDays">Duration (Days)</Label>
              <Input type="number" id="durationDays" {...register("durationDays")} data-testid="input-duration" />
              {errors.durationDays && <p className="text-sm text-red-500">{errors.durationDays.message}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Variants</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => append({ name: `Variant ${String.fromCharCode(65 + fields.length)}`, videoUrl: "", thumbnailUrl: "", description: "" })}
                data-testid="button-add-variant"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Variant
              </Button>
            </div>
            
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3 relative group">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-slate-700">Variant {index + 1}</h4>
                  {fields.length > 2 && (
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => remove(index)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Name</Label>
                    <Input {...register(`variants.${index}.name`)} placeholder="Variant Name" className="bg-white" data-testid={`input-variant-name-${index}`} />
                    {errors.variants?.[index]?.name && <p className="text-xs text-red-500">{errors.variants[index]?.name?.message}</p>}
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Video File</Label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        id={`video-${index}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, index, "video");
                        }}
                        data-testid={`input-video-file-${index}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start bg-white"
                        onClick={() => document.getElementById(`video-${index}`)?.click()}
                        disabled={uploadingFiles[`${index}-video`]}
                      >
                        {uploadingFiles[`${index}-video`] ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : variants[index]?.videoUrl ? (
                          <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" />
                        ) : (
                          <Video className="w-4 h-4 mr-2 text-slate-400" />
                        )}
                        {variants[index]?.videoUrl ? "Video uploaded" : "Upload video"}
                      </Button>
                    </div>
                    {errors.variants?.[index]?.videoUrl && <p className="text-xs text-red-500">{errors.variants[index]?.videoUrl?.message}</p>}
                  </div>
                  
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-slate-500">Thumbnail Image</Label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`thumbnail-${index}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, index, "thumbnail");
                        }}
                        data-testid={`input-thumbnail-file-${index}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start bg-white"
                        onClick={() => document.getElementById(`thumbnail-${index}`)?.click()}
                        disabled={uploadingFiles[`${index}-thumbnail`]}
                      >
                        {uploadingFiles[`${index}-thumbnail`] ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : variants[index]?.thumbnailUrl ? (
                          <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" />
                        ) : (
                          <Image className="w-4 h-4 mr-2 text-slate-400" />
                        )}
                        {variants[index]?.thumbnailUrl ? "Thumbnail uploaded" : "Upload thumbnail"}
                      </Button>
                    </div>
                    {errors.variants?.[index]?.thumbnailUrl && <p className="text-xs text-red-500">{errors.variants[index]?.thumbnailUrl?.message}</p>}
                  </div>
                </div>
              </div>
            ))}
            {errors.variants && <p className="text-sm text-red-500">{errors.variants.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createTest.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="button-create-test">
              {createTest.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Test
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
