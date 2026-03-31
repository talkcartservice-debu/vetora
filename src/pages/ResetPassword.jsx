import React, { useState, useEffect } from "react";
import { authAPI } from "@/api/apiClient";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, CheckCircle2, Loader2, Key } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function ResetPassword() {
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
      const timer = setTimeout(() => navigate(createPageUrl("Login")), 3000);
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
    <div className="min-h-screen w-full relative flex flex-col items-center justify-center bg-[#fdfdfd] py-12 px-6 selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 90, 0],
            x: [0, 50, 0],
            y: [0, 30, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-50/50 rounded-full blur-[120px]"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, -90, 0],
            x: [0, -50, 0],
            y: [0, -30, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-violet-50/50 rounded-full blur-[120px]"
        />
      </div>

      <div className="max-w-md w-full relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white/80 backdrop-blur-2xl p-8 sm:p-12 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-white/40 ring-1 ring-black/5"
        >
          {!success ? (
            <div className="space-y-10">
              <div className="text-center space-y-8">
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center justify-center"
                >
                  <div className="h-14 w-14 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-200 rotate-3">
                    <Key className="h-8 w-8 text-white -rotate-3" />
                  </div>
                </motion.div>
                
                <div className="space-y-2">
                  <h1 className="text-[2.5rem] font-black text-slate-900 tracking-tight leading-none italic uppercase">
                    Secure
                  </h1>
                  <div className="h-1 w-12 bg-indigo-600 mx-auto rounded-full" />
                  <p className="text-slate-400 font-semibold tracking-wide text-xs uppercase pt-2">
                    Set your new password
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-7">
                <div className="space-y-2.5 text-left">
                  <Label htmlFor="token" className="text-xs font-black text-slate-800 uppercase tracking-widest ml-1 opacity-60">Reset Token</Label>
                  <div className="relative group">
                    <Input 
                      id="token"
                      value={token} 
                      onChange={e => setToken(e.target.value)} 
                      placeholder="Enter your reset token" 
                      className="w-full pl-12 pr-4 py-7 rounded-2xl border border-slate-100 bg-slate-50/50 text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 focus:bg-white outline-none transition-all duration-300 font-medium group-hover:border-slate-200"
                      required
                    />
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300" />
                  </div>
                </div>

                <div className="space-y-2.5 text-left">
                  <Label htmlFor="newPassword" name="password" className="text-xs font-black text-slate-800 uppercase tracking-widest ml-1 opacity-60">New Password</Label>
                  <div className="relative group">
                    <Input 
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} 
                      placeholder="••••••••" 
                      className="w-full pl-12 pr-12 py-7 rounded-2xl border border-slate-100 bg-slate-50/50 text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 focus:bg-white outline-none transition-all duration-300 font-medium group-hover:border-slate-200"
                      required
                    />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300" />
                    <Button 
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors duration-300 focus:outline-none h-10 w-10"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2.5 text-left">
                  <Label htmlFor="confirmPassword" name="confirm_password" className="text-xs font-black text-slate-800 uppercase tracking-widest ml-1 opacity-60">Confirm Password</Label>
                  <div className="relative group">
                    <Input 
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                      placeholder="••••••••" 
                      className="w-full pl-12 pr-12 py-7 rounded-2xl border border-slate-100 bg-slate-50/50 text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 focus:bg-white outline-none transition-all duration-300 font-medium group-hover:border-slate-200"
                      required
                    />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300" />
                    <Button 
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors duration-300 focus:outline-none h-10 w-10"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="group w-full bg-slate-900 text-white py-8 rounded-[1.25rem] font-black text-sm uppercase tracking-widest hover:bg-slate-800 active:scale-[0.98] transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:active:scale-100 shadow-[0_20px_40px_-10px_rgba(15,23,42,0.3)] mt-8"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : "Reset Password"}
                </Button>
              </form>
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">All Set!</h2>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                Your password has been successfully updated. You'll be redirected to the login page shortly.
              </p>
              <Link to={createPageUrl("Login")}>
                <Button className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-indigo-200">
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
