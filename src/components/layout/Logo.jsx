import React from 'react';

const Logo = ({ size = "md", showText = true, className = "", subtext = "", showDecoration = false }) => {
  const sizes = {
    sm: {
      container: "w-8 h-8 rounded-xl shadow-[0_0_10px_-2px_rgba(var(--neon-shadow),var(--neon-shadow-opacity))]",
      icon: "text-lg",
      text: "text-lg",
      decoration: "h-0.5 w-8"
    },
    md: {
      container: "w-10 h-10 rounded-2xl shadow-[0_0_15px_-3px_rgba(var(--neon-shadow),var(--neon-shadow-opacity)),0_4px_6px_-2px_rgba(0,0,0,0.05)]",
      icon: "text-xl",
      text: "text-2xl",
      decoration: "h-1 w-12"
    },
    lg: {
      container: "h-16 w-16 rounded-2xl shadow-[0_0_20px_-5px_rgba(var(--neon-shadow),var(--neon-shadow-opacity))]",
      icon: "text-2xl",
      text: "text-[2.75rem]",
      decoration: "h-1.5 w-16"
    }
  };

  const currentSize = sizes[size] || sizes.md;

  return (
    <div className={`flex items-center gap-2.5 transition-all ${className}`}>
      <div className={`${currentSize.container} bg-gradient-to-br from-sky-400 via-blue-500 to-blue-700 flex items-center justify-center shrink-0 ring-2 ring-sky-400/20 transition-all hover:scale-110 active:scale-95 group/logo animate-neon-pulse`}>
        <span className={`text-white font-black ${currentSize.icon} drop-shadow-[0_2px_2px_rgba(0,0,0,0.1)] group-hover/logo:scale-110 transition-transform`}>
          I
        </span>
      </div>
      {showText && (
        <div className={`flex flex-col ${className.includes('flex-col') ? 'items-center' : ''} gap-1`}>
          <span className={`${currentSize.text} font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 dark:from-white dark:via-slate-200 dark:to-slate-400 leading-none italic uppercase`}>
            IQON
          </span>
          {showDecoration && (
            <div className={`${currentSize.decoration} bg-gradient-to-r from-sky-400 to-blue-600 rounded-full shadow-[0_0_10px_rgba(var(--neon-shadow),0.3)]`} />
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
