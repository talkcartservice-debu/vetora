import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio, Heart, Send, Eye,
  Video, Loader2, X, Pin, PinOff, ShoppingBag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { liveSessionsAPI, liveChatMessagesAPI, productsAPI, cartAPI, authAPI, storesAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";

const MessageCircleIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
  </svg>
);

const DEMO_SESSIONS = [
  {
    id: "live_1", host_name: "Sarah Chen", host_email: "sarah@urbanthreads.co",
    title: "Spring Drop 🌿 Exclusive First Look!", store_name: "Urban Threads",
    viewer_count: 1240, likes: 4890, thumbnail: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800",
    is_live: true, category: "fashion",
    pinned_products: [
      { id: "p1", title: "Oversized Vintage Hoodie", price: 89.99, image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400" },
      { id: "p2", title: "Canvas Sneakers", price: 64.99, image: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=400" }
    ]
  },
  {
    id: "live_2", host_name: "Mia Johnson", host_email: "mia@glowstudio.com",
    title: "Skincare Routine Reveal + Q&A ✨", store_name: "Glow Studio",
    viewer_count: 3400, likes: 12000, thumbnail: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800",
    is_live: true, category: "beauty",
    pinned_products: [
      { id: "p5", title: "Vitamin C Glow Serum", price: 38.99, image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400" },
    ]
  },
  {
    id: "live_3", host_name: "Alex Rivera", host_email: "alex@techvault.io",
    title: "Best Gadgets Under $200 – Live Review", store_name: "TechVault",
    viewer_count: 890, likes: 2340, thumbnail: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800",
    is_live: false, category: "electronics",
    pinned_products: [{ id: "p3", title: "Wireless Earbuds", price: 149.99, image: "https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=400" }]
  },
];

const DEMO_CHAT = [
  { id: 1, user_name: "Emma W.", content: "Omg this hoodie looks amazing!! 😍", message_type: "chat" },
  { id: 2, user_name: "Marcus T.", content: "What sizes are available?", message_type: "chat" },
  { id: 3, user_name: "Lily K.", content: "Adding to cart rn 🛒", message_type: "purchase" },
  { id: 4, user_name: "Jay P.", content: "Love the color!", message_type: "chat" },
  { id: 5, user_name: "Nia S.", content: "Is there a discount code?", message_type: "chat" },
];

function ChatMsg({ msg, isNew }) {
  const isBuy = msg.message_type === "purchase";
  const isJoin = msg.message_type === "join";
  return (
    <motion.div initial={isNew ? { opacity: 0, x: -10 } : { opacity: 1 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2 items-start">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${isBuy ? "bg-green-500" : isJoin ? "bg-blue-500" : "bg-gradient-to-br from-indigo-400 to-purple-500"}`}>
        {isBuy ? "🛒" : isJoin ? "👋" : msg.user_name?.[0]}
      </div>
      <div className={`backdrop-blur-sm rounded-xl px-3 py-1.5 max-w-[85%] ${isBuy ? "bg-green-500/30 border border-green-400/40" : isJoin ? "bg-blue-500/20" : "bg-black/30"}`}>
        <span className={`text-xs font-semibold mr-1.5 ${isBuy ? "text-green-300" : isJoin ? "text-blue-300" : "text-indigo-300"}`}>{msg.user_name}</span>
        <span className="text-white text-xs">{msg.content}</span>
      </div>
    </motion.div>
  );
}

function ProductPill({ product, onAdd, currentUser }) {
  const [added, setAdded] = useState(false);
  const queryClient = useQueryClient();
  const addMutation = useMutation({
    mutationFn: () => cartAPI.add({
      user_email: currentUser?.email,
      product_id: product.id,
      product_title: product.title,
      product_image: product.image,
      product_price: product.price,
      quantity: 1,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      setAdded(true);
      toast.success(`${product.title} added to cart!`);
      setTimeout(() => setAdded(false), 2500);
    },
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-2">
      <img src={product.image} alt={product.title} className="w-11 h-11 rounded-xl object-cover shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-semibold truncate">{product.title}</p>
        <p className="text-indigo-300 text-xs font-bold">${product.price}</p>
      </div>
      <button
        onClick={() => currentUser ? addMutation.mutate() : toast.error("Sign in to buy")}
        disabled={addMutation.isPending}
        className={`shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${added ? "bg-green-500 text-white" : "bg-white text-slate-900 hover:bg-indigo-50"}`}
      >
        {addMutation.isPending ? "..." : added ? "✓ Added" : "Buy Now"}
      </button>
    </motion.div>
  );
}

// ========== VIEWER ==========
function LiveStreamViewer({ session, onBack }) {
  const [chatMessages, setChatMessages] = useState(DEMO_CHAT);
  const [chatInput, setChatInput] = useState("");
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(session.likes || 0);
  const [floatingHearts, setFloatingHearts] = useState([]);
  const [viewerCount, setViewerCount] = useState(session.viewer_count || 0);
  const chatEndRef = useRef(null);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Live chat subscription
  const { data: liveChatMsgs = [] } = useQuery({
    queryKey: ["liveChat", session.id],
    queryFn: async () => {
      const res = await liveChatMessagesAPI.list(session.id, { sort: "created_date", limit: 50 });
      return res.data || [];
    },
    refetchInterval: 2000,
    enabled: !!session.id && !session.id.startsWith("live_"),
  });

  // Simulate live chat activity for demo sessions
  useEffect(() => {
    if (!session.id.startsWith("live_")) return;
    const bots = ["Alex M.", "Chloe R.", "Dante V.", "Fiona K.", "George T.", "Hannah L."];
    const msgs = ["🔥 This is fire!", "Just bought it!", "Love this!", "Can you show it again?", "Shipping to Canada?", "Adding to wishlist 💜", "What's the discount code?", "👏👏👏"];
    const types = ["chat", "chat", "chat", "purchase", "chat", "chat"];
    const interval = setInterval(() => {
      const t = types[Math.floor(Math.random() * types.length)];
      const user = bots[Math.floor(Math.random() * bots.length)];
      setChatMessages(prev => [...prev.slice(-25), {
        id: Date.now(), user_name: user,
        content: t === "purchase" ? `just purchased ${session.pinned_products?.[0]?.title || "an item"}! 🛒` : msgs[Math.floor(Math.random() * msgs.length)],
        message_type: t, isNew: true,
      }]);
      setViewerCount(v => v + Math.floor(Math.random() * 3 - 1));
    }, 2500);
    return () => clearInterval(interval);
  }, [session.id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, liveChatMsgs]);

  const sendChatMutation = useMutation({
    mutationFn: () => liveChatMessagesAPI.create({
      session_id: session.id,
      user_email: currentUser?.email || "guest",
      user_name: currentUser?.full_name || "Guest",
      content: chatInput,
      message_type: "chat",
    }),
    onSuccess: () => { setChatInput(""); queryClient.invalidateQueries({ queryKey: ["liveChat"] }); },
  });

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    if (!session.id.startsWith("live_")) {
      sendChatMutation.mutate();
    } else {
      setChatMessages(prev => [...prev, { id: Date.now(), user_name: currentUser?.full_name?.split(" ")[0] || "You", content: chatInput, message_type: "chat", isNew: true }]);
      setChatInput("");
    }
  };

  const handleLike = () => {
    setLiked(true);
    setLikeCount(v => v + 1);
    const heart = { id: Date.now(), x: Math.random() * 60 + 20 };
    setFloatingHearts(prev => [...prev, heart]);
    setTimeout(() => setFloatingHearts(prev => prev.filter(h => h.id !== heart.id)), 2000);
  };

  const allChat = session.id.startsWith("live_") ? chatMessages : [...DEMO_CHAT, ...liveChatMsgs.map(m => ({ ...m, user_name: m.user_name || m.user_email }))];

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col lg:flex-row">
      {/* Video Area */}
      <div className="relative flex-1 bg-slate-900 min-h-0">
        <img src={session.thumbnail} alt="" className="w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />

        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
          <button onClick={onBack} className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2">
            {session.is_live && (
              <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white" /> LIVE
              </span>
            )}
            <span className="flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">
              <Eye className="w-3 h-3" /> {Math.max(0, viewerCount).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Host info */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
              {session.host_name?.[0]}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{session.host_name}</p>
              <p className="text-white/70 text-xs">{session.store_name}</p>
            </div>
            <button className="ml-auto px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-full transition-colors">Follow</button>
          </div>
          <p className="text-white font-semibold text-sm mb-3 leading-tight">{session.title}</p>

          {/* Pinned Products — Buy Now overlay */}
          <div className="space-y-2">
            {(session.pinned_products || []).map(product => (
              <ProductPill key={product.id} product={product} currentUser={currentUser} />
            ))}
          </div>
        </div>

        {/* Like Button */}
        <button onClick={handleLike} className="absolute right-4 bottom-60 lg:bottom-40 w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-0.5">
          <Heart className={`w-6 h-6 transition-all ${liked ? "fill-red-500 text-red-500 scale-110" : "text-white"}`} />
          <span className="text-white text-[9px]">{likeCount.toLocaleString()}</span>
        </button>

        <AnimatePresence>
          {floatingHearts.map(heart => (
            <motion.div key={heart.id} initial={{ opacity: 1, y: 0, scale: 1 }} animate={{ opacity: 0, y: -140, scale: 1.5 }} exit={{ opacity: 0 }} transition={{ duration: 1.8 }} className="absolute bottom-60 pointer-events-none" style={{ right: `${heart.x}px` }}>
              <Heart className="w-8 h-8 fill-red-500 text-red-500" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Chat Panel */}
      <div className="w-full lg:w-80 bg-slate-900/95 backdrop-blur-xl flex flex-col border-l border-white/10" style={{ maxHeight: "45vh", minHeight: "200px" }}>
        <div className="p-3 border-b border-white/10 flex items-center gap-2 shrink-0">
          <MessageCircleIcon className="w-4 h-4 text-slate-400" />
          <span className="text-white text-sm font-semibold">Live Chat</span>
          <span className="ml-auto text-slate-400 text-xs">{allChat.length} messages</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {allChat.map((msg, i) => <ChatMsg key={msg.id || i} msg={msg} isNew={msg.isNew} />)}
          <div ref={chatEndRef} />
        </div>
        <div className="p-3 border-t border-white/10 flex gap-2 shrink-0">
          <Input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Say something..."
            className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 text-sm rounded-xl h-9"
          />
          <button onClick={sendMessage} className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center shrink-0 transition-colors">
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== VENDOR BROADCASTER ==========
function VendorBroadcast({ onClose, currentUser, store }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("fashion");
  const [isLive, setIsLive] = useState(false);
  const [session, setSession] = useState(null);
  const [pinnedProducts, setPinnedProducts] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const videoRef = useRef(null);
  const chatEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: myProducts = [] } = useQuery({
    queryKey: ["myProducts", store?.id],
    queryFn: async () => {
      const res = await productsAPI.list({ store_id: store?.id, sort: "-sales_count", limit: 30 });
      return res.data || [];
    },
    enabled: !!store?.id,
  });

  const { data: liveChat = [] } = useQuery({
    queryKey: ["liveChat", session?.id],
    queryFn: async () => {
      const res = await liveChatMessagesAPI.list(session.id, { sort: "created_date", limit: 60 });
      return res.data || [];
    },
    enabled: !!session?.id,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!isLive) return;
    // Simulate viewer count growth
    const iv = setInterval(() => {
      setViewerCount(v => v + Math.floor(Math.random() * 4));
      setLikeCount(v => v + Math.floor(Math.random() * 6));
    }, 4000);
    return () => clearInterval(iv);
  }, [isLive]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [liveChat]);

  const startLiveMutation = useMutation({
    mutationFn: async () => {
      const res = await liveSessionsAPI.create({
        host_email: currentUser.email,
        host_name: currentUser.full_name,
        store_id: store?.id,
        store_name: store?.name,
        title,
        category,
        is_live: true,
        viewer_count: 0,
        likes: 0,
        pinned_products: [],
        thumbnail: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=800",
      });
      return res.data || res;
    },
    onSuccess: (sess) => {
      setSession(sess);
      setIsLive(true);
      toast.success("You are live! 🔴");
      queryClient.invalidateQueries({ queryKey: ["liveSessions"] });
    },
  });

  const endLiveMutation = useMutation({
    mutationFn: () => liveSessionsAPI.update(session.id, { is_live: false, ended_at: new Date().toISOString(), viewer_count: viewerCount }),
    onSuccess: () => {
      setIsLive(false);
      toast.success("Stream ended");
      onClose();
      queryClient.invalidateQueries({ queryKey: ["liveSessions"] });
    },
  });

  const pinProductMutation = useMutation({
    mutationFn: async (product) => {
      const newPinned = [...pinnedProducts, { id: product.id, title: product.title, price: product.price, image: product.images?.[0] }];
      setPinnedProducts(newPinned);
      if (session) await liveSessionsAPI.update(session.id, { pinned_products: newPinned });
    },
  });

  const unpinProduct = async (productId) => {
    const newPinned = pinnedProducts.filter(p => p.id !== productId);
    setPinnedProducts(newPinned);
    if (session) await liveSessionsAPI.update(session.id, { pinned_products: newPinned });
  };

  const sendHostMessage = useMutation({
    mutationFn: () => liveChatMessagesAPI.create({
      session_id: session.id,
      user_email: currentUser.email,
      user_name: `${currentUser.full_name} (host)`,
      content: chatInput,
      message_type: "chat",
    }),
    onSuccess: () => { setChatInput(""); queryClient.invalidateQueries({ queryKey: ["liveChat"] }); },
  });

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col lg:flex-row">
      {/* Preview area */}
      <div className="relative flex-1 bg-slate-900 flex items-center justify-center min-h-0">
        <div className="w-full h-full bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 flex items-center justify-center relative">
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold mx-auto mb-4">
              {currentUser?.full_name?.[0]}
            </div>
            <p className="text-white font-bold text-lg">{currentUser?.full_name}</p>
            <p className="text-white/60 text-sm">{store?.name}</p>
            {isLive && (
              <div className="mt-3 flex items-center justify-center gap-3 text-white/80 text-sm">
                <span className="flex items-center gap-1"><Eye className="w-4 h-4" />{viewerCount}</span>
                <span className="flex items-center gap-1"><Heart className="w-4 h-4 text-red-400" />{likeCount}</span>
              </div>
            )}
          </div>

          {/* Top Controls */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center gap-2">
              {isLive && (
                <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                </span>
              )}
            </div>
            {isLive && (
              <Button onClick={() => endLiveMutation.mutate()} variant="destructive" size="sm" className="rounded-xl text-xs">
                End Stream
              </Button>
            )}
          </div>

          {/* Pinned products overlay */}
          {pinnedProducts.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4 space-y-2">
              {pinnedProducts.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-2">
                  <img src={p.image} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold truncate">{p.title}</p>
                    <p className="text-indigo-300 text-xs font-bold">${p.price}</p>
                  </div>
                  <span className="text-xs bg-white text-slate-900 font-bold px-2 py-1 rounded-lg">Buy Now</span>
                  <button onClick={() => unpinProduct(p.id)} className="shrink-0 w-6 h-6 bg-red-500/80 rounded-lg flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Control Panel */}
      <div className="w-full lg:w-80 bg-slate-900 border-l border-white/10 flex flex-col overflow-hidden" style={{ maxHeight: "100vh" }}>
        {!isLive ? (
          <div className="p-5 flex flex-col gap-4">
            <h2 className="text-white font-bold text-lg">Start a Live Stream</h2>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Stream Title</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What are you showing today?" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 rounded-xl" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-white/10 border-white/20 text-white rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["fashion","electronics","home","beauty","sports","food","art","other"].map(c => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => startLiveMutation.mutate()}
              disabled={!title.trim() || startLiveMutation.isPending}
              className="bg-red-500 hover:bg-red-600 w-full rounded-xl h-12 text-base font-bold"
            >
              {startLiveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Radio className="w-5 h-5 mr-2" />}
              Go Live Now
            </Button>
          </div>
        ) : (
          <>
            {/* Pin Products */}
            <div className="p-3 border-b border-white/10 shrink-0">
              <p className="text-white text-xs font-semibold mb-2 flex items-center gap-1.5"><Pin className="w-3.5 h-3.5" /> Pin Products to Stream</p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {myProducts.slice(0, 10).map(p => {
                  const isPinned = pinnedProducts.some(pp => pp.id === p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-700 shrink-0">
                        {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <p className="text-xs text-white flex-1 truncate">{p.title}</p>
                      <p className="text-xs text-indigo-300 font-bold shrink-0">${p.price}</p>
                      <button
                        onClick={() => isPinned ? unpinProduct(p.id) : pinProductMutation.mutate(p)}
                        className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${isPinned ? "bg-red-500/80 hover:bg-red-500" : "bg-indigo-600 hover:bg-indigo-500"}`}
                      >
                        {isPinned ? <PinOff className="w-3 h-3 text-white" /> : <Pin className="w-3 h-3 text-white" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Chat */}
            <div className="p-2.5 border-b border-white/10 shrink-0">
              <p className="text-slate-400 text-xs font-semibold mb-1.5 flex items-center gap-1">
                <MessageCircleIcon className="w-3.5 h-3.5" /> Live Chat
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 min-h-0">
              {liveChat.map((msg, i) => (
                <div key={i} className="text-xs">
                  <span className="text-indigo-300 font-semibold">{msg.user_name}: </span>
                  <span className="text-white/80">{msg.content}</span>
                </div>
              ))}
              {liveChat.length === 0 && <p className="text-slate-500 text-xs text-center py-4">Waiting for viewers...</p>}
              <div ref={chatEndRef} />
            </div>
            <div className="p-2.5 border-t border-white/10 flex gap-2 shrink-0">
              <Input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && chatInput.trim() && sendHostMessage.mutate()}
                placeholder="Reply to viewers..."
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 text-xs rounded-xl h-8"
              />
              <button onClick={() => chatInput.trim() && sendHostMessage.mutate()} className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center shrink-0">
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ========== MAIN PAGE ==========
export default function Live() {
  const [activeSession, setActiveSession] = useState(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [filter, setFilter] = useState("all");

  const { data: currentUser } = useQuery({ queryKey: ["currentUser"], queryFn: async () => {
    const res = await authAPI.me();
    return res.data || res;
  }, retry: false });
  const { data: store } = useQuery({
    queryKey: ["myStore", currentUser?.email],
    queryFn: async () => { 
      try {
        const res = await storesAPI.getByOwner(currentUser.email);
        return res.data || res;
      } catch (e) {
        return null;
      }
    },
    enabled: !!currentUser?.email,
  });

  const { data: dbSessionsResponse = {} } = useQuery({
    queryKey: ["liveSessions"],
    queryFn: async () => {
      const res = await liveSessionsAPI.list({ status: 'active', sort: "-started_at", limit: 20 });
      return res;
    },
    refetchInterval: 15000,
  });
  
  const dbSessions = Array.isArray(dbSessionsResponse?.sessions) ? dbSessionsResponse.sessions : [];

  // Merge DB sessions with demo fallback
  const allSessions = dbSessions.length > 0 ? dbSessions.map(s => ({ ...s, pinned_products: s.pinned_products || [] })) : DEMO_SESSIONS;
  const categories = ["all", "fashion", "beauty", "electronics", "home", "food"];
  const filtered = filter === "all" ? allSessions : allSessions.filter(s => s.category === filter);
  const liveSessions = filtered.filter(s => s.is_live !== false);
  const upcomingSessions = DEMO_SESSIONS.filter(s => !s.is_live && (filter === "all" || s.category === filter));

  if (activeSession) return <LiveStreamViewer session={activeSession} onBack={() => setActiveSession(null)} />;
  if (showBroadcast) return <VendorBroadcast onClose={() => setShowBroadcast(false)} currentUser={currentUser} store={store} />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-red-500 flex items-center justify-center"><Radio className="w-4 h-4 text-white" /></span>
            Live Shopping
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Watch, chat & shop in real-time</p>
        </div>
        {currentUser && (
          <Button onClick={() => setShowBroadcast(true)} className="bg-red-500 hover:bg-red-600 rounded-xl gap-1.5 text-sm">
            <Video className="w-4 h-4" /> Go Live
          </Button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 hide-scrollbar">
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === cat ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"}`}>
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {liveSessions.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live Now
          </h2>
          <div className="space-y-4">
            {liveSessions.map(session => (
              <motion.button key={session.id} whileHover={{ scale: 1.01 }} onClick={() => setActiveSession(session)} className="w-full text-left">
                <div className="relative rounded-2xl overflow-hidden group">
                  <img src={session.thumbnail} alt={session.title} className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                    </span>
                    <span className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                      <Eye className="w-3 h-3" />{(session.viewer_count || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white">
                        {session.host_name?.[0]}
                      </div>
                      <span className="text-white text-xs font-medium">{session.host_name}</span>
                      <span className="text-white/60 text-xs">· {session.store_name}</span>
                    </div>
                    <p className="text-white font-semibold text-sm leading-tight">{session.title}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-white/70 text-xs"><Heart className="w-3 h-3" />{(session.likes || 0).toLocaleString()}</span>
                      <span className="flex items-center gap-1 text-white/70 text-xs"><ShoppingBag className="w-3 h-3" />{(session.pinned_products || []).length} products</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {upcomingSessions.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-3">Upcoming</h2>
          <div className="space-y-3">
            {upcomingSessions.map(session => (
              <div key={session.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex gap-3">
                <img src={session.thumbnail} alt="" className="w-20 h-16 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 font-semibold text-sm line-clamp-1">{session.title}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{session.host_name} · {session.store_name}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-[10px]">{session.category}</Badge>
                    <span className="text-xs text-slate-400">{(session.pinned_products || session.products || []).length} products</span>
                  </div>
                </div>
                <button className="shrink-0 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-xl hover:bg-indigo-100 self-center transition-colors">Remind</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}