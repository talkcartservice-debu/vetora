import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/lib/utils";
import { notificationsAPI, messagesAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import {
  Home,
  Search,
  ShoppingBag,
  MessageCircle,
  User,
  Plus,
  Store,
  Users,
  Package,
  Radio,
  Sparkles,
  Heart,
  Bookmark,
  Settings as SettingsIcon,
  MapPin,
  DollarSign,
  Link2,
  Bell,
  Shield
} from "lucide-react";
import LanguagePicker from "@/components/layout/LanguagePicker";
import NotificationBell from "@/components/layout/NotificationBell";
import GlobalSearch from "@/components/layout/GlobalSearch";
import CreateActionModal from "@/components/layout/CreateActionModal";

const NAV_ITEMS = [
  { name: "Home", icon: Home, page: "Home" },
  { name: "Explore", icon: Search, page: "Explore" },
  { name: "Create", icon: Plus, action: "create", accent: true },
  { name: "Live", icon: Radio, page: "Live" },
  { name: "Profile", icon: User, page: "Profile" },
];

const ADMIN_NAV_ITEMS = [
  { name: "Admin", icon: Shield, page: "AdminDashboard" },
  { name: "Messages", icon: MessageCircle, page: "Chat" },
  { name: "Notifications", icon: Bell, page: "Notifications" },
  { name: "Settings", icon: SettingsIcon, page: "Settings" },
  { name: "Profile", icon: User, page: "Profile" },
];

const ALLOWED_ADMIN_SIDEBAR_NAMES = ["Admin", "Profile", "Messages", "Notifications", "Settings"];

const SIDEBAR_ITEMS = [
  { name: "Feed", icon: Home, page: "Home" },
  { name: "Profile", icon: User, page: "Profile" },
  { name: "Explore", icon: Search, page: "Explore" },
  { name: "Marketplace", icon: ShoppingBag, page: "Marketplace" },
  { name: "Live Shopping", icon: Radio, page: "Live" },
  { name: "Communities", icon: Users, page: "Communities" },
  { name: "Messages", icon: MessageCircle, page: "Chat" },
  { name: "AI Assistant", icon: Sparkles, page: "AIAssistant" },
  { name: "Wishlist", icon: Heart, page: "Wishlist" },
  { name: "Bookmarks", icon: Bookmark, page: "Bookmarks" },
  { name: "Orders", icon: Package, page: "Orders" },
  { name: "Track Order", icon: MapPin, page: "OrderTracking" },
  { name: "My Store", icon: Store, page: "MyStore" },
  { name: "Finance", icon: DollarSign, page: "VendorFinance" },
  { name: "Affiliate", icon: Link2, page: "Affiliate" },
  { name: "Notifications", icon: Bell, page: "Notifications" },
  { name: "Settings", icon: SettingsIcon, page: "Settings" },
  { name: "Admin", icon: Shield, page: "AdminDashboard", adminOnly: true },
];

const HIDE_LAYOUT_PAGES = [];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const { data: unreadNotifs = [] } = useQuery({
    queryKey: ["unreadNotifs", currentUser?.email],
    queryFn: () => notificationsAPI.list({ unread_only: 'true' }).then(res => res.data || []),
    enabled: !!currentUser?.email,
  });

  const { data: unreadMessages = [] } = useQuery({
    queryKey: ["unreadMessages", currentUser?.email],
    queryFn: () => messagesAPI.listConversations().then(res => res.data || res || []),
    enabled: !!currentUser?.email,
    refetchInterval: 10000,
  });

  if (HIDE_LAYOUT_PAGES.includes(currentPageName)) {
    return <>{children}</>;
  }

  const unreadCount = unreadNotifs.length;
  const unreadMsgCount = unreadMessages.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col z-40">
        <div className="p-6">
          <Link to={createPageUrl(currentUser?.role === 'super_admin' ? "AdminDashboard" : "Home")} className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Vetora</span>
          </Link>
          {currentUser?.role !== 'super_admin' && <GlobalSearch />}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto hide-scrollbar">
          {SIDEBAR_ITEMS.map((item) => {
            if (item.adminOnly && currentUser?.role !== 'super_admin') return null;
            
            // If super_admin, only show admin-specific and account-related items
            if (currentUser?.role === 'super_admin' && !ALLOWED_ADMIN_SIDEBAR_NAMES.includes(item.name)) {
              return null;
            }
            
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.page)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                {item.name}
                {item.name === "Notifications" && unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
                {item.name === "Messages" && unreadMsgCount > 0 && (
                  <span className="ml-auto bg-indigo-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadMsgCount > 9 ? "9+" : unreadMsgCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {currentUser?.role !== 'super_admin' && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-indigo-900/40 transition-all"
            >
              <Plus className="w-4 h-4" />
              Create
            </button>
            <div className="flex justify-center">
              <LanguagePicker />
            </div>
          </div>
        )}
        {currentUser?.role === 'super_admin' && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex justify-center">
              <LanguagePicker />
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Top Bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between px-4 z-40">
        <Link to={createPageUrl(currentUser?.role === 'super_admin' ? "AdminDashboard" : "Home")} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-white">Vetora</span>
        </Link>
        <div className="flex items-center gap-1">
          <LanguagePicker />
          {currentUser?.role !== 'super_admin' && (
            <Link to={createPageUrl("Chat")} className="relative p-2">
              <MessageCircle className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              {unreadMsgCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {unreadMsgCount > 9 ? "9+" : unreadMsgCount}
                </span>
              )}
            </Link>
          )}
          <NotificationBell userEmail={currentUser?.email} />
          {currentUser?.role !== 'super_admin' && (
            <Link to={createPageUrl("Cart")} className="p-2">
              <ShoppingBag className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </Link>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="lg:ml-64 pt-14 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/60 z-40">
        <div className="flex items-center justify-around h-16 px-2">
          {(currentUser?.role === 'super_admin' ? ADMIN_NAV_ITEMS : NAV_ITEMS).map((item) => {
            const isActive = currentPageName === item.page;
            if (item.accent) {
              return (
                <button
                  key={item.name}
                  onClick={() => setShowCreate(true)}
                  className="w-11 h-11 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 -mt-4"
                >
                  <Plus className="w-5 h-5 text-white" />
                </button>
              );
            }
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.page)}
                className="flex flex-col items-center gap-0.5"
              >
                <item.icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
                  }`}
                />
                <span
                  className={`text-[10px] font-medium ${
                    isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <CreateActionModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        currentUser={currentUser}
      />
    </div>
  );
}