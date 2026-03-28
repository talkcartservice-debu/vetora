import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Mail, Lock, Loader2, ShieldCheck, ArrowRight, ShoppingBag, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import { 
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState(null);
  const [otpToken, setOtpToken] = useState('');

  const { login, googleLogin, verify2FA } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await googleLogin(credentialResponse.credential);
      const redirectPath = res.user?.role === 'super_admin' ? '/AdminDashboard' : '/';
      navigate(redirectPath);
    } catch (err) {
      setError(err.message || 'Google login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google login failed. Please try again.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await login(identifier, password);
      if (res.two_factor_required) {
        setTwoFactorToken(res.two_factor_token);
        setShow2FA(true);
      } else {
        const redirectPath = res.user?.role === 'super_admin' ? '/AdminDashboard' : '/';
        navigate(redirectPath);
      }
    } catch (err) {
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await verify2FA(twoFactorToken, otpToken);
      const redirectPath = res.user?.role === 'super_admin' ? '/AdminDashboard' : '/';
      navigate(redirectPath);
    } catch (err) {
      setError(err.message || 'Invalid verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center bg-[#fdfdfd] overflow-hidden p-6 selection:bg-indigo-100 selection:text-indigo-900">
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
          <AnimatePresence mode="wait">
            {!show2FA ? (
              <motion.div 
                key="login-form"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4 }}
                className="space-y-10"
              >
                <div className="text-center space-y-8">
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="inline-flex items-center justify-center"
                  >
                    <div className="h-14 w-14 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-200 rotate-3">
                      <ShoppingBag className="h-8 w-8 text-white -rotate-3" />
                    </div>
                  </motion.div>
                  
                  <div className="space-y-2">
                    <h1 className="text-[2.5rem] font-black text-slate-900 tracking-tight leading-none italic uppercase">
                      Vetora
                    </h1>
                    <div className="h-1 w-12 bg-indigo-600 mx-auto rounded-full" />
                    <p className="text-slate-400 font-semibold tracking-wide text-xs uppercase pt-2">
                      Sign in to your account
                    </p>
                  </div>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-rose-50/50 backdrop-blur-md border border-rose-100 text-rose-600 px-5 py-4 rounded-2xl text-sm font-semibold flex items-start gap-3"
                  >
                    <div className="h-2 w-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    {error}
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-7">
                  <div className="space-y-2.5">
                    <label className="text-xs font-black text-slate-800 uppercase tracking-widest ml-1 opacity-60">Account Identity</label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 focus:bg-white outline-none transition-all duration-300 font-medium group-hover:border-slate-200"
                        placeholder="Email or @username"
                        required
                      />
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300" />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-xs font-black text-slate-800 uppercase tracking-widest opacity-60">Password</label>
                      <Link to="/ForgotPassword" title="Reset your password" className="text-[10px] uppercase tracking-tighter text-indigo-600 hover:text-indigo-700 font-black transition-colors">
                        Forgot Password?
                      </Link>
                    </div>
                    <div className="relative group">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-12 pr-12 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 focus:bg-white outline-none transition-all duration-300 font-medium group-hover:border-slate-200"
                        placeholder="••••••••"
                        required
                      />
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors duration-300 focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group w-full bg-slate-900 text-white py-4.5 rounded-[1.25rem] font-black text-sm uppercase tracking-widest hover:bg-slate-800 active:scale-[0.98] transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:active:scale-100 shadow-[0_20px_40px_-10px_rgba(15,23,42,0.3)] mt-8"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    ) : (
                      <span className="flex items-center gap-3">
                        Enter Workspace <ArrowRight className="h-4 w-4 group-hover:translate-x-1.5 transition-transform duration-300" />
                      </span>
                    )}
                  </button>
                </form>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-100"></span>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-4 text-slate-400 font-bold">Or continue with</span>
                  </div>
                </div>

                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    theme="outline"
                    shape="pill"
                  />
                </div>

                <div className="pt-8 border-t border-slate-50 text-center">
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-tight">
                    Don't have an account?{' '}
                    <Link to="/Register" className="text-indigo-600 hover:text-indigo-700 font-black underline underline-offset-4 decoration-2 transition-colors">
                      Register Now
                    </Link>
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="otp-form"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4 }}
                className="space-y-10"
              >
                <div className="text-center space-y-6">
                  <motion.div 
                    initial={{ rotate: -10, scale: 0.9 }}
                    animate={{ rotate: 0, scale: 1 }}
                    className="inline-flex items-center justify-center h-24 w-24 rounded-3xl bg-emerald-50 text-emerald-600 mb-2 border border-emerald-100 shadow-xl shadow-emerald-100/50"
                  >
                    <ShieldCheck className="h-12 w-12" />
                  </motion.div>
                  <div className="space-y-3">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase">Vault</h1>
                    <p className="text-slate-400 font-semibold text-xs tracking-widest uppercase">
                      Verification required
                    </p>
                  </div>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-rose-50 border border-rose-100 text-rose-600 px-5 py-4 rounded-2xl text-sm font-semibold flex items-start gap-3"
                  >
                    <div className="h-2 w-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    {error}
                  </motion.div>
                )}

                <form onSubmit={handleVerify2FA} className="space-y-10 flex flex-col items-center">
                  <div className="flex justify-center">
                    <InputOTP 
                      maxLength={6} 
                      value={otpToken} 
                      onChange={setOtpToken}
                      className="gap-3"
                    >
                      <InputOTPGroup className="gap-3">
                        <InputOTPSlot index={0} className="w-12 h-16 text-2xl font-black rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none" />
                        <InputOTPSlot index={1} className="w-12 h-16 text-2xl font-black rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none" />
                        <InputOTPSlot index={2} className="w-12 h-16 text-2xl font-black rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none" />
                      </InputOTPGroup>
                      <div className="w-1" />
                      <InputOTPGroup className="gap-3">
                        <InputOTPSlot index={3} className="w-12 h-16 text-2xl font-black rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none" />
                        <InputOTPSlot index={4} className="w-12 h-16 text-2xl font-black rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none" />
                        <InputOTPSlot index={5} className="w-12 h-16 text-2xl font-black rounded-2xl border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <div className="w-full space-y-5">
                    <button
                      type="submit"
                      disabled={isLoading || otpToken.length !== 6}
                      className="w-full bg-indigo-600 text-white py-4.5 rounded-[1.25rem] font-black uppercase tracking-widest text-sm hover:bg-indigo-700 active:scale-[0.98] transition-all duration-300 flex items-center justify-center disabled:opacity-70 shadow-[0_20px_40px_-10px_rgba(79,70,229,0.3)]"
                    >
                      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Authorize Access'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setShow2FA(false)}
                      className="w-full py-2 text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
                    >
                      Return to Authentication
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
