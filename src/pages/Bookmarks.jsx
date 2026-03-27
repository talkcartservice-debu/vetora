import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { bookmarksAPI, postsAPI, productsAPI, wishlistAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import PostCard from "@/components/shared/PostCard";
import ProductCard from "@/components/shared/ProductCard";
import { PostSkeleton, ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import EmptyState from "@/components/shared/EmptyState";
import { Bookmark, ShoppingBag, LayoutGrid, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function Bookmarks() {
  const [activeTab, setActiveTab] = useState("posts");
  const { user: currentUser } = useAuth();

  const { data: itemsResponse = {}, isLoading: itemsLoading, refetch } = useQuery({
    queryKey: ["bookmarks", currentUser?.username, activeTab],
    queryFn: async () => {
      if (activeTab === "posts") {
        const res = await bookmarksAPI.list({ target_type: "post" });
        // Fetch full post details
        if (res.data?.length > 0) {
          const promises = res.data.slice(0, 20).map(b => postsAPI.get(b.target_id).catch(() => null));
          const results = await Promise.all(promises);
          return { data: results.filter(i => !!i) };
        }
        return { data: [] };
      } else {
        const res = await wishlistAPI.list({ user_username: currentUser?.username, limit: 50 });
        // Fetch full product details for each wishlist item if needed, 
        // but wishlist usually already contains enough info. 
        // Let's ensure we have full product objects for ProductCard.
        if (res.data?.length > 0) {
          const promises = res.data.map(w => productsAPI.get(w.product_id).catch(() => null));
          const results = await Promise.all(promises);
          return { data: results.filter(i => !!i) };
        }
        return { data: [] };
      }
    },
    enabled: !!currentUser?.username,
  });

  const items = Array.isArray(itemsResponse?.data) ? itemsResponse.data : [];

  const handleRemove = async (id) => {
    try {
      if (activeTab === "posts") {
        await bookmarksAPI.remove("post", id);
      } else {
        await wishlistAPI.remove(id);
      }
      toast.success(`Removed from ${activeTab === "posts" ? "bookmarks" : "wishlist"}`);
      refetch();
    } catch (e) {
      toast.error("Failed to remove");
    }
  };

  const isLoading = itemsLoading;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
          <Bookmark className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-tight">Bookmarks</h1>
          <p className="text-sm text-slate-500">Everything you've saved for later</p>
        </div>
      </div>

      <Tabs defaultValue="posts" onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full grid-cols-2 p-1 bg-slate-100/50 rounded-xl">
          <TabsTrigger value="posts" className="rounded-lg py-2 font-bold text-xs uppercase tracking-wider">
            <LayoutGrid className="w-4 h-4 mr-2" /> Posts
          </TabsTrigger>
          <TabsTrigger value="products" className="rounded-lg py-2 font-bold text-xs uppercase tracking-wider">
            <ShoppingBag className="w-4 h-4 mr-2" /> Products
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-4">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            activeTab === "posts" ? <PostSkeleton key={i} /> : <ProductSkeleton key={i} />
          ))
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title={`No ${activeTab} saved yet`}
            description={`Save ${activeTab} you find interesting to view them here later.`}
          />
        ) : (
          <AnimatePresence>
            <div className={activeTab === "products" ? "grid grid-cols-2 gap-4" : "space-y-4"}>
              {items.map((item, idx) => (
                <motion.div 
                  key={item.id || item._id || idx}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative group"
                >
                  {activeTab === "posts" ? (
                    <PostCard post={item} currentUser={currentUser} />
                  ) : (
                    <ProductCard product={item} />
                  )}
                  
                  <button
                    onClick={() => handleRemove(item.id || item._id)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-slate-100 flex items-center justify-center text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 z-10"
                    title={`Remove from ${activeTab === "posts" ? "Bookmarks" : "Wishlist"}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
