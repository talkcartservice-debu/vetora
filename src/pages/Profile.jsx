import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import PostCard from "@/components/shared/PostCard";
import ProductCard from "@/components/shared/ProductCard";
import { PostSkeleton, ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import ProfileEditModal from "@/components/profile/ProfileEditModal";
import {
  usersAPI, postsAPI, productsAPI, ordersAPI, reviewsAPI,
  followsAPI, likesAPI, storesAPI
} from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import {
  Grid3X3, ShoppingBag, UserPlus, UserCheck, LogOut,
  Store, Package, CheckCircle2, Clock, Truck, Pencil, Star, BadgeCheck
} from "lucide-react";
import StarRating from "@/components/reviews/StarRating";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";

const STATUS_CONFIG = {
  pending:   { icon: Clock,         color: "bg-amber-100 text-amber-700",  label: "Pending" },
  confirmed: { icon: CheckCircle2,  color: "bg-blue-100 text-blue-700",    label: "Confirmed" },
  processing:{ icon: Package,       color: "bg-indigo-100 text-indigo-700",label: "Processing" },
  shipped:   { icon: Truck,         color: "bg-purple-100 text-purple-700",label: "Shipped" },
  delivered: { icon: CheckCircle2,  color: "bg-green-100 text-green-700",  label: "Delivered" },
};

export default function Profile() {
  const params = new URLSearchParams(window.location.search);
  const profileEmail = params.get("email");
  const [activeTab, setActiveTab] = useState("posts");
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user: currentUser, logout } = useAuth();

  const targetEmail = profileEmail || currentUser?.email;
  const isOwnProfile = !profileEmail || profileEmail === currentUser?.email;

  const { data: profileUser } = useQuery({
    queryKey: ["profileUser", targetEmail],
    queryFn: async () => {
      if (isOwnProfile) return currentUser;
      return usersAPI.getProfile(targetEmail);
    },
    enabled: !!targetEmail,
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["userPosts", targetEmail],
    queryFn: async () => {
      const res = await postsAPI.list({ author_email: targetEmail, sort: "-created_date", limit: 50 });
      return res.data || [];
    },
    enabled: !!targetEmail,
  });

  const { data: userProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["userProducts", targetEmail],
    queryFn: async () => {
      const res = await productsAPI.list({ vendor_email: targetEmail, status: "active", sort: "-created_date", limit: 30 });
      return res.data || [];
    },
    enabled: !!targetEmail,
  });

  const { data: buyerOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["profileOrders", targetEmail],
    queryFn: async () => {
      const res = await ordersAPI.list({ buyer_email: targetEmail, sort: "-created_date", limit: 30 });
      return res.data || [];
    },
    enabled: !!targetEmail && isOwnProfile,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["userReviews", targetEmail],
    queryFn: async () => {
      const res = await reviewsAPI.list({ reviewer_email: targetEmail, sort: "-created_date", limit: 5 });
      return res.data || [];
    },
    enabled: !!targetEmail,
  });

  const { data: followersCount = 0 } = useQuery({
    queryKey: ["followers", targetEmail],
    queryFn: async () => {
      const res = await followsAPI.getFollowers({ following_email: targetEmail });
      const followers = Array.isArray(res) ? res : (res.data || []);
      return followers.length;
    },
    enabled: !!targetEmail,
  });

  const { data: followingCount = 0 } = useQuery({
    queryKey: ["following", targetEmail],
    queryFn: async () => {
      const res = await followsAPI.getFollowing({ follower_email: targetEmail });
      const following = Array.isArray(res) ? res : (res.data || []);
      return following.length;
    },
    enabled: !!targetEmail,
  });

  const { data: isFollowing = false } = useQuery({
    queryKey: ["isFollowing", currentUser?.email, targetEmail],
    queryFn: async () => {
      if (!currentUser?.email) return false;
      const res = await followsAPI.check({ follower_email: currentUser.email, following_email: targetEmail });
      return !!res.is_following || !!res.following;
    },
    enabled: !!currentUser?.email && !isOwnProfile,
  });

  const { data: userLikesResponse } = useQuery({
    queryKey: ["userLikes", currentUser?.email],
    queryFn: async () => {
      const res = await likesAPI.list({ user_email: currentUser?.email });
      return res;
    },
    enabled: !!currentUser?.email,
  });
  const userLikes = Array.isArray(userLikesResponse?.data) ? userLikesResponse.data : [];

  const { data: store } = useQuery({
    queryKey: ["userStore", targetEmail],
    queryFn: async () => {
      const res = await storesAPI.getByOwner(targetEmail);
      return res.data || res; // Handle both wrapped and unwrapped store response
    },
    enabled: !!targetEmail,
  });

  const { data: vendorStoreReviews = [] } = useQuery({
    queryKey: ["vendorStoreReviews", store?.id],
    queryFn: async () => {
      const res = await reviewsAPI.list({ store_id: store.id, sort: "-created_date", limit: 100 });
      return res.data || [];
    },
    enabled: !!store?.id,
  });

  const vendorAvgRating = vendorStoreReviews.length > 0
    ? vendorStoreReviews.reduce((s, r) => s + (r.rating || 0), 0) / vendorStoreReviews.length
    : 0;

  const followMutation = useMutation({
    mutationFn: async () => {
      if (isFollowing) {
        await followsAPI.unfollow({ follower_email: currentUser.email, following_email: targetEmail });
      } else {
        await followsAPI.follow(targetEmail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isFollowing"] });
      queryClient.invalidateQueries({ queryKey: ["followers"] });
      toast.success(isFollowing ? "Unfollowed" : "Following!");
    },
  });

  const displayName = profileUser?.display_name || profileUser?.full_name || "User";
  const avatarUrl = profileUser?.avatar_url;
  const bannerUrl = profileUser?.banner_url;
  const bio = profileUser?.bio;
  const completedOrders = buyerOrders.filter(o => o.status === "delivered").length;
  const totalSpent = buyerOrders.filter(o => o.status === "delivered").reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Profile Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-5 shadow-sm"
      >
        {/* Banner */}
        <div className="h-32 relative overflow-hidden bg-slate-100">
          {bannerUrl ? (
            <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          )}
        </div>

        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-10 mb-3">
            {/* Avatar */}
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-2xl">{displayName[0]?.toUpperCase()}</span>
                )}
              </div>
              {store?.is_verified && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                  <BadgeCheck className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-8">
              {isOwnProfile ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="rounded-xl gap-1.5">
                    <Pencil className="w-3.5 h-3.5" /> Edit Profile
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => logout()} className="rounded-xl">
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => followMutation.mutate()}
                    size="sm"
                    className={`rounded-xl ${isFollowing ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-indigo-600 hover:bg-indigo-700"}`}
                    variant={isFollowing ? "secondary" : "default"}
                  >
                    {isFollowing ? <><UserCheck className="w-3.5 h-3.5 mr-1" />Following</> : <><UserPlus className="w-3.5 h-3.5 mr-1" />Follow</>}
                  </Button>
                  <Link to={createPageUrl("Chat") + `?to=${targetEmail}`}>
                    <Button variant="outline" size="sm" className="rounded-xl">Message</Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Name + bio */}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">{displayName}</h1>
              {store?.is_verified && <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px] gap-0.5"><BadgeCheck className="w-3 h-3" />Verified Vendor</Badge>}
            </div>
            <p className="text-xs text-slate-400 mb-1">{profileUser?.email}</p>
            {bio && <p className="text-sm text-slate-600 leading-relaxed mt-1">{bio}</p>}
            {store && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Link to={createPageUrl("StoreDetail") + `?id=${store.id}`} className="inline-flex items-center gap-1 text-xs text-indigo-600 font-medium hover:underline">
                  <Store className="w-3.5 h-3.5" /> {store.name}
                </Link>
                {vendorAvgRating > 0 && (
                  <span className="flex items-center gap-1">
                    <StarRating value={Math.round(vendorAvgRating)} readonly size={3} />
                    <span className="text-[11px] text-amber-600 font-semibold">{vendorAvgRating.toFixed(1)}</span>
                    <span className="text-[11px] text-slate-400">({vendorStoreReviews.length})</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="flex gap-5 mt-4 pt-4 border-t border-slate-50">
            {[
              { label: "Posts", value: posts.length },
              { label: "Followers", value: followersCount },
              { label: "Following", value: followingCount },
              ...(userProducts.length > 0 ? [{ label: "Products", value: userProducts.length }] : []),
              ...(isOwnProfile && completedOrders > 0 ? [{ label: "Orders Done", value: completedOrders }] : []),
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className="text-base font-bold text-slate-900">{stat.value}</p>
                <p className="text-[10px] text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Trust badges */}
          {isOwnProfile && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {completedOrders >= 5 && (
                <Badge className="bg-green-100 text-green-700 border-0 text-[10px] gap-1"><CheckCircle2 className="w-3 h-3" />Trusted Buyer</Badge>
              )}
              {(store?.total_sales || 0) >= 10 && (
                <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] gap-1"><Star className="w-3 h-3" />Top Vendor</Badge>
              )}
              {totalSpent >= 100 && (
                <Badge className="bg-purple-100 text-purple-700 border-0 text-[10px] gap-1"><BadgeCheck className="w-3 h-3" />Power Shopper</Badge>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList className="bg-white border border-slate-100 w-full">
          <TabsTrigger value="posts" className="flex-1 gap-1.5"><Grid3X3 className="w-4 h-4" />Posts</TabsTrigger>
          <TabsTrigger value="products" className="flex-1 gap-1.5"><ShoppingBag className="w-4 h-4" />Products</TabsTrigger>
          {isOwnProfile && <TabsTrigger value="orders" className="flex-1 gap-1.5"><Package className="w-4 h-4" />Orders</TabsTrigger>}
        </TabsList>
      </Tabs>

      {/* Posts tab */}
      {activeTab === "posts" && (
        <div className="space-y-4">
          {postsLoading
            ? Array(3).fill(0).map((_, i) => <PostSkeleton key={i} />)
            : posts.map(post => <PostCard key={post.id} post={post} currentUser={currentUser} userLikes={userLikes} />)}
          {!postsLoading && posts.length === 0 && (
            <div className="text-center py-16 text-slate-400 text-sm">No posts yet</div>
          )}
        </div>
      )}

      {/* Products tab */}
      {activeTab === "products" && (
        <div>
          {productsLoading ? (
            <div className="grid grid-cols-2 gap-3">{Array(4).fill(0).map((_, i) => <ProductSkeleton key={i} />)}</div>
          ) : userProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {userProducts.map(p => <ProductCard key={p.id} product={p} compact />)}
            </div>
          ) : (
            <div className="text-center py-16">
              <ShoppingBag className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No products listed yet</p>
              {isOwnProfile && (
                <Link to={createPageUrl("MyStore")}>
                  <Button size="sm" className="mt-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl">Open My Store</Button>
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Orders tab (own profile only) */}
      {activeTab === "orders" && isOwnProfile && (
        <div className="space-y-3">
          {ordersLoading ? (
            Array(3).fill(0).map((_, i) => <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse h-20" />)
          ) : buyerOrders.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No orders yet</p>
              <Link to={createPageUrl("Marketplace")}>
                <Button size="sm" className="mt-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl">Browse Marketplace</Button>
              </Link>
            </div>
          ) : (
            buyerOrders.map(order => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs text-slate-400">#{order.id?.slice(-8)} · {new Date(order.created_date).toLocaleDateString()}</p>
                      <p className="text-sm font-semibold text-slate-800">{order.store_name || "Store"}</p>
                    </div>
                    <Badge className={`${cfg.color} border-0 text-[10px] gap-0.5`}>
                      <StatusIcon className="w-3 h-3" />{cfg.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {order.items?.slice(0, 3).map((item, i) => (
                      <div key={`${item.product_id || i}-${i}`} className="flex items-center gap-1.5 text-xs text-slate-600">
                        {item.product_image && <img src={item.product_image} className="w-7 h-7 rounded-lg object-cover" alt="" />}
                        <span className="truncate max-w-[100px]">{item.product_title}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-50 flex justify-between">
                    <span className="text-xs font-bold text-slate-800">Total: ${order.total?.toFixed(2)}</span>
                    <Link to={createPageUrl("Orders")} className="text-xs text-indigo-500 font-semibold hover:underline">Details →</Link>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && (
        <ProfileEditModal open={editOpen} onClose={() => setEditOpen(false)} user={profileUser} />
      )}
    </div>
  );
}