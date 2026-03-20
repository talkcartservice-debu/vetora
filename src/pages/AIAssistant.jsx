import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { createPageUrl } from "@/lib/utils";
import { Link } from "react-router-dom";
import {
  Sparkles, Send, Star, ChevronRight,
  Loader2, Bot, User, RefreshCw, TrendingUp
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { productsAPI, authAPI, aiAPI } from "@/api/apiClient";

const QUICK_PROMPTS = [
  "Show me trending fashion items under $100",
  "What are the best beauty products?",
  "Find me top-rated electronics",
  "What's the return policy for most stores?",
  "How long does shipping usually take?",
  "Recommend something for home decor",
];

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content: "Hi! I'm **Vetora AI** 🛍️\n\nI can help you:\n- **Find products** based on your style & budget\n- **Discover deals** across all categories\n- **Answer questions** about shipping, returns & policies\n- **Give personalized recommendations** based on your preferences\n\nWhat are you looking for today?",
  timestamp: new Date(),
};

function ProductRecommendation({ product }) {
  const discount = product.compare_at_price > 0
    ? Math.round((1 - product.price / product.compare_at_price) * 100) : 0;

  return (
    <Link to={createPageUrl("ProductDetail") + `?id=${product.id}`}>
      <motion.div
        whileHover={{ y: -2 }}
        className="flex gap-3 bg-white rounded-2xl border border-slate-100 p-3 hover:shadow-md transition-all"
      >
        <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
          <img src={product.images?.[0] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200"} alt={product.title} className="w-full h-full object-cover" />
          {discount > 0 && (
            <div className="absolute top-1 left-1 bg-red-500 text-white text-[8px] font-bold px-1 rounded">-{discount}%</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 font-medium">{product.store_name}</p>
          <p className="text-sm font-semibold text-slate-900 line-clamp-1">{product.title}</p>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-indigo-600">${product.price?.toFixed(2)}</span>
              {product.compare_at_price > 0 && (
                <span className="text-xs text-slate-400 line-through">${product.compare_at_price?.toFixed(2)}</span>
              )}
            </div>
            {product.rating_avg > 0 && (
              <div className="flex items-center gap-0.5">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span className="text-xs text-slate-500">{product.rating_avg?.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 self-center shrink-0" />
      </motion.div>
    </Link>
  );
}

function ChatMessage({ message }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser
          ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
          : "bg-gradient-to-br from-pink-500 to-indigo-600 text-white"
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[80%] space-y-3 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white"
            : "bg-white border border-slate-100 text-slate-800"
        }`}>
          {isUser ? (
            <p className="text-sm leading-relaxed">{message.content}</p>
          ) : (
            <ReactMarkdown
              className="text-sm leading-relaxed prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_strong]:text-slate-900 [&_ul]:my-1 [&_li]:my-0.5"
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        {message.products?.length > 0 && (
          <div className="w-full space-y-2">
            <p className="text-xs text-slate-400 font-medium px-1">Recommended for you:</p>
            {message.products.map(p => <ProductRecommendation key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-indigo-600 flex items-center justify-center">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            className="w-1.5 h-1.5 rounded-full bg-slate-400"
          />
        ))}
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const { data: products = [] } = useQuery({
    queryKey: ["allProducts"],
    queryFn: async () => {
      const res = await productsAPI.list({ status: "active", sort: "-sales_count", limit: 50 });
      return res.data || [];
    },
  });

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await authAPI.me();
      return res.data || res;
    },
    retry: false,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const findRelevantProducts = (query, limit = 3) => {
    const q = query.toLowerCase();
    const keywords = q.split(" ").filter(w => w.length > 3);
    return products
      .filter(p => {
        const text = `${p.title} ${p.description} ${p.category} ${p.tags?.join(" ")}`.toLowerCase();
        return keywords.some(k => text.includes(k)) || text.includes(q);
      })
      .slice(0, limit);
  };

  const sendMessage = async (userMessage) => {
    if (!userMessage.trim() || isLoading) return;

    const userMsg = { id: Date.now(), role: "user", content: userMessage, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const relevantProducts = findRelevantProducts(userMessage);
    const productContext = products.slice(0, 20).map(p =>
      `- ${p.title} ($${p.price}, ${p.category}, ${p.store_name}, rating: ${p.rating_avg || "N/A"}, stock: ${p.inventory_count || 0})`
    ).join("\n");

    const systemPrompt = `You are Vetora AI, a friendly and knowledgeable shopping assistant for Vetora — a social commerce platform.

Available products on Vetora right now:
${productContext}

Instructions:
- If asking about products, recommend specific ones from the list above by name.
- If asking about shipping: typical shipping is 3-7 business days standard, 1-2 days express. Most stores offer free shipping over $75.
- If asking about returns: most stores have a 30-day return policy for unused items. Some stores offer 60 days. Items must be in original condition.
- If asking about a specific store policy, give general platform policy and suggest contacting the store directly.
- Be concise (2-4 sentences), warm, and helpful. Use emoji sparingly.
- If recommending products, mention them by name but keep the response brief since product cards will be shown separately.
- Format with markdown for readability.`;

    const history = messages
      .filter(m => m.id !== "welcome")
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await aiAPI.chat(userMessage, history, systemPrompt);
      const data = res.data || res;
      const aiMsg = {
        id: Date.now() + 1,
        role: "assistant",
        content: data.reply || data.response,
        products: relevantProducts,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      const errorMsg = {
        id: Date.now() + 1,
        role: "assistant",
        content: "I'm sorry, I'm having trouble responding right now. Please try again later.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt) => sendMessage(prompt);
  const clearChat = () => setMessages([WELCOME_MESSAGE]);

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-56px)] lg:h-screen">
      {/* Header */}
      <div className="px-4 py-4 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Vetora AI</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <p className="text-xs text-slate-500">Shopping assistant · Online</p>
            </div>
          </div>
        </div>
        <button onClick={clearChat} className="p-2 rounded-xl hover:bg-slate-100 transition-colors" title="Clear chat">
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
        </AnimatePresence>
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts (shown only when just welcome message) */}
      {messages.length === 1 && !isLoading && (
        <div className="px-4 pb-2">
          <p className="text-xs text-slate-400 font-medium mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" /> Popular questions
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {QUICK_PROMPTS.slice(0, 4).map(prompt => (
              <button
                key={prompt}
                onClick={() => handleQuickPrompt(prompt)}
                className="text-left px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs text-slate-600 hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-700 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 bg-white/80 backdrop-blur-xl border-t border-slate-100 shrink-0">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder="Ask me anything about products, shipping, returns..."
            className="rounded-2xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
            disabled={isLoading}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 p-0 shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-2">Powered by Vetora AI · Recommendations are personalized</p>
      </div>
    </div>
  );
}