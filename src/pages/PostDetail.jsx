import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import PostCard from "@/components/shared/PostCard";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { postsAPI, commentsAPI, likesAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";

export default function PostDetail() {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get("id");
  const [commentText, setCommentText] = useState("");
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Early return if no postId
  if (!postId) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        No post ID provided
      </div>
    );
  }

  const { data: post, error: postError } = useQuery({
    queryKey: ["postDetail", postId],
    queryFn: async () => {
      return postsAPI.get(postId);
    },
    enabled: !!postId,
    retry: false,
  });

  // Handle 404 or other errors
  if (postError) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        {postError.status === 404 ? "Post not found" : "Error loading post"}
      </div>
    );
  }

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

  if (!post) return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 lg:py-6">
      <Link to={createPageUrl("Home")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <PostCard post={post} currentUser={currentUser} userLikes={userLikes} />

      {/* Comments */}
      <div className="mt-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Comments ({comments.length})</h3>

        {/* Show comments error if any */}
        {commentsError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            Failed to load comments
          </div>
        )}

        {/* Add Comment */}
        {currentUser && (
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
              {currentUser.full_name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 flex gap-2">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="rounded-xl"
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
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 shrink-0"
              >
                {addCommentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Comment List */}
        <div className="space-y-3">
          {comments.map((comment, i) => (
            <motion.div
              key={comment.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                {comment.author_name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex-1 bg-slate-50 rounded-2xl rounded-tl-sm p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-900">{comment.author_name || "User"}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(comment.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{comment.content}</p>
              </div>
            </motion.div>
          ))}
          {comments.length === 0 && !commentsLoading && (
            <div className="text-center py-8 text-slate-400 text-sm">No comments yet. Be the first!</div>
          )}
        </div>
      </div>
    </div>
  );
}