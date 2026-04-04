import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Package, ShoppingBag, Clock, Truck, CheckCircle2, XCircle, AlertCircle, Star, Search, RefreshCw, MessageCircle, Info
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import OrderTrackingPanel from "@/components/orders/OrderTrackingPanel";
import OrderReviewModal from "@/components/reviews/OrderReviewModal";
import OrderDetailModal from "@/components/orders/OrderDetailModal";
import { ordersAPI, cartAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

const STATUS_CONFIG = {
  pending: { icon: Clock, color: "bg-amber-100 text-amber-700", label: "Pending" },
  confirmed: { icon: CheckCircle2, color: "bg-blue-100 text-blue-700", label: "Confirmed" },
  processing: { icon: Package, color: "bg-indigo-100 text-indigo-700", label: "Processing" },
  shipped: { icon: Truck, color: "bg-purple-100 text-purple-700", label: "Shipped" },
  delivered: { icon: CheckCircle2, color: "bg-green-100 text-green-700", label: "Delivered" },
  cancelled: { icon: XCircle, color: "bg-red-100 text-red-700", label: "Cancelled" },
  refunded: { icon: AlertCircle, color: "bg-gray-100 text-gray-700", label: "Refunded" },
};

export default function Orders() {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [reviewOrder, setReviewOrder] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: response, isLoading, refetch } = useQuery({
    queryKey: ["myOrders", currentUser?.username],
    queryFn: () => ordersAPI.list({ buyer_username: currentUser?.username, sort: "-created_at", limit: 100 }),
    enabled: !!currentUser?.username,
  });

  const buyAgainMutation = useMutation({
    mutationFn: async (order) => {
      for (const item of order.items) {
        await cartAPI.add({
          product_id: item.product_id,
          quantity: item.quantity,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", currentUser?.username] });
      toast.success("Items added to cart");
      navigate(createPageUrl("Cart"));
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add items to cart");
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: (orderId) => ordersAPI.cancelOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myOrders", currentUser?.username] });
      toast.success("Your order has been cancelled successfully.");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to cancel order");
    },
  });

  const orders = response?.data || [];

  const filteredOrders = orders.filter(o => {
    const matchesTab = tab === "all" ? true : o.status === tab;
    const orderId = o._id || o.id;
    const searchLower = search.toLowerCase();
    const matchesSearch = search === "" || 
      orderId?.toLowerCase().includes(searchLower) || 
      o.store_name?.toLowerCase().includes(searchLower) ||
      o.items?.some(item => item.product_title?.toLowerCase().includes(searchLower));
    
    return matchesTab && matchesSearch;
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Orders</h1>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => refetch()}
          className="text-slate-500 gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input 
          placeholder="Search by Order ID, store or product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-white border-slate-100 rounded-2xl h-12 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList className="bg-white border border-slate-100 w-full justify-start overflow-x-auto hide-scrollbar h-auto p-1">
          <TabsTrigger value="all" className="rounded-xl px-4 py-2">All</TabsTrigger>
          <TabsTrigger value="pending" className="rounded-xl px-4 py-2">Pending</TabsTrigger>
          <TabsTrigger value="processing" className="rounded-xl px-4 py-2">Processing</TabsTrigger>
          <TabsTrigger value="shipped" className="rounded-xl px-4 py-2">Shipped</TabsTrigger>
          <TabsTrigger value="delivered" className="rounded-xl px-4 py-2">Delivered</TabsTrigger>
          <TabsTrigger value="cancelled" className="rounded-xl px-4 py-2">Cancelled</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
              <div className="h-4 w-32 bg-slate-200 rounded mb-3" />
              <div className="h-3 w-48 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={search ? "No matches found" : "No orders yet"}
          description={search ? "Try adjusting your search terms" : "Start shopping to see your orders here"}
          action={!search && <Link to={createPageUrl("Marketplace")}><Button className="bg-indigo-600 hover:bg-indigo-700">Browse Marketplace</Button></Link>}
        />
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredOrders.map((order) => {
              const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              const StatusIcon = status.icon;
              const orderId = order._id || order.id;
              
              return (
                <motion.div
                  key={orderId}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="cursor-pointer" onClick={() => setDetailOrder(order)}>
                      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                        Order #{orderId?.slice(-8)}
                      </p>
                      <h3 className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                        {order.store_name || "Store"}
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {order.payment_method?.replaceAll('_', ' ') || 'card'}
                      </p>
                    </div>
                    <Badge className={`${status.color} border-0 text-[10px] px-2 py-0.5 h-6 font-semibold`}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>

                  <div className="space-y-3 mb-4 cursor-pointer" onClick={() => setDetailOrder(order)}>
                    {order.items?.slice(0, 2).map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0">
                          {item.product_image ? (
                            <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-200">
                              <Package className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{item.product_title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">Qty: {item.quantity} · ${item.price?.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                    {order.items?.length > 2 && (
                      <p className="text-xs text-indigo-600 font-medium pl-1">+{order.items.length - 2} more items</p>
                    )}
                  </div>

                  {order.order_note && (
                    <div className="bg-amber-50 rounded-xl p-2.5 mb-4 border border-amber-100/50">
                      <p className="text-[10px] text-amber-700 leading-tight flex items-start gap-1.5 font-medium">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        Note: {order.order_note}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 uppercase tracking-tight">Total Amount</span>
                      <span className="text-sm font-extrabold text-slate-900">${order.total?.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(createPageUrl("Chat") + `?to=${order.vendor_username}`)}
                        className="rounded-xl text-[10px] h-8 text-indigo-600 hover:bg-indigo-50"
                        title="Contact Seller"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Chat
                      </Button>

                      {order.status === "delivered" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReviewOrder(order)}
                            className="rounded-xl text-[10px] h-8 gap-1 border-amber-200 text-amber-700 hover:bg-amber-50"
                          >
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            Review
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => buyAgainMutation.mutate(order)}
                            disabled={buyAgainMutation.isPending}
                            className="rounded-xl text-[10px] h-8 bg-slate-900 hover:bg-slate-800"
                          >
                            Buy Again
                          </Button>
                        </>
                      ) : order.status === "pending" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelOrderMutation.mutate(orderId)}
                          disabled={cancelOrderMutation.isPending}
                          className="rounded-xl text-[10px] h-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          Cancel
                        </Button>
                      ) : null}
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDetailOrder(order)}
                        className="rounded-xl text-[10px] h-8 text-slate-500 hover:bg-slate-50"
                      >
                        <Info className="w-3.5 h-3.5" />
                        Details
                      </Button>
                    </div>
                  </div>
                  
                  {["processing", "shipped", "confirmed"].includes(order.status) && (
                    <div className="mt-3 bg-slate-50/50 rounded-xl p-1">
                      <OrderTrackingPanel order={order} />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {reviewOrder && (
        <OrderReviewModal
          open={!!reviewOrder}
          onClose={() => setReviewOrder(null)}
          order={reviewOrder}
          currentUser={currentUser}
        />
      )}

      {detailOrder && (
        <OrderDetailModal
          open={!!detailOrder}
          onOpenChange={(open) => !open && setDetailOrder(null)}
          order={detailOrder}
          onBuyAgain={(order) => buyAgainMutation.mutate(order)}
          onContactVendor={(vendorUsername) => navigate(createPageUrl("Chat") + `?to=${vendorUsername}`)}
        />
      )}
    </div>
  );
}
