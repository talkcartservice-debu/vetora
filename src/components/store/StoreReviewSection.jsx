import React, { useState } from "react";
import { reviewsAPI, storesAPI } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ThumbsUp, MessageSquare, Send, Loader2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function StarRating({ value, onChange, size = 5, readonly = false }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(s)}
          onMouseEnter={() => !readonly && setHovered(s)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={readonly ? "cursor-default" : "cursor-pointer"}
        >
          <Star
            className={`w-${size} h-${size} transition-colors ${
              s <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "fill-slate-100 text-slate-200"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function RatingBreakdown({ reviews }) {
  const counts = [5, 4, 3, 2, 1].map(r => ({
    star: r,
    count: reviews.filter(rv => rv.rating === r).length,
  }));
  const total = reviews.length;
  const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;

  return (
    <div className="flex items-center gap-5 p-5 bg-slate-50 rounded-2xl mb-5">
      <div className="text-center shrink-0">
        <p className="text-4xl font-black text-slate-900">{avg.toFixed(1)}</p>
        <StarRating value={Math.round(avg)} readonly size={4} />
        <p className="text-xs text-slate-400 mt-1">{total} review{total !== 1 ? "s" : ""}</p>
      </div>
      <div className="flex-1 space-y-1.5">
        {counts.map(({ star, count }) => (
          <div key={star} className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-3">{star}</span>
            <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all"
                style={{ width: total ? `${(count / total) * 100}%` : "0%" }}
              />
            </div>
            <span className="text-xs text-slate-400 w-4">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review, isVendor, vendorEmail, storeId }) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState(review.vendor_reply || "");
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const reviewId = review._id || review.id;

  const replyMutation = useMutation({
    mutationFn: () => reviewsAPI.update(reviewId, {
      vendor_reply: replyText,
      vendor_replied_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      toast.success("Reply posted!");
      setShowReply(false);
      queryClient.invalidateQueries({ queryKey: ["storeReviews", storeId] });
    },
  });

  const helpfulMutation = useMutation({
    mutationFn: () => reviewsAPI.update(reviewId, {
      helpful_count: (review.helpful_count || 0) + 1,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["storeReviews", storeId] }),
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-slate-100 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {review.reviewer_name?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{review.reviewer_name || "Anonymous"}</p>
            <div className="flex items-center gap-2">
              <StarRating value={review.rating} readonly size={3} />
              {review.is_verified_purchase && (
                <Badge className="text-[9px] bg-green-50 text-green-700 border-0 px-1.5 py-0">✓ Verified</Badge>
              )}
            </div>
          </div>
        </div>
        <span className="text-[10px] text-slate-400 shrink-0">
          {new Date(review.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>

      {review.title && <p className="text-sm font-semibold text-slate-800 mb-1">{review.title}</p>}
      <p className="text-sm text-slate-600 leading-relaxed">{review.content}</p>

      {/* Vendor reply */}
      {review.vendor_reply && (
        <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
          <p className="text-xs font-semibold text-indigo-700 mb-1 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> Vendor Response
          </p>
          <p className="text-xs text-slate-600">{review.vendor_reply}</p>
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
        <button
          onClick={() => helpfulMutation.mutate()}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          Helpful ({review.helpful_count || 0})
        </button>

        {isVendor && !review.vendor_reply && (
          <button
            onClick={() => setShowReply(v => !v)}
            className="flex items-center gap-1 text-xs text-indigo-600 font-medium hover:text-indigo-800"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Reply
          </button>
        )}
        {isVendor && review.vendor_reply && (
          <button
            onClick={() => setShowReply(v => !v)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit reply
          </button>
        )}
      </div>

      <AnimatePresence>
        {showReply && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-3">
            <Textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Write a public reply to this review..."
              className="text-sm rounded-xl mb-2 min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button onClick={() => replyMutation.mutate()} disabled={!replyText.trim() || replyMutation.isPending} size="sm" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl">
                {replyMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                Post Reply
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowReply(false)}>Cancel</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function StoreReviewSection({ store, currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rating: 0, title: "", content: "" });
  const queryClient = useQueryClient();

  const isVendor = currentUser?.email === store?.owner_email;
  const canReview = currentUser && !isVendor;

  const { data: response, isLoading } = useQuery({
    queryKey: ["storeReviews", store?.id],
    queryFn: () => reviewsAPI.list({ store_id: store.id, sort: "-created_at", limit: 50 }),
    enabled: !!store?.id,
  });

  const reviews = response?.data || response?.reviews || [];

  const alreadyReviewed = reviews.some(r => r.reviewer_email === currentUser?.email);

  const submitMutation = useMutation({
    mutationFn: () => reviewsAPI.create({
      store_id: store.id,
      store_name: store.name,
      vendor_email: store.owner_email,
      reviewer_email: currentUser.email,
      reviewer_name: currentUser.full_name,
      rating: form.rating,
      title: form.title,
      content: form.content,
      helpful_count: 0,
    }),
    onSuccess: async () => {
      toast.success("Review submitted!");
      setShowForm(false);
      setForm({ rating: 0, title: "", content: "" });
      // Update store rating_avg
      const newAvg = reviews.length
        ? (reviews.reduce((s, r) => s + r.rating, 0) + form.rating) / (reviews.length + 1)
        : form.rating;
      await storesAPI.update(store.id, { rating_avg: parseFloat(newAvg.toFixed(1)) });
      queryClient.invalidateQueries({ queryKey: ["storeReviews", store.id] });
      queryClient.invalidateQueries({ queryKey: ["storeDetail", store.id] });
    },
  });

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-900">Store Reviews</h2>
        {canReview && !alreadyReviewed && (
          <Button onClick={() => setShowForm(v => !v)} size="sm" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl gap-1.5">
            <Star className="w-4 h-4" /> Write a Review
          </Button>
        )}
        {alreadyReviewed && <Badge variant="secondary" className="text-xs">You reviewed this store</Badge>}
      </div>
      
      {reviews.length > 0 && <RatingBreakdown reviews={reviews} />}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-white rounded-2xl border border-indigo-100 p-5 mb-5">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Your Review</h3>
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-1.5">Rating</p>
              <StarRating value={form.rating} onChange={r => setForm(f => ({ ...f, rating: r }))} size={6} />
            </div>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Review title (optional)"
              className="rounded-xl mb-2 text-sm"
            />
            <Textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Share your experience with this store..."
              className="rounded-xl text-sm min-h-[100px] mb-3"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={form.rating === 0 || !form.content.trim() || submitMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 rounded-xl"
              >
                {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                Submit Review
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
          <Star className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No reviews yet</p>
          <p className="text-xs text-slate-400">Be the first to review this store</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <ReviewCard
              key={review._id || review.id}
              review={review}
              isVendor={isVendor}
              vendorEmail={store?.owner_email}
              storeId={store?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}