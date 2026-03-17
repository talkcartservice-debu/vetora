import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import ProductCard from "@/components/shared/ProductCard";
import { ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import { ArrowLeft, Users, Package, CheckCircle, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import StoreReviewSection from "@/components/store/StoreReviewSection";
import StarRating from "@/components/reviews/StarRating";
import { storesAPI, productsAPI, reviewsAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";

export default function StoreDetail() {
  const params = new URLSearchParams(window.location.search);
  const storeId = params.get("id");
  const { user: currentUser } = useAuth();

  // Early return if no storeId
  if (!storeId) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        No store ID provided
      </div>
    );
  }

  const { data: store, error: storeError } = useQuery({
    queryKey: ["storeDetail", storeId],
    queryFn: async () => {
      return storesAPI.get(storeId);
    },
    enabled: !!storeId,
    retry: false,
  });

  // Handle 404 or other errors
  if (storeError) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        {storeError.status === 404 ? "Store not found" : "Error loading store"}
      </div>
    );
  }

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["storeProducts", storeId],
    queryFn: () => productsAPI.list({ store_id: storeId, status: "active", sort: "-created_date", limit: 50 }),
    enabled: !!storeId,
    retry: false,
  });

  const { data: storeReviews = [] } = useQuery({
    queryKey: ["storeReviews", storeId],
    queryFn: () => reviewsAPI.list({ store_id: storeId, sort: "-created_date", limit: 100 }),
    enabled: !!storeId,
    retry: false,
  });

  const avgRating = storeReviews.length > 0
    ? storeReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / storeReviews.length
    : (store?.rating_avg || 0);

  if (!store) return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 lg:py-6">
      <Link to={createPageUrl("Marketplace")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Marketplace
      </Link>

      {/* Store Banner */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-6">
        <div className="h-32 lg:h-48 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative">
          {store.banner_url && <img src={store.banner_url} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="p-6 -mt-10 relative">
          <div className="w-20 h-20 rounded-2xl bg-white shadow-lg border-4 border-white flex items-center justify-center text-2xl font-bold overflow-hidden">
            {store.logo_url ? (
              <img src={store.logo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="bg-gradient-to-br from-indigo-400 to-purple-500 w-full h-full flex items-center justify-center text-white">
                {store.name?.[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-900">{store.name}</h1>
              {store.is_verified && (
                <Badge className="bg-blue-100 text-blue-600 border-0"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>
              )}
            </div>
            <p className="text-sm text-slate-500 mb-3">{store.description}</p>
            <div className="flex items-center flex-wrap gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1"><Package className="w-4 h-4" /> {products.length} products</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {store.follower_count || 0} followers</span>
              {avgRating > 0 && (
                <span className="flex items-center gap-1.5">
                  <StarRating value={Math.round(avgRating)} readonly size={4} />
                  <span className="text-amber-600 font-semibold">{avgRating.toFixed(1)}</span>
                  <span className="text-slate-400">({storeReviews.length} reviews)</span>
                </span>
              )}
            </div>
            {currentUser && currentUser.email !== store.owner_email && (
              <div className="mt-4">
                <Link to={createPageUrl("Chat") + `?to=${store.owner_email}`}>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-xl gap-2" size="sm">
                    <MessageCircle className="w-4 h-4" /> Chat with Vendor
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Products */}
      <h2 className="text-lg font-bold text-slate-900 mb-4">All Products</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
        {isLoading
          ? Array(8).fill(0).map((_, i) => <ProductSkeleton key={i} />)
          : products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
      {!isLoading && products.length === 0 && (
        <div className="text-center py-16 text-slate-400">No products in this store yet</div>
      )}

      <StoreReviewSection store={store} currentUser={currentUser} />
    </div>
  );
}