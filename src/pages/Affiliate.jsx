import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Link2, Copy, DollarSign, MousePointerClick, ShoppingCart,
  Plus, Loader2, Check, Search, Package, Zap, Trophy,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { affiliateLinksAPI, productsAPI, vendorSubscriptionsAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";

const MOCK_LEADERBOARD = [
  { rank: 1, name: "Sarah J.", avatar: "https://i.pravatar.cc/150?u=sarah", earnings: 1250.50, sales: 84 },
  { rank: 2, name: "Mike R.", avatar: "https://i.pravatar.cc/150?u=mike", earnings: 980.20, sales: 62 },
  { rank: 3, name: "Alex K.", avatar: "https://i.pravatar.cc/150?u=alex", earnings: 840.00, sales: 55 },
  { rank: 4, name: "Emma W.", avatar: "https://i.pravatar.cc/150?u=emma", earnings: 720.45, sales: 48 },
  { rank: 5, name: "David L.", avatar: "https://i.pravatar.cc/150?u=david", earnings: 610.10, sales: 41 },
];

const MARKETING_ASSETS = [
  { id: 1, title: "Summer Sale Banner", type: "Banner", size: "1200x628", thumbnail: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400" },
  { id: 2, title: "Social Story Template", type: "Story", size: "1080x1920", thumbnail: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=400" },
  { id: 3, title: "Platform Overview", type: "PDF", size: "2.4 MB", thumbnail: "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=400" },
];

function LeaderboardItem({ rank, name, avatar, earnings, sales }) {
  return (
    <div className="flex items-center gap-4 p-3 bg-white rounded-2xl border border-slate-100 mb-2">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
        rank === 1 ? "bg-yellow-100 text-yellow-700" :
        rank === 2 ? "bg-slate-100 text-slate-700" :
        rank === 3 ? "bg-orange-100 text-orange-700" : "bg-slate-50 text-slate-400"
      }`}>
        {rank}
      </div>
      <img src={avatar} alt="" className="w-10 h-10 rounded-full border-2 border-slate-50" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 truncate">{name}</p>
        <p className="text-xs text-slate-400">{sales} sales this month</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-black text-indigo-600">${earnings.toFixed(2)}</p>
        <p className="text-[10px] text-slate-400">Total Earned</p>
      </div>
    </div>
  );
}

function AssetCard({ asset }) {
  const handleDownload = (e) => {
    e.preventDefault();
    // In a real app, this would be a direct download link
    window.open(asset.thumbnail, "_blank");
    toast.info(`Downloading ${asset.title}...`);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-[16/9] bg-slate-50 relative group">
        <img src={asset.thumbnail} alt="" className="w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button 
            size="sm" 
            variant="secondary" 
            className="rounded-lg h-8 gap-1.5 text-xs"
            onClick={handleDownload}
          >
            <Download className="w-3.5 h-3.5" /> Download
          </Button>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between mb-1">
          <Badge variant="outline" className="text-[10px] py-0 h-5 border-slate-200 text-slate-500 font-medium">
            {asset.type}
          </Badge>
          <span className="text-[10px] text-slate-400 font-medium">{asset.size}</span>
        </div>
        <p className="text-xs font-bold text-slate-800 truncate">{asset.title}</p>
      </div>
    </div>
  );
}


function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ConversionBar({ clicks, conversions }) {
  const pct = clicks ? Math.min(100, (conversions / clicks) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>Conversion Rate</span>
        <span className="font-semibold text-indigo-600">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Affiliate() {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [pendingProductId, setPendingProductId] = useState(null);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data: subscription } = useQuery({
    queryKey: ["vendorSubscription", currentUser?.username],
    queryFn: async () => {
      const res = await vendorSubscriptionsAPI.list({ vendor_username: currentUser?.username });
      const subs = res.subscriptions || res.data || (Array.isArray(res) ? res : []);
      return subs.find(s => s.status === 'active') || null;
    },
    enabled: !!currentUser?.username,
  });

  const isEliteVendor = subscription?.plan === "elite";

  const { data: myData, isLoading } = useQuery({
    queryKey: ["affiliateLinks", currentUser?.username],
    queryFn: async () => {
      return await affiliateLinksAPI.listForMe({ sort: "-created_at", limit: 50 });
    },
    enabled: !!currentUser?.username,
  });

  const myLinks = myData?.links || [];
  const stats = myData?.stats || {
    total_clicks: 0,
    total_conversions: 0,
    total_earned: 0,
    total_paid: 0
  };

  const { data: products = [], isPending: productsLoading } = useQuery({
    queryKey: ["affiliateProducts", search],
    queryFn: async () => {
      const res = await productsAPI.list({ 
        status: "active", 
        vendor_plan: "elite", // Only show products from elite vendors
        search: search || undefined,
        sort: "-sales_count", 
        limit: 30 
      });
      return res.data || [];
    },
    staleTime: 60000,
  });

  const filteredProducts = search ? products : products.slice(0, 12);

  const createLinkMutation = useMutation({
    mutationFn: async (product) => {
      const productId = product._id || product.id;
      setPendingProductId(productId);
      return affiliateLinksAPI.create({
        product_id: productId,
        commission_pct: product.affiliate_commission_pct || 10,
        status: "active",
      });
    },
    onSuccess: () => {
      toast.success("Affiliate link created!");
      setCreating(false);
      setSelectedProduct(null);
      queryClient.invalidateQueries({ queryKey: ["affiliateLinks"] });
    },
    onSettled: () => {
      setPendingProductId(null);
    }
  });

  const copyLink = (refCode) => {
    const url = `${window.location.origin}/Marketplace?ref=${refCode}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  // Totals from backend stats
  const totalClicks = stats.total_clicks || 0;
  const totalConversions = stats.total_conversions || 0;
  const totalEarned = stats.total_earned || 0;
  const pendingPayout = (stats.total_earned || 0) - (stats.total_paid || 0);

  const alreadyLinked = (productId) => myLinks.some(l => l.product_id === productId);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-3xl p-6 lg:p-8 mb-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200')] bg-cover" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-300" />
            <span className="text-sm font-semibold text-white/80">Affiliate Program</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black mb-2">Earn from Every Sale</h1>
          <p className="text-white/80 text-sm max-w-lg">Generate referral links for products, share them with your audience, and earn commissions automatically on every converted sale.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Link2} label="Active Links" value={myLinks.filter(l => l.status === "active").length} color="bg-indigo-50 text-indigo-600" />
        <StatCard icon={MousePointerClick} label="Total Clicks" value={totalClicks.toLocaleString()} color="bg-blue-50 text-blue-600" />
        <StatCard icon={ShoppingCart} label="Conversions" value={totalConversions} sub={totalClicks ? `${((totalConversions/totalClicks)*100).toFixed(1)}% rate` : ""} color="bg-green-50 text-green-600" />
        <StatCard icon={DollarSign} label="Pending Payout" value={`$${pendingPayout.toFixed(2)}`} sub={`$${totalEarned.toFixed(2)} total earned`} color="bg-amber-50 text-amber-600" />
      </div>

      <Tabs defaultValue="links" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-2xl mb-6 w-full lg:w-auto overflow-x-auto justify-start lg:justify-center">
          <TabsTrigger value="links" className="rounded-xl px-6 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Links</TabsTrigger>
          <TabsTrigger value="leaderboard" className="rounded-xl px-6 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Leaderboard</TabsTrigger>
          <TabsTrigger value="assets" className="rounded-xl px-6 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Marketing Assets</TabsTrigger>
        </TabsList>

        <TabsContent value="links" className="mt-0">
          <div className="grid lg:grid-cols-5 gap-6">
            {/* My Links */}
            <div className="lg:col-span-3 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-slate-900">My Affiliate Links</h2>
                <Button onClick={() => setCreating(v => !v)} size="sm" className={`rounded-xl gap-1.5 ${creating ? "bg-slate-200 text-slate-700 hover:bg-slate-300" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                  <Plus className="w-4 h-4" /> New Link
                </Button>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
              ) : myLinks.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
                  <Link2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-600">No affiliate links yet</p>
                  <p className="text-xs text-slate-400 mt-1">Pick a product from the right to create your first link</p>
                </div>
              ) : (
                myLinks.map(link => {
                  const linkId = link._id || link.id;
                  return (
                    <motion.div key={linkId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-slate-100 p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{link.product_title}</p>
                          <p className="text-xs text-slate-400">{link.store_name} · ${link.product_price}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`text-[10px] border-0 capitalize ${link.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                            {link.status}
                          </Badge>
                          <span className="text-xs font-bold text-indigo-600">{link.commission_pct}% comm.</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                        <div className="bg-slate-50 rounded-xl py-2">
                          <p className="text-lg font-black text-slate-900">{link.clicks || 0}</p>
                          <p className="text-[10px] text-slate-400">Clicks</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl py-2">
                          <p className="text-lg font-black text-slate-900">{link.conversions || 0}</p>
                          <p className="text-[10px] text-slate-400">Sales</p>
                        </div>
                        <div className="bg-green-50 rounded-xl py-2">
                          <p className="text-lg font-black text-green-700">${(link.total_commission_earned || 0).toFixed(2)}</p>
                          <p className="text-[10px] text-slate-400">Earned</p>
                        </div>
                      </div>

                      <ConversionBar clicks={link.clicks} conversions={link.conversions} />

                      <div className="flex gap-2 mt-3">
                        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-500 truncate font-mono">
                          {window.location.origin}/Marketplace?ref={link.ref_code}
                        </div>
                        <button
                          onClick={() => copyLink(link.ref_code)}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors"
                          title="Copy link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Product Picker */}
            <div className="lg:col-span-2">
              {!isEliteVendor && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Zap className="w-4 h-4 text-amber-600" />
                    <p className="text-sm font-bold text-amber-900">List Your Products</p>
                  </div>
                  <p className="text-xs text-amber-700 leading-relaxed mb-3">
                    Only products from **Elite vendors** are shown in the affiliate marketplace. Upgrade your plan to let others promote your products.
                  </p>
                  <Link to={createPageUrl("MyStore") + "?tab=subscription"}>
                    <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] h-8">
                      Upgrade to Elite
                    </Button>
                  </Link>
                </div>
              )}
              <div className="bg-white rounded-2xl border border-slate-100 p-4 sticky top-4">
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-500" /> Choose a Product
                </h3>
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search products..."
                    className="pl-8 h-8 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-2 max-h-[520px] overflow-y-auto">
                  {productsLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-10 text-xs text-slate-400">No products found</div>
                  ) : (
                    filteredProducts.map(product => {
                      const productId = product._id || product.id;
                      const linked = alreadyLinked(productId);
                      return (
                        <button
                          key={productId}
                          onClick={() => !linked && createLinkMutation.mutate(product)}
                          disabled={linked || createLinkMutation.isPending}
                          className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-colors border ${
                            linked ? "bg-green-50 border-green-200 cursor-default" : "hover:bg-indigo-50 border-slate-100 hover:border-indigo-200"
                          }`}
                        >
                          <div className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                            {product.images?.[0] && <img src={product.images[0]} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 line-clamp-2">{product.title}</p>
                            <p className="text-xs text-indigo-600 font-bold">${product.price}</p>
                            <p className="text-[10px] text-slate-400">{product.affiliate_commission_pct || 10}% commission</p>
                          </div>
                          {pendingProductId === productId ? (
                            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                          ) : linked ? (
                            <Check className="w-4 h-4 text-green-500 shrink-0" />
                          ) : (
                            <Plus className="w-4 h-4 text-indigo-400 shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leaderboard">
          <div className="bg-white rounded-3xl border border-slate-100 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">Affiliate Leaderboard</h2>
                  <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] font-bold">Coming Soon</Badge>
                </div>
                <p className="text-sm text-slate-500">Top performers this month based on earnings</p>
              </div>
            </div>
            <div className="max-w-2xl">
              {MOCK_LEADERBOARD.map(item => (
                <LeaderboardItem key={item.rank} {...item} />
              ))}
              <div className="mt-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">YOU</div>
                  <div>
                    <p className="text-sm font-bold text-indigo-900">Your Current Rank</p>
                    <p className="text-xs text-indigo-600">Keep sharing to climb the leaderboard!</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-indigo-700">#42</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="assets">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Marketing Assets</h2>
                <p className="text-sm text-slate-500">Download high-quality assets to help you promote products</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MARKETING_ASSETS.map(asset => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}