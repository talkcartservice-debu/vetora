import { formatCurrency } from "@/lib/utils";
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Send, ArrowLeft, MoreVertical, X, Phone, Video,
  ShoppingBag, Star, Package, Loader2, Reply, Smile, PenSquare, CheckCheck
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import MessageBubble from "@/components/chat/MessageBubble";
import ChatImageUpload from "@/components/chat/ChatImageUpload";
import { authAPI, productsAPI, messagesAPI, ordersAPI, usersAPI } from "@/api/apiClient";
import { useSocket } from "@/lib/SocketContext";

const EMOJI_QUICK = ["❤️", "😂", "🔥", "👍", "😍", "💯", "🎉", "😎", "✨", "🙌", "🤔", "👏", "🚀", "💡", "✅", "❌"];

const EMOJI_PACK = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰",
  "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏",
  "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠",
  "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥",
  "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐",
  "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "💩", "👻",
  "💀", "☠️", "👽", "👾", "🤖", "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾",
  "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆",
  "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️",
  "💅", "🤳", "💪", "🦾", "🦵", "🦿", "🦶", "👣", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴",
  "👀", "👁️", "👅", "👄", "💋", "🩸"
];

function Avatar({ name, size = 10 }) {
  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm shrink-0`}>
      {name?.[0]?.toUpperCase() || "U"}
    </div>
  );
}

function ProductSharePicker({ onShare, onClose, currentUser }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all"); // "all" | "mine"

  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ["quickProducts"],
    queryFn: async () => {
      const res = await productsAPI.list({ status: "active", sort: "-sales_count", limit: 30 });
      return res.data || [];
    },
  });

  const { data: myProducts = [] } = useQuery({
    queryKey: ["myQuickProducts", currentUser?.username],
    queryFn: async () => {
      const res = await productsAPI.list({ vendor_username: currentUser.username, status: "active", sort: "-created_date", limit: 30 });
      return res.data || [];
    },
    enabled: !!currentUser?.username,
  });

  const source = tab === "mine" ? myProducts : allProducts;
  const products = search ? source.filter(p => p.title?.toLowerCase().includes(search.toLowerCase())) : source.slice(0, 18);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 z-20"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-slate-800">Share a Product</p>
        <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
      </div>
      <div className="flex gap-1 mb-2 p-1 bg-slate-100 rounded-xl">
        <button onClick={() => setTab("all")} className={`flex-1 text-xs py-1 rounded-lg font-medium transition-colors ${tab === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>All Products</button>
        <button onClick={() => setTab("mine")} className={`flex-1 text-xs py-1 rounded-lg font-medium transition-colors ${tab === "mine" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>My Store</button>
      </div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search..."
        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 mb-2 outline-none focus:border-indigo-300"
      />
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : products.length === 0 ? (
        <p className="text-center py-4 text-xs text-slate-400">No products found</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
          {products.map(p => (
            <button key={p.id} onClick={() => onShare(p)} className="text-left hover:bg-indigo-50 rounded-xl p-1.5 transition-colors border border-transparent hover:border-indigo-100">
              <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 mb-1">
                {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-300 m-auto mt-2" />}
              </div>
              <p className="text-[10px] text-slate-700 line-clamp-2 font-medium">{p.title}</p>
              <p className="text-[10px] font-bold text-indigo-600">{formatCurrency(p.price)}</p>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function OfferModal({ onSend, onClose }) {
  const [amount, setAmount] = useState("");
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 z-20"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-800">💰 Make an Offer</p>
        <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
      </div>
      <p className="text-xs text-slate-500 mb-2">Enter your price offer</p>
      <div className="flex gap-2">
        <Input type="number" placeholder="RWF 0" value={amount} onChange={e => setAmount(e.target.value)} className="rounded-xl" />
        <Button onClick={() => { onSend(parseFloat(amount)); onClose(); }} disabled={!amount} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl shrink-0">Send</Button>
      </div>
    </motion.div>
  );
}

export default function Chat() {
  const { t } = useTranslation();
  const params = new URLSearchParams(window.location.search);
  const toUsername = params.get("username") || params.get("to");
  const [selectedConvo, setSelectedConvo] = useState(toUsername || null);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [forwardToUsername, setForwardToUsername] = useState("");
  const [pendingImageUrl, setPendingImageUrl] = useState(null);
  const [composing, setComposing] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();
  const { on } = useSocket();

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => authAPI.me(),
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["unreadMessages", currentUser?.email],
    queryFn: () => messagesAPI.listConversations().then(res => res.data || res || []),
    enabled: !!currentUser?.email,
    refetchInterval: 5000,
  });

  const conversationId = useMemo(() => {
    if (!selectedConvo || !currentUser?.username) return null;
    const parts = [currentUser.username, selectedConvo].sort();
    return `chat_${parts[0]}_${parts[1]}`;
  }, [selectedConvo, currentUser?.username]);

  const { data: conversationMessages = [] } = useQuery({
    queryKey: ["conversationMessages", conversationId],
    queryFn: () => messagesAPI.list(conversationId),
    enabled: !!conversationId,
    refetchInterval: 2000,
  });

  const { data: userSearchResults = [] } = useQuery({
    queryKey: ["userSearch", userSearch],
    queryFn: () => usersAPI.search(userSearch),
    enabled: composing && userSearch.trim().length >= 2,
    staleTime: 10000,
  });

  const markAsRead = useCallback(async () => {
    if (!selectedConvo || !currentUser?.username) return;
    const parts = [currentUser.username, selectedConvo].sort();
    const cId = `chat_${parts[0]}_${parts[1]}`;
    try {
      await messagesAPI.markConversationAsRead(cId);
      queryClient.invalidateQueries({ queryKey: ["conversationMessages", cId] });
      queryClient.invalidateQueries({ queryKey: ["unreadMessages"] });
    } catch (error) {
      console.error("Failed to mark conversation as read:", error);
    }
  }, [selectedConvo, currentUser, queryClient]);

  useEffect(() => {
    const unsubscribe = on("new-message", (msg) => {
      queryClient.invalidateQueries({ queryKey: ["unreadMessages"] });
      queryClient.invalidateQueries({ queryKey: ["conversationMessages", conversationId] });
      if (selectedConvo && (msg.sender_username === selectedConvo || msg.receiver_username === selectedConvo)) {
        markAsRead();
      }
    });
    return unsubscribe;
  }, [on, queryClient, selectedConvo, markAsRead, conversationId]);

  // Real-time subscription replaced by refetchInterval

  const selectedMessages = useMemo(() => {
    const seen = new Set();
    return (Array.isArray(conversationMessages) ? conversationMessages : []).filter(m => {
      const id = m._id || m.id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [conversationMessages]);

  const sendMutation = useMutation({
    mutationFn: async (msgData) => {
      const recipient = msgData.recipient_username || selectedConvo;
      if (!recipient) {
        toast.error("No recipient selected");
        throw new Error("recipient_username is required");
      }
      if (!currentUser?.username) {
        toast.error("You must be logged in");
        throw new Error("sender_username is required");
      }
      
      await messagesAPI.send({
        conversation_id: `chat_${[currentUser.username, recipient].sort().join("_")}`,
        sender_username: currentUser.username,
        sender_name: currentUser.display_name || currentUser.full_name,
        recipient_username: recipient,
        ...msgData,
      });
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["conversationMessages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["unreadMessages"] });
    },
  });

  const sendText = () => {
    if (!newMessage.trim() || !selectedConvo) return;
    const extra = replyingTo ? {
      reply_to_content: replyingTo.content,
      reply_to_name: replyingTo.sender_username === currentUser?.username ? "You" : selectedConvoName,
    } : {};
    
    const baseMsg = { recipient_username: selectedConvo, ...extra };
    
    if (pendingImageUrl) {
      sendMutation.mutate({ ...baseMsg, content: newMessage || "📷 Image", message_type: "image", image_url: pendingImageUrl });
      setPendingImageUrl(null);
    } else {
      sendMutation.mutate({ ...baseMsg, content: newMessage, message_type: "text" });
    }
    setReplyingTo(null);
    setShowEmojiPicker(false);
  };

  const handleForward = (msg) => {
    setForwardMsg(msg);
  };

  const executeForward = async () => {
    if (!forwardToUsername.trim() || !forwardMsg || !currentUser?.username) return;
    try {
      await messagesAPI.send({
        conversation_id: `chat_${[currentUser.username, forwardToUsername].sort().join("_")}`,
        sender_username: currentUser.username,
        sender_name: currentUser.display_name || currentUser.full_name,
        recipient_username: forwardToUsername.trim(),
        content: `Forwarded: ${forwardMsg.content || ""}`,
        message_type: forwardMsg.message_type,
        product_id: forwardMsg.product_id,
        product_data: forwardMsg.product_data,
      });
      toast.success("Message forwarded!");
      setForwardMsg(null);
      setForwardToUsername("");
    } catch (error) {
      toast.error("Failed to forward message");
    }
  };

  const sendProduct = (product) => {
    if (!selectedConvo) return;
    setShowProductPicker(false);
    sendMutation.mutate({
      recipient_username: selectedConvo,
      content: `Check out this product: ${product.title}`,
      message_type: "product_share",
      product_id: product.id,
      product_data: { title: product.title, price: product.price, image: product.images?.[0] },
    });
  };

  const sendOffer = async (amount, productData) => {
    if (!selectedConvo || !currentUser?.username) return;
    // Create an order for this offer
    let orderId = null;
    try {
      if (productData) {
        const order = await ordersAPI.create({
          buyer_username: currentUser.username,
          buyer_name: currentUser.display_name || currentUser.full_name,
          vendor_username: selectedConvo,
          items: [{ product_id: productData.id, product_title: productData.title, product_image: productData.images?.[0], quantity: 1, price: amount }],
          subtotal: amount,
          total: amount,
          status: "pending",
          payment_status: "pending",
        });
        orderId = order.id;
      }
      sendMutation.mutate({
        recipient_username: selectedConvo,
        content: `💰 Offer: ${formatCurrency(amount)}${productData ? ` for "${productData.title}"` : ""}`,
        message_type: "offer",
        offer_amount: amount,
        order_id: orderId,
      });
    } catch (error) {
      toast.error("Failed to create offer");
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (selectedConvo) markAsRead();
  }, [selectedMessages, selectedConvo]);

  const selectedConvoData = conversations.find(c => c.other_user_username === selectedConvo);
  const selectedConvoName = selectedConvoData?.other_user_name || selectedConvo;
  const unreadTotal = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  return (
    <div className="h-[calc(100vh-3.5rem)] lg:h-screen flex bg-white">
      {/* Sidebar */}
      <div className={`w-full lg:w-80 border-r border-slate-100 flex flex-col ${selectedConvo ? "hidden lg:flex" : "flex"}`}>
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-slate-900">
              Messages
              {unreadTotal > 0 && (
                <span className="ml-2 text-xs bg-indigo-600 text-white rounded-full px-1.5 py-0.5">{unreadTotal}</span>
              )}
            </h1>
            <button
              onClick={() => { setComposing(v => !v); setUserSearch(""); }}
              className={`p-1.5 rounded-xl transition-colors ${composing ? "bg-indigo-100 text-indigo-600" : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"}`}
              title="New conversation"
            >
              <PenSquare className="w-4 h-4" />
            </button>
          </div>

          <AnimatePresence>
            {composing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-3"
              >
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    autoFocus
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Search by name or username..."
                    className="pl-8 h-9 rounded-xl text-sm bg-indigo-50 border-indigo-100 focus:border-indigo-300"
                  />
                </div>
                {userSearch.trim().length >= 2 && (
                  <div className="space-y-0.5">
                    {userSearchResults.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">No users found</p>
                    ) : userSearchResults.map(u => (
                      <button
                        key={u.username || u._id}
                        onClick={() => {
                          setSelectedConvo(u.username);
                          setComposing(false);
                          setUserSearch("");
                        }}
                        className="w-full flex items-center gap-2.5 px-2 py-2 hover:bg-indigo-50 rounded-xl transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                          {(u.display_name || u.username)?.[0]?.toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{u.display_name || u.username}</p>
                          <p className="text-xs text-slate-400">@{u.username}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {userSearch.trim().length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-1">Type at least 2 characters to search</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!composing && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t("chat.searchConversations")}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 rounded-xl text-sm"
              />
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Send className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">{t("chat.noConversations")}</p>
              <p className="text-xs text-slate-400 mt-1">{t("chat.startConversation")}</p>
            </div>
          ) : (
            conversations
              .filter(c => !search || c.other_user_name?.toLowerCase().includes(search.toLowerCase()) || c.other_user_username?.toLowerCase().includes(search.toLowerCase()))
              .map(convo => (
                <button
                  key={convo.other_user_username}
                  onClick={() => setSelectedConvo(convo.other_user_username)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 ${selectedConvo === convo.other_user_username ? "bg-indigo-50" : ""}`}
                >
                  <div className="relative shrink-0">
                    <Avatar name={convo.other_user_name} size={11} />
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className={`text-sm truncate ${convo.unread_count > 0 ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>{convo.other_user_name}</p>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                        {new Date(convo.last_message_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className={`text-xs truncate ${convo.unread_count > 0 ? "text-slate-700 font-medium" : "text-slate-400"}`}>
                      {convo.last_message_type === "product_share" ? "📦 Shared a product" : convo.last_message_type === "offer" ? "💰 Price offer" : convo.last_message_content}
                    </p>
                  </div>
                  {convo.unread_count > 0 && (
                    <div className="bg-indigo-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold">
                      {convo.unread_count > 9 ? "9+" : convo.unread_count}
                    </div>
                  )}
                </button>
              ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${!selectedConvo ? "hidden lg:flex" : "flex"}`}>
        {selectedConvo ? (
          <>
            {/* Header */}
            <div className="h-16 border-b border-slate-100 flex items-center justify-between px-4 bg-white shadow-sm">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedConvo(null)} className="lg:hidden p-1 rounded-lg hover:bg-slate-100">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="relative">
                  <Avatar name={selectedConvoName} size={9} />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{selectedConvoName}</p>
                  <p className="text-xs text-green-500 font-medium">Online</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors" title="Voice call">
                  <Phone className="w-4 h-4 text-slate-500" />
                </button>
                <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors" title="Video call">
                  <Video className="w-4 h-4 text-slate-500" />
                </button>
                <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors" onClick={() => setShowActionMenu(v => !v)}>
                  <MoreVertical className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/60">
              {selectedMessages.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Send className="w-5 h-5 text-slate-300" />
                  </div>
                  Start a conversation with {selectedConvoName}
                </div>
              )}
              {selectedMessages.map((msg, idx) => {
                const isMine = msg.sender_username === currentUser?.username;
                const prevMsg = selectedMessages[idx - 1];
                const showAvatar = !prevMsg || prevMsg.sender_username !== msg.sender_username;
                return (
                  <MessageBubble
                    key={msg._id || msg.id || `msg-${idx}`}
                    msg={msg}
                    isMine={isMine}
                    showAvatar={showAvatar}
                    senderName={isMine ? currentUser?.full_name : selectedConvoName}
                    currentUser={currentUser}
                    onReply={(m) => setReplyingTo(m)}
                    onForward={handleForward}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-slate-100 bg-white">
              {/* Reply preview */}
              <AnimatePresence>
                {replyingTo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border-b border-indigo-100"
                  >
                    <Reply className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-indigo-500 font-semibold">Replying to</p>
                      <p className="text-xs text-slate-600 truncate">{replyingTo.content}</p>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center">
                      <X className="w-3 h-3 text-slate-500" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="p-3 relative">
                <AnimatePresence>
                  {showProductPicker && <ProductSharePicker onShare={sendProduct} onClose={() => setShowProductPicker(false)} currentUser={currentUser} />}
                  {showOfferModal && <OfferModal onSend={sendOffer} onClose={() => setShowOfferModal(false)} />}
                  {showEmojiPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 z-20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-slate-800">Emojis</p>
                        <button onClick={() => setShowEmojiPicker(false)}><X className="w-4 h-4 text-slate-400" /></button>
                      </div>
                      <div className="grid grid-cols-8 gap-2 max-h-48 overflow-y-auto p-1">
                        {EMOJI_PACK.map(e => (
                          <button
                            key={e}
                            onClick={() => { setNewMessage(prev => prev + e); setShowEmojiPicker(false); }}
                            className="text-xl hover:scale-125 transition-transform"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-2 bg-slate-100 rounded-2xl px-3 py-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setShowProductPicker(v => !v); setShowOfferModal(false); setShowEmojiPicker(false); }}
                      className={`p-1.5 rounded-xl transition-colors ${showProductPicker ? "bg-indigo-100 text-indigo-600" : "hover:bg-slate-200 text-slate-500"}`}
                      title="Share product"
                    >
                      <ShoppingBag className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setShowOfferModal(v => !v); setShowProductPicker(false); setShowEmojiPicker(false); }}
                      className={`p-1.5 rounded-xl transition-colors ${showOfferModal ? "bg-indigo-100 text-indigo-600" : "hover:bg-slate-200 text-slate-500"}`}
                      title="Make an offer"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                    <ChatImageUpload
                      onImageReady={(url) => setPendingImageUrl(url)}
                      onClear={() => setPendingImageUrl(null)}
                      previewUrl={pendingImageUrl}
                    />
                  </div>

                  <input
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder={t("chat.typeMessage")}
                    className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none py-1"
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendText()}
                  />

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setShowEmojiPicker(v => !v); setShowProductPicker(false); setShowOfferModal(false); }}
                      className={`p-1.5 rounded-xl transition-colors ${showEmojiPicker ? "bg-indigo-100 text-indigo-600" : "hover:bg-slate-200 text-slate-500"}`}
                      title="Emoji picker"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                    <button
                      onClick={sendText}
                      disabled={!newMessage.trim() || sendMutation.isPending}
                      className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center ml-1 shrink-0 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Forward Modal */}
            <AnimatePresence>
              {forwardMsg && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
                  onClick={e => e.target === e.currentTarget && setForwardMsg(null)}
                >
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl"
                  >
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Forward Message</h3>
                    <p className="text-xs text-slate-500 mb-3 bg-slate-50 rounded-xl px-3 py-2 line-clamp-2">{forwardMsg.content}</p>
                    <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Send to</p>
                    {conversations.length > 0 ? (
                      <div className="space-y-1 max-h-52 overflow-y-auto mb-3">
                        {conversations.map(c => (
                          <button
                            key={c.other_user_username}
                            onClick={() => setForwardToUsername(c.other_user_username)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors text-left border-2 ${
                              forwardToUsername === c.other_user_username
                                ? "border-indigo-500 bg-indigo-50"
                                : "border-transparent hover:bg-slate-50"
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                              {(c.other_user_name)?.[0]?.toUpperCase() || "U"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{c.other_user_name}</p>
                              <p className="text-xs text-slate-400">@{c.other_user_username}</p>
                            </div>
                            {forwardToUsername === c.other_user_username && (
                              <div className="ml-auto w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                                <CheckCheck className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-4 mb-3">No conversations yet</p>
                    )}
                    <div className="flex gap-2">
                      <Button onClick={() => { setForwardMsg(null); setForwardToUsername(""); }} variant="outline" className="flex-1 rounded-xl" size="sm">Cancel</Button>
                      <Button onClick={executeForward} disabled={!forwardToUsername.trim()} className="flex-1 bg-indigo-600 hover:bg-indigo-700 rounded-xl" size="sm">Forward</Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
                <Send className="w-9 h-9 text-indigo-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Your Messages</h3>
              <p className="text-sm text-slate-400">Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}