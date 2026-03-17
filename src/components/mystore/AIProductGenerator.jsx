import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiAPI } from "@/api/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, RefreshCw, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const CATEGORIES = ["fashion", "electronics", "home", "beauty", "sports", "food", "art", "books", "handmade", "other"];

export default function AIProductGenerator({ onApply }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("fashion");
  const [keyFeatures, setKeyFeatures] = useState("");
  const [result, setResult] = useState(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!keyFeatures.trim()) throw new Error("Enter key features first");
      const res = await aiAPI.generateProductContent({
        category,
        keyFeatures,
      });
      return res.data || res;
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate content");
    }
  });

  const generate = () => {
    if (!keyFeatures.trim()) { toast.error("Enter key features first"); return; }
    generateMutation.mutate();
  };

  const apply = () => {
    if (!result) return;
    onApply(result);
    toast.success("AI content applied!");
    setOpen(false);
  };

  const generating = generateMutation.isPending;

  return (
    <div className="border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-purple-900">AI Product Assistant</p>
          <p className="text-xs text-purple-600">Auto-generate SEO title, description & tags</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-purple-500" /> : <ChevronDown className="w-4 h-4 text-purple-500" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-purple-100">
              <div className="pt-3">
                <label className="text-xs font-medium text-slate-600 block mb-1">Product Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="rounded-xl text-sm bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Key Features & Details <span className="text-slate-400">(the more detail, the better)</span>
                </label>
                <Textarea
                  value={keyFeatures}
                  onChange={e => setKeyFeatures(e.target.value)}
                  placeholder="e.g. oversized cotton hoodie, vintage wash, unisex, available in 5 colors, eco-friendly fabric, streetwear style..."
                  className="rounded-xl text-sm bg-white min-h-[80px]"
                />
              </div>

              <Button
                onClick={generate}
                disabled={generating || !keyFeatures.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl gap-2"
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generate with AI</>
                )}
              </Button>

              {result && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 bg-white rounded-xl border border-purple-100 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-purple-800 uppercase tracking-wide">AI Generated Content</p>
                    <button onClick={generate} className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800">
                      <RefreshCw className="w-3 h-3" /> Regenerate
                    </button>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Title</p>
                    <p className="text-sm font-semibold text-slate-800">{result.title}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Description</p>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-4">{result.description}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1.5">SEO Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.tags?.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] px-2 py-0.5">{tag}</Badge>
                      ))}
                    </div>
                  </div>

                  {result.seo_title && (
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase mb-0.5">SEO Meta Title</p>
                      <p className="text-xs text-slate-700">{result.seo_title}</p>
                    </div>
                  )}

                  <Button onClick={apply} className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl gap-2">
                    <Check className="w-4 h-4" /> Apply to Product Form
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}