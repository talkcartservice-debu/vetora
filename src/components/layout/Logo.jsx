import React from 'react';

const Logo = ({ size = "md", showText = true, className = "", subtext = "", showDecoration = false }) => {
  const sizes = {
    sm: {
      container: "w-8 h-8 rounded-xl shadow-sm",
      text: "text-lg",
      decoration: "h-0.5 w-8",
      i: {
        dot: "w-1 h-1",
        body: "w-1 h-3",
        gap: "gap-0.5"
      }
    },
    md: {
      container: "w-10 h-10 rounded-2xl shadow-md",
      text: "text-2xl",
      decoration: "h-1 w-12",
      i: {
        dot: "w-1.5 h-1.5",
        body: "w-1.5 h-4",
        gap: "gap-0.5"
      }
    },
    lg: {
      container: "h-16 w-16 rounded-3xl shadow-xl",
      text: "text-[2.75rem]",
      decoration: "h-1.5 w-16",
      i: {
        dot: "w-2.5 h-2.5",
        body: "w-2.5 h-7",
        gap: "gap-1"
      }
    }
  };

  const currentSize = sizes[size] || sizes.md;

  return (
    <div className={`flex items-center gap-2.5 transition-all ${className}`} role="img" aria-label="IQON Logo">
      <div className={`${currentSize.container} bg-white flex items-center justify-center shrink-0 ring-1 ring-slate-100 transition-all hover:scale-110 active:scale-95 group/logo relative overflow-hidden`}>
        {/* The "i" figure */}
        <div className={`relative flex flex-col items-center justify-center ${currentSize.i.gap} z-10 transition-transform duration-300 group-hover/logo:-translate-y-0.5`}>
          {/* Glowing Dot of "i" */}
          <div className={`${currentSize.i.dot} bg-orange-500 rounded-full shadow-[0_0_12px_rgba(249,115,22,0.4)] animate-pulse group-hover/logo:scale-125 transition-transform`} />
          {/* Body of "i" */}
          <div className={`${currentSize.i.body} bg-orange-500 rounded-full shadow-sm`} />
        </div>

        {/* Subtle inner glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-transparent pointer-events-none" />
      </div>
      {showText && (
        <div className={`flex flex-col ${className.includes('flex-col') ? 'items-center' : ''} gap-1`}>
          <div className={`${currentSize.text} font-black italic lowercase tracking-tight flex items-baseline leading-none`}>
            <span className="text-orange-400 drop-shadow-[0_1px_1px_rgba(249,115,22,0.1)]">i</span>
            <span className="text-slate-600 dark:text-slate-300 ml-[0.5px] opacity-80">qon</span>
            {/* Subtle detailing: a tiny dot at the end */}
            <span className="w-1 h-1 bg-orange-400/40 rounded-full ml-1 self-center" />
          </div>
          {showDecoration && (
            <div className={`${currentSize.decoration} bg-orange-500/80 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.2)]`} />
          )}
          {subtext && (
            <p className="text-slate-400 font-bold tracking-[0.2em] text-[10px] uppercase pt-1">
              {subtext}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;
