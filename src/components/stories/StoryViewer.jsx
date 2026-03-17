import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart } from "lucide-react";
import { storiesAPI } from "@/api/apiClient";

export default function StoryViewer({ stories, startIndex = 0, onClose }) {
  const [current, setCurrent] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState(false);

  const story = stories[current];

  useEffect(() => {
    if (story?._id || story?.id) {
      storiesAPI.view(story._id || story.id).catch(() => {});
    }
  }, [story?._id, story?.id]);

  useEffect(() => {
    setProgress(0);
    setLiked(false);
    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (current < stories.length - 1) {
            setCurrent(c => c + 1);
          } else {
            onClose();
          }
          return 0;
        }
        return p + 2;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [current]);

  if (!story) return null;

  const BG_GRADIENTS = {
    "#6366f1": "from-indigo-600 to-purple-700",
    "#ec4899": "from-pink-500 to-rose-600",
    "#f59e0b": "from-amber-500 to-orange-600",
    "#10b981": "from-emerald-500 to-teal-600",
    "#3b82f6": "from-blue-500 to-cyan-600",
  };
  const gradClass = BG_GRADIENTS[story.bg_color] || "from-indigo-600 to-purple-700";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
    >
      <div className="relative w-full max-w-sm h-full max-h-screen overflow-hidden">
        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{ width: i < current ? "100%" : i === current ? `${progress}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-0 right-0 px-4 flex items-center gap-3 z-10">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white">
            {story.author_name?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <p className="text-white text-xs font-semibold">{story.author_name}</p>
            <p className="text-white/60 text-[10px]">{new Date(story.created_at || story.created_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <button onClick={onClose} className="ml-auto w-8 h-8 rounded-full bg-black/40 flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Story Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full h-full"
          >
            {story.media_type === "image" && story.media_url ? (
              <img src={story.media_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${gradClass} flex items-center justify-center`}>
                <p className="text-white text-2xl font-bold text-center px-8 leading-relaxed">{story.caption || "✨"}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Caption overlay */}
        {story.media_url && story.caption && (
          <div className="absolute bottom-16 left-0 right-0 px-4">
            <p className="text-white text-sm font-medium bg-black/40 rounded-xl px-3 py-2 backdrop-blur-sm">{story.caption}</p>
          </div>
        )}

        {/* Bottom actions */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3">
          <div className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full h-10 px-4 flex items-center">
            <span className="text-white/50 text-xs">Reply to story...</span>
          </div>
          <button onClick={() => setLiked(v => !v)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <Heart className={`w-5 h-5 ${liked ? "fill-red-500 text-red-500" : "text-white"}`} />
          </button>
        </div>

        {/* Nav zones */}
        <button
          onClick={() => current > 0 ? setCurrent(c => c - 1) : onClose()}
          className="absolute left-0 top-0 w-1/3 h-full z-20 opacity-0"
        />
        <button
          onClick={() => current < stories.length - 1 ? setCurrent(c => c + 1) : onClose()}
          className="absolute right-0 top-0 w-1/3 h-full z-20 opacity-0"
        />
      </div>
    </motion.div>
  );
}