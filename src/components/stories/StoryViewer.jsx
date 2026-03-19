import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Send } from "lucide-react";
import { storiesAPI, messagesAPI } from "@/api/apiClient";
import { toast } from "sonner";

export default function StoryViewer({ stories = [], startIndex = 0, onClose }) {
  const [current, setCurrent] = useState(startIndex >= stories.length ? 0 : startIndex);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!stories || stories.length === 0) {
      onClose();
    }
  }, [stories, onClose]);

  const story = stories[current];

  useEffect(() => {
    if (story?._id || story?.id) {
      storiesAPI.view(story._id || story.id).catch(() => {});
    }
  }, [story?._id, story?.id]);

  useEffect(() => {
    setProgress(0);
    setLiked(false);
    if (isPaused || !story) return;

    const timer = setInterval(() => {
      setProgress(p => p + 1);
    }, 50);
    return () => clearInterval(timer);
  }, [current, isPaused, story]);

  useEffect(() => {
    if (progress >= 100) {
      if (current < stories.length - 1) {
        setCurrent(c => c + 1);
        setProgress(0);
      } else {
        onClose();
      }
    }
  }, [progress, current, stories.length, onClose]);

  const handleLike = async () => {
    if (liked) return;
    try {
      setLiked(true);
      await storiesAPI.like(story._id || story.id);
    } catch (error) {
      setLiked(false);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    try {
      await messagesAPI.send({
        recipient_email: story.author_email,
        content: `Replied to your story: "${replyText}"`,
        message_type: 'text'
      });
      toast.success("Reply sent!");
      setReplyText("");
      setIsPaused(false);
    } catch (error) {
      toast.error("Failed to send reply");
    }
  };

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
      <div className="relative w-full max-w-sm h-full max-h-screen overflow-hidden bg-black shadow-2xl">
        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-30">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{ width: i < current ? "100%" : i === current ? `${progress}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-0 right-0 px-4 flex items-center gap-3 z-30">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center relative overflow-hidden ring-2 ring-white/50 shadow-lg">
            {story.author_avatar ? (
              <img src={story.author_avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
                {story.author_name?.[0]?.toUpperCase() || story.author_email?.[0]?.toUpperCase() || "U"}
              </div>
            )}
          </div>
          <div>
            <p className="text-white text-sm font-bold drop-shadow-md">{story.author_name || story.author_email?.split('@')[0]}</p>
            <p className="text-white/80 text-[10px] drop-shadow-md">{new Date(story.created_at || story.created_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <button onClick={onClose} className="ml-auto w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center hover:bg-black/40 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Story Content */}
        <div 
          className="w-full h-full relative"
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full"
            >
              {(story.media_type === "image" || story.media_type === "video") && story.media_url ? (
                story.media_type === "video" ? (
                  <video 
                    src={story.media_url} 
                    className="w-full h-full object-cover" 
                    autoPlay 
                    playsInline 
                    muted={false}
                    onPlay={() => setIsPaused(false)}
                    onEnded={() => {
                      if (current < stories.length - 1) {
                        setCurrent(c => c + 1);
                        setProgress(0);
                      } else {
                        onClose();
                      }
                    }}
                  />
                ) : (
                  <img src={story.media_url} alt="" className="w-full h-full object-cover" />
                )
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${gradClass} flex items-center justify-center`}>
                  <p className="text-white text-3xl font-extrabold text-center px-8 leading-relaxed drop-shadow-xl">{story.caption || "✨"}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Caption overlay */}
        {story.media_url && story.caption && (
          <div className="absolute bottom-20 left-0 right-0 px-6 z-20 pointer-events-none">
            <p className="text-white text-base font-semibold bg-black/30 rounded-2xl px-4 py-3 backdrop-blur-md border border-white/10 shadow-lg">{story.caption}</p>
          </div>
        )}

        {/* Bottom actions */}
        <div className="absolute bottom-6 left-0 right-0 px-4 flex items-center gap-3 z-30">
          <form onSubmit={handleReply} className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
              placeholder="Send message..."
              className="flex-1 bg-black/40 hover:bg-black/60 focus:bg-black/70 backdrop-blur-xl border border-white/20 rounded-full h-12 px-5 text-white text-sm outline-none transition-all placeholder:text-white/40 shadow-inner"
            />
            {replyText.trim() && (
              <button type="submit" className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all">
                <Send className="w-5 h-5 text-white" />
              </button>
            )}
          </form>
          {!replyText.trim() && (
            <button 
              onClick={handleLike} 
              className={`w-12 h-12 rounded-full backdrop-blur-xl border border-white/20 flex items-center justify-center transition-all ${liked ? 'bg-red-500/20 border-red-500/50 scale-110 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-black/40 hover:bg-black/60 active:scale-90'}`}
            >
              <Heart className={`w-6 h-6 ${liked ? "fill-red-500 text-red-500 animate-bounce" : "text-white"}`} />
            </button>
          )}
        </div>

        {/* Nav zones */}
        {!isPaused && (
          <>
            <button
              onClick={() => current > 0 ? setCurrent(c => c - 1) : onClose()}
              className="absolute left-0 top-20 w-1/4 h-3/4 z-20 opacity-0 cursor-default"
            />
            <button
              onClick={() => current < stories.length - 1 ? setCurrent(c => c + 1) : onClose()}
              className="absolute right-0 top-20 w-1/4 h-3/4 z-20 opacity-0 cursor-default"
            />
          </>
        )}
      </div>
    </motion.div>
  );
}
