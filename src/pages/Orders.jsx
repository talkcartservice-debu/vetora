import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Package, ShoppingBag, Clock, Truck, CheckCircle2, XCircle, AlertCircle, Star
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import OrderTrackingPanel from "@/components/orders/OrderTrackingPanel";
import OrderReviewModal from "@/components/reviews/OrderReviewModal";
import { ordersAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";

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
  const [reviewOrder, setReviewOrder] = useState(null);
  const { user: currentUser } = useAuth();

  const { data: response, isLoading } = useQuery({
    queryKey: ["myOrders", currentUser?.username],
    queryFn: () => ordersAPI.list({ buyer_username: currentUser?.username, sort: "-created_at", limit: 50 }),
    enabled: !!currentUser?.username,
  });

  const orders = response?.data || [];

  const filteredOrders = tab === "all" ? orders : orders.filter(o => o.status === tab);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">My Orders</h1>

      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList className="bg-white border border-slate-100 overflow-x-auto hide-scrollbar">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="shipped">Shipped</TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
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
          title="No orders yet"
          description="Start shopping to see your orders here"
          action={<Link to={createPageUrl("Marketplace")}><Button className="bg-indigo-600 hover:bg-indigo-700">Browse Marketplace</Button></Link>}
        />
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = status.icon;
            const orderId = order._id || order.id;
            return (
              <motion.div
                key={orderId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-slate-400">
                      Order #{orderId?.slice(-8)} · {new Date(order.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{order.store_name || "Store"}</p>
                    {order.order_note && (
                      <p className="text-[10px] text-amber-600 font-medium mt-1 leading-tight flex items-start gap-1">
                        <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                        Note: {order.order_note}
                      </p>
                    )}
                  </div>
                  <Badge className={`${status.color} border-0 text-xs`}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {status.label}
                  </Badge>
                </div>

                <div className="space-y-2 mb-3">
                  {order.items?.slice(0, 2).map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                        {item.product_image && <img src={item.product_image} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{item.product_title}</p>
                        <p className="text-xs text-slate-400">Qty: {item.quantity} · ${item.price?.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                  {order.items?.length > 2 && (
                    <p className="text-xs text-slate-400">+{order.items.length - 2} more items</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <span className="text-sm font-bold text-slate-900">Total: ${order.total?.toFixed(2)}</span>
                  {order.status === "delivered" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReviewOrder(order)}
                      className="rounded-xl text-xs gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      Leave Review
                    </Button>
                  )}
                </div>
                <OrderTrackingPanel order={order} />
              </motion.div>
            );
          })}
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
    </div>
  );
}