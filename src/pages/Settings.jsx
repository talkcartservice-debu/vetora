import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authAPI, filesAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { 
  User, Lock, Bell, Camera, Loader2, 
  ChevronRight, LogOut, Shield, Smartphone,
  Globe, Moon, Mail, CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "@/components/providers/LanguageContext";

function SettingSection({ icon: Icon, title, description, children, active, onClick }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden mb-4 shadow-sm">
      <button 
        onClick={onClick}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">{description}</p>
          </div>
        </div>
        <ChevronRight className={`w-5 h-5 text-slate-300 transition-transform ${active ? "rotate-90" : ""}`} />
      </button>
      
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-50 dark:border-slate-800"
          >
            <div className="p-5 bg-slate-50/30 dark:bg-slate-800/20">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Settings() {
  const { user: currentUser, logout, checkUserAuth } = useAuth();
  const { lang: currentLang, setLang, SUPPORTED_LANGS, currentLangInfo } = useLang();
  const [activeSection, setActiveSection] = useState("profile");
  const queryClient = useQueryClient();

  const [profileData, setProfileData] = useState({
    username: currentUser?.username || "",
    display_name: currentUser?.display_name || "",
    bio: currentUser?.bio || "",
    avatar_url: currentUser?.avatar_url || "",
    banner_url: currentUser?.banner_url || ""
  });

  const [uploading, setUploading] = useState({ avatar: false, banner: false });

  // Password & Email update states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showEmailVerifyModal, setShowEmailVerifyModal] = useState(false);
  const [passForm, setPassForm] = useState({ current: "", new: "", confirm: "" });
  const [emailForm, setEmailForm] = useState({ newEmail: "", password: "" });

  // Phone update states
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showPhoneVerifyModal, setShowPhoneVerifyModal] = useState(false);
  const [phoneForm, setPhoneForm] = useState({ newPhone: "" });

  // 2FA Setup state
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState({ qrCode: "", secret: "" });
  const [otpToken, setOtpToken] = useState("");

  // Preference states
  const [notifications, setNotifications] = useState({
    notif_sales: currentUser?.notifications?.notif_sales ?? true,
    notif_msg: currentUser?.notifications?.notif_msg ?? true,
    notif_follow: currentUser?.notifications?.notif_follow ?? true,
    notif_live: currentUser?.notifications?.notif_live ?? false,
  });

  const [darkMode, setDarkMode] = useState(() => {
    if (currentUser?.preferences?.theme) {
      return currentUser.preferences.theme === 'dark';
    }
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  // Sync state with currentUser when it loads
  React.useEffect(() => {
    if (currentUser) {
      setProfileData({
        username: currentUser.username || "",
        display_name: currentUser.display_name || "",
        bio: currentUser.bio || "",
        avatar_url: currentUser.avatar_url || "",
        banner_url: currentUser.banner_url || ""
      });
      
      if (currentUser.notifications) {
        setNotifications({
          notif_sales: currentUser.notifications.notif_sales ?? true,
          notif_msg: currentUser.notifications.notif_msg ?? true,
          notif_follow: currentUser.notifications.notif_follow ?? true,
          notif_live: currentUser.notifications.notif_live ?? false,
        });
      }
      
      if (currentUser.preferences?.theme) {
        setDarkMode(currentUser.preferences.theme === 'dark');
      }
    }
  }, [currentUser]);

  // Theme effect
  React.useEffect(() => {
    const theme = darkMode ? "dark" : "light";
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("vetora_theme", theme);
    
    // Update preference if changed from user's current setting
    // Only if user is logged in
    if (currentUser && currentUser.preferences?.theme !== theme) {
      updateMutation.mutate({ preferences: { ...currentUser.preferences, theme } });
    }
  }, [darkMode, currentUser]);

  const handleNotificationToggle = (id) => {
    const newState = { ...notifications, [id]: !notifications[id] };
    setNotifications(newState);
    updateMutation.mutate({ notifications: newState });
  };

  const handleLanguageChange = (code) => {
    setLang(code);
    updateMutation.mutate({ preferences: { ...currentUser?.preferences, language: code } });
  };

  const handle2FAToggle = () => {
    setOtpToken("");
    if (currentUser?.is_2fa_enabled) {
      setShowDisable2FAModal(true);
    } else {
      setup2FAMutation.mutate();
    }
  };

  const setup2FAMutation = useMutation({
    mutationFn: () => authAPI.setup2FA(),
    onSuccess: (data) => {
      setTwoFactorData({ qrCode: data.qrCode, secret: data.secret });
      setShow2FAModal(true);
      setOtpToken("");
    },
    onError: (err) => toast.error(err.message || "Failed to initiate 2FA setup"),
  });

  const enable2FAMutation = useMutation({
    mutationFn: () => authAPI.enable2FA(otpToken),
    onSuccess: () => {
      toast.success("Two-factor authentication enabled!");
      setShow2FAModal(false);
      checkUserAuth();
      setOtpToken("");
    },
    onError: (err) => toast.error(err.message || "Invalid verification code"),
  });

  const disable2FAMutation = useMutation({
    mutationFn: () => authAPI.disable2FA(otpToken),
    onSuccess: () => {
      toast.success("Two-factor authentication disabled.");
      setShowDisable2FAModal(false);
      checkUserAuth();
      setOtpToken("");
    },
    onError: (err) => toast.error(err.message || "Invalid verification code"),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => authAPI.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      checkUserAuth();
      toast.success("Settings updated successfully!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update settings");
    }
  });

  const passMutation = useMutation({
    mutationFn: () => authAPI.updatePassword(passForm.current, passForm.new),
    onSuccess: () => {
      toast.success("Password updated successfully!");
      setShowPasswordModal(false);
      setPassForm({ current: "", new: "", confirm: "" });
    },
    onError: (err) => toast.error(err.message || "Failed to update password"),
  });

  const emailMutation = useMutation({
    mutationFn: () => authAPI.updateEmail(emailForm.newEmail, emailForm.password),
    onSuccess: () => {
      setOtpToken(""); // Clear OTP token for email verification
      toast.success("Verification code sent to your new email!");
      setShowEmailModal(false);
      setShowEmailVerifyModal(true);
    },
    onError: (err) => toast.error(err.message || "Failed to update email"),
  });

  const verifyEmailMutation = useMutation({
    mutationFn: (token) => authAPI.verifyEmail(emailForm.newEmail, token),
    onSuccess: () => {
      toast.success("Email updated and verified successfully!");
      setShowEmailVerifyModal(false);
      setEmailForm({ newEmail: "", password: "" });
      setOtpToken("");
      checkUserAuth();
    },
    onError: (err) => toast.error(err.message || "Invalid verification code"),
  });

  const phoneMutation = useMutation({
    mutationFn: () => authAPI.updatePhone(phoneForm.newPhone),
    onSuccess: () => {
      setOtpToken("");
      toast.success("Verification code sent to your phone via WhatsApp/SMS!");
      setShowPhoneModal(false);
      setShowPhoneVerifyModal(true);
    },
    onError: (err) => toast.error(err.message || "Failed to update phone number"),
  });

  const verifyPhoneMutation = useMutation({
    mutationFn: (token) => authAPI.verifyPhone(phoneForm.newPhone, token),
    onSuccess: () => {
      toast.success("Phone number updated and verified successfully!");
      setShowPhoneVerifyModal(false);
      setPhoneForm({ newPhone: "" });
      setOtpToken("");
      checkUserAuth();
    },
    onError: (err) => toast.error(err.message || "Invalid verification code"),
  });

  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      const res = await filesAPI.upload(file);
      if (res.url) {
        setProfileData(prev => ({ ...prev, [`${type}_url`]: res.url }));
        updateMutation.mutate({ [`${type}_url`]: res.url });
      }
    } catch (err) {
      toast.error(`Failed to upload ${type}`);
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleProfileSave = () => {
    updateMutation.mutate({
      username: profileData.username,
      display_name: profileData.display_name,
      bio: profileData.bio
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage your account and preferences</p>
      </div>

      {/* Profile Section */}
      <SettingSection 
        icon={User} 
        title="Public Profile" 
        description="Manage how others see you on Vetora"
        active={activeSection === "profile"}
        onClick={() => setActiveSection(activeSection === "profile" ? "" : "profile")}
      >
        <div className="space-y-6">
          <div className="flex flex-col gap-4">
            {/* Banner Upload */}
            <div className="relative h-32 w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 group">
              {profileData.banner_url ? (
                <img src={profileData.banner_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80" />
              )}
              <label className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                <div className="bg-white/20 backdrop-blur-md p-2 rounded-full border border-white/30">
                  {uploading.banner ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'banner')} disabled={uploading.banner} />
              </label>
              <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/40 backdrop-blur-md rounded-md border border-white/10">
                <p className="text-[9px] text-white font-bold uppercase tracking-wider">Profile Banner</p>
              </div>
            </div>

            {/* Avatar Upload */}
            <div className="flex flex-col items-center -mt-12 relative z-10">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 ring-4 ring-white dark:ring-slate-900 shadow-lg">
                  {profileData.avatar_url ? (
                    <img src={profileData.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 font-bold text-2xl">
                      {profileData.display_name?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                  {uploading.avatar && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center cursor-pointer hover:bg-indigo-700 transition-colors shadow-sm">
                  <Camera className="w-4 h-4 text-white" />
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'avatar')} disabled={uploading.avatar} />
                </label>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-2">Recommended: 400x400px JPG or PNG</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 ml-1">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">@</span>
                <Input 
                  value={profileData.username} 
                  onChange={e => setProfileData({...profileData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})}
                  placeholder="username"
                  className="rounded-xl border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-indigo-500 pl-8"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 ml-1">Your unique identifier on Vetora. Only lowercase letters, numbers, and underscores.</p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 ml-1">Display Name</label>
              <Input 
                value={profileData.display_name} 
                onChange={e => setProfileData({...profileData, display_name: e.target.value})}
                placeholder="Full name or nickname"
                className="rounded-xl border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 ml-1">Bio</label>
              <textarea 
                value={profileData.bio}
                onChange={e => setProfileData({...profileData, bio: e.target.value})}
                placeholder="Tell the community about yourself..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 focus:border-indigo-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm outline-none transition-all resize-none"
              />
              <p className="text-right text-[10px] text-slate-400 dark:text-slate-500 mt-1">{profileData.bio.length}/500</p>
            </div>
            <Button 
              onClick={handleProfileSave}
              disabled={updateMutation.isPending}
              className="w-full bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white rounded-xl h-11 font-semibold"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      </SettingSection>

      {/* Account Section */}
      <SettingSection 
        icon={Lock} 
        title="Account & Security" 
        description="Email, Password and 2FA settings"
        active={activeSection === "account"}
        onClick={() => setActiveSection(activeSection === "account" ? "" : "account")}
      >
        <div className="space-y-4">
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Email Address</p>
                <span className="text-[9px] font-black bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-600">PRIVATE</span>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{currentUser?.email}</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-indigo-600 dark:text-indigo-400 font-bold text-xs h-8 px-3 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
              onClick={() => setShowEmailModal(true)}
            >
              Change
            </Button>
          </div>
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Phone Number</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {currentUser?.phone_number || "Not set"}
                {currentUser?.is_phone_verified && (
                  <span className="ml-2 text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full border border-green-100">Verified</span>
                )}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-indigo-600 dark:text-indigo-400 font-bold text-xs h-8 px-3 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
              onClick={() => setShowPhoneModal(true)}
            >
              {currentUser?.phone_number ? "Change" : "Add"}
            </Button>
          </div>
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Password</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">••••••••••••</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-indigo-600 dark:text-indigo-400 font-bold text-xs h-8 px-3 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
              onClick={() => setShowPasswordModal(true)}
            >
              Update
            </Button>
          </div>
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100">Two-Factor Authentication</h4>
              <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mb-2 leading-relaxed">Add an extra layer of security to your account by requiring a code from your phone to login.</p>
              <Button 
                size="sm" 
                onClick={handle2FAToggle}
                disabled={updateMutation.isPending}
                className={`${currentUser?.is_2fa_enabled ? "bg-red-500 hover:bg-red-600" : "bg-indigo-600 hover:bg-indigo-700"} text-white rounded-lg h-8 text-[10px] font-bold px-3`}
              >
                {currentUser?.is_2fa_enabled ? "Disable 2FA" : "Enable 2FA"}
              </Button>
            </div>
          </div>
        </div>

        {/* Change Password Dialog */}
        <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader><DialogTitle>Update Password</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input 
                type="password" 
                placeholder="Current Password" 
                value={passForm.current}
                onChange={e => setPassForm({...passForm, current: e.target.value})}
              />
              <Input 
                type="password" 
                placeholder="New Password" 
                value={passForm.new}
                onChange={e => setPassForm({...passForm, new: e.target.value})}
              />
              <Input 
                type="password" 
                placeholder="Confirm New Password" 
                value={passForm.confirm}
                onChange={e => setPassForm({...passForm, confirm: e.target.value})}
              />
              <Button 
                className="w-full bg-slate-900 hover:bg-slate-800 rounded-xl"
                disabled={!passForm.current || !passForm.new || passForm.new !== passForm.confirm || passMutation.isPending}
                onClick={() => passMutation.mutate()}
              >
                {passMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Update Password"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Change Email Dialog */}
        <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader><DialogTitle>Change Email Address</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input 
                type="email" 
                placeholder="New Email Address" 
                value={emailForm.newEmail}
                onChange={e => setEmailForm({...emailForm, newEmail: e.target.value})}
              />
              <Input 
                type="password" 
                placeholder="Current Password" 
                value={emailForm.password}
                onChange={e => setEmailForm({...emailForm, password: e.target.value})}
              />
              <Button 
                className="w-full bg-slate-900 hover:bg-slate-800 rounded-xl"
                disabled={!emailForm.newEmail || !emailForm.password || emailMutation.isPending}
                onClick={() => emailMutation.mutate()}
              >
                {emailMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Change Email"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </SettingSection>

      {/* Notifications */}
      <SettingSection 
        icon={Bell} 
        title="Notifications" 
        description="Choose what you want to be notified about"
        active={activeSection === "notifications"}
        onClick={() => setActiveSection(activeSection === "notifications" ? "" : "notifications")}
      >
        <div className="space-y-2">
          {[
            { id: "notif_sales", label: "Sales & Orders", icon: CreditCard },
            { id: "notif_msg", label: "Direct Messages", icon: Mail },
            { id: "notif_follow", label: "New Followers", icon: User },
            { id: "notif_live", label: "Live Streams", icon: Smartphone },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 dark:text-slate-500">
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.label}</span>
              </div>
              <div 
                onClick={() => handleNotificationToggle(item.id)}
                className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors shadow-inner ${notifications[item.id] ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${notifications[item.id] ? "right-0.5" : "left-0.5"}`} />
              </div>
            </div>
          ))}
        </div>
      </SettingSection>

      {/* Preferences */}
      <SettingSection 
        icon={Globe} 
        title="Preferences" 
        description="Language, Theme and Regional settings"
        active={activeSection === "preferences"}
        onClick={() => setActiveSection(activeSection === "preferences" ? "" : "preferences")}
      >
        <div className="space-y-3">
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Language</span>
              </div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg">
                {currentLangInfo?.flag} {currentLangInfo?.label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => handleLanguageChange(l.code)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                    currentLang === l.code 
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" 
                      : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-indigo-200 dark:hover:border-indigo-800 hover:text-indigo-600 dark:hover:text-indigo-400"
                  }`}
                >
                  {l.flag} {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <Moon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Dark Mode</span>
            </div>
            <div 
              onClick={() => setDarkMode(!darkMode)}
              className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${darkMode ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-700"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${darkMode ? "right-0.5" : "left-0.5"}`} />
            </div>
          </div>
        </div>
      </SettingSection>

      {/* Logout / Dangerous Zone */}
      <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800">
        <Button 
          variant="outline"
          onClick={() => logout()}
          className="w-full border-red-100 dark:border-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 rounded-xl h-11 font-bold transition-all"
        >
          <LogOut className="w-4 h-4 mr-2" /> Log Out of Vetora
        </Button>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-6">
          Vetora Platform v2.4.0 • Build 2026.03.20<br/>
          &copy; 2026 Vetora Inc. All rights reserved.
        </p>
      </div>

      {/* 2FA Setup Modal */}
      <Dialog open={show2FAModal} onOpenChange={setShow2FAModal}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code below with your authenticator app (like Google Authenticator or Authy).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-6 py-4">
            {twoFactorData.qrCode && (
              <div className="p-4 bg-white rounded-2xl border-4 border-slate-50 shadow-inner">
                <img src={twoFactorData.qrCode} alt="QR Code" className="w-48 h-48" />
              </div>
            )}
            <div className="space-y-2 text-center">
              <p className="text-xs font-bold text-slate-500 uppercase">Verification Code</p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otpToken} onChange={setOtpToken}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11"
              disabled={otpToken.length !== 6 || enable2FAMutation.isPending}
              onClick={() => enable2FAMutation.mutate()}
            >
              {enable2FAMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Verify and Enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Disable Modal */}
      <Dialog open={showDisable2FAModal} onOpenChange={setShowDisable2FAModal}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Disable 2FA</DialogTitle>
            <DialogDescription>
              Enter the 6-digit code from your authenticator app to disable 2FA.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <InputOTP maxLength={6} value={otpToken} onChange={setOtpToken}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <DialogFooter>
            <Button 
              variant="destructive"
              className="w-full rounded-xl h-11 font-bold"
              disabled={otpToken.length !== 6 || disable2FAMutation.isPending}
              onClick={() => disable2FAMutation.mutate()}
            >
              {disable2FAMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Confirm Disable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Verification Code Modal */}
      <Dialog open={showEmailVerifyModal} onOpenChange={setShowEmailVerifyModal}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Verify Your New Email</DialogTitle>
            <DialogDescription>
              We've sent a 6-digit verification code to <strong>{emailForm.newEmail}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <InputOTP maxLength={6} value={otpToken} onChange={setOtpToken}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <DialogFooter>
            <Button 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11"
              disabled={otpToken.length !== 6 || verifyEmailMutation.isPending}
              onClick={() => verifyEmailMutation.mutate(otpToken)}
            >
              {verifyEmailMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Verify Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Phone Modal */}
      <Dialog open={showPhoneModal} onOpenChange={setShowPhoneModal}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle>Update Phone Number</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">New Phone Number (WhatsApp)</label>
              <Input 
                type="tel" 
                placeholder="+1234567890" 
                value={phoneForm.newPhone}
                onChange={e => setPhoneForm({...phoneForm, newPhone: e.target.value})}
                className="rounded-xl border-slate-200 dark:border-slate-800 dark:bg-slate-900"
              />
              <p className="text-[10px] text-slate-400 ml-1">Include country code (e.g., +1 for US, +234 for NG)</p>
            </div>
            <Button 
              className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 rounded-xl h-11 font-bold"
              disabled={!phoneForm.newPhone || phoneForm.newPhone.length < 10 || phoneMutation.isPending}
              onClick={() => phoneMutation.mutate()}
            >
              {phoneMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Send Verification Code"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Phone Verification Code Modal */}
      <Dialog open={showPhoneVerifyModal} onOpenChange={setShowPhoneVerifyModal}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Verify Your Phone</DialogTitle>
            <DialogDescription>
              Enter the 6-digit code sent to <strong>{phoneForm.newPhone}</strong> via WhatsApp/SMS.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <InputOTP maxLength={6} value={otpToken} onChange={setOtpToken}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <DialogFooter>
            <Button 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 font-bold"
              disabled={otpToken.length !== 6 || verifyPhoneMutation.isPending}
              onClick={() => verifyPhoneMutation.mutate(otpToken)}
            >
              {verifyPhoneMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Verify and Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
