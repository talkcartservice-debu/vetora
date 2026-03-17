import React from "react";
import { productsAPI } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import ProductCard from "@/components/shared/ProductCard";
import { ProductSkeleton } from "@/components/shared/LoadingSkeleton";
import { Zap } from "lucide-react";

export default function SimilarProducts({ product }) {
  const { data: similar = [], isLoading } = useQuery({
    queryKey: ["similarProducts", product?.id, product?.category],
    queryFn: async () => {
      const res = await productsAPI.list({ category: product.category, status: "active", limit: 10, order: "desc", orderBy: "sales_count" });
      return res.data || [];
    },
    enabled: !!product?.category,
    staleTime: 120000,
    select: (data) => data.filter(p => p.id !== product?.id).slice(0, 6),
  });

  const { data: sameStore = [] } = useQuery({
    queryKey: ["sameStoreProducts", product?.store_id],
    queryFn: async () => {
      const res = await productsAPI.list({ store_id: product.store_id, status: "active", limit: 8, order: "desc", orderBy: "sales_count" });
      return res.data || [];
    },
    enabled: !!product?.store_id,
    staleTime: 120000,
    select: (data) => data.filter(p => p.id !== product?.id).slice(0, 4),
  });

  const combined = React.useMemo(() => {
    const seen = new Set();
    return [...similar, ...sameStore].filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    }).slice(0, 6);
  }, [similar, sameStore]);

  if (!isLoading && combined.length === 0) return null;

  return (
    <div className="mt-12 border-t border-slate-100 pt-8">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-amber-500" />
        <h2 className="text-xl font-bold text-slate-900">You Might Also Like</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {isLoading
          ? Array(6).fill(0).map((_, i) => <ProductSkeleton key={i} />)
          : combined.map(p => <ProductCard key={p.id} product={p} compact />)
        }
      </div>
    </div>
  );
}