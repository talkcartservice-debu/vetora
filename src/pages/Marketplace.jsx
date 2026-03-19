import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ProductCard from "@/components/shared/ProductCard";
import { ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import {
  Search, Store, ShoppingBag
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { productsAPI, storesAPI } from "@/api/apiClient";

export default function Marketplace() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("-created_date");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["marketplaceProducts", category, sort],
    queryFn: async () => {
      const filters = { status: "active", sort, limit: 50 };
      if (category !== "all") filters.category = category;
      const res = await productsAPI.list(filters);
      return res.data || [];
    },
  });

  const { data: storesResponse = {} } = useQuery({
    queryKey: ["featuredStores"],
    queryFn: async () => {
      const res = await storesAPI.list({ status: "active", sort: "-follower_count", limit: 6 });
      return res;
    },
  });
  
  const stores = Array.isArray(storesResponse?.data) ? storesResponse.data : [];

  const filtered = search
    ? products.filter(p => p.title?.toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-3xl p-6 lg:p-8 mb-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200')] bg-cover bg-center opacity-10" />
        <div className="relative z-10">
          <h1 className="text-2xl lg:text-3xl font-bold mb-2">Vetora Marketplace</h1>
          <p className="text-white/80 text-sm lg:text-base mb-4">Discover unique products from creators and vendors worldwide</p>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1.5">
              <ShoppingBag className="w-4 h-4" />
              {products.length}+ Products
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1.5">
              <Store className="w-4 h-4" />
              {stores.length}+ Stores
            </div>
          </div>
        </div>
      </div>

      {/* Featured Stores */}
      {stores.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Featured Stores</h2>
          <div className="overflow-x-auto -mx-4 px-4 hide-scrollbar">
            <div className="flex gap-3" style={{ width: "max-content" }}>
              {stores.map((store, idx) => (
                <Link
                  key={store.id || store._id || `store-${idx}`}
                  to={createPageUrl("StoreDetail") + `?id=${store.id || store._id}`}
                  className="w-40 shrink-0 bg-white rounded-2xl border border-slate-100 p-4 text-center hover:shadow-lg transition-shadow"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-2 text-2xl overflow-hidden">
                    {store.logo_url ? (
                      <img src={store.logo_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      store.name?.[0]?.toUpperCase()
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 truncate">{store.name}</h3>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {store.is_verified && <span className="text-blue-500 text-xs">✓</span>}
                    <span className="text-xs text-slate-400">{store.product_count || 0} items</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40 h-10 rounded-xl">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="fashion">Fashion</SelectItem>
            <SelectItem value="electronics">Electronics</SelectItem>
            <SelectItem value="home">Home</SelectItem>
            <SelectItem value="beauty">Beauty</SelectItem>
            <SelectItem value="sports">Sports</SelectItem>
            <SelectItem value="art">Art</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-40 h-10 rounded-xl">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="-created_date">Newest</SelectItem>
            <SelectItem value="-sales_count">Best Selling</SelectItem>
            <SelectItem value="price">Price: Low to High</SelectItem>
            <SelectItem value="-price">Price: High to Low</SelectItem>
            <SelectItem value="-rating_avg">Top Rated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
        {isLoading
          ? Array(12).fill(0).map((_, i) => <ProductSkeleton key={`skeleton-${i}`} />)
          : filtered.map((product, idx) => <ProductCard key={product.id || product._id || `product-${idx}`} product={product} />)}
      </div>
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">No products found</div>
      )}
    </div>
  );
}