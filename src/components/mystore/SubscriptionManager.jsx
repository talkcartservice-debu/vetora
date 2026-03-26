import React, { useState, useEffect } from "react";
import { vendorSubscriptionsAPI } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Zap, Star, Check, Globe, TrendingUp, Image, Infinity, Loader2, X, Shield, BadgeCheck,
  CreditCard, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { initializePaystackPayment } from "@/lib/paystack";
import { useAuth } from "@/lib/AuthContext";

const PLANS = [
  {
    id: "free",
    name: "Starter",
    price: 0,
    priceAnnual: 0,
    color: "border-slate-200",
    headerBg: "bg-slate-50",
    badge: null,
    icon: Star,
    iconColor: "text-slate-500",
    features: [
      "Up to 10 products",
      "5 images per product",
      "Basic analytics",
      "Standard search listing",
      "Community support",
    ],
    limits: { products: 10, images: 5, priority_search: false, custom_domain: false, unlimited_media: false },
  },
  {
    id: "pro",
    name: "Pro",
    price: 29,
    priceAnnual: 23,
    color: "border-indigo-400",
    headerBg: "bg-gradient-to-br from-indigo-50 to-purple-50",
    badge: "Most Popular",
    icon: Zap,
    iconColor: "text-indigo-600",
    features: [
      "Up to 200 products",
      "20 images + videos per product",
      "Advanced analytics & CTR data",
      "Priority search listing",
      "Custom domain mapping",
      "Shipping zone manager",
      "Email support",
    ],
    limits: { products: 200, images: 20, priority_search: true, custom_domain: true, unlimited_media: false },
  },
  {
    id: "elite",
    name: "Elite",
    price: 79,
    priceAnnual: 63,
    color: "border-amber-400",
    headerBg: "bg-gradient-to-br from-amber-50 to-orange-50",
    badge: "Best Value",
    icon: Crown,
    iconColor: "text-amber-600",
    features: [
      "Unlimited products",
      "Unlimited images & videos",
      "Full analytics suite",
      "Top-tier search placement",
      "Custom domain + SSL",
      "Shipping zones + live rates",
      "Dedicated account manager",
      "Affiliate program access",
    ],
    limits: { products: Infinity, images: Infinity, priority_search: true, custom_domain: true, unlimited_media: true },
  },
];

function PlanCard({ plan, currentPlan, onSelect, billing }) {
  const isActive = currentPlan?.plan === plan.id;
  const isDowngrade = currentPlan && PLANS.findIndex(p => p.id === plan.id) < PLANS.findIndex(p => p.id === currentPlan.plan);
  const price = billing === "annual" ? plan.priceAnnual : plan.price;
  const PlanIcon = plan.icon;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`relative rounded-2xl border-2 ${plan.color} ${isActive ? "ring-2 ring-indigo-500 ring-offset-2" : ""} overflow-hidden flex flex-col`}
    >
      {plan.badge && (
        <div className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${plan.id === "pro" ? "bg-indigo-600 text-white" : "bg-amber-500 text-white"}`}>
          {plan.badge}
        </div>
      )}
      <div className={`p-5 ${plan.headerBg}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${plan.id === "free" ? "bg-slate-200" : plan.id === "pro" ? "bg-indigo-100" : "bg-amber-100"}`}>
          <PlanIcon className={`w-5 h-5 ${plan.iconColor}`} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
        <div className="flex items-end gap-1 mt-1">
          <span className="text-3xl font-black text-slate-900">${price}</span>
          <span className="text-slate-500 text-sm mb-0.5">/mo</span>
        </div>
        {billing === "annual" && plan.price > 0 && (
          <p className="text-xs text-green-600 font-medium mt-0.5">Save ${(plan.price - plan.priceAnnual) * 12}/yr</p>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <ul className="space-y-2.5 flex-1 mb-5">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
              <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>

        {isActive ? (
          <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold">
            <BadgeCheck className="w-4 h-4" /> Current Plan
          </div>
        ) : (
          <Button
            onClick={() => onSelect(plan)}
            className={`w-full rounded-xl ${plan.id === "free" ? "variant-outline border border-slate-200" : plan.id === "pro" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"}`}
            variant={plan.id === "free" ? "outline" : "default"}
          >
            {isDowngrade ? "Downgrade" : "Upgrade"} to {plan.name}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function CustomDomainManager({ subscription, vendorEmail }) {
  const [domain, setDomain] = useState(subscription?.custom_domain || "");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const canUseDomain = subscription?.plan === "pro" || subscription?.plan === "elite";

  const save = async () => {
    if (!subscription?.id && !subscription?._id) return;
    setSaving(true);
    try {
      await vendorSubscriptionsAPI.update(subscription.id || subscription._id, { custom_domain: domain });
      queryClient.invalidateQueries({ queryKey: ["vendorSubscription"] });
      toast.success("Custom domain saved!");
    } catch (err) {
      toast.error(err.message || "Failed to save domain");
    } finally {
      setSaving(false);
    }
  };

  if (!canUseDomain) {
    return (
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 flex items-center gap-3">
        <Shield className="w-8 h-8 text-slate-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-700">Custom Domain Mapping</p>
          <p className="text-xs text-slate-500">Upgrade to Pro or Elite to use a custom domain</p>
        </div>
        <Badge className="ml-auto bg-indigo-600 text-white text-xs">Pro+</Badge>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-5 h-5 text-indigo-500" />
        <h4 className="text-sm font-semibold text-slate-900">Custom Domain</h4>
        {subscription?.custom_domain ? (
          <Badge className="ml-auto bg-green-100 text-green-700 border-0 text-xs">Active</Badge>
        ) : (
          <Badge className="ml-auto bg-slate-100 text-slate-500 border-0 text-xs">Not configured</Badge>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-3">Point your domain to Vetora to use a branded store URL.</p>
      <div className="flex gap-2">
        <Input
          value={domain}
          onChange={e => setDomain(e.target.value)}
          placeholder="shop.yourbrand.com"
          className="rounded-xl text-sm"
        />
        <Button onClick={save} disabled={saving || !domain.trim()} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
        </Button>
      </div>
      {domain && (
        <p className="text-xs text-slate-400 mt-2">
          Add a CNAME record: <code className="bg-slate-100 px-1 rounded text-indigo-700">store.vetora.app</code>
        </p>
      )}
    </div>
  );
}

export default function SubscriptionManager({ store, vendorEmail }) {
  const [billing, setBilling] = useState("monthly");
  const [showConfirm, setShowConfirm] = useState(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    
    if (reference && subscription && (subscription.id || subscription._id)) {
      verifyMutation.mutate({ 
        id: subscription.id || subscription._id, 
        reference 
      });
      
      // Clean up URL properly
      params.delete('reference');
      params.delete('trxref');
      const search = params.toString() ? `?${params.toString()}` : '';
      window.history.replaceState({}, '', window.location.pathname + search);
    }
  }, [subscription, verifyMutation]);

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["vendorSubscription", vendorEmail],
    queryFn: async () => {
      const res = await vendorSubscriptionsAPI.list({ vendor_email: vendorEmail });
      const subs = Array.isArray(res) ? res : (res.data || res.subscriptions || []);
      return subs[0] || null;
    },
    enabled: !!vendorEmail,
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, reference }) => {
      return vendorSubscriptionsAPI.verifyPayment(id, reference);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorSubscription"] });
      toast.success("Payment verified! Subscription active.");
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async (plan) => {
      const today = new Date();
      const expires = new Date(today);
      expires.setMonth(expires.getMonth() + (billing === "annual" ? 12 : 1));

      const payload = {
        plan: plan.id,
        billing_cycle: billing,
        store_id: store?.id,
        vendor_email: vendorEmail,
      };

      let sub;
      if (subscription?.id || subscription?._id) {
        sub = await vendorSubscriptionsAPI.update(subscription.id || subscription._id, payload);
      } else {
        sub = await vendorSubscriptionsAPI.create(payload);
      }

      if (plan.id === "free") {
        return { sub, needsPayment: false };
      }

      return { sub, needsPayment: true, plan };
    },
    onSuccess: (data) => {
      if (!data.needsPayment) {
        toast.success(`Plan updated to ${data.sub.plan}!`);
        setShowConfirm(null);
        queryClient.invalidateQueries({ queryKey: ["vendorSubscription"] });
      } else {
        const annualPrice = data.plan.priceAnnual * 12;
        const monthlyPrice = data.plan.price;
        const price = billing === "annual" ? annualPrice : monthlyPrice;
        
        // Paystack uses kobo (kobo = price * 100)
        initializePaystackPayment({
          amount: Math.round(price * 100),
          email: user.email,
          order_id: `SUB-${data.sub.id || data.sub._id}`,
          onSuccess: (res) => {
            verifyMutation.mutate({ 
              id: data.sub.id || data.sub._id, 
              reference: res.reference 
            });
          }
        });
        setShowConfirm(null);
      }
    },
  });

  const currentPlanInfo = PLANS.find(p => p.id === (subscription?.plan || "free"));
  const isPending = subscription?.status === "pending";

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      {/* Current Plan Banner */}
      <div className={`relative rounded-2xl p-5 flex items-center gap-4 ${subscription?.plan === "elite" ? "bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200" : subscription?.plan === "pro" ? "bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200" : "bg-slate-50 border border-slate-200"}`}>
        {currentPlanInfo && <currentPlanInfo.icon className={`w-8 h-8 shrink-0 ${currentPlanInfo.iconColor}`} />}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-900">
              You are on the <span className={subscription?.plan === "elite" ? "text-amber-600" : subscription?.plan === "pro" ? "text-indigo-600" : "text-slate-600"}>{currentPlanInfo?.name}</span> plan
            </p>
            {isPending && (
              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 animate-pulse">Pending Payment</Badge>
            )}
          </div>
          {subscription?.expires_at && (
            <p className="text-xs text-slate-500">
              {subscription.status === 'cancelled' ? 'Expires' : 'Renews'} {new Date(subscription.expires_at).toLocaleDateString()}
            </p>
          )}
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {subscription?.plan !== "free" && (
            <Badge className={`text-xs border-0 ${subscription?.plan === "elite" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"}`}>
              {subscription?.billing_cycle === "annual" ? "Annual" : "Monthly"}
            </Badge>
          )}
          {isPending && (
            <Button 
              size="sm" 
              variant="default" 
              className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 rounded-lg px-4 shadow-sm shadow-indigo-100"
              onClick={() => {
                const plan = PLANS.find(p => p.id === subscription.plan);
                const price = subscription.billing_cycle === "annual" ? plan.priceAnnual * 12 : plan.price;
                initializePaystackPayment({
                  amount: Math.round(price * 100),
                  email: user.email,
                  order_id: `SUB-${subscription.id || subscription._id}`,
                  onSuccess: (res) => {
                    verifyMutation.mutate({ 
                      id: subscription.id || subscription._id, 
                      reference: res.reference 
                    });
                  }
                });
              }}
            >
              Pay Now
            </Button>
          )}
        </div>
      </div>

      {isPending && (
        <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 leading-relaxed">
            <strong>Payment Required:</strong> Your {currentPlanInfo?.name} features will be unlocked once payment is confirmed. 
            If you've already paid, it may take a few minutes to update.
          </div>
        </div>
      )}

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm font-medium ${billing === "monthly" ? "text-slate-900" : "text-slate-400"}`}>Monthly</span>
        <button
          onClick={() => setBilling(b => b === "monthly" ? "annual" : "monthly")}
          className={`relative w-12 h-6 rounded-full transition-colors ${billing === "annual" ? "bg-indigo-600" : "bg-slate-200"}`}
        >
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${billing === "annual" ? "left-7" : "left-1"}`} />
        </button>
        <span className={`text-sm font-medium ${billing === "annual" ? "text-slate-900" : "text-slate-400"}`}>
          Annual <span className="text-green-600 text-xs font-bold">Save 20%</span>
        </span>
      </div>

      {/* Plan Cards */}
      <div className="grid lg:grid-cols-3 gap-4">
        {PLANS.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            currentPlan={subscription}
            billing={billing}
            onSelect={setShowConfirm}
          />
        ))}
      </div>

      {/* Custom Domain */}
      <CustomDomainManager subscription={subscription} vendorEmail={vendorEmail} />

      {/* Feature comparison callout */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { icon: TrendingUp, label: "Priority Search", plans: ["Pro", "Elite"], color: "text-indigo-500" },
          { icon: Image, label: "Unlimited Media", plans: ["Elite"], color: "text-amber-500" },
          { icon: Globe, label: "Custom Domain", plans: ["Pro", "Elite"], color: "text-green-500" },
        ].map(f => (
          <div key={f.label} className="bg-white rounded-xl border border-slate-100 p-3">
            <f.icon className={`w-5 h-5 mx-auto mb-1.5 ${f.color}`} />
            <p className="text-xs font-semibold text-slate-700">{f.label}</p>
            <p className="text-[10px] text-slate-400">{f.plans.join(", ")} only</p>
          </div>
        ))}
      </div>

      {/* Confirm Dialog */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="bg-white rounded-2xl p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Confirm Upgrade</h3>
                <button onClick={() => setShowConfirm(null)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <p className="text-slate-600 text-sm mb-2">
                Upgrade to <strong>{showConfirm.name}</strong> for <strong>${billing === "annual" ? showConfirm.priceAnnual : showConfirm.price}/mo</strong> ({billing}).
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowConfirm(null)}>Cancel</Button>
                <Button
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => subscribeMutation.mutate(showConfirm)}
                  disabled={subscribeMutation.isPending}
                >
                  {subscribeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Confirm
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}