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
import { liveSessionsAPI, liveChatMessagesAPI, productsAPI, cartAPI, authAPI, storesAPI, followsAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";

const MessageCircleIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
  </svg>
);

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

function ProductPill({ product, currentUser }) {
  const [added, setAdded] = useState(false);
  const queryClient = useQueryClient();
  const addMutation = useMutation({
    mutationFn: () => cartAPI.add({
      product_id: product.id,
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
function LiveStreamViewer({ session: initialSession, onBack }) {
  const [chatInput, setChatInput] = useState("");
  const [liked, setLiked] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState([]);
  const chatEndRef = useRef(null);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Real-time session data
  const { data: session = initialSession } = useQuery({
    queryKey: ["liveSession", initialSession?.id],
    queryFn: async () => {
      const res = await liveSessionsAPI.get(initialSession.id);
      return res.data || res;
    },
    initialData: initialSession,
    enabled: !!initialSession?.id,
    refetchInterval: 5000,
  });

  const [viewerCount, setViewerCount] = useState(session.viewer_count || 0);
  const [likeCount, setLikeCount] = useState(session.likes || 0);

  // Sync state with polled data and handle end of session
  useEffect(() => {
    if (session) {
      setViewerCount(session.viewer_count || 0);
      setLikeCount(session.likes || 0);
      
      if (session.status === 'ended' || session.status === 'completed') {
        toast.info("This live stream has ended.");
        onBack();
      }
    }
  }, [session, session.viewer_count, session.likes]);

  // Follow Status
  const { data: followStatus } = useQuery({
    queryKey: ["followStatus", session.host_username],
    queryFn: async () => {
      if (!currentUser?.username || !session.host_username) return null;
      try {
        const res = await followsAPI.check({ 
          follower_username: currentUser.username, 
          following_username: session.host_username 
        });
        return res.is_following;
      } catch (e) {
        return false;
      }
    },
    enabled: !!currentUser?.username && !!session.host_username,
  });

  const followMutation = useMutation({
    mutationFn: () => {
      if (!currentUser?.username) throw new Error("Not authenticated");
      return followsAPI.follow(session.host_username);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followStatus", session.host_username] });
      toast.success(`Following ${session.host_name}`);
    }
  });

  const unfollowMutation = useMutation({
    mutationFn: () => {
      if (!currentUser?.username) throw new Error("Not authenticated");
      return followsAPI.unfollow({ 
        follower_username: currentUser.username, 
        following_username: session.host_username 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followStatus", session.host_username] });
      toast.info(`Unfollowed ${session.host_name}`);
    }
  });

  // Live chat subscription
  const { data: liveChatResponse = {} } = useQuery({
    queryKey: ["liveChat", session.id],
    queryFn: async () => {
      const res = await liveChatMessagesAPI.list(session.id, { sort: "created_date", limit: 50 });
      return res;
    },
    refetchInterval: 2000,
    enabled: !!session.id,
  });

  const liveChatMsgs = Array.isArray(liveChatResponse?.messages) ? liveChatResponse.messages : [];

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [liveChatMsgs]);

  const sendChatMutation = useMutation({
    mutationFn: () => liveChatMessagesAPI.send({
      session_id: session?.id,
      user_username: currentUser?.username || "guest",
      user_name: currentUser?.display_name || currentUser?.username || "Guest",
      content: chatInput,
      message_type: "chat",
    }),
    onSuccess: () => { 
      setChatInput(""); 
      queryClient.invalidateQueries({ queryKey: ["liveChat", session?.id] }); 
    },
  });

  const likeMutation = useMutation({
    mutationFn: () => liveSessionsAPI.like(session?.id),
    onSuccess: (data) => {
      if (data?.likes !== undefined) setLikeCount(data.likes);
    },
    onError: () => {
      setLiked(false);
      toast.error("Failed to like — please try again");
    }
  });

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    if (session?.id) {
      sendChatMutation.mutate();
    }
  };

  const handleLike = () => {
    if (liked) return;
    setLiked(true);
    const heart = { id: Date.now(), x: Math.random() * 60 + 20 };
    setFloatingHearts(prev => [...prev, heart]);
    
    if (session?.id) {
      likeMutation.mutate();
    }
    
    setTimeout(() => setFloatingHearts(prev => prev.filter(h => h.id !== heart.id)), 2000);
  };

  const allChat = liveChatMsgs.map(m => ({ ...m, user_name: m.user_name || m.user_username }));

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col lg:flex-row">
      {/* Video Area */}
      <div className="relative flex-1 bg-black min-h-0 overflow-hidden">
        <img src={session.thumbnail} alt="" className="w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />

        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10">
          <button onClick={onBack} className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-black/80 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2">
            {session.is_live && (
              <span className="flex items-center gap-1.5 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-full animate-pulse tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-white" /> LIVE
              </span>
            )}
            <span className="flex items-center gap-1 bg-black/60 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-full border border-white/10">
              <Eye className="w-3 h-3" /> {Math.max(0, viewerCount).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Host info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 lg:pb-6 z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shrink-0 ring-2 ring-white/20">
              {session.host_name?.[0]}
            </div>
            <div>
              <p className="text-white font-semibold text-sm drop-shadow-md">{session.host_name}</p>
              <p className="text-white/70 text-xs drop-shadow-md">{session.store_name}</p>
            </div>
            {currentUser?.username !== session.host_username && (
              <button 
                onClick={() => {
                  if (!currentUser) return toast.error("Sign in to follow");
                  if (followStatus) unfollowMutation.mutate();
                  else followMutation.mutate();
                }}
                disabled={followMutation.isPending || unfollowMutation.isPending}
                className={`ml-auto px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  followStatus 
                    ? "bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm" 
                    : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20"
                }`}
              >
                {followMutation.isPending || unfollowMutation.isPending 
                  ? "..." 
                  : followStatus ? "Following" : "Follow"}
              </button>
            )}
          </div>
          <p className="text-white font-semibold text-base mb-4 leading-tight drop-shadow-lg">{session.title}</p>

          {/* Pinned Products — Buy Now overlay */}
          <div className="space-y-2 max-w-sm">
            {(session.pinned_products || []).map(product => (
              <ProductPill key={product.id} product={product} currentUser={currentUser} />
            ))}
          </div>
        </div>

        {/* Right Actions */}
        <div className="absolute right-4 bottom-60 lg:bottom-40 flex flex-col gap-4 z-20">
          <button onClick={handleLike} className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center gap-0.5 hover:bg-black/60 transition-colors">
            <Heart className={`w-6 h-6 transition-all ${liked ? "fill-red-500 text-red-500 scale-110" : "text-white"}`} />
            <span className="text-white text-[9px] font-bold">{likeCount.toLocaleString()}</span>
          </button>
          
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Link copied to clipboard!");
            }}
            className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-colors"
          >
            <Send className="w-5 h-5 text-white -rotate-45" />
          </button>
        </div>

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
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
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

  const { data: liveChatResponse = {} } = useQuery({
    queryKey: ["liveChat", session?.id],
    queryFn: async () => {
      const res = await liveChatMessagesAPI.list(session.id, { sort: "created_date", limit: 60 });
      return res;
    },
    enabled: !!session?.id,
    refetchInterval: 3000,
  });

  const liveChat = Array.isArray(liveChatResponse?.messages) ? liveChatResponse.messages : [];

  // Poll session for real-time likes/status updates
  const { data: polledSession } = useQuery({
    queryKey: ["liveSession", session?.id],
    queryFn: async () => {
      const res = await liveSessionsAPI.get(session.id);
      return res.data || res;
    },
    enabled: !!session?.id && isLive,
    refetchInterval: 5000,
  });

  // Sync likes from server
  useEffect(() => {
    if (polledSession?.likes !== undefined) {
      setLikeCount(polledSession.likes);
    }
  }, [polledSession?.likes]);

  // Periodic viewer count update for real sessions
  useEffect(() => {
    if (!session?.id || session.id.startsWith("live_") || !isLive) return;
    
    const interval = setInterval(() => {
      // Host is the authority on viewer count in this simulation
      liveSessionsAPI.updateViewers(session.id, viewerCount);
    }, 10000); // Every 10 seconds
    
    return () => clearInterval(interval);
  }, [session?.id, isLive, viewerCount]);

  useEffect(() => {
    if (!isLive) return;
    // Simulate viewer count growth
    const iv = setInterval(() => {
      setViewerCount(v => v + Math.floor(Math.random() * 4));
    }, 4000);
    return () => clearInterval(iv);
  }, [isLive]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [liveChat]);

  const startLiveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        host_email: currentUser.email,
        host_username: currentUser.username,
        host_name: currentUser.display_name || currentUser.username,
        store_id: store?.id,
        store_name: store?.name,
        title,
        category,
        is_live: !isScheduled,
        status: isScheduled ? 'scheduled' : 'active',
        viewer_count: 0,
        likes: 0,
        pinned_products: [],
        thumbnail: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=800",
      };

      if (isScheduled && scheduledDate) {
        payload.scheduled_at = new Date(scheduledDate).toISOString();
      }

      const res = await liveSessionsAPI.create(payload);
      const sess = res.data || res;
      
      // Only start immediately if not scheduled
      if (sess.id && !isScheduled) {
        await liveSessionsAPI.start(sess.id);
      }
      return sess;
    },
    onSuccess: (sess) => {
      if (isScheduled) {
        toast.success("Stream scheduled successfully!");
        onClose();
      } else {
        setSession(sess);
        setIsLive(true);
        toast.success("You are live! 🔴");
      }
      queryClient.invalidateQueries({ queryKey: ["liveSessions"] });
    },
    onError: () => {
      toast.error("Failed to create live session — please try again");
    }
  });

  const endLiveMutation = useMutation({
    mutationFn: () => liveSessionsAPI.end(session.id),
    onSuccess: () => {
      setIsLive(false);
      toast.success("Stream ended");
      onClose();
      queryClient.invalidateQueries({ queryKey: ["liveSessions"] });
    },
    onError: () => {
      toast.error("Failed to end stream — please try again");
    }
  });

  const pinProductMutation = useMutation({
    mutationFn: async (product) => {
      const newPinned = [...pinnedProducts, { id: product.id, title: product.title, price: product.price, image: product.images?.[0] }];
      if (session) await liveSessionsAPI.update(session.id, { pinned_products: newPinned });
      return newPinned;
    },
    onSuccess: (newPinned) => {
      setPinnedProducts(newPinned);
      toast.success("Product pinned!");
    },
    onError: () => {
      toast.error("Failed to pin product");
    }
  });

  const unpinProduct = async (productId) => {
    const newPinned = pinnedProducts.filter(p => p.id !== productId);
    try {
      if (session) await liveSessionsAPI.update(session.id, { pinned_products: newPinned });
      setPinnedProducts(newPinned);
    } catch (e) {
      toast.error("Failed to unpin product");
    }
  };

  const sendHostMessage = useMutation({
    mutationFn: () => liveChatMessagesAPI.send({
      session_id: session.id,
      user_email: currentUser.email,
      user_name: `${currentUser.full_name} (host)`,
      content: chatInput,
      message_type: "chat",
    }),
    onSuccess: () => { 
      setChatInput(""); 
      queryClient.invalidateQueries({ queryKey: ["liveChat", session?.id] }); 
    },
  });

  useEffect(() => {
    if (isLive && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error("Error accessing camera:", err);
          toast.error("Could not access camera for streaming");
        });
    }
    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [isLive]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col lg:flex-row">
      {/* Preview area */}
      <div className="relative flex-1 bg-slate-900 flex items-center justify-center min-h-0">
        <div className="w-full h-full bg-black flex items-center justify-center relative overflow-hidden">
          {isLive ? (
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold mx-auto mb-4">
                  {currentUser?.full_name?.[0]}
                </div>
                <p className="text-white font-bold text-lg">{currentUser?.full_name}</p>
                <p className="text-white/60 text-sm">{store?.name}</p>
              </div>
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

          {isLive && (
            <div className="absolute bottom-24 left-4 z-10 text-white">
               <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0 ring-2 ring-white/20">
                  {currentUser?.full_name?.[0]}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm drop-shadow-md">{currentUser?.full_name}</p>
                  <p className="text-white/70 text-xs drop-shadow-md">{store?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-white/90 text-xs font-bold drop-shadow-md">
                <span className="flex items-center gap-1"><Eye className="w-4 h-4" />{viewerCount}</span>
                <span className="flex items-center gap-1"><Heart className="w-4 h-4 text-red-400" />{likeCount}</span>
              </div>
            </div>
          )}

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

            <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-white text-xs font-semibold">Schedule for later</label>
                <input 
                  type="checkbox" 
                  checked={isScheduled} 
                  onChange={e => setIsScheduled(e.target.checked)}
                  className="w-4 h-4 rounded bg-indigo-600"
                />
              </div>
              {isScheduled && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-slate-400 text-[10px] mb-1 block uppercase font-bold tracking-wider">Date & Time</label>
                  <Input 
                    type="datetime-local" 
                    value={scheduledDate} 
                    onChange={e => setScheduledDate(e.target.value)} 
                    className="bg-white/10 border-white/20 text-white text-xs rounded-xl h-9"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              )}
            </div>

            <Button
              onClick={() => startLiveMutation.mutate()}
              disabled={!title.trim() || (isScheduled && !scheduledDate) || startLiveMutation.isPending}
              className={`${isScheduled ? "bg-indigo-600 hover:bg-indigo-700" : "bg-red-500 hover:bg-red-600"} w-full rounded-xl h-12 text-base font-bold transition-all shadow-lg`}
            >
              {startLiveMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : isScheduled ? (
                <Radio className="w-5 h-5 mr-2" />
              ) : (
                <Radio className="w-5 h-5 mr-2" />
              )}
              {isScheduled ? "Schedule Stream" : "Go Live Now"}
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
                <ChatMsg key={msg.id || i} msg={msg} />
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

  const { data: activeSessionsRes = {} } = useQuery({
    queryKey: ["liveSessions", "active"],
    queryFn: async () => {
      const res = await liveSessionsAPI.list({ status: 'active', sort: "-started_at", limit: 20 });
      return res;
    },
    refetchInterval: 15000,
  });

  const { data: upcomingSessionsRes = {} } = useQuery({
    queryKey: ["liveSessions", "scheduled"],
    queryFn: async () => {
      const res = await liveSessionsAPI.list({ status: 'scheduled', sort: "scheduled_at", limit: 10 });
      return res;
    },
    refetchInterval: 30000,
  });
  
  const liveSessionsRaw = Array.isArray(activeSessionsRes?.sessions) ? activeSessionsRes.sessions : [];
  const upcomingSessionsRaw = Array.isArray(upcomingSessionsRes?.sessions) ? upcomingSessionsRes.sessions : [];

  const categories = ["all", "fashion", "beauty", "electronics", "home", "food"];
  
  const liveSessions = filter === "all" 
    ? liveSessionsRaw 
    : liveSessionsRaw.filter(s => s.category === filter);
    
  const upcomingSessions = filter === "all" 
    ? upcomingSessionsRaw 
    : upcomingSessionsRaw.filter(s => s.category === filter);

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

      {liveSessions.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live Now
          </h2>
          <div className="space-y-4">
            {liveSessions.map(session => (
              <motion.button key={session.id} whileHover={{ scale: 1.01 }} onClick={() => setActiveSession(session)} className="w-full text-left">
                <div className="relative rounded-2xl overflow-hidden group shadow-md hover:shadow-xl transition-shadow">
                  <img src={session.thumbnail} alt={session.title} className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="flex items-center gap-1.5 bg-red-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                    </span>
                    <span className="flex items-center gap-1 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm">
                      <Eye className="w-3 h-3" />{(session.viewer_count || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-white">
                        {session.host_name?.[0]}
                      </div>
                      <span className="text-white text-xs font-medium">{session.host_name}</span>
                      <span className="text-white/60 text-xs">· {session.store_name}</span>
                    </div>
                    <p className="text-white font-semibold text-sm leading-tight">{session.title}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-white/70 text-[10px] font-medium"><Heart className="w-3 h-3" />{(session.likes || 0).toLocaleString()}</span>
                      <span className="flex items-center gap-1 text-white/70 text-[10px] font-medium"><ShoppingBag className="w-3 h-3" />{(session.pinned_products || []).length} products</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      ) : (
        <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 mb-8">
          <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
            <Radio className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 font-medium">No live sessions in this category</p>
          <p className="text-slate-400 text-xs mt-1">Check back later or explore other categories</p>
        </div>
      )}

      {upcomingSessions.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-3">Upcoming Streams</h2>
          <div className="space-y-3">
            {upcomingSessions.map(session => (
              <div key={session.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex gap-3 shadow-sm">
                <div className="relative w-24 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                  <img src={session.thumbnail} alt="" className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1">
                    <Badge className="bg-black/60 backdrop-blur-md border-none text-[8px] px-1.5 py-0">
                      {session.category}
                    </Badge>
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-slate-900 font-bold text-sm line-clamp-1 leading-tight">{session.title}</p>
                  <p className="text-slate-500 text-[11px] mt-1 font-medium">{session.host_name} · {session.store_name}</p>
                  
                  <div className="flex items-center gap-2.5 mt-2">
                    <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Radio className="w-2.5 h-2.5" />
                      {session.scheduled_at ? new Date(session.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Soon'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{(session.pinned_products || []).length} products</span>
                  </div>
                </div>
                <button 
                  onClick={() => toast.success(`Reminder set for ${session.title}!`)}
                  className="shrink-0 w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 flex items-center justify-center transition-colors self-center"
                >
                  <Heart className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}