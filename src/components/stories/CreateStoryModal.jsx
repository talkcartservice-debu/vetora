import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { X, Image, Type, Loader2 } from "lucide-react";
import { filesAPI, storiesAPI } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const BG_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6", "#64748b"];

export default function CreateStoryModal({ currentUser, onClose }) {
  const [type, setType] = useState("text"); // "text" | "image"
  const [caption, setCaption] = useState("");
  const [bgColor, setBgColor] = useState("#6366f1");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const queryClient = useQueryClient();

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setType("image");
  };

  const handlePublish = async () => {
    if (type === "text" && !caption.trim()) {
      toast.error("Add some text to your story");
      return;
    }
    setUploading(true);
    try {
      let media_url = null;
      if (imageFile) {
        const res = await filesAPI.upload(imageFile);
        media_url = res.file_url;
      }
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await storiesAPI.create({
        author_email: currentUser.email,
        author_name: currentUser.full_name,
        media_url,
        media_type: imageFile ? "image" : "text",
        caption,
        bg_color: bgColor,
        expires_at: expires,
        is_active: true,
        views_count: 0,
      });
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      toast.success("Story published! 🎉");
      onClose();
    } catch (e) {
      toast.error("Failed to publish story");
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] bg-black/70 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-sm overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Create Story</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Preview */}
        <div className="mx-4 mt-4 rounded-2xl overflow-hidden aspect-[9/16] max-h-64 relative">
          {imagePreview ? (
            <img src={imagePreview} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: bgColor }}>
              <p className="text-white text-lg font-bold text-center px-6 break-words">{caption || "Your story text here..."}</p>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          {/* Type tabs */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => { setType("text"); setImageFile(null); setImagePreview(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${type === "text" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
            >
              <Type className="w-3.5 h-3.5" /> Text
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${type === "image" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
            >
              <Image className="w-3.5 h-3.5" /> Photo
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />

          {/* Caption */}
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder={type === "image" ? "Add a caption..." : "What's on your mind?"}
            rows={2}
            className="w-full text-sm text-slate-700 placeholder:text-slate-400 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-300 resize-none"
          />

          {/* Background colors (text only) */}
          {type === "text" && (
            <div className="flex gap-2">
              {BG_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setBgColor(c)}
                  className={`w-7 h-7 rounded-full shrink-0 transition-transform ${bgColor === c ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : "hover:scale-110"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}

          <Button
            onClick={handlePublish}
            disabled={uploading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl h-10 font-semibold"
          >
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Publishing...</> : "Share Story"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}