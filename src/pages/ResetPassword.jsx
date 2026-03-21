import React, { useState, useEffect } from "react";
import { authAPI } from "@/api/apiClient";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Eye, EyeOff, CheckCircle2, Loader2, Key } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
  }, []);

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
      setTimeout(() => navigate(createPageUrl("Login")), 3000);
    } catch (err) {
      toast.error(err.message || "Invalid or expired token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 p-8 lg:p-10 text-center"
      >
        {!success ? (
          <>
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Key className="w-8 h-8 text-indigo-600" />
            </div>
            
            <div className="mb-8">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Set New Password</h1>
              <p className="text-sm text-slate-500">Choose a strong, unique password to secure your account.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block ml-1">Reset Token</label>
                <div className="relative">
                  <Input 
                    value={token} 
                    onChange={e => setToken(e.target.value)} 
                    placeholder="Enter your reset token" 
                    className="rounded-2xl h-12 pl-12 border-slate-200"
                    required
                  />
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block ml-1">New Password</label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"}
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    placeholder="••••••••" 
                    className="rounded-2xl h-12 pl-12 pr-12 border-slate-200 focus:border-indigo-500"
                    required
                  />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block ml-1">Confirm New Password</label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    placeholder="••••••••" 
                    className="rounded-2xl h-12 pl-12 pr-12 border-slate-200 focus:border-indigo-500"
                    required
                  />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-black h-12 rounded-2xl font-bold text-base transition-all mt-4"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Reset Password"}
              </Button>
            </form>
          </>
        ) : (
          <div className="py-8">
            <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">All Set!</h2>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              Your password has been successfully updated. You'll be redirected to the login page shortly.
            </p>
            <Link to={createPageUrl("Login")}>
              <Button className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold">
                Log In Now
              </Button>
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
