import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 

export function createPageUrl(pageName) {
  if (pageName === "Home") return "/";
  return `/${pageName}`;
}

export const isIframe = window.self !== window.top;
