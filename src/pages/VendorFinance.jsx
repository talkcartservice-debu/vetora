import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign, TrendingUp, Clock, CheckCircle2, ArrowDownCircle,
  Loader2, Wallet, FileText, ChevronDown, ChevronUp, AlertCircle, Building2,
  CreditCard, BarChart3
} from "lucide-react";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { storesAPI, ordersAPI, withdrawalsAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";

function StatCard({ icon: Icon, label, value, sub, color }) {
  // Icon is a component, rendered as <Icon />
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

const PAYOUT_RATE = 0.9; // 90% after platform fee

export default function VendorFinance() {
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: "", bank_name: "", bank_account_name: "", bank_account_number: "", routing_number: ""
  });
  const [expandedOrder, setExpandedOrder] = useState(null);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data: store } = useQuery({
    queryKey: ["myStore", currentUser?.email],
    queryFn: async () => {
      return storesAPI.getByOwner(currentUser?.email);
    },
    enabled: !!currentUser?.email,
  });

  const { data: ordersResponse = {} } = useQuery({
    queryKey: ["storeOrders", currentUser?.email],
    queryFn: async () => {
      const res = await ordersAPI.list({ vendor_email: currentUser?.email, sort: "-created_date", limit: 200 });
      return res;
    },
    enabled: !!currentUser?.email,
  });
  
  const orders = Array.isArray(ordersResponse?.data) ? ordersResponse.data : [];

  const { data: withdrawalsResponse = {} } = useQuery({
    queryKey: ["withdrawals", currentUser?.email],
    queryFn: async () => {
      const res = await withdrawalsAPI.list({ vendor_email: currentUser?.email, sort: "-created_date", limit: 50 });
      return res;
    },
    enabled: !!currentUser?.email,
  });
  
  const withdrawals = Array.isArray(withdrawalsResponse?.withdrawals) ? withdrawalsResponse.withdrawals : [];

  const withdrawMutation = useMutation({
    mutationFn: () => withdrawalsAPI.create({
      vendor_email: currentUser.email,
      store_id: store?.id,
      store_name: store?.name,
      amount: parseFloat(withdrawForm.amount),
      bank_account_name: withdrawForm.bank_account_name,
      bank_account_number: withdrawForm.bank_account_number,
      bank_name: withdrawForm.bank_name,
      routing_number: withdrawForm.routing_number,
      status: "pending",
    }),
    onSuccess: () => {
      toast.success("Withdrawal request submitted!");
      setWithdrawOpen(false);
      setWithdrawForm({ amount: "", bank_name: "", bank_account_name: "", bank_account_number: "", routing_number: "" });
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
    },
  });

  // Financial calculations
  const paidOrders = orders.filter(o => o.payment_status === "paid" || o.status === "delivered" || o.status === "shipped");
  const pendingOrders = orders.filter(o => o.status === "pending" || o.status === "confirmed" || o.status === "processing");
  const totalGross = paidOrders.reduce((s, o) => s + (o.total || 0), 0);
  const totalEarned = totalGross * PAYOUT_RATE;
  const totalWithdrawn = withdrawals.filter(w => w.status === "completed").reduce((s, w) => s + (w.amount || 0), 0);
  const pendingWithdrawals = withdrawals.filter(w => w.status === "pending" || w.status === "processing").reduce((s, w) => s + (w.amount || 0), 0);
  const availableBalance = Math.max(0, totalEarned - totalWithdrawn - pendingWithdrawals);
  const pendingEarnings = pendingOrders.reduce((s, o) => s + (o.total || 0), 0) * PAYOUT_RATE;

  // Group orders by month for chart
  const monthlyData = orders.reduce((acc, o) => {
    const month = new Date(o.created_date).toLocaleString("default", { month: "short", year: "2-digit" });
    acc[month] = (acc[month] || 0) + (o.total || 0) * PAYOUT_RATE;
    return acc;
  }, {});
  const chartData = Object.entries(monthlyData).slice(-6);
  const maxVal = Math.max(...chartData.map(([, v]) => v), 1);

  const downloadTaxInvoice = (order) => {
    const doc = new jsPDF();
    const invoiceId = `INV-${order.id?.slice(-8).toUpperCase()}`;
    const date = new Date(order.created_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // Header gradient strip
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, 210, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("TAX INVOICE", 14, 18);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Vetora Marketplace`, 150, 12);
    doc.text(`Platform Fee: 10%`, 150, 18);

    // Invoice meta
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Invoice Details", 14, 40);
    doc.setFont("helvetica", "normal");
    doc.text(`Invoice #: ${invoiceId}`, 14, 48);
    doc.text(`Date: ${date}`, 14, 54);
    doc.text(`Status: ${order.status?.toUpperCase()}`, 14, 60);

    // Vendor info
    doc.setFont("helvetica", "bold");
    doc.text("From (Vendor)", 120, 40);
    doc.setFont("helvetica", "normal");
    doc.text(store?.name || "Your Store", 120, 48);
    doc.text(currentUser?.email || "", 120, 54);

    // Bill To
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 68, 182, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("BILL TO", 18, 76);
    doc.setFont("helvetica", "normal");
    doc.text(order.buyer_name || order.buyer_email || "Customer", 18, 82);
    doc.text(order.shipping_address || "", 18, 87);

    // Items table header
    let y = 102;
    doc.setFillColor(99, 102, 241);
    doc.rect(14, y - 6, 182, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Item", 18, y);
    doc.text("Qty", 130, y);
    doc.text("Unit Price", 148, y);
    doc.text("Amount", 174, y);

    y += 10;
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "normal");

    (order.items || []).forEach((item, i) => {
      if (i % 2 === 0) { doc.setFillColor(249, 250, 251); doc.rect(14, y - 5, 182, 9, "F"); }
      const title = item.product_title?.length > 40 ? item.product_title.slice(0, 40) + "…" : (item.product_title || "Product");
      doc.text(title, 18, y);
      doc.text(String(item.quantity || 1), 133, y);
      doc.text(`$${(item.price || 0).toFixed(2)}`, 150, y);
      doc.text(`$${((item.price || 0) * (item.quantity || 1)).toFixed(2)}`, 176, y);
      y += 10;
    });

    // Totals
    y += 5;
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y, 196, y);
    y += 8;

    const rows = [
      ["Subtotal", `$${(order.subtotal || order.total || 0).toFixed(2)}`],
      ["Shipping", `$${(order.shipping_fee || 0).toFixed(2)}`],
      ["Gross Total", `$${(order.total || 0).toFixed(2)}`],
      ["Platform Fee (10%)", `-$${((order.total || 0) * 0.1).toFixed(2)}`],
    ];
    rows.forEach(([label, val]) => {
      doc.setFont("helvetica", "normal");
      doc.text(label, 130, y);
      doc.setFont("helvetica", "bold");
      doc.text(val, 185, y, { align: "right" });
      y += 8;
    });

    doc.setFillColor(99, 102, 241);
    doc.rect(130, y - 2, 66, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("Net Payout", 134, y + 5);
    doc.text(`$${((order.total || 0) * 0.9).toFixed(2)}`, 185, y + 5, { align: "right" });

    // Footer
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Generated by Vetora Marketplace · This is a tax invoice for your records.", 14, 282);
    doc.text(`Payment Method: ${order.payment_method || "card"}`, 14, 287);

    doc.save(`invoice-${invoiceId}.pdf`);
    toast.success("PDF Invoice downloaded!");
  };

  const statusColors = {
    pending: "bg-amber-100 text-amber-700",
    processing: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };

  const orderStatusColors = {
    pending: "bg-amber-50 text-amber-700",
    confirmed: "bg-blue-50 text-blue-700",
    processing: "bg-indigo-50 text-indigo-700",
    shipped: "bg-purple-50 text-purple-700",
    delivered: "bg-green-50 text-green-700",
    cancelled: "bg-red-50 text-red-700",
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Platform fee: 10% · Payout rate: 90%</p>
        </div>
        <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-xl gap-2">
              <Wallet className="w-4 h-4" /> Request Withdrawal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Request Withdrawal</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="p-3 bg-indigo-50 rounded-xl">
                <p className="text-xs text-slate-500">Available Balance</p>
                <p className="text-2xl font-bold text-indigo-700">${availableBalance.toFixed(2)}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Withdrawal Amount *</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={withdrawForm.amount}
                  onChange={e => setWithdrawForm(p => ({ ...p, amount: e.target.value }))}
                  max={availableBalance}
                />
                {parseFloat(withdrawForm.amount) > availableBalance && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Exceeds available balance</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Bank Name *</label>
                <Input placeholder="e.g. Chase, Bank of America" value={withdrawForm.bank_name} onChange={e => setWithdrawForm(p => ({ ...p, bank_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Account Holder Name *</label>
                <Input placeholder="Full name on account" value={withdrawForm.bank_account_name} onChange={e => setWithdrawForm(p => ({ ...p, bank_account_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Account Number *</label>
                  <Input placeholder="Account #" value={withdrawForm.bank_account_number} onChange={e => setWithdrawForm(p => ({ ...p, bank_account_number: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Routing Number</label>
                  <Input placeholder="Routing #" value={withdrawForm.routing_number} onChange={e => setWithdrawForm(p => ({ ...p, routing_number: e.target.value }))} />
                </div>
              </div>
              <Button
                onClick={() => withdrawMutation.mutate()}
                disabled={
                  withdrawMutation.isPending ||
                  !withdrawForm.amount || !withdrawForm.bank_name ||
                  !withdrawForm.bank_account_name || !withdrawForm.bank_account_number ||
                  parseFloat(withdrawForm.amount) <= 0 ||
                  parseFloat(withdrawForm.amount) > availableBalance
                }
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowDownCircle className="w-4 h-4 mr-2" />}
                Submit Withdrawal Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={DollarSign} label="Available Balance" value={`$${availableBalance.toFixed(2)}`} color="bg-indigo-50 text-indigo-600" />
        <StatCard icon={TrendingUp} label="Total Earned" value={`$${totalEarned.toFixed(2)}`} sub="After platform fee" color="bg-green-50 text-green-600" />
        <StatCard icon={Clock} label="Pending Earnings" value={`$${pendingEarnings.toFixed(2)}`} sub="From active orders" color="bg-amber-50 text-amber-600" />
        <StatCard icon={CheckCircle2} label="Total Withdrawn" value={`$${totalWithdrawn.toFixed(2)}`} color="bg-purple-50 text-purple-600" />
      </div>

      {/* Monthly Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            <h3 className="font-semibold text-slate-900">Monthly Revenue</h3>
          </div>
          <div className="flex items-end gap-2 h-28">
            {chartData.map(([month, val]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-slate-500">${val.toFixed(0)}</span>
                <div
                  className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all"
                  style={{ height: `${Math.max(8, (val / maxVal) * 80)}px` }}
                />
                <span className="text-[10px] text-slate-400">{month}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Transaction History */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-slate-500" /> Transaction History
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {orders.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-sm">No transactions yet</p>
            ) : (
              orders.map(order => (
                <div key={order.id}>
                  <button
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${orderStatusColors[order.status] || "bg-slate-50 text-slate-600"}`}>
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">
                        {order.buyer_name || order.buyer_email}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(order.created_date).toLocaleDateString()} · #{order.id?.slice(-8)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-600">+${(order.total * 0.9).toFixed(2)}</p>
                      <p className="text-[10px] text-slate-400 line-through">${order.total?.toFixed(2)}</p>
                    </div>
                    {expandedOrder === order.id ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                  </button>

                  <AnimatePresence>
                    {expandedOrder === order.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mx-2.5 mb-2 p-3 bg-slate-50 rounded-xl space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Gross</span>
                            <span className="font-medium">${order.total?.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Platform fee (10%)</span>
                            <span className="text-red-500">-${(order.total * 0.1).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-semibold border-t border-slate-200 pt-1.5">
                            <span>Net payout</span>
                            <span className="text-green-600">${(order.total * 0.9).toFixed(2)}</span>
                          </div>
                          <button
                            onClick={() => downloadTaxInvoice(order)}
                            className="w-full flex items-center justify-center gap-1.5 mt-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" /> Download Invoice
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Withdrawal History */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-500" /> Withdrawal Requests
          </h3>
          {pendingWithdrawals > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl mb-3">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">${pendingWithdrawals.toFixed(2)} pending processing (1–3 business days)</p>
            </div>
          )}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {withdrawals.length === 0 ? (
              <div className="text-center py-8">
                <Wallet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No withdrawals yet</p>
                <p className="text-xs text-slate-300 mt-0.5">Your available balance: ${availableBalance.toFixed(2)}</p>
              </div>
            ) : (
              withdrawals.map(w => (
                <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${statusColors[w.status] || "bg-slate-50 text-slate-600"}`}>
                    <ArrowDownCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">${w.amount?.toFixed(2)}</p>
                    <p className="text-xs text-slate-400">
                      {w.bank_name} · {new Date(w.created_date).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className={`${statusColors[w.status]} border-0 text-xs capitalize`}>
                    {w.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}