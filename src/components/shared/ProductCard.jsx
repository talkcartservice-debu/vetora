import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { Star, Heart, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { authAPI, wishlistAPI } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ShareModal from "./ShareModal";

export default function ProductCard({ product, compact = false }) {
  const queryClient = useQueryClient();
  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false);
  const productId = product?.id || product?._id;

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => authAPI.me(),
    retry: false,
    staleTime: 60000,
  });

  const { data: wishlistItems = [] } = useQuery({
    queryKey: ["wishlist", currentUser?.username],
    queryFn: async () => {
      const res = await wishlistAPI.list({ user_username: currentUser?.username, sort: "-created_date", limit: 200 });
      return res.items || res.data || (Array.isArray(res) ? res : []);
    },
    enabled: !!currentUser?.username,
    staleTime: 30000,
  });

  const isWishlisted = wishlistItems.some(w => (w.product_id === productId || w.product_id === product?.id || w.product_id === product?._id));

  const wishlistMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) {
        toast.error("Sign in to save items");
        return;
      }
      
      // Double check state to avoid race conditions
      if (isWishlisted) {
        await wishlistAPI.remove(productId);
      } else {
        const vendorUsername = product.vendor_username || product.store_username || "";
        
        if (!vendorUsername) {
          console.error("Missing vendor username for product", product);
        }

        await wishlistAPI.add({
          user_username: currentUser.username,
          product_id: productId,
          product_title: product.title,
          product_image: product.images?.[0],
          product_price: product.price,
          compare_at_price: product.compare_at_price,
          store_id: product.store_id,
          store_name: product.store_name,
          vendor_username: vendorUsername,
        });
        toast.success("Saved to wishlist!");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  const discount = product.compare_at_price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : 0;

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    wishlistMutation.mutate();
  };

  return (
    <>
      <Link to={createPageUrl("ProductDetail") + `?id=${productId}`}>
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl overflow-hidden border border-slate-100 hover:shadow-xl hover:shadow-slate-100 transition-all duration-300 group"
        >
          <div className="relative aspect-square overflow-hidden">
            <img
              src={product.images?.[0] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400"}
              alt={product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {discount > 0 && (
              <div className="absolute top-3 left-3 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg">
                -{discount}%
              </div>
            )}
            {product.status === "sold_out" && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-white font-bold text-sm uppercase tracking-wider">Sold Out</span>
              </div>
            )}
            <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={handleWishlist}
                className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-colors ${
                  isWishlisted
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-white/90 hover:bg-white"
                }`}
              >
                <Heart className={`w-4 h-4 transition-all ${
                  isWishlisted ? "fill-white text-white" : "text-slate-600"
                }`} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsShareModalOpen(true);
                }}
                className="w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-lg backdrop-blur-sm transition-colors"
              >
                <Share2 className="w-4 h-4 text-slate-600" />
              </motion.button>
            </div>
          </div>
          <div className={compact ? "p-2" : "p-3"}>
            <p className="text-xs text-slate-400 font-medium mb-1">{product.store_name || "Store"}</p>
            <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-tight">{product.title}</h3>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-base font-bold text-slate-900">${product.price?.toFixed(2)}</span>
              {product.compare_at_price > 0 && (
                <span className="text-xs text-slate-400 line-through">${product.compare_at_price?.toFixed(2)}</span>
              )}
            </div>
            {product.rating_avg > 0 && (
              <div className="flex items-center gap-1 mt-1.5">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="text-xs font-medium text-slate-600">{product.rating_avg?.toFixed(1)}</span>
                <span className="text-xs text-slate-400">({product.rating_count})</span>
              </div>
            )}
          </div>
        </motion.div>
      </Link>
      <ShareModal
        isOpen={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        product={product}
        currentUser={currentUser}
      />
    </>
  );
}
