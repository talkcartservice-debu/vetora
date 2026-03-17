import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import EmptyState from "@/components/shared/EmptyState";
import { Minus, Plus, Trash2, ArrowLeft, CreditCard, Loader2, ShoppingBag, Tag, X, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { authAPI, cartAPI, ordersAPI, couponsAPI } from "@/api/apiClient";

export default function Cart() {
  const [shippingAddress, setShippingAddress] = useState("");
  const [placing, setPlacing] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => authAPI.me(),
  });

  const { data: cartResponse = {}, isLoading } = useQuery({
    queryKey: ["cart", currentUser?.email],
    queryFn: async () => {
      const res = await cartAPI.get();
      return res;
    },
    enabled: !!currentUser?.email,
  });
  
  const cartItems = Array.isArray(cartResponse?.items) ? cartResponse.items : [];

  const updateQuantityMutation = useMutation({
    mutationFn: ({ id, quantity }) => {
      if (quantity <= 0) return cartAPI.remove(id);
      return cartAPI.update(id, { quantity });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const removeItemMutation = useMutation({
    mutationFn: (id) => cartAPI.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      setPlacing(true);
      // Group items by store
      const storeGroups = {};
      cartItems.forEach(item => {
        const key = item.store_id || "default";
        if (!storeGroups[key]) storeGroups[key] = { items: [], store_name: item.store_name, vendor_email: "" };
        storeGroups[key].items.push(item);
      });

      for (const group of Object.values(storeGroups)) {
        const orderItems = group.items.map(item => ({
          product_id: item.product_id,
          product_title: item.product_title,
          product_image: item.product_image,
          quantity: item.quantity,
          price: item.product_price,
        }));
        const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

        await ordersAPI.create({
          buyer_email: currentUser.email,
          buyer_name: currentUser.full_name,
          vendor_email: group.items[0]?.affiliate_email || currentUser.email,
          store_id: group.items[0]?.store_id,
          store_name: group.store_name,
          items: orderItems,
          subtotal,
          total: subtotal,
          shipping_address: shippingAddress,
          status: "pending",
          payment_status: "paid",
          payment_method: "card",
        });
      }

      // Clear cart
      await cartAPI.clear();
    },
    onSuccess: () => {
      toast.success("Order placed successfully!");
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      navigate(createPageUrl("Orders"));
    },
    onSettled: () => setPlacing(false),
  });

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCheckingCoupon(true);
    setCouponError("");
    try {
      const coupon = await couponsAPI.check(couponCode.trim().toUpperCase());
      if (!coupon) { setCouponError("Invalid or expired coupon code"); return; }
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) { setCouponError("This coupon has expired"); return; }
      if (coupon.max_uses > 0 && coupon.uses_count >= coupon.max_uses) { setCouponError("This coupon has reached its usage limit"); return; }
      const sub = cartItems.reduce((s, i) => s + (i.product_price || 0) * (i.quantity || 1), 0);
      if (coupon.min_order_amount > 0 && sub < coupon.min_order_amount) {
        setCouponError(`Minimum order of $${coupon.min_order_amount} required`); return;
      }
      setAppliedCoupon(coupon);
      toast.success(`Coupon applied! ${coupon.discount_type === "percentage" ? `${coupon.discount_value}% off` : `$${coupon.discount_value} off`}`);
    } catch (e) {
      setCouponError("Invalid coupon code");
    } finally {
      setCheckingCoupon(false);
    }
  };

  const removeCoupon = () => { setAppliedCoupon(null); setCouponCode(""); setCouponError(""); };

  const subtotal = cartItems.reduce((sum, item) => sum + (item.product_price || 0) * (item.quantity || 1), 0);
  const discount = appliedCoupon
    ? appliedCoupon.discount_type === "percentage"
      ? subtotal * (appliedCoupon.discount_value / 100)
      : Math.min(appliedCoupon.discount_value, subtotal)
    : 0;
  const discountedSubtotal = subtotal - discount;
  const shipping = discountedSubtotal > 50 ? 0 : 5.99;
  const total = discountedSubtotal + shipping;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link to={createPageUrl("Marketplace")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Continue Shopping
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">Shopping Cart ({cartItems.length})</h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse flex gap-4">
              <div className="w-20 h-20 bg-slate-200 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-slate-200 rounded" />
                <div className="h-3 w-1/4 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : cartItems.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Browse the marketplace to find products you love"
          action={
            <Link to={createPageUrl("Marketplace")}>
              <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-xl">Browse Products</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <AnimatePresence>
              {cartItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  exit={{ opacity: 0, x: -100 }}
                  className="bg-white rounded-2xl border border-slate-100 p-4 flex gap-4"
                >
                  <Link to={createPageUrl("ProductDetail") + `?id=${item.product_id}`} className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                    {item.product_image && <img src={item.product_image} alt="" className="w-full h-full object-cover" />}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{item.product_title}</p>
                    <p className="text-xs text-slate-400 mb-2">{item.store_name}</p>
                    <p className="text-base font-bold text-indigo-600">${item.product_price?.toFixed(2)}</p>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <button onClick={() => removeItemMutation.mutate(item.id)} className="text-slate-400 hover:text-red-500 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                      <button onClick={() => updateQuantityMutation.mutate({ id: item.id, quantity: (item.quantity || 1) - 1 })} className="w-8 h-8 flex items-center justify-center hover:bg-slate-50">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity || 1}</span>
                      <button onClick={() => updateQuantityMutation.mutate({ id: item.id, quantity: (item.quantity || 1) + 1 })} className="w-8 h-8 flex items-center justify-center hover:bg-slate-50">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-100 p-6 sticky top-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Order Summary</h3>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" /> Discount ({appliedCoupon.code})
                    </span>
                    <span className="font-medium text-green-600">-${discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Shipping</span>
                  <span className="font-medium">{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
                </div>
                <div className="border-t border-slate-100 pt-3 flex justify-between text-base">
                  <span className="font-bold text-slate-900">Total</span>
                  <span className="font-bold text-slate-900">${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Coupon */}
              <div className="mb-4">
                {appliedCoupon ? (
                  <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-sm text-green-700 font-semibold flex-1">{appliedCoupon.code} applied!</span>
                    <button onClick={removeCoupon} className="text-green-600 hover:text-green-800">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Coupon code"
                        value={couponCode}
                        onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                        onKeyDown={e => e.key === "Enter" && applyCoupon()}
                        className="rounded-xl font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        onClick={applyCoupon}
                        disabled={checkingCoupon || !couponCode.trim()}
                        className="shrink-0 rounded-xl px-3"
                      >
                        {checkingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                    {couponError && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><X className="w-3 h-3" />{couponError}</p>}
                  </div>
                )}
              </div>

              <Input
                placeholder="Shipping address"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                className="mb-4 rounded-xl"
              />

              <Button
                onClick={() => placeOrderMutation.mutate()}
                disabled={placing || cartItems.length === 0}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-base font-semibold"
              >
                {placing ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
                ) : (
                  <><CreditCard className="w-5 h-5 mr-2" /> Place Order</>
                )}
              </Button>

              {subtotal < 50 && (
                <p className="text-xs text-center text-slate-400 mt-3">
                  Add ${(50 - subtotal).toFixed(2)} more for free shipping
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}