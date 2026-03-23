import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { 
  ArrowLeft, CreditCard, Shield, Truck, 
  MapPin, CheckCircle2, Loader2,
  Lock, Zap, Info, Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cartAPI, ordersAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";

const CheckoutStep = ({ number, title, active, completed, children }) => (
  <div className={`bg-white rounded-3xl border ${active ? "border-indigo-500 shadow-xl shadow-indigo-100/50 scale-[1.02]" : "border-slate-100"} p-6 mb-4 transition-all duration-300`}>
    <div className="flex items-center gap-4 mb-4">
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-colors ${
        completed ? "bg-green-500 text-white" : active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
      }`}>
        {completed ? <CheckCircle2 className="w-5 h-5" /> : number}
      </div>
      <h2 className={`text-lg font-black tracking-tight ${active ? "text-slate-900" : "text-slate-400"}`}>{title}</h2>
    </div>
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export default function Checkout() {
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState({ street: "", city: "", state: "", zip: "" });
  const [cardData, setCardData] = useState({ number: "", expiry: "", cvc: "" });
  const [paymentMethod, setPaymentMethod] = useState("paystack");
  const [placing, setPlacing] = useState(false);
  const [orderNote, setOrderNote] = useState("");
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data: cartResponse = {}, isLoading: cartLoading } = useQuery({
    queryKey: ["cart", currentUser?.email],
    queryFn: () => cartAPI.get(),
    enabled: !!currentUser?.email,
  });
  
  const cartItems = Array.isArray(cartResponse?.items) ? cartResponse.items : [];
  const subtotal = cartItems.reduce((sum, item) => sum + (item.product_price || 0) * (item.quantity || 1), 0);
  const shipping = subtotal > 50 ? 0 : 5.99;
  const total = subtotal + shipping;

  useEffect(() => {
    if (!cartLoading && cartItems.length === 0) {
      toast.error("Your cart is empty");
      navigate(createPageUrl("Cart"));
    }
  }, [cartItems, cartLoading, navigate]);

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      setPlacing(true);
      const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
      
      // Group items by store for separate order records
      const storeGroups = {};
      cartItems.forEach(item => {
        const key = item.store_id || "default";
        if (!storeGroups[key]) storeGroups[key] = { items: [], store_name: item.store_name };
        storeGroups[key].items.push(item);
      });

      const orders = [];
      for (const group of Object.values(storeGroups)) {
        const orderItems = group.items.map(item => ({
          product_id: item.product_id,
          product_title: item.product_title,
          product_image: item.product_image,
          quantity: item.quantity,
          price: item.product_price,
        }));
        
        const groupSubtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

        const order = await ordersAPI.create({
          buyer_email: currentUser.email,
          buyer_name: currentUser.full_name || currentUser.display_name,
          vendor_email: group.items[0]?.vendor_email,
          store_id: group.items[0]?.store_id,
          store_name: group.store_name,
          items: orderItems,
          subtotal: groupSubtotal,
          total: groupSubtotal,
          shipping_address: fullAddress,
          affiliate_email: group.items[0]?.affiliate_email,
          order_note: orderNote,
          status: "pending",
          payment_status: "paid",
          payment_method: paymentMethod,
        });
        orders.push(order);
      }
      
      await cartAPI.clear();
      return orders;
    },
    onSuccess: () => {
      toast.success("Order placed successfully! 🎉");
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      navigate(createPageUrl("Orders"));
    },
    onError: (err) => {
      toast.error(err.message || "Failed to place order");
      setPlacing(false);
    }
  });

  if (cartLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 lg:py-12">
      <Link to={createPageUrl("Cart")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Cart
      </Link>

      <div className="grid lg:grid-cols-5 gap-8 lg:gap-12">
        <div className="lg:col-span-3">
          <h1 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Checkout</h1>
          
          <CheckoutStep number="1" title="Shipping Details" active={step === 1} completed={step > 1}>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Street Address</label>
                <Input value={address.street} onChange={e => setAddress({...address, street: e.target.value})} placeholder="123 Main St, Apt 4" className="rounded-xl h-11 border-slate-200" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">City</label>
                <Input value={address.city} onChange={e => setAddress({...address, city: e.target.value})} placeholder="New York" className="rounded-xl h-11 border-slate-200" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">ZIP Code</label>
                <Input value={address.zip} onChange={e => setAddress({...address, zip: e.target.value})} placeholder="10001" className="rounded-xl h-11 border-slate-200" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Order Note (Optional)</label>
                <Textarea 
                  value={orderNote} 
                  onChange={e => setOrderNote(e.target.value)} 
                  placeholder="Anything we should know about your delivery?" 
                  className="rounded-xl min-h-[80px] border-slate-200 resize-none" 
                />
              </div>
              <Button onClick={() => setStep(2)} disabled={!address.street || !address.city || !address.zip} className="col-span-2 mt-4 bg-indigo-600 hover:bg-indigo-700 h-12 rounded-xl font-bold">
                Continue to Payment
              </Button>
            </div>
          </CheckoutStep>

          <CheckoutStep number="2" title="Payment Method" active={step === 2} completed={step > 2}>
            <div className="space-y-3">
              {[
                { id: "paystack", name: "Paystack (Secure Payment)", icon: Zap },
                { id: "card", name: "Credit/Debit Card", icon: CreditCard, disabled: true },
                { id: "wallet", name: "Vetora Wallet", icon: Wallet, disabled: true },
                { id: "crypto", name: "Cryptocurrency", icon: Zap, disabled: true }
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => !method.disabled && setPaymentMethod(method.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                    paymentMethod === method.id ? "border-indigo-600 bg-indigo-50/50" : "border-slate-100 hover:border-slate-200"
                  } ${method.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentMethod === method.id ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-500"}`}>
                      <method.icon className="w-5 h-5" />
                    </div>
                    <span className={`font-bold ${paymentMethod === method.id ? "text-indigo-900" : "text-slate-600"}`}>{method.name}</span>
                  </div>
                  {paymentMethod === method.id && <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-white" /></div>}
                </button>
              ))}
              
              {paymentMethod === "card" && (
                <div className="mt-6 p-5 bg-white border border-slate-100 rounded-3xl space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Card Number</label>
                    <div className="relative">
                      <Input 
                        value={cardData.number}
                        onChange={e => setCardData({...cardData, number: e.target.value})}
                        placeholder="0000 0000 0000 0000" 
                        className="rounded-xl h-11 pl-11 border-slate-200" 
                      />
                      <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Expiry Date</label>
                      <Input 
                        value={cardData.expiry}
                        onChange={e => setCardData({...cardData, expiry: e.target.value})}
                        placeholder="MM/YY" 
                        className="rounded-xl h-11 border-slate-200" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">CVC</label>
                      <Input 
                        value={cardData.cvc}
                        onChange={e => setCardData({...cardData, cvc: e.target.value})}
                        placeholder="123" 
                        className="rounded-xl h-11 border-slate-200" 
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-8">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl font-bold border-slate-200">Back</Button>
                <Button onClick={() => setStep(3)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 h-12 rounded-xl font-bold">Review Order</Button>
              </div>
            </div>
          </CheckoutStep>

          <CheckoutStep number="3" title="Review & Confirm" active={step === 3} completed={false}>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Delivery Address</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{address.street}, {address.city}, {address.zip}</p>
                </div>
                <button onClick={() => setStep(1)} className="ml-auto text-xs font-bold text-indigo-600 hover:underline">Edit</button>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Payment Method</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {paymentMethod === "paystack" ? "Paystack Secure Payment" : 
                     paymentMethod === "card" ? "Credit Card •••• 4242" : 
                     paymentMethod}
                  </p>
                </div>
                <button onClick={() => setStep(2)} className="ml-auto text-xs font-bold text-indigo-600 hover:underline">Edit</button>
              </div>

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                  By clicking "Place Order", you agree to Vetora's terms of service and privacy policy. Your order will be processed immediately.
                </p>
              </div>

              <Button 
                onClick={() => placeOrderMutation.mutate()} 
                disabled={placing}
                className="w-full bg-slate-900 hover:bg-black h-14 rounded-2xl font-black text-lg tracking-tight mt-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                {placing ? <><Loader2 className="w-5 h-5 animate-spin mr-3" /> Processing...</> : <><Lock className="w-5 h-5 mr-3" /> Place Order • ${total.toFixed(2)}</>}
              </Button>
            </div>
          </CheckoutStep>
        </div>

        {/* Order Summary Column */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[2rem] border border-slate-100 p-8 sticky top-12 shadow-2xl shadow-slate-200/50">
            <h3 className="text-xl font-black text-slate-900 mb-6 tracking-tight">Order Summary</h3>
            
            <div className="max-h-[300px] overflow-y-auto pr-2 mb-6 space-y-4 custom-scrollbar">
              {cartItems.map((item, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-50">
                    <img src={item.product_image} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">{item.product_title}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 font-bold">Qty: {item.quantity}</p>
                    <p className="text-sm font-black text-indigo-600 mt-0.5">${(item.product_price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-6 border-t border-slate-50">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-bold">Subtotal</span>
                <span className="font-black text-slate-900">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-bold flex items-center gap-1.5">
                  <Truck className="w-4 h-4" /> Shipping
                </span>
                <span className="font-black text-slate-900">{shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}</span>
              </div>
              <div className="pt-4 mt-2 border-t border-slate-100 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Amount</p>
                  <p className="text-3xl font-black text-slate-900 tracking-tighter">${total.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-lg">
                  <Shield className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-[10px] font-black text-green-700 uppercase">Secure</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
