import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { createPageUrl } from "@/lib/utils";
import { notificationsAPI, messagesAPI, cartAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
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
  Shield,
  CreditCard,
  Sun,
  Moon,
  Menu,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import LanguagePicker from "@/components/layout/LanguagePicker";
import NotificationBell from "@/components/layout/NotificationBell";
import GlobalSearch from "@/components/layout/GlobalSearch";
import CreateActionModal from "@/components/layout/CreateActionModal";
import AnnouncementBanner from "@/components/layout/AnnouncementBanner";

const NAV_ITEMS = [
  { name: "Home", icon: Home, page: "Home" },
  { name: "Explore", icon: Search, page: "Explore" },
  { name: "Create", icon: Plus, action: "create", accent: true },
  { name: "Cart", icon: ShoppingBag, page: "Cart" },
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
  { name: "Cart", icon: ShoppingBag, page: "Cart" },
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
  { name: "Account Plans", icon: CreditCard, page: "MyStore", params: "?tab=subscription" },
  { name: "Affiliate", icon: Link2, page: "Affiliate" },
  { name: "Notifications", icon: Bell, page: "Notifications" },
  { name: "Settings", icon: SettingsIcon, page: "Settings" },
  { name: "Admin", icon: Shield, page: "AdminDashboard", adminOnly: true },
];

const HIDE_LAYOUT_PAGES = [];

export default function Layout({ children, currentPageName }) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    setMounted(true);
    // Initial state based on screen size
    if (window.innerWidth >= 1024) { // lg breakpoint
      setSidebarOpen(true);
    }
  }, []);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const BottomSection = () => (
    <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
      {currentUser?.role !== 'super_admin' && (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-indigo-900/40 transition-all"
        >
          <Plus className="w-4 h-4" />
          Create
        </button>
      )}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          title="Toggle Theme"
        >
          {mounted && (theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />)}
        </button>
        <LanguagePicker />
      </div>
    </div>
  );

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

  const { data: cartResponse = {} } = useQuery({
    queryKey: ["cart", currentUser?.username],
    queryFn: () => cartAPI.get(),
    enabled: !!currentUser?.username,
  });

  if (HIDE_LAYOUT_PAGES.includes(currentPageName)) {
    return <>{children}</>;
  }

  const unreadCount = unreadNotifs.length;
  const unreadMsgCount = unreadMessages.reduce((acc, conv) => acc + (conv.unread_count || 0), 0);
  const cartItemCount = Array.isArray(cartResponse?.items) ? cartResponse.items.length : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 bottom-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 transition-all duration-300
        ${isMobile 
          ? (sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full w-64") 
          : (sidebarOpen ? "w-64" : "w-20")
        }`}
      >
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Link 
              to={createPageUrl(currentUser?.role === 'super_admin' ? "AdminDashboard" : "Home")} 
              onClick={() => isMobile && setSidebarOpen(false)}
              className={`flex items-center gap-2 ${!sidebarOpen && !isMobile && "justify-center w-full"}`}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-lg">V</span>
              </div>
              {(sidebarOpen || isMobile) && <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Vetora</span>}
            </Link>
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {isMobile ? <X className="w-5 h-5" /> : (sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />)}
            </button>
          </div>
          {(sidebarOpen || isMobile) && currentUser?.role !== 'super_admin' && <GlobalSearch />}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto hide-scrollbar">
          {SIDEBAR_ITEMS.map((item) => {
            if (item.adminOnly && currentUser?.role !== 'super_admin') return null;
            
            // If super_admin, only show admin-specific and account-related items
            if (currentUser?.role === 'super_admin' && !ALLOWED_ADMIN_SIDEBAR_NAMES.includes(item.name)) {
              return null;
            }
            
            const queryParams = new URLSearchParams(window.location.search);
            const currentTab = queryParams.get("tab");
            const itemTab = item.params ? new URLSearchParams(item.params).get("tab") : null;
            
            const isActive = currentPageName === item.page && (itemTab ? currentTab === itemTab : !currentTab);
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.page) + (item.params || "")}
                onClick={() => isMobile && setSidebarOpen(false)}
                title={!sidebarOpen && !isMobile ? item.name : ""}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                } ${!sidebarOpen && !isMobile ? "justify-center" : ""}`}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                {(sidebarOpen || isMobile) && (
                  <>
                    <span className="truncate">{item.name}</span>
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
                    {item.name === "Cart" && cartItemCount > 0 && (
                      <span className="ml-auto bg-indigo-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                        {cartItemCount}
                      </span>
                    )}
                  </>
                )}
                {!sidebarOpen && !isMobile && (
                  (item.name === "Notifications" && unreadCount > 0) || 
                  (item.name === "Messages" && unreadMsgCount > 0) ||
                  (item.name === "Cart" && cartItemCount > 0)
                ) && (
                  <div className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className={`p-4 border-t border-slate-100 dark:border-slate-800 space-y-2 ${!sidebarOpen && !isMobile && "flex flex-col items-center"}`}>
          {currentUser?.role !== 'super_admin' && (
            <button
              onClick={() => {
                setShowCreate(true);
                if (isMobile) setSidebarOpen(false);
              }}
              className={`flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-indigo-200 dark:hover:shadow-indigo-900/40 transition-all ${!sidebarOpen && !isMobile && "aspect-square p-0"}`}
            >
              <Plus className="w-4 h-4" />
              {(sidebarOpen || isMobile) && <span>Create</span>}
            </button>
          )}
          <div className={`flex items-center gap-2 ${!sidebarOpen && !isMobile ? "flex-col" : "justify-center"}`}>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Toggle Theme"
            >
              {mounted && (theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />)}
            </button>
            <LanguagePicker compact={!sidebarOpen && !isMobile} />
          </div>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-600 dark:text-slate-400"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link to={createPageUrl(currentUser?.role === 'super_admin' ? "AdminDashboard" : "Home")} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">Vetora</span>
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-600 dark:text-slate-400"
            title="Toggle Theme"
          >
            {mounted && (theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />)}
          </button>
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
      <main className={`pt-14 lg:pt-0 pb-20 lg:pb-0 min-h-screen dark:text-slate-100 transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "lg:ml-20"}`}>
        <AnnouncementBanner />
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
                className="flex flex-col items-center gap-0.5 relative"
              >
                <item.icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
                  }`}
                />
                {item.name === "Cart" && cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center border border-white dark:border-slate-900">
                    {cartItemCount}
                  </span>
                )}
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