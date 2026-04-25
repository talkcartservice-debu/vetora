import React from 'react';
import { motion } from 'framer-motion';
import { Package, Heart, Sparkles, ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function SmartActionChips({ onChipClick }) {
  const { t } = useTranslation();

  const CHIPS = [
    { labelKey: "ai.chip_lastOrder", icon: Package, value: "Where is my last order?" },
    { labelKey: "ai.chip_wishlist", icon: Heart, value: "Show me items similar to my wishlist" },
    { labelKey: "ai.chip_dailyPicks", icon: Sparkles, value: "Show me my daily picks" },
    { labelKey: "ai.chip_trending", icon: ShoppingBag, value: "What are the trending fashion items?" },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-1">
      {CHIPS.map((chip, i) => (
        <motion.button
          key={chip.labelKey}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => onChipClick(chip.value)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-100 rounded-full text-xs text-slate-600 hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-700 transition-all whitespace-nowrap shadow-sm shrink-0"
        >
          <chip.icon className="w-3 h-3 text-indigo-500" />
          {t(chip.labelKey)}
        </motion.button>
      ))}
    </div>
  );
}
