import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/AuthContext';
import { getRedirectPath } from '@/lib/utils';
import { Mail, Lock, User, Loader2, ArrowRight, Eye, EyeOff, Sun, Moon, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/layout/Logo";
import { useTheme } from 'next-themes';
import { toast } from '@/components/ui/use-toast';
import { AnimatePresence } from 'framer-motion';

const MemoizedBackground = React.memo(() => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute inset-0 dark:bg-[radial-gradient(circle_at_50%_50%,rgba(17,17,19,1)_0%,rgba(0,0,0,1)_100%)] bg-gradient-to-br from-indigo-50/40 via-slate-50 to-orange-50/30" />

    <motion.div
      animate={{ scale: [1.2, 1, 1.2], x: [0, -100, 0], y: [0, -50, 0] }}
      transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] dark:bg-indigo-600/10 bg-indigo-400/15 rounded-full blur-[120px]"
    />
    <motion.div
      animate={{ scale: [1, 1.2, 1], x: [0, 120, 0], y: [0, 80, 0] }}
      transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -bottom-[20%] -left-[10%] w-[70%] h-[70%] dark:bg-orange-600/10 bg-orange-400/20 rounded-full blur-[120px]"
    />

    <div className="absolute inset-0 dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
  </div>
));

const PasswordStrength = ({ password }) => {
  const checks = [
    { label: '6+ chars', pass: password.length >= 6 },
    { label: 'Uppercase', pass: /[A-Z]/.test(password) },
    { label: 'Number', pass: /\d/.test(password) },
  ];
  if (!password) return null;
  return (
    <div className="flex gap-2 mt-1.5">
      {checks.map((c) => (
        <div key={c.label} className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider transition-colors ${c.pass ? 'text-emerald-500' : 'dark:text-slate-600 text-slate-400'}`}>
          <div className={`h-1 w-6 rounded-full transition-colors ${c.pass ? 'bg-emerald-500' : 'dark:bg-white/10 bg-slate-200'}`} />
          {c.label}
        </div>
      ))}
    </div>
  );
};

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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { register, googleLogin } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();

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
      toast({ title: "Google sign-up failed", description: "No credential received. Please try again.", variant: "destructive" });
      return;
    }
    setIsGoogleLoading(true);
    setError('');
    try {
      const res = await googleLogin(credentialResponse.credential);
      toast({ title: "Account created!", description: "Welcome aboard. Google sign-up successful.", variant: "success" });
      navigate(getRedirectPath(res.user));
    } catch (err) {
      const msg = err.message || 'Google sign-up failed. Please try again.';
      setError(msg);
      toast({ title: "Google sign-up failed", description: msg, variant: "destructive" });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleError = (err) => {
    console.error('Google OAuth error:', err);
    const msg = 'Google sign-up failed. Make sure pop-ups are not blocked and try again.';
    setError(msg);
    toast({ title: "Google sign-up failed", description: msg, variant: "destructive" });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirm_password) {
      const msg = 'Passwords do not match';
      setError(msg);
      toast({ title: "Passwords don't match", description: "Please make sure both password fields are identical.", variant: "destructive" });
      return;
    }

    if (!formData.username || formData.username.length < 3) {
      const msg = 'Username must be at least 3 characters';
      setError(msg);
      toast({ title: "Username too short", description: "Your handle must be at least 3 characters long.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const res = await register({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        display_name: formData.display_name
      });
      toast({ title: "Welcome aboard!", description: "Your account has been created successfully.", variant: "success" });
      navigate(getRedirectPath(res.user));
    } catch (err) {
      const msg = err.message || 'Failed to create account. Please try again.';
      setError(msg);
      toast({ title: "Registration failed", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full pl-12 pr-4 py-6 sm:py-7 rounded-2xl dark:border-white/5 border-slate-200 dark:bg-white/[0.03] bg-slate-50 dark:text-white text-slate-900 focus:ring-4 dark:focus:ring-orange-500/10 focus:ring-orange-500/15 dark:focus:border-orange-500/40 focus:border-orange-400 dark:focus:bg-white/[0.05] focus:bg-white outline-none transition-all duration-300 font-bold dark:group-hover:border-white/10 group-hover:border-slate-300 dark:placeholder:text-slate-700 placeholder:text-slate-400 placeholder:font-medium";
  const iconClass = "absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 dark:text-slate-600 text-slate-400 group-focus-within:text-orange-500 transition-colors duration-300";
  const labelClass = "text-[10px] font-black dark:text-slate-500 text-slate-500 uppercase tracking-[0.2em] ml-1";

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center dark:bg-[#0a0a0c] bg-slate-50 selection:bg-orange-500/30 selection:text-orange-200 overflow-hidden font-sans transition-colors duration-300">
      <MemoizedBackground />

      <div className="absolute top-4 right-4 z-20">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="h-10 w-10 rounded-full dark:bg-white/5 bg-white/90 dark:hover:bg-white/10 hover:bg-white dark:text-slate-400 text-slate-600 dark:border-white/10 border-slate-200 border backdrop-blur-sm shadow-sm transition-all duration-300"
        >
          {resolvedTheme === 'dark'
            ? <Sun className="h-4 w-4" />
            : <Moon className="h-4 w-4" />
          }
        </Button>
      </div>

      <div className="container relative z-10 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-20 px-4 sm:px-6 max-w-7xl mx-auto py-10 lg:py-14">

        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:flex flex-col space-y-8 max-w-lg shrink-0"
        >
          <div className="space-y-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <Logo size="lg" showText={false} className="!gap-0" />
            </motion.div>
            <h1 className="text-6xl xl:text-7xl font-black dark:text-white text-slate-900 tracking-tighter leading-[0.85]">
              JOIN THE <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600">EVOLUTION.</span>
            </h1>
            <p className="text-lg xl:text-xl dark:text-slate-400 text-slate-600 font-medium leading-relaxed max-w-md">
              Secure your spot in the future of social commerce. Create your unique identity and start building today.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { num: '01', color: 'orange', title: 'Create Identity', sub: 'Setup your handle & profile' },
              { num: '02', color: 'indigo', title: 'Showcase Assets', sub: 'List your products & content' },
              { num: '03', color: 'emerald', title: 'Grow & Earn', sub: 'Connect with your audience' },
            ].map(({ num, color, title, sub }) => (
              <motion.div
                key={num}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + parseInt(num) * 0.1 }}
                className="flex items-center gap-4 p-4 rounded-2xl dark:bg-white/[0.02] bg-white/60 dark:border-white/5 border border-slate-200/80 backdrop-blur-sm"
              >
                <div className={`w-12 h-12 rounded-xl bg-${color}-500/10 flex items-center justify-center text-${color}-500 font-black shrink-0`}>{num}</div>
                <div>
                  <div className="dark:text-white text-slate-900 font-bold text-sm uppercase tracking-tight">{title}</div>
                  <div className="dark:text-slate-500 text-slate-500 text-[10px] font-bold uppercase tracking-widest">{sub}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-xl lg:max-w-2xl"
        >
          <div className="dark:bg-white/[0.02] bg-white dark:backdrop-blur-3xl backdrop-blur-xl p-6 sm:p-10 rounded-3xl sm:rounded-[3rem] dark:shadow-[0_32px_128px_-16px_rgba(0,0,0,0.7)] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.08)] dark:border dark:border-white/10 border border-slate-200/80 dark:ring-1 dark:ring-white/5 relative overflow-hidden group transition-colors duration-300">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent dark:via-white/[0.03] via-orange-500/[0.01] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

            <div className="space-y-6 sm:space-y-8">
              <div className="text-center lg:text-left space-y-4 lg:hidden">
                <Logo
                  size="lg"
                  className="flex-col !gap-6 mx-auto"
                  subtext="Join the Network"
                  showDecoration={true}
                />
              </div>

              <div className="hidden lg:block space-y-2">
                <h2 className="text-3xl sm:text-4xl font-black dark:text-white text-slate-900 tracking-tighter">{t("auth.registerTitle")}</h2>
                <p className="dark:text-slate-500 text-slate-500 font-medium text-sm">{t("auth.registerSubtitle")}</p>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="dark:bg-rose-500/10 bg-rose-50 dark:border dark:border-rose-500/20 border border-rose-200 dark:text-rose-400 text-rose-700 px-4 py-3 rounded-2xl text-sm font-semibold flex items-start gap-3"
                  >
                    <div className="h-2 w-2 rounded-full bg-rose-500 mt-1.5 shrink-0 animate-pulse" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="display_name" className={labelClass}>Full Name</Label>
                    <div className="relative group">
                      <Input
                        id="display_name"
                        type="text"
                        name="display_name"
                        value={formData.display_name}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="Your name"
                        required
                        autoComplete="name"
                      />
                      <User className={iconClass} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="username" className={labelClass}>Unique Handle</Label>
                    <div className="relative group">
                      <Input
                        id="username"
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                        className={`${inputClass} pl-10`}
                        placeholder="handle"
                        required
                        minLength={3}
                        autoComplete="username"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black dark:text-slate-600 text-slate-400 group-focus-within:text-orange-500 transition-colors duration-300">@</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="email" className={labelClass}>Email Address</Label>
                    <div className="relative group">
                      <Input
                        id="email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="hello@example.com"
                        required
                        autoComplete="email"
                      />
                      <Mail className={iconClass} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className={labelClass}>Secret Key</Label>
                    <div className="relative group">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className={`${inputClass} pr-12`}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        autoComplete="new-password"
                      />
                      <Lock className={iconClass} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 dark:text-slate-600 text-slate-400 hover:text-orange-500 transition-colors duration-300 focus:outline-none h-10 w-10 dark:hover:bg-white/5 hover:bg-slate-100 rounded-xl"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </Button>
                    </div>
                    <PasswordStrength password={formData.password} />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm_password" className={labelClass}>Confirm Key</Label>
                    <div className="relative group">
                      <Input
                        id="confirm_password"
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirm_password"
                        value={formData.confirm_password}
                        onChange={handleChange}
                        className={`${inputClass} pr-12`}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        autoComplete="new-password"
                      />
                      <Lock className={iconClass} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 dark:text-slate-600 text-slate-400 hover:text-orange-500 transition-colors duration-300 focus:outline-none h-10 w-10 dark:hover:bg-white/5 hover:bg-slate-100 rounded-xl"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </Button>
                    </div>
                    {formData.confirm_password && (
                      <div className={`flex items-center gap-1.5 mt-1.5 text-[9px] font-black uppercase tracking-wider transition-colors ${formData.password === formData.confirm_password ? 'text-emerald-500' : 'text-rose-500'}`}>
                        <CheckCircle2 className="h-3 w-3" />
                        {formData.password === formData.confirm_password ? 'Passwords match' : 'Passwords do not match'}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="group w-full bg-orange-600 text-white py-7 sm:py-8 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-orange-500 active:scale-[0.98] transition-all duration-300 flex items-center justify-center disabled:opacity-70 disabled:active:scale-100 shadow-[0_20px_40px_-10px_rgba(249,115,22,0.4)] hover:shadow-[0_20px_40px_-10px_rgba(249,115,22,0.6)] border-t border-white/20"
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
                  <span className="w-full border-t dark:border-white/5 border-slate-200"></span>
                </div>
                <div className="relative flex justify-center text-[9px] uppercase tracking-[0.3em]">
                  <span className="dark:bg-[#0a0a0c] bg-white px-4 py-1 rounded-full dark:text-slate-600 text-slate-500 font-black dark:border dark:border-white/5 border border-slate-200">Instant Access</span>
                </div>
              </div>

              <div className="flex justify-center gap-8 items-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <div className={`hover:scale-110 transition-transform duration-300 ${isGoogleLoading ? 'pointer-events-none' : ''}`}>
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
                    <AnimatePresence>
                      {isGoogleLoading && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                          className="absolute inset-0 flex items-center justify-center rounded-full bg-[#1a73e8]"
                        >
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-[0.15em] transition-colors ${isGoogleLoading ? 'text-orange-400' : 'dark:text-slate-600 text-slate-500'}`}>
                    {isGoogleLoading ? 'Signing up...' : 'Google'}
                  </span>
                </div>
              </div>

              <div className="pt-2 text-center">
                <p className="dark:text-slate-600 text-slate-500 font-bold text-xs uppercase tracking-tight">
                  {t("auth.haveAccount")}{' '}
                  <Link to="/login" className="text-orange-500 hover:text-orange-400 font-black transition-colors relative group/link">
                    {t("auth.signInLink")}
                    <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-orange-500 scale-x-0 group-hover/link:scale-x-100 transition-transform duration-300 origin-left" />
                  </Link>
                </p>
              </div>
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-center dark:text-slate-700 text-slate-400 text-[9px] font-black uppercase tracking-[0.4em]"
          >
            Powered by Aicon X Decentralized Protocol
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
