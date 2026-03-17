import React, { useState } from "react";
import { reviewsAPI, storeReviewsAPI } from "@/api/apiClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import StarRating from "./StarRating";

export default function OrderReviewModal({ open, onClose, order, currentUser }) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Submit one review per item in the order
      const firstItem = order.items?.[0];
      if (firstItem?.product_id) {
        await reviewsAPI.create({
          product_id: firstItem.product_id,
          store_id: order.store_id,
          reviewer_email: currentUser.email,
          reviewer_name: currentUser.display_name || currentUser.full_name,
          rating,
          title,
          content,
          is_verified_purchase: true,
        });
      }

      // Also submit a store review
      if (order.store_id) {
        await storeReviewsAPI.create({
          store_id: order.store_id,
          store_name: order.store_name,
          vendor_email: order.vendor_email,
          reviewer_email: currentUser.email,
          reviewer_name: currentUser.display_name || currentUser.full_name,
          rating,
          title,
          content,
          is_verified_purchase: true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      queryClient.invalidateQueries({ queryKey: ["storeReviews"] });
      queryClient.invalidateQueries({ queryKey: ["productReviews"] });
      toast.success("Review submitted! Thank you.");
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            Rate Your Order
          </DialogTitle>
        </DialogHeader>

        {/* Order summary */}
        <div className="bg-slate-50 rounded-xl p-3 mb-2">
          <p className="text-xs font-semibold text-slate-700">{order.store_name || "Store"}</p>
          <p className="text-[11px] text-slate-400">Order #{order.id?.slice(-8)}</p>
          {order.items?.slice(0, 2).map((item, i) => (
            <div key={i} className="flex items-center gap-2 mt-2">
              {item.product_image && <img src={item.product_image} className="w-8 h-8 rounded-lg object-cover" alt="" />}
              <p className="text-xs text-slate-600 truncate">{item.product_title}</p>
            </div>
          ))}
        </div>

        {/* Rating stars */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-2">Your Rating</label>
          <StarRating value={rating} onChange={setRating} size={7} />
          <p className="text-[11px] text-slate-400 mt-1">
            {rating === 0 ? "Tap to rate" : rating === 5 ? "Excellent!" : rating === 4 ? "Great!" : rating === 3 ? "Good" : rating === 2 ? "Fair" : "Poor"}
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Title (optional)</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Summarize your experience..."
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Review (optional)</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            placeholder="Tell others about your experience..."
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-300 resize-none"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl" size="sm">Cancel</Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={rating === 0 || submitMutation.isPending}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 rounded-xl"
            size="sm"
          >
            {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}