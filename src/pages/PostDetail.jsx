import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import PostCard from "@/components/shared/PostCard";
import { ArrowLeft, Send, Loader2, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { postsAPI, commentsAPI, likesAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";

export default function PostDetail() {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get("id");
  const [commentText, setCommentText] = useState("");
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data: post, error: postError } = useQuery({
    queryKey: ["postDetail", postId],
    queryFn: async () => {
      return postsAPI.get(postId);
    },
    enabled: !!postId,
    retry: false,
  });

  const { data: commentsData = [], isLoading: commentsLoading, error: commentsError } = useQuery({
    queryKey: ["postComments", postId],
    queryFn: () => commentsAPI.list(postId, { sort: "-created_date", limit: 50 }),
    enabled: !!postId,
    retry: false,
  });
  
  // Ensure comments is always an array - backend returns { comments: [...], pagination: {...} }
  const comments = Array.isArray(commentsData) ? commentsData : commentsData?.comments || [];

  const { data: userLikesResponse = [] } = useQuery({
    queryKey: ["userLikes", currentUser?.email],
    queryFn: () => likesAPI.list({ user_email: currentUser?.email }),
    enabled: !!currentUser?.email,
  });
  const userLikes = Array.isArray(userLikesResponse) ? userLikesResponse : userLikesResponse?.data || [];

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      await commentsAPI.create({
        post_id: postId,
        author_email: currentUser.email,
        author_name: currentUser.full_name,
        content: commentText,
      });
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["postComments"] });
      queryClient.invalidateQueries({ queryKey: ["postDetail"] });
    },
  });

  // Early return if no postId (moved after all hooks)
  if (!postId) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        No post ID provided
      </div>
    );
  }

  // Handle 404 or other errors
  if (postError) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        {postError.status === 404 ? "Post not found" : "Error loading post"}
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-slate-200" />
          <div className="space-y-2">
            <div className="h-3 w-24 bg-slate-200 rounded" />
            <div className="h-2 w-16 bg-slate-100 rounded" />
          </div>
        </div>
        <div className="aspect-square bg-slate-100 rounded-3xl mb-4" />
        <div className="space-y-2">
          <div className="h-3 w-full bg-slate-200 rounded" />
          <div className="h-3 w-3/4 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 lg:py-6">
      <Link to={createPageUrl("Home")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <PostCard post={post} currentUser={currentUser} userLikes={userLikes} />

      {/* Comments */}
      <div className="mt-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          Comments 
          <span className="text-sm font-normal text-slate-400">({comments.length})</span>
        </h3>

        {/* Show comments error if any */}
        {commentsError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Failed to load comments. Please refresh.
          </div>
        )}

        {/* Add Comment */}
        <AnimatePresence>
          {currentUser && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0 border-2 border-white shadow-sm">
                {currentUser.full_name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex-1 flex gap-2">
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  className="rounded-2xl border-slate-200 bg-white h-11 focus:ring-indigo-100"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && commentText.trim()) {
                      e.preventDefault();
                      addCommentMutation.mutate();
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    if (commentText.trim()) {
                      addCommentMutation.mutate();
                    }
                  }}
                  disabled={!commentText.trim() || addCommentMutation.isPending}
                  size="icon"
                  className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 w-11 h-11 shrink-0 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                >
                  {addCommentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Comment List */}
        <div className="space-y-5">
          {commentsLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-slate-100" />
                <div className="flex-1 bg-slate-50/50 rounded-2xl p-4 space-y-2">
                  <div className="h-2.5 w-24 bg-slate-100 rounded" />
                  <div className="h-2 w-full bg-slate-50 rounded" />
                </div>
              </div>
            ))
          ) : comments.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
              <MessageCircle className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-medium">No comments yet. Be the first!</p>
            </div>
          ) : (
            comments.map((comment, i) => (
              <motion.div
                key={comment.id || comment._id || i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex gap-3 group"
              >
                <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0 border border-white shadow-sm">
                  {comment.author_avatar ? (
                    <img src={comment.author_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    comment.author_name?.[0]?.toUpperCase() || "U"
                  )}
                </div>
                <div className="flex-1">
                  <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm p-4 hover:shadow-md hover:shadow-slate-100 transition-all">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-900">{comment.author_name || "User"}</span>
                        <span className="text-[10px] text-slate-400 font-medium">@{comment.author_email?.split('@')[0]}</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">
                        {new Date(comment.created_at || comment.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{comment.content}</p>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}