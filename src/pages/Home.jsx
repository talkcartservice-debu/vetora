import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PostCard from "@/components/shared/PostCard";
import ProductCard from "@/components/shared/ProductCard";
import StoriesRow from "@/components/stories/StoriesRow";
import { PostSkeleton, ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import EmptyState from "@/components/shared/EmptyState";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { Flame, TrendingUp, Sparkles, ChevronRight, PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import RecommendedSection from "@/components/home/RecommendedSection";
import { postsAPI, productsAPI, likesAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";

export default function Home() {
  const [activeTab, setActiveTab] = useState("for_you");
  const { user: currentUser } = useAuth();

  const { data: postsResponse, isLoading: postsLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: () => postsAPI.list({ sort: "-created_at", limit: 20 }),
  });
  const posts = postsResponse?.data || [];

  const { data: trendingProductsResponse, isLoading: productsLoading } = useQuery({
    queryKey: ["trendingProducts"],
    queryFn: () => productsAPI.list({ status: "active", sort: "-sales_count", limit: 8 }),
  });
  const trendingProducts = trendingProductsResponse?.data || [];

  const { data: userLikesResponse = [] } = useQuery({
    queryKey: ["userLikes", currentUser?.email],
    queryFn: () => likesAPI.list({ user_email: currentUser?.email }),
    enabled: !!currentUser?.email,
  });
  const userLikes = Array.isArray(userLikesResponse) ? userLikesResponse : userLikesResponse?.data || [];

  const tabs = [
    { id: "for_you", label: "For You", icon: Sparkles },
    { id: "trending", label: "Trending", icon: Flame },
    { id: "following", label: "Following", icon: TrendingUp },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-0 lg:py-6">
      {/* Stories Row */}
      <StoriesRow currentUser={currentUser} />

      {/* Feed Tabs */}
      <div className="flex items-center gap-1 py-3 border-b border-slate-100 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Recommended for You */}
      {activeTab === "for_you" && <RecommendedSection currentUser={currentUser} />}

      {/* Trending Products Section */}
      {trendingProducts.length > 0 && activeTab === "for_you" && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              Trending Now
            </h2>
            <Link to={createPageUrl("Marketplace")} className="text-xs text-indigo-600 font-medium flex items-center gap-0.5">
              See all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto -mx-4 px-4 hide-scrollbar">
            <div className="flex gap-3" style={{ width: "max-content" }}>
              {productsLoading
                ? Array(4).fill(0).map((_, i) => (
                    <div key={i} className="w-40 shrink-0"><ProductSkeleton /></div>
                  ))
                : trendingProducts.slice(0, 6).map((product) => (
                    <div key={product._id || product.id} className="w-40 shrink-0">
                      <ProductCard product={product} compact />
                    </div>
                  ))}
            </div>
          </div>
        </div>
      )}

      {/* Posts Feed */}
      <div className="space-y-4">
        {postsLoading ? (
          Array(3).fill(0).map((_, i) => <PostSkeleton key={i} />)
        ) : posts.length === 0 ? (
          <EmptyState
            icon={PenSquare}
            title="Welcome to Vetora"
            description="Your feed is empty. Start by creating a post or exploring the community!"
            action={
              <div className="flex gap-3">
                <Link to={createPageUrl("CreatePost")}>
                  <Button className="bg-indigo-600 hover:bg-indigo-700">Create Post</Button>
                </Link>
                <Link to={createPageUrl("Explore")}>
                  <Button variant="outline">Explore</Button>
                </Link>
              </div>
            }
          />
        ) : (
          posts.map((post) => (
            <PostCard key={post._id || post.id} post={post} currentUser={currentUser} userLikes={userLikes} />
          ))
        )}
      </div>
    </div>
  );
}