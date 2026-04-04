import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { 
  ArrowLeft, CreditCard, Shield, Truck, 
  MapPin, CheckCircle2, Loader2,
  Lock, Info, Wallet, Plus, Trash2, Tag, 
  ChevronRight, ShoppingBag, Store as StoreIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cartAPI, checkoutAPI, authAPI, couponsAPI, shippingZonesAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { initializePaystackPayment } from "@/lib/paystack";

const CheckoutStep = ({ number, title, active, completed, children, onEdit, summary }) => (
  <div 
    className={`bg-white rounded-3xl border ${active ? "border-indigo-500 shadow-xl shadow-indigo-100/50" : "border-slate-100"} p-6 mb-4 transition-all duration-300`}
  >
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${completed ? "bg-green-500 text-white" : active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"}`}>
          {completed ? <CheckCircle2 className="w-5 h-5" /> : number}
        </div>
        <h2 className={`font-black text-lg tracking-tight ${active ? "text-slate-900" : "text-slate-400"}`}>{title}</h2>
      </div>
      {completed && onEdit && (
        <button onClick={onEdit} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full transition-colors">Edit Details</button>
      )}
    </div>
    {(active || !completed) && (
      <div className={`${!active && "hidden"}`}>
        {children}
      </div>
    )}
    {completed && !active && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            {summary || (
                <div className="text-sm text-slate-500 font-medium bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                    Requirement completed.
                </div>
            )}
        </div>
    )}
  </div>
);

export default function Checkout() {
  const [step, setStep] = useState(1);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ street: "", city: "", state: "", zip: "", phone: "", country: "NG", label: "Home" });
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [orderNote, setOrderNote] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Queries
  const { data: cartResponse = {}, isLoading: cartLoading } = useQuery({
    queryKey: ["cart", currentUser?.username],
    queryFn: () => cartAPI.get(),
    enabled: !!currentUser?.username,
  });

  const { data: addressResponse = { addresses: [] }, isLoading: addressLoading, refetch: refetchAddresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => authAPI.getAddresses(),
    enabled: !!currentUser,
  });

  const cartItems = Array.isArray(cartResponse?.items) ? cartResponse.items : [];
  const storeIds = useMemo(() => Array.from(new Set(cartItems.map(item => item.store_id))), [cartItems]);

  const { data: shippingZones = [] } = useQuery({
    queryKey: ["shipping-zones", storeIds],
    queryFn: () => shippingZonesAPI.listByStores(storeIds),
    enabled: storeIds.length > 0,
  });

  // Group items by store
  const storeGroups = useMemo(() => {
    const groups = {};
    cartItems.forEach(item => {
      const key = item.store_id;
      if (!groups[key]) groups[key] = { items: [], store_name: item.store_name, store_id: item.store_id };
      groups[key].items.push(item);
    });
    return Object.values(groups);
  }, [cartItems]);

  // Selected address
  const selectedAddress = useMemo(() => 
    addressResponse.addresses.find(a => a._id === selectedAddressId) || addressResponse.addresses.find(a => a.is_default) || addressResponse.addresses[0]
  , [addressResponse.addresses, selectedAddressId]);

  useEffect(() => {
    if (selectedAddress && !selectedAddressId) {
        setSelectedAddressId(selectedAddress._id);
    }
  }, [selectedAddress, selectedAddressId]);

  // Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let shipping = 0;
    const country = selectedAddress?.country || "NG";

    const storeBreakdown = storeGroups.map(group => {
        const groupSubtotal = group.items.reduce((sum, item) => sum + (item.product_price || 0) * (item.quantity || 1), 0);
        subtotal += groupSubtotal;

        // Find applicable shipping zone for this store and country
        const storeZones = shippingZones.filter(z => z.store_id === group.store_id && z.is_active);
        const zone = storeZones.find(z => z.countries.includes(country)) || storeZones.find(z => z.countries.includes("WORLD"));
        
        let groupShipping = zone ? zone.flat_rate : 0;
        if (zone && zone.free_above > 0 && groupSubtotal >= zone.free_above) {
            groupShipping = 0;
        }

        shipping += groupShipping;

        return {
            ...group,
            subtotal: groupSubtotal,
            shipping: groupShipping
        };
    });

    let discount = 0;
    if (appliedCoupon) {
        if (appliedCoupon.discount_type === 'percentage') {
            discount = (subtotal * appliedCoupon.discount_value) / 100;
        } else {
            discount = Math.min(appliedCoupon.discount_value, subtotal);
        }
    }

    return {
        subtotal,
        shipping,
        discount,
        total: subtotal + shipping - discount,
        storeBreakdown
    };
  }, [storeGroups, shippingZones, selectedAddress, appliedCoupon]);

  // Mutations
  const addAddressMutation = useMutation({
    mutationFn: (data) => authAPI.addAddress(data),
    onSuccess: () => {
        refetchAddresses();
        setIsAddingAddress(false);
        toast.success("Address added successfully");
    }
  });

  const validateCouponMutation = useMutation({
    mutationFn: (code) => couponsAPI.validateForCart({ code, cart_total: calculations.subtotal }),
    onSuccess: (data) => {
        setAppliedCoupon(data.coupon);
        toast.success("Coupon applied! 🎉");
    },
    onError: (err) => {
        toast.error(err.message || "Invalid coupon code");
    }
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
        if (!selectedAddress) throw new Error("Please select a shipping address");
        
        const payload = {
            shipping_address: {
                street: selectedAddress.street,
                city: selectedAddress.city,
                state: selectedAddress.state,
                zip: selectedAddress.zip,
                country: selectedAddress.country,
                phone: selectedAddress.phone || currentUser.phone_number || "",
            },
            payment_method: paymentMethod,
            order_note: orderNote,
            coupon_code: appliedCoupon?.code,
            affiliate_ref: localStorage.getItem('vetora_ref') || undefined,
            affiliate_time: localStorage.getItem('vetora_ref_time') || undefined,
        };

        return await checkoutAPI.process(payload);
    },
    onSuccess: async (data) => {
        if (data.payment_url) {
            window.location.href = data.payment_url;
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

  useEffect(() => {
    if (!cartLoading && cartItems.length === 0 && !checkoutMutation.isSuccess) {
      toast.error("Your cart is empty");
      navigate(createPageUrl("Cart"));
    }
  }, [cartItems, cartLoading, navigate, checkoutMutation.isSuccess]);

  if (cartLoading || addressLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 lg:py-12">
      <Link to={createPageUrl("Cart")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Cart
      </Link>

      <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-8">
          <h1 className="text-4xl font-black text-slate-900 mb-10 tracking-tight">Checkout</h1>
          
          {/* STEP 1: SHIPPING ADDRESS */}
          <CheckoutStep 
            number="1" 
            title="Shipping Address" 
            active={step === 1} 
            completed={step > 1} 
            onEdit={() => setStep(1)}
            summary={selectedAddress && (
              <div className="flex items-center justify-between bg-slate-50/80 p-5 rounded-2xl border border-slate-100 backdrop-blur-sm">
                  <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-indigo-100">
                          <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                          <p className="font-black text-slate-900 leading-tight uppercase text-[10px] tracking-widest text-indigo-600 mb-1">{selectedAddress.label || "Shipping to"}</p>
                          <p className="font-bold text-slate-700 text-sm leading-snug">{selectedAddress.street}</p>
                          <p className="text-xs text-slate-500 font-medium tracking-tight mt-0.5">{selectedAddress.city}, {selectedAddress.state} {selectedAddress.zip}</p>
                      </div>
                  </div>
              </div>
            )}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addressResponse.addresses.map((addr) => (
                  <button
                    key={addr._id}
                    onClick={() => setSelectedAddressId(addr._id)}
                    className={`flex flex-col text-left p-4 rounded-2xl border-2 transition-all relative ${
                      selectedAddressId === addr._id ? "border-indigo-600 bg-indigo-50/30 ring-4 ring-indigo-50" : "border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-100/50 px-2 py-0.5 rounded-full">{addr.label || "Address"}</span>
                        {selectedAddressId === addr._id && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <p className="font-bold text-slate-900 text-sm line-clamp-1">{addr.street}</p>
                    <p className="text-xs text-slate-500 font-medium">{addr.city}, {addr.state} {addr.zip}</p>
                    <p className="text-xs text-slate-400 mt-1">{addr.country}</p>
                  </button>
                ))}
                
                <button 
                    onClick={() => setIsAddingAddress(true)}
                    className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group"
                >
                    <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-indigo-100 flex items-center justify-center mb-2 transition-colors">
                        <Plus className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
                    </div>
                    <span className="text-sm font-bold text-slate-500 group-hover:text-indigo-600">Add New Address</span>
                </button>
              </div>

              {isAddingAddress && (
                <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">New Address Details</h4>
                      <button onClick={() => setIsAddingAddress(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600">Cancel</button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Label (e.g. Home, Office)</label>
                        <Input value={newAddress.label} onChange={e => setNewAddress({...newAddress, label: e.target.value})} placeholder="Home" className="rounded-xl h-11 bg-white border-slate-200" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Street Address</label>
                      <Input value={newAddress.street} onChange={e => setNewAddress({...newAddress, street: e.target.value})} placeholder="123 Main St" className="rounded-xl h-11 bg-white border-slate-200" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">City</label>
                      <Input value={newAddress.city} onChange={e => setNewAddress({...newAddress, city: e.target.value})} placeholder="Lagos" className="rounded-xl h-11 bg-white border-slate-200" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">State</label>
                      <Input value={newAddress.state} onChange={e => setNewAddress({...newAddress, state: e.target.value})} placeholder="Lagos" className="rounded-xl h-11 bg-white border-slate-200" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">ZIP Code</label>
                      <Input value={newAddress.zip} onChange={e => setNewAddress({...newAddress, zip: e.target.value})} placeholder="100001" className="rounded-xl h-11 bg-white border-slate-200" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Phone</label>
                      <Input value={newAddress.phone} onChange={e => setNewAddress({...newAddress, phone: e.target.value})} placeholder="+234..." className="rounded-xl h-11 bg-white border-slate-200" />
                    </div>
                  </div>
                  <Button 
                    onClick={() => {
                        if (!newAddress.street || !newAddress.city || !newAddress.state || !newAddress.zip || !newAddress.phone) {
                            return toast.error("Please fill in all address fields");
                        }
                        addAddressMutation.mutate(newAddress);
                    }} 
                    disabled={addAddressMutation.isPending}
                    className="w-full bg-slate-900 hover:bg-black text-white rounded-xl h-12 font-bold"
                  >
                    {addAddressMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Address"}
                  </Button>
                </div>
              )}

              <Button 
                onClick={() => {
                  if (!selectedAddressId) return toast.error("Please select or add an address");
                  setStep(2);
                }} 
                className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 h-14 rounded-2xl font-black text-lg shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
              >
                Continue to Payment
              </Button>
            </div>
          </CheckoutStep>

          {/* STEP 2: PAYMENT METHOD */}
          <CheckoutStep 
            number="2" 
            title="Payment Method" 
            active={step === 2} 
            completed={step > 2} 
            onEdit={() => setStep(2)}
            summary={(
                <div className="flex items-center justify-between bg-slate-50/80 p-5 rounded-2xl border border-slate-100 backdrop-blur-sm">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-slate-200">
                            {paymentMethod === 'card' ? <CreditCard className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                        </div>
                        <div>
                            <p className="font-black text-slate-900 leading-tight uppercase text-[10px] tracking-widest text-slate-400 mb-1">Paying via</p>
                            <p className="font-bold text-slate-700 text-sm leading-snug">{paymentMethod === 'card' ? "Credit/Debit Card" : "Mobile Money"}</p>
                            <p className="text-xs text-slate-500 font-medium tracking-tight mt-0.5">Secure payment powered by Paystack</p>
                        </div>
                    </div>
                </div>
            )}
          >
            <div className="space-y-3">
              {[
                { id: "card", name: "Credit/Debit Card", icon: CreditCard, desc: "Safe & Secure with Paystack" },
                { id: "mobile_money", name: "Mobile Money", icon: Wallet, desc: "Airtel, MTN, etc." }
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${
                    paymentMethod === method.id ? "border-indigo-600 bg-indigo-50/50" : "border-slate-100 hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${paymentMethod === method.id ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-500"}`}>
                      <method.icon className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <p className={`font-black ${paymentMethod === method.id ? "text-indigo-900" : "text-slate-900"}`}>{method.name}</p>
                        <p className="text-xs text-slate-500 font-medium">{method.desc}</p>
                    </div>
                  </div>
                  {paymentMethod === method.id && <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200"><CheckCircle2 className="w-4 h-4 text-white" /></div>}
                </button>
              ))}

              <div className="mt-8 p-6 bg-indigo-50/30 rounded-3xl border border-indigo-100/50">
                  <div className="flex items-center gap-3 mb-4">
                      <Shield className="w-5 h-5 text-indigo-600" />
                      <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">Secure Payment Guarantee</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      All transactions are processed through <strong>Paystack</strong>'s secure infrastructure. 
                      Vetora does not store or see your payment details.
                  </p>
              </div>

              <div className="flex gap-4 mt-8">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-14 rounded-2xl font-black text-slate-600 border-slate-200">Back</Button>
                <Button onClick={() => setStep(3)} className="flex-2 bg-indigo-600 hover:bg-indigo-700 h-14 rounded-2xl font-black text-lg">Review Order</Button>
              </div>
            </div>
          </CheckoutStep>

          {/* STEP 3: REVIEW ORDER */}
          <CheckoutStep number="3" title="Order Review" active={step === 3} completed={step > 3}>
            <div className="space-y-8">
              {calculations.storeBreakdown.map((store, idx) => (
                <div key={store.store_id} className={`space-y-4 ${idx !== 0 && "pt-8 border-t border-slate-100"}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <StoreIcon className="w-4 h-4 text-indigo-600" />
                        <h3 className="font-black text-slate-900 tracking-tight">{store.store_name}</h3>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">{store.items.length} items</span>
                    </div>
                    <div className="space-y-4">
                        {store.items.map(item => (
                            <div key={item._id} className="flex gap-4 group">
                                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0">
                                    <img src={item.product_image} alt={item.product_title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <h4 className="font-bold text-slate-900 text-sm truncate">{item.product_title}</h4>
                                    <p className="text-xs text-slate-500 font-medium">Qty: {item.quantity} × ${item.product_price}</p>
                                </div>
                                <div className="text-right flex flex-col justify-center">
                                    <p className="font-black text-slate-900 text-sm">${(item.product_price * item.quantity).toFixed(2)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                            <Truck className="w-3.5 h-3.5" />
                            Shipping for this store
                        </div>
                        <span className="text-xs font-black text-slate-900">{store.shipping === 0 ? "FREE" : `$${store.shipping.toFixed(2)}`}</span>
                    </div>
                </div>
              ))}

              <div className="space-y-4 pt-6 border-t-2 border-slate-100">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Order Note (Optional)</label>
                  <Textarea 
                    value={orderNote} 
                    onChange={e => setOrderNote(e.target.value)} 
                    placeholder="Anything we should know about your delivery?" 
                    className="rounded-2xl min-h-[100px] border-slate-200 resize-none focus:ring-indigo-500 focus:border-indigo-500" 
                  />
              </div>

              <div className="flex gap-4 mt-8">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-14 rounded-2xl font-black text-slate-600 border-slate-200">Back</Button>
                <Button 
                    onClick={() => checkoutMutation.mutate()} 
                    disabled={checkoutMutation.isPending}
                    className="flex-2 bg-slate-900 hover:bg-black text-white h-14 rounded-2xl font-black text-lg shadow-xl shadow-slate-200 flex items-center justify-center gap-3 group"
                >
                    {checkoutMutation.isPending ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <>
                            Place Order <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </Button>
              </div>
            </div>
          </CheckoutStep>
        </div>

        {/* SUMMARY SIDEBAR */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-2xl shadow-slate-200/50 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50" />
              
              <h3 className="font-black text-xl text-slate-900 mb-8 tracking-tight flex items-center gap-3">
                  <ShoppingBag className="w-5 h-5 text-indigo-600" /> Order Summary
              </h3>

              <div className="space-y-5 relative z-10">
                <div className="flex justify-between text-slate-500 font-bold">
                  <span>Subtotal</span>
                  <span className="text-slate-900">${calculations.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500 font-bold">
                  <span>Shipping</span>
                  <span className="text-slate-900">{calculations.shipping === 0 ? "FREE" : `$${calculations.shipping.toFixed(2)}`}</span>
                </div>
                {calculations.discount > 0 && (
                  <div className="flex justify-between text-green-600 font-bold bg-green-50 px-3 py-2 rounded-xl border border-green-100">
                    <span className="flex items-center gap-2"><Tag className="w-3.5 h-3.5" /> Discount</span>
                    <span>-${calculations.discount.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="h-px bg-slate-100 my-2" />
                
                <div className="flex justify-between items-end pt-2">
                  <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Amount</span>
                      <span className="text-3xl font-black text-slate-900 tracking-tighter">${calculations.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Coupon Code */}
                <div className="mt-8 pt-8 border-t border-slate-100">
                    {!appliedCoupon ? (
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Coupon Code</label>
                            <div className="flex gap-2">
                                <Input 
                                    value={couponCode} 
                                    onChange={e => setCouponCode(e.target.value)} 
                                    placeholder="Enter code" 
                                    className="rounded-xl h-11 border-slate-200"
                                />
                                <Button 
                                    onClick={() => validateCouponMutation.mutate(couponCode)}
                                    disabled={!couponCode || validateCouponMutation.isPending}
                                    variant="outline" 
                                    className="h-11 rounded-xl font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                >
                                    Apply
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                                    <Tag className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-indigo-900 uppercase tracking-tight">{appliedCoupon.code}</p>
                                    <p className="text-[10px] text-indigo-600 font-bold">Applied Successfully</p>
                                </div>
                            </div>
                            <button onClick={() => setAppliedCoupon(null)} className="text-slate-400 hover:text-red-500 p-1">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
              </div>
            </div>

            {/* Help/Support info */}
            <div className="bg-slate-900 rounded-[2rem] p-6 text-white overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 transition-all group-hover:scale-150 duration-700" />
                <div className="flex items-center gap-4 mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                        <Info className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-black tracking-tight">Need Help?</h4>
                </div>
                <p className="text-xs text-white/60 font-medium leading-relaxed mb-4">
                    If you have any questions about your order or the checkout process, our support team is available 24/7.
                </p>
                <Link to="/Support" className="text-xs font-black text-white hover:text-indigo-400 underline underline-offset-4 decoration-white/20">Contact Support</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
