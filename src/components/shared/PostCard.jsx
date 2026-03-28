import React, { useState, useEffect } from "react";
import { postsAPI, bookmarksAPI, followsAPI } from "@/api/apiClient";
import { Heart, MessageCircle, Share2, ShoppingBag, MoreHorizontal, Bookmark } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ShareModal from "./ShareModal";

export default function PostCard({ post, currentUser, userLikes = [] }) {
  const queryClient = useQueryClient();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  const postId = (post?.id || post?._id)?.toString();
  const authorUsername = post?.author_username;
  const isLiked = userLikes.some(l => String(l.target_id) === String(postId) && l.target_type === "post");
  const [optimisticLiked, setOptimisticLiked] = useState(isLiked);
  const [optimisticCount, setOptimisticCount] = useState(post?.likes_count || 0);

  // Keep optimistic state in sync with props
  useEffect(() => {
    setOptimisticLiked(isLiked);
  }, [isLiked]);

  useEffect(() => {
    setOptimisticCount(post?.likes_count || 0);
  }, [post?.likes_count]);

  // Follow state
  const { data: isFollowing = false } = useQuery({
    queryKey: ["isFollowing", currentUser?.username, authorUsername],
    queryFn: async () => {
      if (!currentUser?.username || !authorUsername || currentUser.username === authorUsername) return false;
      const res = await followsAPI.check({ 
        follower_username: currentUser.username, 
        following_username: authorUsername,
        follow_type: 'user'
      });
      return !!res.is_following;
    },
    enabled: !!currentUser?.username && !!authorUsername && currentUser.username !== authorUsername,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) {
        toast.error("Please login to follow");
        return;
      }
      if (isFollowing) {
        await followsAPI.unfollow({ 
          follower_username: currentUser.username, 
          following_username: authorUsername,
          follow_type: 'user'
        });
      } else {
        await followsAPI.follow(authorUsername, 'user');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isFollowing", currentUser?.username, authorUsername] });
      toast.success(isFollowing ? "Unfollowed" : `Following ${post.author_name || authorUsername}`);
    },
  });

  // Bookmark state
  const { data: bookmarkData } = useQuery({
    queryKey: ["isBookmarked", postId, currentUser?.email],
    queryFn: () => bookmarksAPI.check("post", postId),
    enabled: !!currentUser?.email && !!postId,
  });
  const isBookmarked = !!bookmarkData?.is_bookmarked;

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (optimisticLiked) {
        await postsAPI.unlike(postId);
      } else {
        await postsAPI.like(postId);
      }
    },
    onMutate: () => {
      setOptimisticLiked(!optimisticLiked);
      setOptimisticCount(prev => optimisticLiked ? prev - 1 : prev + 1);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["userLikes"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isBookmarked) {
        await bookmarksAPI.remove("post", postId);
      } else {
        await bookmarksAPI.add({ target_type: "post", target_id: postId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isBookmarked", postId] });
      toast.success(isBookmarked ? "Removed from saved" : "Post saved!");
    },
  });

  if (!post) return null;

  const isVideoUrl = (url) => {
    if (!url) return false;
    const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".m4v"];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext)) || url.includes("video/upload");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg hover:shadow-slate-100 transition-all duration-300"
    >
      <ShareModal 
        isOpen={isShareModalOpen} 
        onOpenChange={setIsShareModalOpen} 
        post={post} 
        currentUser={currentUser} 
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <Link to={createPageUrl("Profile") + `?username=${authorUsername}`} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm ring-2 ring-white">
            {post.author_avatar ? (
              <img src={post.author_avatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              post.author_name?.[0]?.toUpperCase() || "U"
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900 leading-none">{post.author_name || "User"}</p>
              {currentUser && authorUsername && currentUser.username !== authorUsername && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    followMutation.mutate();
                  }}
                  disabled={followMutation.isPending}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                    isFollowing 
                      ? "text-slate-400 hover:text-slate-600 bg-slate-50" 
                      : "text-indigo-600 hover:text-indigo-700 bg-indigo-50"
                  }`}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-medium mb-1">@{authorUsername}</p>
            <p className="text-[10px] text-slate-400">
              {new Date(post.created_at || post.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {post.is_sponsored && (
                <span className="ml-2 px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-medium">Sponsored</span>
              )}
            </p>
          </div>
        </Link>
        <button className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      {post.content && (
        <div className="px-4 py-2">
          <p className="text-sm text-slate-700 leading-relaxed">{post.content}</p>
        </div>
      )}

      {/* Media */}
      {post.media_urls?.length > 0 && (
        <div className="mt-1">
          {post.media_urls.length === 1 ? (
            (post.media_type === "video" || isVideoUrl(post.media_urls[0])) ? (
              <video 
                src={post.media_urls[0]} 
                className="w-full aspect-square object-cover" 
                controls
                muted
                loop
                playsInline
              />
            ) : (
              <img src={post.media_urls[0]} alt="" className="w-full aspect-square object-cover" />
            )
          ) : (
            <div className="grid grid-cols-2 gap-0.5">
              {post.media_urls.slice(0, 4).map((url, i) => {
                const isVid = post.media_type === "video" || isVideoUrl(url);
                return (
                  <div key={`${url}-${i}`} className="relative aspect-square">
                    {isVid ? (
                      <video src={url} className="w-full h-full object-cover" controls muted loop playsInline />
                    ) : (
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    )}
                    {i === 3 && post.media_urls.length > 4 && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white font-bold text-xl">
                        +{post.media_urls.length - 4}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tagged Products */}
      {post.tagged_products?.length > 0 && (
        <div className="px-4 py-2">
          <Link
            to={createPageUrl("ProductDetail") + `?id=${post.tagged_products[0]}`}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-xl text-sm text-indigo-700 font-medium hover:bg-indigo-100 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            View tagged product
          </Link>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-50">
        <div className="flex items-center gap-5">
          <button
            onClick={() => currentUser && likeMutation.mutate()}
            className="flex items-center gap-1.5 group"
          >
            <motion.div whileTap={{ scale: 1.3 }}>
              <Heart
                className={`w-5 h-5 transition-colors ${
                  optimisticLiked ? "fill-red-500 text-red-500" : "text-slate-400 group-hover:text-red-400"
                }`}
              />
            </motion.div>
            <span className={`text-xs font-medium ${optimisticLiked ? "text-red-500" : "text-slate-400"}`}>
              {optimisticCount > 0 ? optimisticCount : ""}
            </span>
          </button>

          <Link to={createPageUrl("PostDetail") + `?id=${postId}`} className="flex items-center gap-1.5 group">
            <MessageCircle className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            <span className="text-xs font-medium text-slate-400">{post.comments_count || ""}</span>
          </Link>

          <button 
            onClick={() => currentUser && setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 group"
          >
            <Share2 className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            <span className="text-xs font-medium text-slate-400">{post.shares_count || ""}</span>
          </button>
        </div>

        <button 
          onClick={() => currentUser && saveMutation.mutate()}
          className={`transition-colors ${isBookmarked ? "text-indigo-600" : "text-slate-400 hover:text-indigo-500"}`}
        >
          <Bookmark className={`w-5 h-5 ${isBookmarked ? "fill-current" : ""}`} />
        </button>
      </div>
    </motion.div>
  );
}