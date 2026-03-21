import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import {
  Store, Plus, Package, DollarSign, ShoppingCart, Trash2, Loader2, BarChart3, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import AdvancedAnalytics from "@/components/mystore/AdvancedAnalytics";
import CouponManager from "@/components/mystore/CouponManager";
import SubscriptionManager from "@/components/mystore/SubscriptionManager";
import ShippingZoneManager from "@/components/mystore/ShippingZoneManager";
import AIProductGenerator from "@/components/mystore/AIProductGenerator";
import { storesAPI, productsAPI, ordersAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";

const CATEGORIES = ["fashion", "electronics", "home", "beauty", "sports", "food", "art", "books", "handmade", "other"];

export default function MyStore() {
  const [activeTab, setActiveTab] = useState("products");
  const [showCreateStore, setShowCreateStore] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [storeForm, setStoreForm] = useState({ name: "", description: "", category: "other", logo_url: "", banner_url: "" });
  const [productForm, setProductForm] = useState({ title: "", description: "", price: "", compare_at_price: "", category: "other", inventory_count: "" });
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ["myStore", currentUser?.email],
    queryFn: async () => {
      return storesAPI.getByOwner(currentUser?.email);
    },
    enabled: !!currentUser?.email,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["myProducts", store?.id],
    queryFn: async () => {
      const res = await productsAPI.list({ store_id: store?.id, sort: "-created_date", limit: 100 });
      return res.data || [];
    },
    enabled: !!store?.id,
  });

  const { data: ordersResponse = {} } = useQuery({
    queryKey: ["storeOrders", currentUser?.email],
    queryFn: async () => {
      const res = await ordersAPI.list({ vendor_email: currentUser?.email, sort: "-created_date", limit: 50 });
      return res;
    },
    enabled: !!currentUser?.email,
  });
  
  const orders = Array.isArray(ordersResponse?.data) ? ordersResponse.data : [];

  const createStoreMutation = useMutation({
    mutationFn: () => storesAPI.create({
      ...storeForm,
      owner_email: currentUser.email,
      owner_name: currentUser.full_name,
      status: "active",
    }),
    onSuccess: () => {
      toast.success("Store created!");
      setShowCreateStore(false);
      queryClient.invalidateQueries({ queryKey: ["myStore"] });
    },
  });

  const addProductMutation = useMutation({
    mutationFn: () => productsAPI.create({
      ...productForm,
      price: parseFloat(productForm.price),
      compare_at_price: productForm.compare_at_price ? parseFloat(productForm.compare_at_price) : undefined,
      inventory_count: parseInt(productForm.inventory_count) || 0,
      store_id: store.id,
      store_name: store.name,
      vendor_email: currentUser.email,
      status: "active",
    }),
    onSuccess: () => {
      toast.success("Product added!");
      setShowAddProduct(false);
      setProductForm({ title: "", description: "", price: "", compare_at_price: "", category: "other", inventory_count: "" });
      queryClient.invalidateQueries({ queryKey: ["myProducts"] });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id) => productsAPI.delete(id),
    onSuccess: () => {
      toast.success("Product deleted");
      queryClient.invalidateQueries({ queryKey: ["myProducts"] });
    },
  });

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const pendingOrders = orders.filter(o => o.status === "pending" || o.status === "confirmed").length;

  if (storeLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  if (!store) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-6">
          <Store className="w-9 h-9 text-indigo-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Create Your Store</h1>
        <p className="text-slate-500 mb-8">Start selling on Vetora by setting up your store</p>

        <Dialog open={showCreateStore} onOpenChange={setShowCreateStore}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-8 h-12 text-base">
              <Plus className="w-5 h-5 mr-2" /> Create Store
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Your Store</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Store name" value={storeForm.name} onChange={(e) => setStoreForm(p => ({ ...p, name: e.target.value }))} />
              <Textarea placeholder="Describe your store..." value={storeForm.description} onChange={(e) => setStoreForm(p => ({ ...p, description: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Logo URL (optional)" value={storeForm.logo_url} onChange={(e) => setStoreForm(p => ({ ...p, logo_url: e.target.value }))} />
                <Input placeholder="Banner URL (optional)" value={storeForm.banner_url} onChange={(e) => setStoreForm(p => ({ ...p, banner_url: e.target.value }))} />
              </div>
              <Select value={storeForm.category} onValueChange={(v) => setStoreForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => createStoreMutation.mutate()} disabled={!storeForm.name.trim() || createStoreMutation.isPending} className="w-full bg-indigo-600 hover:bg-indigo-700">
                {createStoreMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Store
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Store Header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
              {store.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{store.name}</h1>
              <p className="text-sm text-slate-500">{store.description || "No description"}</p>
            </div>
          </div>
          <Link to={createPageUrl("StoreDetail") + `?id=${store.id || store._id}`}>
            <Button variant="outline" size="sm" className="rounded-xl">
              <Eye className="w-4 h-4 mr-1.5" /> View Store
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Products", value: products.length, icon: Package, color: "text-indigo-500 bg-indigo-50" },
            { label: "Orders", value: orders.length, icon: ShoppingCart, color: "text-purple-500 bg-purple-50" },
            { label: "Revenue", value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-green-500 bg-green-50" },
            { label: "Pending", value: pendingOrders, icon: BarChart3, color: "text-amber-500 bg-amber-50" },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-50 rounded-xl p-3">
              <div className={`w-8 h-8 rounded-lg ${stat.color} flex items-center justify-center mb-2`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between mb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border border-slate-100">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="coupons">Coupons</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="shipping">Shipping</TabsTrigger>
            <TabsTrigger value="subscription">Plan</TabsTrigger>
            <TabsTrigger value="finance">Finance</TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === "products" && (
          <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-xl">
                <Plus className="w-4 h-4 mr-1.5" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
              <div className="space-y-3 max-h-[80vh] overflow-y-auto pr-1">
                <AIProductGenerator onApply={(ai) => setProductForm(p => ({
                  ...p,
                  title: ai.title || p.title,
                  description: ai.description || p.description,
                }))} />
                <Input placeholder="Product title" value={productForm.title} onChange={(e) => setProductForm(p => ({ ...p, title: e.target.value }))} />
                <Textarea placeholder="Description" value={productForm.description} onChange={(e) => setProductForm(p => ({ ...p, description: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" placeholder="Price" value={productForm.price} onChange={(e) => setProductForm(p => ({ ...p, price: e.target.value }))} />
                  <Input type="number" placeholder="Compare at price" value={productForm.compare_at_price} onChange={(e) => setProductForm(p => ({ ...p, compare_at_price: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={productForm.category} onValueChange={(v) => setProductForm(p => ({ ...p, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Inventory count" value={productForm.inventory_count} onChange={(e) => setProductForm(p => ({ ...p, inventory_count: e.target.value }))} />
                </div>
                <Button onClick={() => addProductMutation.mutate()} disabled={!productForm.title.trim() || !productForm.price || addProductMutation.isPending} className="w-full bg-indigo-600 hover:bg-indigo-700">
                  {addProductMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Add Product
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Products Tab */}
      {activeTab === "products" && (
        <div className="space-y-2">
          {products.length === 0 ? (
            <div className="text-center py-16 text-slate-400">No products yet. Add your first product!</div>
          ) : (
            products.map((product) => (
              <motion.div key={product.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                  {product.images?.[0] && <img src={product.images[0]} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{product.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-bold text-indigo-600">${product.price?.toFixed(2)}</span>
                    <Badge variant="secondary" className="text-[10px]">{product.status}</Badge>
                    <span className="text-xs text-slate-400">Stock: {product.inventory_count || 0}</span>
                  </div>
                </div>
                <button onClick={() => deleteProductMutation.mutate(product.id)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Shipping Tab */}
      {activeTab === "shipping" && (
        <ShippingZoneManager store={store} vendorEmail={currentUser?.email} />
      )}

      {/* Subscription Tab */}
      {activeTab === "subscription" && (
        <SubscriptionManager store={store} vendorEmail={currentUser?.email} />
      )}

      {/* Finance Tab */}
      {activeTab === "finance" && (
        <div className="text-center py-8">
          <p className="text-slate-500 mb-3">Full financial dashboard available in the Finance section</p>
          <Link to={createPageUrl("VendorFinance")} className="text-indigo-600 font-medium text-sm hover:underline">Go to Finance Dashboard →</Link>
        </div>
      )}

      {/* Coupons Tab */}
      {activeTab === "coupons" && (
        <CouponManager store={store} vendorEmail={currentUser?.email} />
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        <AdvancedAnalytics orders={orders} products={products} />
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="space-y-2">
          {orders.length === 0 ? (
            <div className="text-center py-16 text-slate-400">No orders yet</div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400">#{order.id?.slice(-8)} · {new Date(order.created_date).toLocaleDateString()}</p>
                  <Badge variant="secondary" className="text-xs">{order.status}</Badge>
                </div>
                <p className="text-sm font-medium text-slate-700">{order.buyer_name || order.buyer_email}</p>
                <p className="text-sm font-bold text-slate-900 mt-1">${order.total?.toFixed(2)}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}