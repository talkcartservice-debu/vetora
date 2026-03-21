import React, { useState } from "react";
import { authAPI } from "@/api/apiClient";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 p-8 lg:p-10"
      >
        <Link to={createPageUrl("Login")} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </Link>

        {!submitted ? (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Forgot Password?</h1>
              <p className="text-sm text-slate-500">No worries, it happens! Enter your email and we'll send you a reset link.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block ml-1">Email Address</label>
                <div className="relative">
                  <Input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    placeholder="name@example.com" 
                    className="rounded-2xl h-12 pl-12 border-slate-200 focus:border-indigo-500 focus:ring-indigo-100"
                    required
                  />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 rounded-2xl font-bold text-base transition-all shadow-lg shadow-indigo-200"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Reset Link"}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Link Sent!</h2>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              If an account exists for <b>{email}</b>, you will receive an email with instructions shortly.
            </p>
            
            {devToken && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 mb-8">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">Development Token</p>
                <p className="text-xl font-mono font-bold text-amber-900">{devToken}</p>
                <Link 
                  to={createPageUrl("ResetPassword") + `?token=${devToken}`}
                  className="mt-3 inline-block text-xs font-bold text-indigo-600 hover:underline"
                >
                  Go to Reset Page
                </Link>
              </div>
            )}

            <Link to={createPageUrl("Login")}>
              <Button variant="outline" className="w-full h-12 rounded-2xl font-bold border-slate-200">
                Return to Login
              </Button>
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
