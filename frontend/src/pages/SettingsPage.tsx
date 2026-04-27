import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Mail, Lock, Shield, Bell, Eye, EyeOff, 
  Save, Loader2, CheckCircle, AlertCircle 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';

export default function SettingsPage() {
  const { user, login } = useAuth(); // login here is actually used to refresh the local user state with a new token
  
  // Profile state
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail]       = useState(user?.email || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError]     = useState('');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [showCurrent, setShowCurrent]         = useState(false);
  const [showNew, setShowNew]                 = useState(false);
  const [passLoading, setPassLoading]         = useState(false);
  const [passSuccess, setPassSuccess]         = useState(false);
  const [passError, setPassError]             = useState('');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true); setProfileError(''); setProfileSuccess(false);
    try {
      const response = await userService.updateProfile(username, email);
      login(response.token, response.username, response.email, response.streakCount, response.aiConfidence);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.details) {
        // Flatten validation details map into a single string
        const msgs = Object.values(data.details).join(' · ');
        setProfileError(msgs);
      } else {
        setProfileError(data?.error || 'Failed to update profile');
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassLoading(true); setPassError(''); setPassSuccess(false);
    try {
      await userService.updatePassword(currentPassword, newPassword);
      setPassSuccess(true);
      setCurrentPassword(''); setNewPassword('');
      setTimeout(() => setPassSuccess(false), 3000);
    } catch (err: any) {
      setPassError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: '#00ff9d', letterSpacing: '0.1em' }}>CONFIGURATION</p>
        <h1 className="text-2xl font-bold text-white">Account Settings</h1>
        <p className="text-sm mt-1" style={{ color: '#5a5a5a' }}>Manage your profile, security, and application preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Profile Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(0,255,157,0.1)', border: '1px solid rgba(0,255,157,0.2)' }}>
              <User className="w-5 h-5" style={{ color: '#00ff9d' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Profile Details</h2>
              <p className="text-xs" style={{ color: '#3a3a3a' }}>Public information</p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: '#5a5a5a' }}>Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#3a3a3a' }} />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="input-field pl-9"
                  placeholder="Username"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: '#5a5a5a' }}>Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#3a3a3a' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field pl-9"
                  placeholder="email@university.edu"
                />
              </div>
            </div>

            {profileError && (
              <div className="flex items-center gap-2 text-xs text-red-400 p-3 rounded-lg" 
                   style={{ background: 'rgba(255,80,80,0.05)', border: '1px solid rgba(255,80,80,0.15)' }}>
                <AlertCircle className="w-3.5 h-3.5" />
                {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="flex items-center gap-2 text-xs text-green-400 p-3 rounded-lg" 
                   style={{ background: 'rgba(0,255,157,0.05)', border: '1px solid rgba(0,255,157,0.15)' }}>
                <CheckCircle className="w-3.5 h-3.5" />
                Profile updated successfully
              </div>
            )}

            <button
              type="submit"
              disabled={profileLoading}
              className="btn-primary w-full py-2.5 mt-2 gap-2"
            >
              {profileLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Profile
            </button>
          </form>
        </motion.div>

        {/* Security Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(162, 89, 255, 0.1)', border: '1px solid rgba(162, 89, 255, 0.2)' }}>
              <Shield className="w-5 h-5" style={{ color: '#a259ff' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Security</h2>
              <p className="text-xs" style={{ color: '#3a3a3a' }}>Credentials and safety</p>
            </div>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: '#5a5a5a' }}>Current Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#3a3a3a' }} />
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="input-field px-9"
                  placeholder="••••••••"
                />
                <button 
                  type="button" 
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4 text-[#3a3a3a]" /> : <Eye className="w-4 h-4 text-[#3a3a3a]" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: '#5a5a5a' }}>New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#3a3a3a' }} />
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="input-field px-9"
                  placeholder="Minimum 8 characters"
                />
                <button 
                  type="button" 
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showNew ? <EyeOff className="w-4 h-4 text-[#3a3a3a]" /> : <Eye className="w-4 h-4 text-[#3a3a3a]" />}
                </button>
              </div>
            </div>

            {passError && (
              <div className="flex items-center gap-2 text-xs text-red-400 p-3 rounded-lg" 
                   style={{ background: 'rgba(255,80,80,0.05)', border: '1px solid rgba(255,80,80,0.15)' }}>
                <AlertCircle className="w-3.5 h-3.5" />
                {passError}
              </div>
            )}

            {passSuccess && (
              <div className="flex items-center gap-2 text-xs text-green-400 p-3 rounded-lg" 
                   style={{ background: 'rgba(0,255,157,0.05)', border: '1px solid rgba(0,255,157,0.15)' }}>
                <CheckCircle className="w-3.5 h-3.5" />
                Password rotated successfully
              </div>
            )}

            <button
              type="submit"
              disabled={passLoading}
              className="btn-primary w-full py-2.5 mt-2 gap-2"
              style={{ background: 'linear-gradient(135deg, #a259ff, #6b21a8)', borderColor: '#a259ff40' }}
            >
              {passLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              Rotate Password
            </button>
          </form>
        </motion.div>

      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 pt-8 border-t flex flex-wrap gap-6"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#5a5a5a]" />
          <span className="text-xs" style={{ color: '#5a5a5a' }}>Push Notifications</span>
          <div className="w-8 h-4 bg-[#1a1a1a] rounded-full relative cursor-pointer border border-[#333]">
             <div className="w-3 h-3 bg-[#3a3a3a] rounded-full absolute top-0.5 left-0.5" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#5a5a5a]" />
          <span className="text-xs" style={{ color: '#5a5a5a' }}>Private Workspace</span>
          <div className="w-8 h-4 bg-[#1a1a1a] rounded-full relative cursor-pointer border border-[#333]">
             <div className="w-3 h-3 bg-[#00ff9d] rounded-full absolute top-0.5 right-0.5 shadow-[0_0_8px_#00ff9d40]" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
