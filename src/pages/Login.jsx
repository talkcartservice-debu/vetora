import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getRedirectPath } from '@/lib/utils';
import { Mail, Lock, Loader2, ShieldCheck, ArrowRight, Eye, EyeOff, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import Logo from "@/components/layout/Logo";
import { 
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useEffect } from 'react';

const MemoizedBackground = React.memo(() => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,17,19,1)_0%,rgba(0,0,0,1)_100%)]" />
    
    {/* Animated Mesh Gradients */}
    <motion.div 
      animate={{ 
        scale: [1, 1.2, 1],
        x: [0, 100, 0],
        y: [0, 50, 0],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-orange-600/10 rounded-full blur-[120px]"
    />
    <motion.div 
      animate={{ 
        scale: [1.2, 1, 1.2],
        x: [0, -120, 0],
        y: [0, -80, 0],
      }}
      transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] bg-indigo-600/10 rounded-full blur-[120px]"
    />
    
    {/* Subtle Grid Pattern */}
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
  </div>
));

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState(null);
  const [otpToken, setOtpToken] = useState('');

  const { login, googleLogin, verify2FA, loginBiometrics } = useAuth();
  const navigate = useNavigate();

  // Cleanup effect to prevent selection errors during unmount
  useEffect(() => {
    return () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
  }, []);

  const handleBiometricLogin = async () => {
    if (!identifier) {
      setError('Please enter your email or username first to use biometric login');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await loginBiometrics(identifier);
      navigate(getRedirectPath(res.user));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Biometric login failed. Make sure you have registered biometrics for this account.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await googleLogin(credentialResponse.credential);
      navigate(getRedirectPath(res.user));
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
      const res = await login(identifier, password, rememberMe);
      if (res.two_factor_required) {
        setTwoFactorToken(res.two_factor_token);
        setShow2FA(true);
      } else {
        navigate(getRedirectPath(res.user));
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
      navigate(getRedirectPath(res.user));
    } catch (err) {
      setError(err.message || 'Invalid verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center bg-[#0a0a0c] selection:bg-orange-500/30 selection:text-orange-200 overflow-hidden font-sans">
      <MemoizedBackground />

      <div className="container relative z-10 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24 px-6 max-w-7xl mx-auto">
        {/* Branding Section (Visible on Desktop) */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:flex flex-col space-y-8 max-w-lg"
        >
          <div className="space-y-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <Logo size="lg" showText={false} className="!gap-0" />
            </motion.div>
            <h1 className="text-7xl font-black text-white tracking-tighter leading-[0.85]">
              BEYOND <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600">COMMERCE.</span>
            </h1>
            <p className="text-xl text-slate-400 font-medium leading-relaxed max-w-md">
              Welcome to the elite social commerce network. Connect, showcase, and grow your digital empire.
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-[#0a0a0c] bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden">
                  <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="User" className="w-full h-full object-cover opacity-80" />
                </div>
              ))}
              <div className="w-10 h-10 rounded-full border-2 border-[#0a0a0c] bg-orange-600 flex items-center justify-center text-[10px] font-bold text-white">
                +2k
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-white font-bold text-sm tracking-tight">Joined the network</div>
              <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">In the last 24h</div>
            </div>
          </div>
        </motion.div>

        {/* Login Form Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="bg-white/[0.02] backdrop-blur-3xl p-8 sm:p-10 rounded-[3rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.7)] border border-white/10 ring-1 ring-white/5 relative overflow-hidden group">
            {/* Subtle light sweep animation */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
            
            <AnimatePresence mode="wait">
              {!show2FA ? (
                <motion.div 
                  key="login-form"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-8"
                >
                  <div className="text-center lg:text-left space-y-4 lg:hidden">
                    <Logo 
                      size="lg" 
                      className="flex-col !gap-6 mx-auto" 
                      subtext="Premium Social Commerce" 
                      showDecoration={true} 
                    />
                  </div>
                  
                  <div className="hidden lg:block space-y-2">
                    <h2 className="text-4xl font-black text-white tracking-tighter">Sign In</h2>
                    <p className="text-slate-500 font-medium text-sm">Enter your workspace credentials</p>
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-rose-500/10 backdrop-blur-md border border-rose-500/20 text-rose-400 px-5 py-4 rounded-2xl text-sm font-semibold flex items-start gap-3"
                    >
                      <div className="h-2 w-2 rounded-full bg-rose-500 mt-1.5 shrink-0 animate-pulse" />
                      {error}
                    </motion.div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="identifier" className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Identity</Label>
                      <div className="relative group">
                        <Input
                          id="identifier"
                          type="text"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          className="w-full pl-12 pr-4 py-7 rounded-2xl border-white/5 bg-white/[0.03] text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/40 focus:bg-white/[0.05] outline-none transition-all duration-300 font-bold group-hover:border-white/10 placeholder:text-slate-700 placeholder:font-medium"
                          placeholder="Email or @username"
                          required
                        />
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-600 group-focus-within:text-orange-500 transition-colors duration-300" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <Label htmlFor="password" className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Secret Key</Label>
                        <Link to="/forgot-password" title="Reset your password" className="text-[10px] uppercase tracking-tighter text-orange-500 hover:text-orange-400 font-black transition-colors">
                          Recover?
                        </Link>
                      </div>
                      <div className="relative group">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-12 pr-12 py-7 rounded-2xl border-white/5 bg-white/[0.03] text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/40 focus:bg-white/[0.05] outline-none transition-all duration-300 font-bold group-hover:border-white/10 placeholder:text-slate-700 placeholder:font-medium"
                          placeholder="••••••••"
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
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center space-x-2.5">
                        <Checkbox 
                          id="remember" 
                          checked={rememberMe}
                          onCheckedChange={setRememberMe}
                          className="border-white/10 bg-white/5 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600 rounded-md h-5 w-5"
                        />
                        <Label 
                          htmlFor="remember" 
                          className="text-[11px] font-bold text-slate-500 cursor-pointer select-none uppercase tracking-tight"
                        >
                          Stay Authenticated
                        </Label>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="group w-full bg-orange-600 text-white py-8 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-orange-500 active:scale-[0.98] transition-all duration-500 flex items-center justify-center disabled:opacity-70 disabled:active:scale-100 shadow-[0_20px_40px_-10px_rgba(249,115,22,0.4)] hover:shadow-orange-500/60 mt-4 border-t border-white/20"
                    >
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      ) : (
                        <span className="flex items-center gap-3 font-black">
                          Initialize Access <ArrowRight className="h-4 w-4 group-hover:translate-x-1.5 transition-transform duration-300" />
                        </span>
                      )}
                    </Button>
                  </form>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/5"></span>
                    </div>
                    <div className="relative flex justify-center text-[9px] uppercase tracking-[0.3em]">
                      <span className="bg-[#0a0a0c] px-4 py-1 rounded-full text-slate-600 font-black border border-white/5">Instant Access</span>
                    </div>
                  </div>

                  <div className="flex justify-center gap-8 items-center">
                    <div className="flex flex-col items-center gap-2 group cursor-pointer">
                      <div className="hover:scale-110 transition-transform duration-300">
                        <GoogleLogin
                          onSuccess={handleGoogleSuccess}
                          onError={handleGoogleError}
                          type="icon"
                          text="signin_with"
                          theme="filled_blue"
                          shape="circle"
                          size="large"
                        />
                      </div>
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.15em] group-hover:text-orange-400 transition-colors">Google</span>
                    </div>
                    
                    <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={handleBiometricLogin}>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={isLoading}
                        className="h-11 w-11 rounded-full border border-white/5 bg-white/5 group-hover:bg-orange-600 group-hover:border-orange-600 group-hover:text-white transition-all duration-500 active:scale-95 disabled:opacity-50 shadow-sm"
                      >
                        <Fingerprint className="h-6 w-6 text-orange-500 group-hover:text-white transition-colors" />
                      </Button>
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.15em] group-hover:text-orange-400 transition-colors">Passkey</span>
                    </div>
                  </div>

                  <div className="pt-6 text-center">
                    <p className="text-slate-600 font-bold text-xs uppercase tracking-tight">
                      New here?{' '}
                      <Link to="/register" className="text-orange-500 hover:text-orange-400 font-black transition-colors relative group/link">
                        Join Network
                        <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-orange-500 scale-x-0 group-hover/link:scale-x-100 transition-transform duration-300 origin-left" />
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
                  className="space-y-8"
                >
                  <div className="text-center space-y-6">
                    <motion.div 
                      initial={{ rotate: -10, scale: 0.9 }}
                      animate={{ rotate: 0, scale: 1 }}
                      className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-orange-500/10 text-orange-500 mb-2 border border-orange-500/20 shadow-2xl shadow-orange-500/20"
                    >
                      <ShieldCheck className="h-10 w-10" />
                    </motion.div>
                    <div className="space-y-2">
                      <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Vault</h1>
                      <p className="text-slate-500 font-semibold text-xs tracking-[0.2em] uppercase">
                        Identity Verification
                      </p>
                    </div>
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-5 py-4 rounded-2xl text-sm font-semibold flex items-start gap-3"
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
                          <InputOTPSlot index={0} className="w-12 h-16 text-2xl font-black rounded-2xl border-white/10 bg-white/5 text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/50 outline-none" />
                          <InputOTPSlot index={1} className="w-12 h-16 text-2xl font-black rounded-2xl border-white/10 bg-white/5 text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/50 outline-none" />
                          <InputOTPSlot index={2} className="w-12 h-16 text-2xl font-black rounded-2xl border-white/10 bg-white/5 text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/50 outline-none" />
                        </InputOTPGroup>
                        <div className="w-1" />
                        <InputOTPGroup className="gap-3">
                          <InputOTPSlot index={3} className="w-12 h-16 text-2xl font-black rounded-2xl border-white/10 bg-white/5 text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/50 outline-none" />
                          <InputOTPSlot index={4} className="w-12 h-16 text-2xl font-black rounded-2xl border-white/10 bg-white/5 text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/50 outline-none" />
                          <InputOTPSlot index={5} className="w-12 h-16 text-2xl font-black rounded-2xl border-white/10 bg-white/5 text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/50 outline-none" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    <div className="w-full space-y-6">
                      <Button
                        type="submit"
                        disabled={isLoading || otpToken.length !== 6}
                        className="group w-full bg-orange-600 text-white py-8 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-orange-500 active:scale-[0.98] transition-all duration-500 flex items-center justify-center disabled:opacity-50 disabled:active:scale-100 shadow-[0_20px_40px_-10px_rgba(249,115,22,0.4)] border-t border-white/20"
                      >
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        ) : (
                          <span className="flex items-center gap-3">
                            Authorize Entry <ShieldCheck className="h-4 w-4 group-hover:scale-110 transition-transform duration-300" />
                          </span>
                        )}
                      </Button>

                      <button
                        type="button"
                        onClick={() => setShow2FA(false)}
                        className="w-full text-slate-600 hover:text-white font-bold text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                      >
                        <ArrowRight className="h-3 w-3 rotate-180" /> Back to Authentication
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-8 text-center text-slate-700 text-[9px] font-black uppercase tracking-[0.4em]"
          >
            Secured by IQON Quantum Encryption
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
