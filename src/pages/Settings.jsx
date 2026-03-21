import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authAPI, filesAPI } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { 
  User, Lock, Bell, MapPin, Camera, Loader2, 
  ChevronRight, LogOut, Shield, Smartphone,
  Globe, Moon, Mail, CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

function SettingSection({ icon: Icon, title, description, children, active, onClick }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-4 shadow-sm">
      <button 
        onClick={onClick}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-400">{description}</p>
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
            className="overflow-hidden border-t border-slate-50"
          >
            <div className="p-5 bg-slate-50/30">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Settings() {
  const { user: currentUser, logout } = useAuth();
  const [activeSection, setActiveSection] = useState("profile");
  const queryClient = useQueryClient();

  const [profileData, setProfileData] = useState({
    display_name: currentUser?.display_name || "",
    bio: currentUser?.bio || "",
    avatar_url: currentUser?.avatar_url || "",
    banner_url: currentUser?.banner_url || ""
  });

  const [uploading, setUploading] = useState({ avatar: false, banner: false });

  const updateMutation = useMutation({
    mutationFn: (data) => authAPI.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      toast.success("Settings updated successfully!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update settings");
    }
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
      display_name: profileData.display_name,
      bio: profileData.bio
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-black text-slate-900 mb-1">Settings</h1>
        <p className="text-sm text-slate-500">Manage your account and preferences</p>
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
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 ring-4 ring-white shadow-md">
                {profileData.avatar_url ? (
                  <img src={profileData.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-500 font-bold text-2xl">
                    {profileData.display_name?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
                {uploading.avatar && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 rounded-full border-2 border-white flex items-center justify-center cursor-pointer hover:bg-indigo-700 transition-colors shadow-sm">
                <Camera className="w-4 h-4 text-white" />
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'avatar')} />
              </label>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Recommended: 400x400px JPG or PNG</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5 ml-1">Display Name</label>
              <Input 
                value={profileData.display_name} 
                onChange={e => setProfileData({...profileData, display_name: e.target.value})}
                placeholder="Full name or nickname"
                className="rounded-xl border-slate-200 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5 ml-1">Bio</label>
              <textarea 
                value={profileData.bio}
                onChange={e => setProfileData({...profileData, bio: e.target.value})}
                placeholder="Tell the community about yourself..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 focus:border-indigo-500 bg-white px-3 py-2 text-sm outline-none transition-all resize-none"
              />
              <p className="text-right text-[10px] text-slate-400 mt-1">{profileData.bio.length}/160</p>
            </div>
            <Button 
              onClick={handleProfileSave}
              disabled={updateMutation.isPending}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 font-semibold"
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
          <div className="p-3 bg-white rounded-xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</p>
              <p className="text-sm font-semibold text-slate-900">{currentUser?.email}</p>
            </div>
            <Button variant="ghost" size="sm" className="text-indigo-600 font-bold text-xs h-8 px-3 rounded-lg hover:bg-indigo-50">Change</Button>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password</p>
              <p className="text-sm font-semibold text-slate-900">••••••••••••</p>
            </div>
            <Button variant="ghost" size="sm" className="text-indigo-600 font-bold text-xs h-8 px-3 rounded-lg hover:bg-indigo-50">Update</Button>
          </div>
          <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-indigo-900">Two-Factor Authentication</h4>
              <p className="text-xs text-indigo-600/70 mb-2 leading-relaxed">Add an extra layer of security to your account by requiring a code from your phone to login.</p>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-8 text-[10px] font-bold px-3">Enable 2FA</Button>
            </div>
          </div>
        </div>
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
            <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold text-slate-700">{item.label}</span>
              </div>
              <div className="w-10 h-5 bg-indigo-600 rounded-full relative cursor-pointer shadow-inner">
                <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
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
          <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">Language</span>
            </div>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">English (US)</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <Moon className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">Dark Mode</span>
            </div>
            <div className="w-10 h-5 bg-slate-200 rounded-full relative cursor-pointer">
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
            </div>
          </div>
        </div>
      </SettingSection>

      {/* Logout / Dangerous Zone */}
      <div className="mt-12 pt-8 border-t border-slate-100">
        <Button 
          variant="outline"
          onClick={() => logout()}
          className="w-full border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl h-11 font-bold transition-all"
        >
          <LogOut className="w-4 h-4 mr-2" /> Log Out of Vetora
        </Button>
        <p className="text-[10px] text-slate-400 text-center mt-6">
          Vetora Platform v2.4.0 • Build 2026.03.20<br/>
          &copy; 2026 Vetora Inc. All rights reserved.
        </p>
      </div>
    </div>
  );
}
