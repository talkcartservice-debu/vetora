import React, { useState, useEffect } from "react";
import { authAPI } from "@/api/apiClient";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/layout/Logo";
import { Lock, Eye, EyeOff, CheckCircle2, Loader2, Key } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function ResetPassword() {
  const { t } = useTranslation();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => navigate(createPageUrl("login")), 3000);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(token, newPassword);
      setSuccess(true);
      toast.success("Password reset successful!");
    } catch (err) {
      toast.error(err.message || "Invalid or expired token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center bg-[#0a0a0c] selection:bg-orange-500/30 selection:text-orange-200 overflow-hidden font-sans">
      {/* Dynamic Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,17,19,1)_0%,rgba(0,0,0,1)_100%)]" />
        
        {/* Animated Mesh Gradients */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            x: [0, -80, 0],
            y: [0, -40, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] bg-indigo-600/10 rounded-full blur-[120px]"
        />
        
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      <div className="max-w-md w-full relative z-10 px-6">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white/[0.02] backdrop-blur-3xl p-8 sm:p-12 rounded-[3rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.7)] border border-white/10 ring-1 ring-white/5 relative overflow-hidden group text-center"
        >
          {!success ? (
            <div className="space-y-10">
              <div className="text-center space-y-6">
                <Logo 
                  size="lg" 
                  className="flex-col !gap-6 mx-auto" 
                  subtext="Security Override" 
                  showDecoration={true} 
                />
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2 text-left">
                  <Label htmlFor="token" className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Reset Token</Label>
                  <div className="relative group">
                    <Input 
                      id="token"
                      value={token} 
                      onChange={e => setToken(e.target.value)} 
                      placeholder="Enter override token" 
                      className="w-full pl-12 pr-4 py-7 rounded-2xl border-white/5 bg-white/[0.03] text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/40 focus:bg-white/[0.05] outline-none transition-all duration-300 font-bold group-hover:border-white/10 placeholder:text-slate-700 placeholder:font-medium"
                      required
                    />
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-600 group-focus-within:text-orange-500 transition-colors duration-300" />
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <Label htmlFor="newPassword" className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">{t("settings.newPassword")}</Label>
                  <div className="relative group">
                    <Input 
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      placeholder="••••••••" 
                      className="w-full pl-12 pr-12 py-7 rounded-2xl border-white/5 bg-white/[0.03] text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/40 focus:bg-white/[0.05] outline-none transition-all duration-300 font-bold group-hover:border-white/10 placeholder:text-slate-700 placeholder:font-medium"
                      required
                    />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-600 group-focus-within:text-orange-500 transition-colors duration-300" />
                    <Button 
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-orange-500 transition-colors duration-300 focus:outline-none h-10 w-10 hover:bg-white/5 rounded-xl"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <Label htmlFor="confirmPassword" className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">{t("settings.confirmNewPassword")}</Label>
                  <div className="relative group">
                    <Input 
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                      placeholder="••••••••" 
                      className="w-full pl-12 pr-12 py-7 rounded-2xl border-white/5 bg-white/[0.03] text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/40 focus:bg-white/[0.05] outline-none transition-all duration-300 font-bold group-hover:border-white/10 placeholder:text-slate-700 placeholder:font-medium"
                      required
                    />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-600 group-focus-within:text-orange-500 transition-colors duration-300" />
                    <Button 
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-orange-500 transition-colors duration-300 focus:outline-none h-10 w-10 hover:bg-white/5 rounded-xl"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="group w-full bg-orange-600 text-white py-8 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-orange-500 active:scale-[0.98] transition-all duration-500 flex items-center justify-center disabled:opacity-70 disabled:active:scale-100 shadow-[0_20px_40px_-10px_rgba(249,115,22,0.4)] hover:shadow-orange-500/60 mt-8 border-t border-white/20"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : t("auth.resetPassword")}
                </Button>
              </form>
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="w-20 h-20 bg-orange-500/10 border border-orange-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-500/20">
                <CheckCircle2 className="w-10 h-10 text-orange-500" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3 tracking-tighter">Identity Secured!</h2>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed font-medium">
                Your credentials have been successfully updated. You'll be redirected to the access portal shortly.
              </p>
              <Link to={createPageUrl("login")}>
                <Button className="w-full h-16 bg-orange-600 hover:bg-orange-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-orange-500/20 border-t border-white/20">
                  Log In Now
                </Button>
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
