import React, { useState, useEffect } from "react";
import { postsAPI, bookmarksAPI, followsAPI } from "@/api/apiClient";
import { Heart, MessageCircle, Share2, ShoppingBag, MoreHorizontal, Bookmark } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ShareModal from "./ShareModal";
import { formatDistanceToNow } from "date-fns";
import useEmblaCarousel from 'embla-carousel-react';

export default function PostCard({ post, currentUser }) {
  const queryClient = useQueryClient();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    };
    emblaApi.on("select", onSelect);
    onSelect();
  }, [emblaApi]);
  
  const postId = (post?.id || post?._id)?.toString();
  const authorUsername = post?.author_username;
  const isLiked = !!post?.is_liked;
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
  const { data: followStatus = { is_following: false, is_followed_by: false } } = useQuery({
    queryKey: ["followStatus", currentUser?.username, authorUsername],
    queryFn: async () => {
      if (!currentUser?.username || !authorUsername || currentUser.username === authorUsername) return { is_following: false, is_followed_by: false };
      const res = await followsAPI.check({ 
        follower_username: currentUser.username, 
        following_username: authorUsername,
        follow_type: 'user'
      });
      return {
        is_following: !!res.is_following,
        is_followed_by: !!res.is_followed_by
      };
    },
    enabled: !!currentUser?.username && !!authorUsername && currentUser.username !== authorUsername,
  });

  const isFollowing = followStatus.is_following;
  const isFollowedBy = followStatus.is_followed_by;

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
      queryClient.invalidateQueries({ queryKey: ["followStatus", currentUser?.username, authorUsername] });
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
      console.log(`Liking/Unliking post: ${postId}, current state: ${optimisticLiked}`);
      if (optimisticLiked) {
        return await postsAPI.unlike(postId);
      } else {
        return await postsAPI.like(postId);
      }
    },
    onMutate: () => {
      setOptimisticLiked(!optimisticLiked);
      setOptimisticCount(prev => optimisticLiked ? Math.max(0, prev - 1) : prev + 1);
    },
    onSuccess: (data) => {
      console.log("Like mutation success, server data:", data);
      if (data && data.likes_count !== undefined) {
        setOptimisticCount(data.likes_count);
      }
      if (data && data.is_liked !== undefined) {
        setOptimisticLiked(data.is_liked);
      }
    },
    onError: (error) => {
      console.error("Like mutation failed:", error);
      toast.error("Failed to update like");
      // Revert optimistic state
      setOptimisticLiked(isLiked);
      setOptimisticCount(post?.likes_count || 0);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["userPosts"] });
      queryClient.invalidateQueries({ queryKey: ["likedPosts"] });
      queryClient.invalidateQueries({ queryKey: ["userLikes"] });
      queryClient.invalidateQueries({ queryKey: ["postDetail", postId] });
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
      <div className="flex items-center justify-between p-4">
        <Link to={createPageUrl("Profile") + `?username=${authorUsername}`} className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm ring-2 ring-white overflow-hidden shadow-sm">
              {post.author_avatar ? (
                <img src={post.author_avatar} alt={post.author_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                  {post.author_name?.[0]?.toUpperCase() || "U"}
                </div>
              )}
            </div>
            {isFollowing && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-bold text-slate-900 hover:text-indigo-600 transition-colors">{post.author_name || "User"}</p>
              {currentUser && authorUsername && currentUser.username !== authorUsername && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      followMutation.mutate();
                    }}
                    disabled={followMutation.isPending}
                    className={`text-[11px] font-bold transition-colors ${
                      isFollowing 
                        ? "text-slate-400 hover:text-slate-600" 
                        : "text-indigo-600 hover:text-indigo-700"
                    }`}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-slate-500 font-medium">@{authorUsername}</p>
              <span className="text-[10px] text-slate-300">•</span>
              <p className="text-[11px] text-slate-400">
                {formatDistanceToNow(new Date(post.created_at || post.created_date), { addSuffix: true })}
              </p>
              {post.is_sponsored && (
                <span className="ml-1 px-1.5 py-0 bg-amber-50 text-amber-600 rounded text-[9px] font-bold uppercase tracking-wider">Sponsored</span>
              )}
            </div>
          </div>
        </Link>
        <button className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      {post.content && (
        <div className="px-4 py-2">
          <p className={`text-sm text-slate-700 leading-relaxed ${!showFullContent && "line-clamp-3"}`}>
            {post.content}
          </p>
          {post.content.length > 150 && (
            <button
              onClick={() => setShowFullContent(!showFullContent)}
              className="text-xs font-semibold text-indigo-600 mt-1 hover:text-indigo-700"
            >
              {showFullContent ? "Show Less" : "Read More"}
            </button>
          )}
        </div>
      )}

      {/* Media */}
      {post.media_urls?.length > 0 && (
        <div className="mt-1 relative group select-none">
          <div 
            className="overflow-hidden cursor-pointer" 
            ref={emblaRef}
            onDoubleClick={() => {
              if (currentUser && !optimisticLiked) {
                likeMutation.mutate();
                setShowHeartAnimation(true);
                setTimeout(() => setShowHeartAnimation(false), 1000);
              }
            }}
          >
            <div className="flex">
              {post.media_urls.map((url, i) => {
                const isVid = post.media_type === "video" || isVideoUrl(url);
                return (
                  <div key={`${url}-${i}`} className="flex-[0_0_100%] min-w-0 relative aspect-square">
                    {isVid ? (
                      <video 
                        src={url} 
                        className="w-full h-full object-cover" 
                        controls 
                        muted 
                        loop 
                        playsInline 
                      />
                    ) : (
                      <img 
                        src={url} 
                        alt="" 
                        className="w-full h-full object-cover" 
                        loading="lazy"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Pagination Indicators */}
          {post.media_urls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-10 pointer-events-none">
              {post.media_urls.map((_, i) => (
                <div 
                  key={i} 
                  className={`w-1.5 h-1.5 rounded-full shadow-sm transition-all duration-300 ${
                    i === selectedIndex ? "bg-white w-3" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Double Tap Heart Animation */}
          <AnimatePresence>
            {showHeartAnimation && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
              >
                <Heart className="w-24 h-24 fill-white text-white drop-shadow-2xl" />
              </motion.div>
            )}
          </AnimatePresence>
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
        <div className="flex items-center gap-6">
          <button
            onClick={() => currentUser && likeMutation.mutate()}
            className="flex items-center gap-1.5 group outline-none"
          >
            <motion.div 
              whileTap={{ scale: 1.4 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Heart
                className={`w-5 h-5 transition-colors duration-200 ${
                  optimisticLiked ? "fill-red-500 text-red-500" : "text-slate-500 group-hover:text-red-400"
                }`}
              />
            </motion.div>
            <span className={`text-[13px] font-semibold transition-colors ${optimisticLiked ? "text-red-500" : "text-slate-500"}`}>
              {optimisticCount > 0 ? optimisticCount.toLocaleString() : "Like"}
            </span>
          </button>

          <Link to={createPageUrl("PostDetail") + `?id=${postId}`} className="flex items-center gap-1.5 group outline-none">
            <MessageCircle className="w-5 h-5 text-slate-500 group-hover:text-indigo-500 transition-colors" />
            <span className="text-[13px] font-semibold text-slate-500 group-hover:text-indigo-500 transition-colors">
              {post.comments_count > 0 ? post.comments_count.toLocaleString() : "Comment"}
            </span>
          </Link>

          <button 
            onClick={() => currentUser && setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 group outline-none"
          >
            <Share2 className="w-5 h-5 text-slate-500 group-hover:text-indigo-500 transition-colors" />
            <span className="text-[13px] font-semibold text-slate-500 group-hover:text-indigo-500 transition-colors">
              {post.shares_count > 0 ? post.shares_count.toLocaleString() : "Share"}
            </span>
          </button>
        </div>

        <button 
          onClick={() => currentUser && saveMutation.mutate()}
          className={`p-1.5 rounded-full transition-all duration-200 ${
            isBookmarked 
              ? "text-indigo-600 bg-indigo-50" 
              : "text-slate-500 hover:text-indigo-500 hover:bg-slate-50"
          }`}
        >
          <Bookmark className={`w-5 h-5 ${isBookmarked ? "fill-current" : ""}`} />
        </button>
      </div>
    </motion.div>
  );
}