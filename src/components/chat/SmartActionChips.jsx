import React from 'react';
import { motion } from 'framer-motion';
import { Package, Heart, Sparkles, ShoppingBag } from 'lucide-react';

const CHIPS = [
  { label: "Where is my last order?", icon: Package, value: "Where is my last order?" },
  { label: "Items like my wishlist", icon: Heart, value: "Show me items similar to my wishlist" },
  { label: "Daily Picks for me", icon: Sparkles, value: "Show me my daily picks" },
  { label: "Trending fashion", icon: ShoppingBag, value: "What are the trending fashion items?" },
];

export default function SmartActionChips({ onChipClick }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-1">
      {CHIPS.map((chip, i) => (
        <motion.button
          key={chip.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => onChipClick(chip.value)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-100 rounded-full text-xs text-slate-600 hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-700 transition-all whitespace-nowrap shadow-sm shrink-0"
        >
          <chip.icon className="w-3 h-3 text-indigo-500" />
          {chip.label}
        </motion.button>
      ))}
    </div>
  );
}
