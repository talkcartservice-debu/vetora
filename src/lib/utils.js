import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 

export function createPageUrl(pageName) {
  if (pageName === "Home") return "/";
  return `/${pageName}`;
}

export function getRedirectPath(user) {
  return user?.role === 'super_admin' ? '/AdminDashboard' : '/';
}

export const isIframe = window.self !== window.top;
