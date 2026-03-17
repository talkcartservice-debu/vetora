import React, { useState } from "react";
import { reviewsAPI, filesAPI } from "@/api/apiClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Upload, X, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function ReviewForm({ productId, currentUser, onClose }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  // Cleanup object URLs to prevent memory leaks
  React.useEffect(() => {
    return () => {
      previews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const updatedFiles = [...mediaFiles, ...files].slice(0, 5);
    
    // Revoke old previews before creating new ones
    previews.forEach(url => URL.revokeObjectURL(url));
    
    const updatedPreviews = updatedFiles.map(f => URL.createObjectURL(f));
    setMediaFiles(updatedFiles);
    setPreviews(updatedPreviews);
  };

  const removeMedia = (index) => {
    // Revoke the specific URL being removed
    URL.revokeObjectURL(previews[index]);
    
    const updatedFiles = mediaFiles.filter((_, i) => i !== index);
    const updatedPreviews = previews.filter((_, i) => i !== index);
    setMediaFiles(updatedFiles);
    setPreviews(updatedPreviews);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      let uploadedUrls = [];
      try {
        for (const file of mediaFiles) {
          const { file_url } = await filesAPI.upload(file);
          uploadedUrls.push(file_url);
        }
      } catch (error) {
        toast.error("Failed to upload media");
        throw error;
      } finally {
        setUploading(false);
      }
      
      await reviewsAPI.create({
        product_id: productId,
        reviewer_email: currentUser.email,
        reviewer_name: currentUser.full_name || currentUser.email,
        rating,
        title,
        content,
        media_urls: uploadedUrls,
        is_verified_purchase: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productReviews"] });
      toast.success("Review submitted! Thank you.");
      onClose?.();
    },
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-slate-200 p-5">
      <h4 className="font-semibold text-slate-900 mb-4">Write a Review</h4>

      {/* Star Rating */}
      <div className="flex items-center gap-1 mb-4">
        {[1, 2, 3, 4, 5].map(s => (
          <button
            key={s}
            onMouseEnter={() => setHoverRating(s)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(s)}
          >
            <Star className={`w-8 h-8 transition-colors ${s <= (hoverRating || rating) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
          </button>
        ))}
        {rating > 0 && <span className="text-sm text-slate-500 ml-2">{["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}</span>}
      </div>

      <Input
        placeholder="Review title (optional)"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="mb-3 rounded-xl"
      />
      <Textarea
        placeholder="Share your experience with this product..."
        value={content}
        onChange={e => setContent(e.target.value)}
        className="mb-3 rounded-xl h-24"
      />

      {/* Media Upload */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5" /> Add Photos / Videos (up to 5)
        </p>
        <div className="flex gap-2 flex-wrap">
          {previews.map((prev, i) => (
            <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200">
              <img src={prev} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removeMedia(i)}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
          {mediaFiles.length < 5 && (
            <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors">
              <Upload className="w-5 h-5 text-slate-400" />
              <span className="text-[9px] text-slate-400 mt-0.5">Add</span>
              <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileChange} />
            </label>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => submitMutation.mutate()}
          disabled={rating === 0 || !content.trim() || submitMutation.isPending}
          className="bg-indigo-600 hover:bg-indigo-700 rounded-xl flex-1"
        >
          {submitMutation.isPending || uploading
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {uploading ? "Uploading media..." : "Submitting..."}</>
            : "Submit Review"
          }
        </Button>
        {onClose && (
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
        )}
      </div>
    </motion.div>
  );
}