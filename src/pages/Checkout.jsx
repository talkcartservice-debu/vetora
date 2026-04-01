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
import { cartAPI, ordersAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { initializePaystackPayment } from "@/lib/paystack";

const CheckoutStep = ({ number, title, active, completed, children }) => (
  <div 
    className={`bg-white rounded-3xl border ${active ? "border-indigo-500 shadow-xl shadow-indigo-100/50" : "border-slate-100"} p-6 mb-4 transition-all duration-300`}
  >
    {active && (
      <div className="overflow-hidden">
        {children}
      </div>
    )}
  </div>
);

export default function Checkout() {
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState({ street: "", city: "", state: "", zip: "", phone: "" });
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [orderNote, setOrderNote] = useState("");
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data: cartResponse = {}, isLoading: cartLoading } = useQuery({
    queryKey: ["cart", currentUser?.username],
    queryFn: () => cartAPI.get(),
    enabled: !!currentUser?.username,
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
      const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
      
      // Group items by store for separate order records
      const storeGroups = {};
      cartItems.forEach(item => {
        const key = item.store_id || "default";
        if (!storeGroups[key]) storeGroups[key] = { items: [], store_name: item.store_name };
        storeGroups[key].items.push(item);
      });

      const orders = [];
      const groups = Object.values(storeGroups);
      
      // Get affiliate ref from storage
      const affiliateRef = localStorage.getItem('vetora_ref');
      const affiliateTime = localStorage.getItem('vetora_ref_time');
      
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const orderItems = group.items.map(item => ({
          product_id: item.product_id,
          product_title: item.product_title,
          product_image: item.product_image,
          quantity: item.quantity,
          price: item.product_price,
        }));
        
        const groupSubtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        // Apply shipping cost only to the first order to avoid double charging in records
        const groupShipping = i === 0 ? shipping : 0;

        const order = await ordersAPI.create({
          buyer_username: currentUser.username,
          buyer_name: currentUser.display_name || currentUser.full_name || currentUser.username,
          buyer_email: currentUser.email,
          buyer_phone: address.phone,
          vendor_username: group.items[0]?.vendor_username,
          store_id: group.items[0]?.store_id,
          store_name: group.store_name,
          items: orderItems,
          subtotal: groupSubtotal,
          shipping_fee: groupShipping,
          total: groupSubtotal + groupShipping,
          shipping_address: fullAddress,
          affiliate_username: group.items[0]?.affiliate_username,
          affiliate_ref: affiliateRef || undefined,
          affiliate_time: affiliateTime || undefined,
          order_note: orderNote,
          status: "pending",
          payment_status: "pending",
          payment_method: paymentMethod,
        });
        orders.push(order);
      }
      
      // If Paystack, initialize payment
      const isPaystackMethod = ["paystack", "card", "mobile_money"].includes(paymentMethod);
      if (isPaystackMethod) {
        // Pass all order IDs to Paystack for reconciliation
        const orderIds = orders.map(o => o._id).join(",");
        
        let channels = [];
        if (paymentMethod === "card") channels = ["card"];
        if (paymentMethod === "mobile_money") channels = ["mobile_money", "ussd", "qr"];

        try {
          await initializePaystackPayment({
            amount: total, // Still passed but server now verifies against DB
            email: currentUser.email,
            phone: address.phone,
            order_id: orderIds,
            channels: channels.length > 0 ? channels : undefined
          });
          
          // cartAPI.clear() removed from here to avoid race condition during redirect.
          // It is now handled in PaymentSuccess.jsx after verification.
        } catch (paystackError) {
          console.error("Payment initialization failed:", paystackError);
          // If paystack fails to initialize, don't clear the cart
          throw paystackError;
        }

        return orders;
      }
      
      await cartAPI.clear();
      return orders;
    },
    onSuccess: (orders) => {
      const isPaystackMethod = ["paystack", "card", "mobile_money"].includes(paymentMethod);
      if (isPaystackMethod) {
        // Redirection happens in initializePaystackPayment
        return;
      }
      toast.success("Order placed successfully! 🎉");
      localStorage.removeItem('vetora_ref');
      localStorage.removeItem('vetora_ref_time');
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      navigate(createPageUrl("Orders"));
    },
    onError: (err) => {
      toast.error(err.message || "Failed to place order");
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
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">State / Province</label>
                <Input value={address.state} onChange={e => setAddress({...address, state: e.target.value})} placeholder="NY" className="rounded-xl h-11 border-slate-200" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">ZIP Code</label>
                <Input value={address.zip} onChange={e => setAddress({...address, zip: e.target.value})} placeholder="10001" className="rounded-xl h-11 border-slate-200" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Phone Number</label>
                <Input value={address.phone} onChange={e => setAddress({...address, phone: e.target.value})} placeholder="+1 (555) 000-0000" className="rounded-xl h-11 border-slate-200" />
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
              <Button 
                type="button"
                onClick={() => {
                  const isStreetValid = address.street.trim().length > 0;
                  const isCityValid = address.city.trim().length > 0;
                  const isStateValid = address.state.trim().length > 0;
                  const isZipValid = address.zip.trim().length > 0;
                  const isPhoneValid = address.phone.trim().length > 5;

                  if (!isStreetValid || !isCityValid || !isStateValid || !isZipValid || !isPhoneValid) {
                    toast.error("Please fill in all required shipping fields correctly");
                    return;
                  }
                  setStep(2);
                }} 
                className="col-span-2 mt-4 bg-indigo-600 hover:bg-indigo-700 h-12 rounded-xl font-bold transition-all active:scale-[0.98]"
              >
                Continue to Payment
              </Button>
            </div>
          </CheckoutStep>

          <CheckoutStep number="2" title="Payment Method" active={step === 2} completed={step > 2}>
            <div className="space-y-3">
              {[
                { id: "card", name: "Credit/Debit Card", icon: CreditCard },
                { id: "mobile_money", name: "Mobile/Airtel Money", icon: Wallet }
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

              {/* Payment Details Input/Notice based on method */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                {paymentMethod === "mobile_money" && (
                  <div className="p-5 bg-indigo-50/50 rounded-[1.5rem] border border-indigo-100/50">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-black text-slate-900 tracking-tight uppercase">Mobile Money Details</h4>
                    </div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Mobile Number for Payment</label>
                    <Input 
                      value={address.phone} 
                      onChange={e => setAddress({...address, phone: e.target.value})} 
                      placeholder="e.g. +234 800 000 0000" 
                      className="rounded-xl h-11 border-slate-200 bg-white" 
                    />
                    <p className="text-[11px] text-indigo-600/70 mt-3 font-medium flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      A secure payment prompt will be sent to this mobile number after you place your order.
                    </p>
                  </div>
                )}

                {paymentMethod === "card" && (
                  <div className="p-5 bg-indigo-50/50 rounded-[1.5rem] border border-indigo-100/50">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                        <Lock className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-black text-slate-900 tracking-tight uppercase">Secure Card Payment</h4>
                    </div>
                    
                    <p className="text-[13px] text-slate-600 leading-relaxed font-medium">
                      You will be securely redirected to <strong>Paystack</strong> to enter your card details and complete the 3D secure authentication. 
                    </p>
                    
                    <div className="mt-4 flex items-center gap-2 p-3 bg-white/50 rounded-xl border border-indigo-100/50">
                      <Shield className="w-4 h-4 text-indigo-600" />
                      <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">PCI-DSS Compliant Payment</span>
                    </div>
                    
                    <p className="text-[11px] text-slate-500 mt-3 font-medium flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      Vetora does not store your card details. All transactions are processed securely by Paystack.
                    </p>
                    <div className="mt-4 flex gap-2 opacity-50 grayscale">
                      <div className="h-6 w-10 bg-white rounded border border-slate-200 flex items-center justify-center text-[8px] font-bold">VISA</div>
                      <div className="h-6 w-10 bg-white rounded border border-slate-200 flex items-center justify-center text-[8px] font-bold">MC</div>
                      <div className="h-6 w-10 bg-white rounded border border-slate-200 flex items-center justify-center text-[8px] font-bold">AMEX</div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 mt-8">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl font-bold border-slate-200">Back</Button>
                <Button type="button" onClick={() => setStep(3)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 h-12 rounded-xl font-bold">Review Order</Button>
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
                  <p className="text-xs text-slate-500 mt-0.5">{address.street}, {address.city}, {address.state} {address.zip}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{address.phone}</p>
                </div>
                <button type="button" onClick={() => setStep(1)} className="ml-auto text-xs font-bold text-indigo-600 hover:underline">Edit</button>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Payment Method</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {paymentMethod === "paystack" ? "Paystack (All Methods)" : paymentMethod}
                  </p>
                </div>
                <button type="button" onClick={() => setStep(2)} className="ml-auto text-xs font-bold text-indigo-600 hover:underline">Edit</button>
              </div>

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                  By clicking "Place Order", you agree to Vetora's terms of service and privacy policy. Your order will be processed immediately.
                </p>
              </div>

              <Button 
                type="button"
                onClick={() => placeOrderMutation.mutate()} 
                disabled={placeOrderMutation.isPending}
                className="w-full bg-slate-900 hover:bg-black h-14 rounded-2xl font-black text-lg tracking-tight mt-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                {placeOrderMutation.isPending ? <><Loader2 className="w-5 h-5 animate-spin mr-3" /> Processing...</> : <><Lock className="w-5 h-5 mr-3" /> Place Order • ${total.toFixed(2)}</>}
              </Button>
            </div>
          </CheckoutStep>
        </div>

        {/* Order Summary Column */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[2rem] border border-slate-100 p-8 sticky top-12 shadow-2xl shadow-slate-200/50">
            <h3 className="text-xl font-black text-slate-900 mb-6 tracking-tight">Order Summary</h3>
            
            <div className="max-h-[300px] overflow-y-auto pr-2 mb-6 space-y-4 custom-scrollbar">
              {cartItems.map((item) => (
                <div key={item._id || item.product_id} className="flex gap-4">
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
