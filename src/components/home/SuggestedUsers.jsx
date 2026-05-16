import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { postsAPI, storesAPI, followsAPI } from "@/api/apiClient";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { UserPlus, Store } from "lucide-react";
import { toast } from "sonner";

export default function SuggestedUsers({ currentUser }) {
  const queryClient = useQueryClient();

  // 1. Fetch recent posts to find active users
  const { data: recentPostsResponse } = useQuery({
    queryKey: ["suggestedAuthors"],
    queryFn: () => postsAPI.list({ limit: 30, sort: "-created_at" }),
    staleTime: 600000,
  });

  // 2. Fetch top stores
  const { data: topStoresResponse } = useQuery({
    queryKey: ["suggestedStores"],
    queryFn: () => storesAPI.list({ limit: 5, sort: "-follower_count" }),
    staleTime: 600000,
  });

  // Process authors from posts
  const recentPosts = recentPostsResponse?.data || [];
  const uniqueAuthors = Array.from(
    new Map(
      recentPosts
        .filter(post => post.author_username && post.author_username !== currentUser?.username)
        .map(post => [post.author_username, {
          username: post.author_username,
          display_name: post.author_name,
          avatar_url: post.author_avatar,
          type: 'user'
        }])
    ).values()
  ).slice(0, 5);

  const topStores = (topStoresResponse?.data || [])
    .filter(store => store.owner_username !== currentUser?.username)
    .map(store => ({
      username: store.owner_username,
      display_name: store.name,
      avatar_url: store.logo_url,
      id: store._id || store.id,
      type: 'store'
    }));

  const suggestions = [...uniqueAuthors, ...topStores].slice(0, 8);

  const followMutation = useMutation({
    mutationFn: async ({ username, type, targetId }) => {
      return await followsAPI.follow(username, type, targetId);
    },
    onSuccess: (_, variables) => {
      toast.success(`Following ${variables.display_name}`);
      queryClient.invalidateQueries({ queryKey: ["followStatus"] });
      queryClient.invalidateQueries({ queryKey: ["posts", "following"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to follow");
    }
  });

  if (suggestions.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden mb-6">
      <div className="p-4 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Suggested for you</h3>
        <Link to={createPageUrl("Explore")} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700">
          See All
        </Link>
      </div>
      <div className="divide-y divide-slate-50 dark:divide-slate-700">
        {suggestions.map((item, idx) => (
          <div key={`${item.type}-${item.username}-${idx}`} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Link 
              to={item.type === 'store' ? createPageUrl("StoreDetail") + `?id=${item.id}` : createPageUrl("Profile") + `?username=${item.username}`}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600">
                {item.avatar_url ? (
                  <img src={item.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  item.type === 'store' ? <Store className="w-5 h-5 text-slate-400" /> : <div className="text-xs font-bold text-slate-400">{item.display_name?.[0]?.toUpperCase()}</div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">{item.display_name}</p>
                  {item.type === 'store' && <span className="px-1 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded text-[9px] font-bold uppercase tracking-tighter">Store</span>}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">@{item.username}</p>
              </div>
            </Link>
            <button
              onClick={() => followMutation.mutate({ 
                username: item.username, 
                type: item.type, 
                targetId: item.id,
                display_name: item.display_name 
              })}
              disabled={followMutation.isPending}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-600 hover:text-white transition-all duration-200"
            >
              {followMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
            </button>
          </div>
        ))}
      </div>
      <Link 
        to={createPageUrl("Explore")}
        className="block p-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50/50 dark:bg-slate-900/30 transition-colors"
      >
        Discover more people and stores
      </Link>
    </div>
  );
}
