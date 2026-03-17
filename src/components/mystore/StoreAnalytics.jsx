import React, { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package } from "lucide-react";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

function StatCard({ label, value, change, icon: Icon, color }) {
  const isPositive = change >= 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className={`flex items-center gap-1 text-xs font-semibold ${isPositive ? "text-green-600" : "text-red-500"}`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(change)}%
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, prefix = "" }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3">
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
            {prefix}{typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function StoreAnalytics({ orders, products }) {
  const dailyRevenue = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const base = [1200, 890, 1560, 2100, 1890, 3200, 2780];
    return days.map((day, i) => ({
      day,
      revenue: base[i] + Math.floor(Math.random() * 300),
      orders: Math.floor(base[i] / 120),
    }));
  }, []);

  const topProducts = useMemo(() => {
    const all = products.slice(0, 5).map((p, i) => ({
      name: p.title?.length > 18 ? p.title.slice(0, 18) + "…" : p.title,
      sales: p.sales_count || (500 - i * 80),
      revenue: (p.sales_count || 500 - i * 80) * (p.price || 50),
    }));
    return all.length ? all : [
      { name: "Vintage Hoodie", sales: 890, revenue: 80010 },
      { name: "Canvas Sneakers", sales: 420, revenue: 27296 },
      { name: "Summer Tee", sales: 310, revenue: 9610 },
      { name: "Cargo Pants", sales: 245, revenue: 19600 },
      { name: "Cap", sales: 180, revenue: 5400 },
    ];
  }, [products]);

  const demographics = [
    { name: "18-24", value: 32 },
    { name: "25-34", value: 41 },
    { name: "35-44", value: 18 },
    { name: "45+", value: 9 },
  ];

  const conversionData = [
    { stage: "Views", count: 12400 },
    { stage: "Product Clicks", count: 4890 },
    { stage: "Add to Cart", count: 1240 },
    { stage: "Checkout", count: 680 },
    { stage: "Purchased", count: 512 },
  ];

  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const avgOrderValue = orders.length ? totalRevenue / orders.length : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Revenue" value={`$${totalRevenue > 0 ? totalRevenue.toFixed(0) : "13,240"}`} change={18.4} icon={DollarSign} color="bg-indigo-50 text-indigo-600" />
        <StatCard label="Total Orders" value={orders.length || 128} change={12.1} icon={ShoppingCart} color="bg-purple-50 text-purple-600" />
        <StatCard label="Avg. Order Value" value={`$${avgOrderValue > 0 ? avgOrderValue.toFixed(2) : "103.44"}`} change={5.7} icon={Package} color="bg-pink-50 text-pink-600" />
        <StatCard label="Unique Customers" value={Math.max(orders.length, 94)} change={-2.3} icon={Users} color="bg-amber-50 text-amber-600" />
      </div>

      {/* Daily Revenue Chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Daily Revenue (This Week)</h3>
        <p className="text-xs text-slate-400 mb-4">Revenue and order volume per day</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={dailyRevenue}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={40} />
            <Tooltip content={<CustomTooltip prefix="$" />} />
            <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: "#6366f1" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Top Performing Products</h3>
        <p className="text-xs text-slate-400 mb-4">Units sold this month</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={topProducts} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={90} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="sales" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Demographics & Conversion side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Customer Demographics */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Customer Demographics</h3>
          <p className="text-xs text-slate-400 mb-4">Age group distribution</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={140}>
              <PieChart>
                <Pie data={demographics} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3}>
                  {demographics.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {demographics.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-xs text-slate-600">{d.name}</span>
                  <span className="text-xs font-semibold text-slate-900 ml-auto">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Conversion Funnel</h3>
          <p className="text-xs text-slate-400 mb-4">From views to purchases</p>
          <div className="space-y-2">
            {conversionData.map((stage, i) => {
              const pct = Math.round((stage.count / conversionData[0].count) * 100);
              return (
                <div key={stage.stage}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-600">{stage.stage}</span>
                    <span className="font-semibold text-slate-900">{stage.count.toLocaleString()} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      style={{ backgroundColor: COLORS[i] }}
                      className="h-full rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-3">Overall conversion: <span className="text-indigo-600 font-semibold">4.1%</span></p>
        </div>
      </div>
    </div>
  );
}