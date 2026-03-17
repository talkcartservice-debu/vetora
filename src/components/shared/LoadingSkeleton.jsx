import React from "react";

export function PostSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-slate-200" />
        <div className="space-y-1.5">
          <div className="h-3 w-24 bg-slate-200 rounded" />
          <div className="h-2.5 w-16 bg-slate-100 rounded" />
        </div>
      </div>
      <div className="h-3 w-3/4 bg-slate-100 rounded mb-2" />
      <div className="h-3 w-1/2 bg-slate-100 rounded mb-3" />
      <div className="aspect-video rounded-xl bg-slate-200" />
    </div>
  );
}

export function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
      <div className="aspect-square bg-slate-200" />
      <div className="p-3 space-y-2">
        <div className="h-2.5 w-16 bg-slate-100 rounded" />
        <div className="h-3 w-3/4 bg-slate-200 rounded" />
        <div className="h-4 w-20 bg-slate-200 rounded" />
      </div>
    </div>
  );
}