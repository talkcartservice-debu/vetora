import React, { useState } from "react";
import { authAPI } from "@/api/apiClient";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/layout/Logo";
import { ArrowLeft, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword(email);
      setSubmitted(true);
      if (res.dev_token) {
        setDevToken(res.dev_token);
      }
    } catch (err) {
      toast.error(err.message || "Something went wrong");
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
          <Link to={createPageUrl("Login")} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </Link>

          {!submitted ? (
            <div className="space-y-10">
              <div className="text-center space-y-8">
                <Logo 
                  size="lg" 
                  className="flex-col !gap-6" 
                  subtext="Recover your account" 
                  showDecoration={true} 
                />
              </div>

              <form onSubmit={handleSubmit} className="space-y-7">
                <div className="space-y-2.5">
                  <Label htmlFor="email" className="text-xs font-black text-slate-800 uppercase tracking-widest ml-1 opacity-60">Email Address</Label>
                  <div className="relative group">
                    <Input 
                      id="email"
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      placeholder="name@example.com" 
                      className="w-full pl-12 pr-4 py-7 rounded-2xl border border-slate-100 bg-slate-50/50 text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 focus:bg-white outline-none transition-all duration-300 font-medium group-hover:border-slate-200"
                      required
                    />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300" />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="group w-full bg-slate-900 text-white py-8 rounded-[1.25rem] font-black text-sm uppercase tracking-widest hover:bg-slate-800 active:scale-[0.98] transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:active:scale-100 shadow-[0_20px_40px_-10px_rgba(15,23,42,0.3)] mt-8"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : "Send Reset Link"}
                </Button>
              </form>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Link Sent!</h2>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                If an account exists for <b>{email}</b>, you will receive an email with instructions shortly.
              </p>
              
              {import.meta.env.DEV && devToken && (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 mb-8">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">Development Token</p>
                  <p className="text-xl font-mono font-bold text-amber-900 break-all">{devToken}</p>
                  <Link 
                    to={createPageUrl("ResetPassword") + `?token=${devToken}`}
                    className="mt-3 inline-block text-xs font-bold text-indigo-600 hover:underline"
                  >
                    Go to Reset Page
                  </Link>
                </div>
              )}

              <Link to={createPageUrl("Login")}>
                <Button variant="outline" className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-widest border-slate-200 hover:bg-slate-50 transition-all active:scale-[0.98]">
                  Return to Login
                </Button>
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
