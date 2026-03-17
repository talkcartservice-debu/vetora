import React from "react";
import { likesAPI, wishlistAPI, ordersAPI, productsAPI } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import ProductCard from "@/components/shared/ProductCard";
import { ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import { Sparkles, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";

export default function RecommendedSection({ currentUser }) {
  // Fetch user signals: likes, wishlist, orders
  const { data: userLikesResponse } = useQuery({
    queryKey: ["userLikes", currentUser?.email],
    queryFn: async () => {
      const res = await likesAPI.list({ user_email: currentUser?.email, target_type: "product" });
      return res;
    },
    enabled: !!currentUser?.email,
    staleTime: 60000,
  });

  const { data: wishlistResponse } = useQuery({
    queryKey: ["wishlist", currentUser?.email],
    queryFn: async () => {
      const res = await wishlistAPI.list({ user_email: currentUser?.email, limit: 50, order: "desc", orderBy: "createdAt" });
      return res;
    },
    enabled: !!currentUser?.email,
    staleTime: 60000,
  });

  const { data: userOrdersResponse } = useQuery({
    queryKey: ["userOrders", currentUser?.email],
    queryFn: async () => {
      const res = await ordersAPI.list({ buyer_email: currentUser?.email, limit: 20, order: "desc", orderBy: "createdAt" });
      return res;
    },
    enabled: !!currentUser?.email,
    staleTime: 60000,
  });

  // Safely extract arrays from responses
  const userLikes = Array.isArray(userLikesResponse?.data) ? userLikesResponse.data : [];
  const wishlistItems = Array.isArray(wishlistResponse?.data) ? wishlistResponse.data : [];
  const userOrders = Array.isArray(userOrdersResponse?.data) ? userOrdersResponse.data : [];

  // Fetch products liked by user for category signals
  const likedProductIds = React.useMemo(() => userLikes.map(l => l.target_id), [userLikes]);
  const wishlistProductIds = React.useMemo(() => wishlistItems.map(w => w.product_id), [wishlistItems]);
  const purchasedProductIds = React.useMemo(() => userOrders.flatMap(o => (o.items || []).map(i => i.product_id)), [userOrders]);

  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ["recommendedProducts"],
    queryFn: async () => {
      const res = await productsAPI.list({ status: "active", limit: 40, order: "desc", orderBy: "sales_count" });
      return res.data || [];
    },
    staleTime: 120000,
  });

  // Score products: exclude already purchased, boost liked/wishlisted
  const scored = React.useMemo(() => {
    const excluded = new Set(purchasedProductIds);
    return allProducts
      .filter(p => !excluded.has(p.id))
      .map(p => {
        let score = p.sales_count || 0;
        if (likedProductIds.includes(p.id)) score += 500;
        if (wishlistProductIds.includes(p.id)) score += 300;
        // Boost similar categories from wishlist
        const wishCats = new Set(wishlistItems.map(w => w.store_name));
        if (wishCats.has(p.store_name)) score += 200;
        return { ...p, _score: score };
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, 8);
  }, [allProducts, likedProductIds, wishlistProductIds, purchasedProductIds, wishlistItems]);

  if (!currentUser || (scored.length === 0 && !isLoading)) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          Recommended for You
        </h2>
        <Link to={createPageUrl("Marketplace")} className="text-xs text-indigo-600 font-medium flex items-center gap-0.5">
          See all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="overflow-x-auto -mx-4 px-4 hide-scrollbar">
        <div className="flex gap-3" style={{ width: "max-content" }}>
          {isLoading
            ? Array(4).fill(0).map((_, i) => <div key={i} className="w-40 shrink-0"><ProductSkeleton /></div>)
            : scored.slice(0, 6).map(product => (
              <div key={product.id} className="w-40 shrink-0">
                <ProductCard product={product} compact />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}