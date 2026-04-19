import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getRedirectPath } from '@/lib/utils';
import { Mail, Lock, User, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/layout/Logo";
import { useEffect } from 'react';

const MemoizedBackground = React.memo(() => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,17,19,1)_0%,rgba(0,0,0,1)_100%)]" />
    
    {/* Animated Mesh Gradients */}
    <motion.div 
      animate={{ 
        scale: [1.2, 1, 1.2],
        x: [0, -100, 0],
        y: [0, -50, 0],
      }}
      transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] bg-indigo-600/10 rounded-full blur-[120px]"
    />
    <motion.div 
      animate={{ 
        scale: [1, 1.2, 1],
        x: [0, 120, 0],
        y: [0, 80, 0],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -bottom-[20%] -left-[10%] w-[70%] h-[70%] bg-orange-600/10 rounded-full blur-[120px]"
    />
    
    {/* Subtle Grid Pattern */}
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
  </div>
));

const Register = () => {
  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    email: '',
    password: '',
    confirm_password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();

  // Cleanup effect to prevent selection errors during unmount
  useEffect(() => {
    return () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
  }, []);

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setError('Google sign-up failed: no credential received. Please try again.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await googleLogin(credentialResponse.credential);
      navigate(getRedirectPath(res.user));
    } catch (err) {
      setError(err.message || 'Google sign-up failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = (err) => {
    console.error('Google OAuth error:', err);
    setError('Google sign-up failed. Make sure pop-ups are not blocked and try again.');
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirm_password) {
      return setError('Passwords do not match');
    }

    if (!formData.username || formData.username.length < 3) {
      return setError('Username must be at least 3 characters');
    }

    setIsLoading(true);
    try {
      const res = await register({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        display_name: formData.display_name
      });
      navigate(getRedirectPath(res.user));
    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center bg-[#0a0a0c] selection:bg-orange-500/30 selection:text-orange-200 overflow-hidden font-sans">
      <MemoizedBackground />

      <div className="container relative z-10 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24 px-6 max-w-7xl mx-auto py-12">
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
              JOIN THE <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600">EVOLUTION.</span>
            </h1>
            <p className="text-xl text-slate-400 font-medium leading-relaxed max-w-md">
              Secure your spot in the future of social commerce. Create your unique identity and start building today.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 font-black">01</div>
              <div>
                <div className="text-white font-bold text-sm uppercase tracking-tight">Create Identity</div>
                <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Setup your handle & profile</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-black">02</div>
              <div>
                <div className="text-white font-bold text-sm uppercase tracking-tight">Showcase Assets</div>
                <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">List your products & content</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Register Form Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-2xl"
        >
          <div className="bg-white/[0.02] backdrop-blur-3xl p-8 sm:p-10 rounded-[3rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.7)] border border-white/10 ring-1 ring-white/5 relative overflow-hidden group">
            {/* Subtle light sweep animation */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
            
            <div className="space-y-8">
              <div className="text-center lg:text-left space-y-4 lg:hidden">
                <Logo 
                  size="lg" 
                  className="flex-col !gap-6 mx-auto" 
                  subtext="Join the Aicon X Network" 
                  showDecoration={true} 
                />
              </div>
              
              <div className="hidden lg:block space-y-2 text-center lg:text-left">
                <h2 className="text-4xl font-black text-white tracking-tighter">Create Identity</h2>
                <p className="text-slate-500 font-medium text-sm">Join the next generation of social commerce</p>
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

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="display_name" className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Full Name</Label>
                    <div className="relative group">
                      <Input
                        id="display_name"
                        type="text"
                        name="display_name"
                        value={formData.display_name}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-7 rounded-2xl border-white/5 bg-white/[0.03] text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/40 focus:bg-white/[0.05] outline-none transition-all duration-300 font-bold group-hover:border-white/10 placeholder:text-slate-700 placeholder:font-medium"
                        placeholder=""
                        required
                      />
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-600 group-focus-within:text-orange-500 transition-colors duration-300" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Unique Handle</Label>
                    <div className="relative group">
                      <Input
                        id="username"
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                        className="w-full pl-12 pr-4 py-7 rounded-2xl border-white/5 bg-white/[0.03] text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/40 focus:bg-white/[0.05] outline-none transition-all duration-300 font-bold group-hover:border-white/10 placeholder:text-slate-700 placeholder:font-medium"
                        placeholder="handle"
                        required
                        minLength={3}
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-600 group-focus-within:text-orange-500 transition-colors duration-300">@</span>
                    </div>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="email" className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Email Address</Label>
                    <div className="relative group">
                      <Input
                        id="email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-7 rounded-2xl border-white/5 bg-white/[0.03] text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/40 focus:bg-white/[0.05] outline-none transition-all duration-300 font-bold group-hover:border-white/10 placeholder:text-slate-700 placeholder:font-medium"
                        placeholder="hello@iqon.network"
                        required
                      />
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-600 group-focus-within:text-orange-500 transition-colors duration-300" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Secret Key</Label>
                    <div className="relative group">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full pl-12 pr-12 py-7 rounded-2xl border-white/5 bg-white/[0.03] text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/40 focus:bg-white/[0.05] outline-none transition-all duration-300 font-bold group-hover:border-white/10 placeholder:text-slate-700 placeholder:font-medium"
                        placeholder="••••••••"
                        required
                        minLength={6}
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

                  <div className="space-y-2">
                    <Label htmlFor="confirm_password" className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Confirm Key</Label>
                    <div className="relative group">
                      <Input
                        id="confirm_password"
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirm_password"
                        value={formData.confirm_password}
                        onChange={handleChange}
                        className="w-full pl-12 pr-12 py-7 rounded-2xl border-white/5 bg-white/[0.03] text-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/40 focus:bg-white/[0.05] outline-none transition-all duration-300 font-bold group-hover:border-white/10 placeholder:text-slate-700 placeholder:font-medium"
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-600 group-focus-within:text-orange-500 transition-colors duration-300" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-orange-500 transition-colors duration-300 focus:outline-none h-10 w-10 hover:bg-white/5 rounded-xl"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </Button>
                    </div>
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
                      Initialize Identity <ArrowRight className="h-4 w-4 group-hover:translate-x-1.5 transition-transform duration-300" />
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
                      text="signup_with"
                      theme="filled_blue"
                      shape="circle"
                      size="large"
                    />
                  </div>
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.15em] group-hover:text-orange-400 transition-colors">Google</span>
                </div>
              </div>

              <div className="pt-6 text-center">
                <p className="text-slate-600 font-bold text-xs uppercase tracking-tight">
                  Already part of the network?{' '}
                  <Link to="/login" className="text-orange-500 hover:text-orange-400 font-black transition-colors relative group/link">
                    Sign In
                    <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-orange-500 scale-x-0 group-hover/link:scale-x-100 transition-transform duration-300 origin-left" />
                  </Link>
                </p>
              </div>
            </div>
          </div>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-8 text-center text-slate-700 text-[9px] font-black uppercase tracking-[0.4em]"
          >
            Powered by Aicon X Decentralized Protocol
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
