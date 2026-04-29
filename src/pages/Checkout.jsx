import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { 
  ArrowLeft, CreditCard, Shield, Truck, 
  MapPin, CheckCircle2, Loader2,
  Info, Wallet, Plus, Trash2, Tag, 
  ChevronRight, ShoppingBag, Store as StoreIcon,
  Package, Navigation
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cartAPI, checkoutAPI, authAPI, couponsAPI, shippingZonesAPI, storesAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/utils";

const FULFILLMENT_ICONS = {
  shipping: Truck,
  delivery: Navigation,
  pickup: Package,
};

const CheckoutStep = ({ number, title, active, completed, children, onEdit, summary }) => {
  const { t } = useTranslation();
  return (
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
        <button onClick={onEdit} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full transition-colors">{t("checkout.editDetails")}</button>
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
                    {t("checkout.requirementCompleted")}
                </div>
            )}
        </div>
    )}
  </div>
  );
};

const FulfillmentMethodCard = ({ method, selected, onSelect, store, subtotal }) => {
  const { t } = useTranslation();
  const Icon = FULFILLMENT_ICONS[method];
  const ds = store?.delivery_settings || {};

  const getMethodLabel = (m) => {
    if (m === "shipping") return t("checkout.shippingLabel");
    if (m === "delivery") return t("checkout.deliveryLabel");
    return t("checkout.pickupLabel");
  };

  const getFee = () => {
    if (method === "pickup") return t("checkout.free");
    if (method === "delivery") {
      const fee = ds.delivery_fee || 0;
      if (ds.free_delivery_above && subtotal >= ds.free_delivery_above) return t("checkout.free");
      return fee === 0 ? t("checkout.free") : formatCurrency(fee);
    }
    return null;
  };

  const getSubLabel = () => {
    if (method === "pickup") return ds.pickup_instructions ? t("checkout.seeInstructionsBelow") : t("checkout.collectFromStore");
    if (method === "delivery") {
      const parts = [];
      if (ds.delivery_time_est) parts.push(ds.delivery_time_est);
      if (ds.delivery_radius_km) parts.push(t("checkout.withinKm", { km: ds.delivery_radius_km }));
      if (ds.min_order_for_delivery && subtotal < ds.min_order_for_delivery) {
        return t("checkout.minOrderRequired", { amount: formatCurrency(ds.min_order_for_delivery) });
      }
      return parts.length ? parts.join(" · ") : t("checkout.toYourLocation");
    }
    return t("checkout.trackedCarrierDelivery");
  };

  const isDisabled = () => {
    if (method === "delivery" && ds.min_order_for_delivery && subtotal < ds.min_order_for_delivery) return true;
    return false;
  };

  const fee = getFee();
  const freeLabel = t("checkout.free");
  const disabled = isDisabled();

  return (
    <button
      onClick={() => !disabled && onSelect(method)}
      disabled={disabled}
      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
        disabled
          ? "border-slate-100 bg-slate-50/50 opacity-60 cursor-not-allowed"
          : selected
          ? "border-indigo-600 bg-indigo-50/40 ring-4 ring-indigo-50"
          : "border-slate-100 hover:border-slate-200"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${selected ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-500"}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className={`font-black text-sm ${selected ? "text-indigo-900" : "text-slate-900"}`}>{getMethodLabel(method)}</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">{getSubLabel()}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {fee !== null && (
          <span className={`text-sm font-black ${fee === freeLabel ? "text-green-600" : "text-slate-900"}`}>{fee}</span>
        )}
        {selected && <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-white" /></div>}
      </div>
    </button>
  );
};

export default function Checkout() {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ street: "", city: "", state: "", zip: "", phone: "", country: "NG", label: "Home" });
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [orderNote, setOrderNote] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [storeDeliverySelections, setStoreDeliverySelections] = useState({});

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser, isLoadingAuth, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
        navigate(createPageUrl("login"), { state: { from: window.location.pathname } });
    }
  }, [isLoadingAuth, isAuthenticated, navigate]);

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

  const { data: shippingZonesResponse = { zones: [] } } = useQuery({
    queryKey: ["shipping-zones", storeIds],
    queryFn: () => shippingZonesAPI.listByStores(storeIds),
    enabled: storeIds.length > 0,
  });

  const shippingZones = Array.isArray(shippingZonesResponse?.zones) ? shippingZonesResponse.zones : [];

  const { data: storesDataList = [] } = useQuery({
    queryKey: ["checkout-stores", storeIds],
    queryFn: async () => {
      const results = await Promise.all(storeIds.map(id => storesAPI.get(id).catch(() => null)));
      return results.filter(Boolean);
    },
    enabled: storeIds.length > 0,
  });

  const storesMap = useMemo(() => {
    const map = {};
    storesDataList.forEach(store => {
      if (store?._id) map[store._id] = store;
    });
    return map;
  }, [storesDataList]);

  const storeGroups = useMemo(() => {
    const groups = {};
    cartItems.forEach(item => {
      const key = item.store_id;
      if (!groups[key]) groups[key] = { items: [], store_name: item.store_name, store_id: item.store_id };
      groups[key].items.push(item);
    });
    return Object.values(groups);
  }, [cartItems]);

  // Init delivery selections from store settings when stores are loaded
  useEffect(() => {
    if (Object.keys(storesMap).length > 0) {
      setStoreDeliverySelections(prev => {
        const next = { ...prev };
        Object.entries(storesMap).forEach(([storeId, store]) => {
          if (!next[storeId]) {
            const ds = store.delivery_settings || {};
            if (ds.shipping_enabled !== false) next[storeId] = "shipping";
            else if (ds.delivery_enabled) next[storeId] = "delivery";
            else if (ds.pickup_enabled) next[storeId] = "pickup";
            else next[storeId] = "shipping";
          }
        });
        return next;
      });
    }
  }, [storesMap]);

  const selectedAddress = useMemo(() => 
    addressResponse.addresses.find(a => a._id === selectedAddressId) || addressResponse.addresses.find(a => a.is_default) || addressResponse.addresses[0]
  , [addressResponse.addresses, selectedAddressId]);

  useEffect(() => {
    if (selectedAddress && !selectedAddressId) {
        setSelectedAddressId(selectedAddress._id);
    }
  }, [selectedAddress, selectedAddressId]);

  // Whether any store requires an address (shipping or delivery selected)
  const needsAddress = useMemo(() => {
    return storeGroups.some(group => {
      const method = storeDeliverySelections[group.store_id] || "shipping";
      return method === "shipping" || method === "delivery";
    });
  }, [storeGroups, storeDeliverySelections]);

  const calculations = useMemo(() => {
    let subtotal = 0;
    let shipping = 0;
    const country = selectedAddress?.country || "NG";

    const storeBreakdown = storeGroups.map(group => {
        const groupSubtotal = group.items.reduce((sum, item) => sum + (item.product_price || 0) * (item.quantity || 1), 0);
        subtotal += groupSubtotal;

        const store = storesMap[group.store_id];
        const ds = store?.delivery_settings || {};
        const method = storeDeliverySelections[group.store_id] || "shipping";

        let groupShipping = 0;

        if (method === "pickup") {
          groupShipping = 0;
        } else if (method === "delivery") {
          let fee = ds.delivery_fee || 0;
          if (ds.free_delivery_above && groupSubtotal >= ds.free_delivery_above) fee = 0;
          groupShipping = fee;
        } else {
          // shipping - use shipping zones
          const storeZones = shippingZones.filter(z => z.store_id === group.store_id && z.is_active);
          const zone = storeZones.find(z => Array.isArray(z.countries) && z.countries.includes(country)) || 
                       storeZones.find(z => Array.isArray(z.countries) && z.countries.includes("WORLD"));
          groupShipping = zone ? (zone.flat_rate || 0) : 0;
          if (zone && zone.free_above > 0 && groupSubtotal >= zone.free_above) groupShipping = 0;
        }

        shipping += groupShipping;

        return {
            ...group,
            subtotal: groupSubtotal,
            shipping: groupShipping,
            delivery_method: method,
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
  }, [storeGroups, shippingZones, selectedAddress, appliedCoupon, storeDeliverySelections, storesMap]);

  const addAddressMutation = useMutation({
    mutationFn: (data) => authAPI.addAddress(data),
    onSuccess: () => {
        refetchAddresses();
        setIsAddingAddress(false);
        toast.success(t("checkout.addressAdded"));
    }
  });

  const validateCouponMutation = useMutation({
    mutationFn: (code) => couponsAPI.validateForCart({ code, cart_total: calculations.subtotal }),
    onSuccess: (data) => {
        setAppliedCoupon(data.coupon);
        toast.success(t("checkout.couponApplied"));
    },
    onError: (err) => {
        toast.error(err.message || t("checkout.invalidCoupon"));
    }
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
        if (needsAddress && !selectedAddress) throw new Error(t("checkout.selectDeliveryAddress"));
        
        const payload = {
            payment_method: paymentMethod,
            order_note: orderNote,
            coupon_code: appliedCoupon?.code,
            affiliate_ref: localStorage.getItem('iqon_ref') || undefined,
            affiliate_time: localStorage.getItem('iqon_ref_time') || undefined,
            store_fulfillment_types: storeDeliverySelections,
        };

        if (needsAddress && selectedAddress) {
            payload.shipping_address = {
                street: selectedAddress.street,
                city: selectedAddress.city,
                state: selectedAddress.state,
                zip: selectedAddress.zip,
                country: selectedAddress.country,
                phone: selectedAddress.phone || currentUser.phone_number || "",
            };
        }

        return await checkoutAPI.process(payload);
    },
    onSuccess: async (data) => {
        if (data.payment_url) {
            window.location.href = data.payment_url;
            return;
        }
        
        toast.success(t("checkout.orderPlaced"));
        localStorage.removeItem('iqon_ref');
        localStorage.removeItem('iqon_ref_time');
        queryClient.invalidateQueries({ queryKey: ["cart"] });
        navigate(createPageUrl("orders"));
    },
    onError: (err) => {
        toast.error(err.message || t("checkout.failedToPlaceOrder"));
    }
  });

  useEffect(() => {
    if (!cartLoading && cartItems.length === 0 && !checkoutMutation.isSuccess) {
      toast.error(t("checkout.cartEmpty"));
      navigate(createPageUrl("cart"));
    }
  }, [cartItems, cartLoading, navigate, checkoutMutation.isSuccess]);

  const handleContinueFromStep1 = () => {
    if (needsAddress && !selectedAddressId) {
      return toast.error(t("checkout.selectOrAddAddress"));
    }
    setStep(2);
  };

  const getStep1Summary = () => {
    const methodSummary = storeGroups.map(g => {
      const method = storeDeliverySelections[g.store_id] || "shipping";
      const Icon = FULFILLMENT_ICONS[method];
      return (
        <div key={g.store_id} className="flex items-center gap-2 text-xs text-slate-600 font-medium">
          <Icon className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
          <span className="font-bold text-slate-800">{g.store_name}</span>
          <span className="text-slate-400">·</span>
          <span className="capitalize">{method === "shipping" ? t("checkout.shippingLabel") : method === "delivery" ? t("checkout.deliveryLabel") : t("checkout.pickupLabel")}</span>
        </div>
      );
    });

    return (
      <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-100 space-y-3">
        {methodSummary}
        {needsAddress && selectedAddress && (
          <div className="flex items-start gap-3 pt-3 border-t border-slate-100 mt-3">
            <MapPin className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-slate-700">{selectedAddress.street}</p>
              <p className="text-xs text-slate-500">{selectedAddress.city}, {selectedAddress.state} {selectedAddress.zip}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (cartLoading || addressLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 lg:py-12">
      <Link to={createPageUrl("cart")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("checkout.backToCart")}
      </Link>

      <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-8">
          <h1 className="text-4xl font-black text-slate-900 mb-10 tracking-tight">{t("common.checkout")}</h1>
          
          {/* STEP 1: DELIVERY OPTIONS */}
          <CheckoutStep 
            number="1" 
            title={t("checkout.deliveryOptions")} 
            active={step === 1} 
            completed={step > 1} 
            onEdit={() => setStep(1)}
            summary={getStep1Summary()}
          >
            <div className="space-y-6">
              {/* Per-store delivery method selector */}
              {storeGroups.map((group, idx) => {
                const store = storesMap[group.store_id];
                const ds = store?.delivery_settings || {};
                const groupSubtotal = group.items.reduce((sum, item) => sum + (item.product_price || 0) * (item.quantity || 1), 0);
                const enabledMethods = [];
                if (ds.shipping_enabled !== false) enabledMethods.push("shipping");
                if (ds.delivery_enabled) enabledMethods.push("delivery");
                if (ds.pickup_enabled) enabledMethods.push("pickup");
                if (enabledMethods.length === 0) enabledMethods.push("shipping");

                const selectedMethod = storeDeliverySelections[group.store_id] || enabledMethods[0];
                const storeHasPickup = selectedMethod === "pickup";

                return (
                  <div key={group.store_id} className={`space-y-3 ${idx !== 0 ? "pt-6 border-t border-slate-100" : ""}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <StoreIcon className="w-4 h-4 text-indigo-500" />
                      <h3 className="font-black text-sm text-slate-900 tracking-tight">{group.store_name}</h3>
                      {enabledMethods.length === 1 && (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full capitalize">{t("checkout.methodOnly", { method: enabledMethods[0] === "shipping" ? t("checkout.shippingLabel") : enabledMethods[0] === "delivery" ? t("checkout.deliveryLabel") : t("checkout.pickupLabel") })}</span>
                      )}
                    </div>

                    {enabledMethods.map(method => (
                      <FulfillmentMethodCard
                        key={method}
                        method={method}
                        selected={selectedMethod === method}
                        onSelect={(m) => setStoreDeliverySelections(prev => ({ ...prev, [group.store_id]: m }))}
                        store={store}
                        subtotal={groupSubtotal}
                      />
                    ))}

                    {storeHasPickup && ds.pickup_instructions && (
                      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4 animate-in fade-in duration-300">
                        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-black text-amber-900 uppercase tracking-wider mb-1">{t("checkout.pickupInstructions")}</p>
                          <p className="text-xs text-amber-700 leading-relaxed">{ds.pickup_instructions}</p>
                          {store?.address && (
                            <p className="text-xs text-amber-600 font-bold mt-2 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {store.address}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedMethod === "delivery" && ds.delivery_radius_km && (
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-700 font-medium">
                        <Navigation className="w-3.5 h-3.5 flex-shrink-0" />
                        {t("checkout.deliveryRadius", { km: ds.delivery_radius_km })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Delivery Address (only when needed) */}
              {needsAddress && (
                <div className="pt-6 border-t-2 border-slate-100 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-indigo-500" />
                    <h3 className="font-black text-sm text-slate-900">
                      {storeGroups.every(g => storeDeliverySelections[g.store_id] === "delivery") ? t("checkout.deliveryAddress") : t("checkout.shippingAddress")}
                    </h3>
                  </div>

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
                        <span className="text-sm font-bold text-slate-500 group-hover:text-indigo-600">{t("checkout.addNewAddress")}</span>
                    </button>
                  </div>

                  {isAddingAddress && (
                    <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{t("checkout.newAddressDetails")}</h4>
                          <button onClick={() => setIsAddingAddress(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600">{t("common.cancel")}</button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label htmlFor="addr-label" className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">{t("checkout.addressLabel")}</label>
                            <Input id="addr-label" value={newAddress.label} onChange={e => setNewAddress({...newAddress, label: e.target.value})} placeholder="Home" className="rounded-xl h-11 bg-white border-slate-200" />
                        </div>
                        <div className="col-span-2">
                          <label htmlFor="addr-street" className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">{t("checkout.streetAddress")}</label>
                          <Input id="addr-street" value={newAddress.street} onChange={e => setNewAddress({...newAddress, street: e.target.value})} placeholder="123 Main St" className="rounded-xl h-11 bg-white border-slate-200" />
                        </div>
                        <div>
                          <label htmlFor="addr-city" className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">{t("checkout.city")}</label>
                          <Input id="addr-city" value={newAddress.city} onChange={e => setNewAddress({...newAddress, city: e.target.value})} placeholder="Lagos" className="rounded-xl h-11 bg-white border-slate-200" />
                        </div>
                        <div>
                          <label htmlFor="addr-state" className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">{t("checkout.state")}</label>
                          <Input id="addr-state" value={newAddress.state} onChange={e => setNewAddress({...newAddress, state: e.target.value})} placeholder="Lagos" className="rounded-xl h-11 bg-white border-slate-200" />
                        </div>
                        <div>
                          <label htmlFor="addr-zip" className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">{t("checkout.zipCode")}</label>
                          <Input id="addr-zip" value={newAddress.zip} onChange={e => setNewAddress({...newAddress, zip: e.target.value})} placeholder="100001" className="rounded-xl h-11 bg-white border-slate-200" />
                        </div>
                        <div>
                          <label htmlFor="addr-phone" className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">{t("checkout.phone")}</label>
                          <Input id="addr-phone" value={newAddress.phone} onChange={e => setNewAddress({...newAddress, phone: e.target.value})} placeholder="+234..." className="rounded-xl h-11 bg-white border-slate-200" />
                        </div>
                      </div>
                      <Button 
                        onClick={() => {
                            if (!newAddress.street || !newAddress.city || !newAddress.state || !newAddress.zip || !newAddress.phone) {
                                return toast.error(t("checkout.fillAllFields"));
                            }
                            addAddressMutation.mutate(newAddress);
                        }} 
                        disabled={addAddressMutation.isPending}
                        className="w-full bg-slate-900 hover:bg-black text-white rounded-xl h-12 font-bold"
                      >
                        {addAddressMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("checkout.saveAddress")}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <Button 
                onClick={handleContinueFromStep1}
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 h-14 rounded-2xl font-black text-lg shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
              >
                {t("checkout.continueToPayment")}
              </Button>
            </div>
          </CheckoutStep>

          {/* STEP 2: PAYMENT METHOD */}
          <CheckoutStep 
            number="2" 
            title={t("checkout.paymentMethod")} 
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
                            <p className="font-black text-slate-900 leading-tight uppercase text-[10px] tracking-widest text-slate-400 mb-1">{t("checkout.payingVia")}</p>
                            <p className="font-bold text-slate-700 text-sm leading-snug">{paymentMethod === 'card' ? t("checkout.creditDebitCard") : t("checkout.mobileMoney")}</p>
                            <p className="text-xs text-slate-500 font-medium tracking-tight mt-0.5">{t("checkout.safeSecurePaystack")}</p>
                        </div>
                    </div>
                </div>
            )}
          >
            <div className="space-y-3">
              {[
                { id: "card", name: t("checkout.creditDebitCard"), icon: CreditCard, desc: t("checkout.safeSecurePaystack") },
                { id: "mobile_money", name: t("checkout.mobileMoney"), icon: Wallet, desc: t("checkout.mobileMoneyProviders") }
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
                      <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">{t("checkout.securePaymentGuarantee")}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      {t("checkout.securePaymentDesc")}
                  </p>
              </div>

              <div className="flex gap-4 mt-8">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-14 rounded-2xl font-black text-slate-600 border-slate-200">{t("common.back")}</Button>
                <Button onClick={() => setStep(3)} className="flex-2 bg-indigo-600 hover:bg-indigo-700 h-14 rounded-2xl font-black text-lg">{t("checkout.reviewOrder")}</Button>
              </div>
            </div>
          </CheckoutStep>

          {/* STEP 3: REVIEW ORDER */}
          <CheckoutStep number="3" title={t("checkout.orderReview")} active={step === 3} completed={step > 3}>
            <div className="space-y-8">
              {calculations.storeBreakdown.map((store, idx) => {
                const FulfillIcon = FULFILLMENT_ICONS[store.delivery_method] || Truck;
                const storeInfo = storesMap[store.store_id];
                const ds = storeInfo?.delivery_settings || {};

                return (
                  <div key={store.store_id} className={`space-y-4 ${idx !== 0 && "pt-8 border-t border-slate-100"}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <StoreIcon className="w-4 h-4 text-indigo-600" />
                        <h3 className="font-black text-slate-900 tracking-tight">{store.store_name}</h3>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">{t("checkout.itemsCount", { count: store.items.length })}</span>
                    </div>
                    <div className="space-y-4">
                        {store.items.map(item => (
                            <div key={item._id} className="flex gap-4 group">
                                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0">
                                    <img src={item.product_image} alt={item.product_title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <h4 className="font-bold text-slate-900 text-sm truncate">{item.product_title}</h4>
                                    <p className="text-xs text-slate-500 font-medium">{t("checkout.qty", { qty: item.quantity, price: formatCurrency(item.product_price) })}</p>
                                </div>
                                <div className="text-right flex flex-col justify-center">
                                    <p className="font-black text-slate-900 text-sm">{formatCurrency(item.product_price * item.quantity)}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                            <FulfillIcon className="w-3.5 h-3.5" />
                            {store.delivery_method === "shipping" ? t("checkout.shippingLabel") : store.delivery_method === "delivery" ? t("checkout.deliveryLabel") : t("checkout.pickupLabel")}
                        </div>
                        <span className="text-xs font-black text-slate-900">{store.shipping === 0 ? t("checkout.freeBadge") : formatCurrency(store.shipping)}</span>
                    </div>

                    {store.delivery_method === "pickup" && ds.pickup_instructions && (
                      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-3">
                        <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 font-medium">{ds.pickup_instructions}</p>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="space-y-4 pt-6 border-t-2 border-slate-100">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">{t("checkout.orderNote")}</label>
                  <Textarea 
                    value={orderNote} 
                    onChange={e => setOrderNote(e.target.value)} 
                    placeholder={t("checkout.orderNotePlaceholder")} 
                    className="rounded-2xl min-h-[100px] border-slate-200 resize-none focus:ring-indigo-500 focus:border-indigo-500" 
                  />
              </div>

              <div className="flex gap-4 mt-8">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-14 rounded-2xl font-black text-slate-600 border-slate-200">{t("common.back")}</Button>
                <Button 
                    onClick={() => checkoutMutation.mutate()} 
                    disabled={checkoutMutation.isPending}
                    className="flex-2 bg-slate-900 hover:bg-black text-white h-14 rounded-2xl font-black text-lg shadow-xl shadow-slate-200 flex items-center justify-center gap-3 group"
                >
                    {checkoutMutation.isPending ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <>
                            {t("checkout.placeOrder")} <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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
                  <ShoppingBag className="w-5 h-5 text-indigo-600" /> {t("cart.orderSummary")}
              </h3>

              <div className="space-y-5 relative z-10">
                <div className="flex justify-between text-slate-500 font-bold">
                  <span>{t("cart.subtotal")}</span>
                  <span className="text-slate-900">{formatCurrency(calculations.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500 font-bold">
                  <span>{t("checkout.fulfillment")}</span>
                  <span className="text-slate-900">{calculations.shipping === 0 ? t("checkout.freeBadge") : formatCurrency(calculations.shipping)}</span>
                </div>
                {calculations.discount > 0 && (
                  <div className="flex justify-between text-green-600 font-bold bg-green-50 px-3 py-2 rounded-xl border border-green-100">
                    <span className="flex items-center gap-2"><Tag className="w-3.5 h-3.5" /> {t("common.discount")}</span>
                    <span>-{formatCurrency(calculations.discount)}</span>
                  </div>
                )}
                
                <div className="h-px bg-slate-100 my-2" />
                
                <div className="flex justify-between items-end pt-2">
                  <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("cart.total")}</span>
                      <span className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(calculations.total)}</span>
                  </div>
                </div>

                {/* Coupon Code */}
                <div className="mt-8 pt-8 border-t border-slate-100">
                    {!appliedCoupon ? (
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("checkout.couponCode")}</label>
                            <div className="flex gap-2">
                                <Input 
                                    value={couponCode} 
                                    onChange={e => setCouponCode(e.target.value)} 
                                    placeholder={t("checkout.couponPlaceholder")} 
                                    className="rounded-xl h-11 border-slate-200"
                                />
                                <Button 
                                    onClick={() => validateCouponMutation.mutate(couponCode)}
                                    disabled={!couponCode || validateCouponMutation.isPending}
                                    variant="outline" 
                                    className="h-11 rounded-xl font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                >
                                    {t("common.apply")}
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
                                    <p className="text-[10px] text-indigo-600 font-bold">{t("checkout.appliedSuccessfully")}</p>
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
                    <h4 className="font-black tracking-tight">{t("checkout.needHelp")}</h4>
                </div>
                <p className="text-xs text-white/60 font-medium leading-relaxed mb-4">
                    {t("checkout.needHelpDesc")}
                </p>
                <Link to="/support" className="text-xs font-black text-white hover:text-indigo-400 underline underline-offset-4 decoration-white/20">{t("checkout.contactSupport")}</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
