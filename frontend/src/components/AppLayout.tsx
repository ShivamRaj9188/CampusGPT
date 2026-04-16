import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, MessageSquare, Upload, FileText,
  Zap, Settings, LogOut, GraduationCap, ChevronRight,
  User, Flame, TrendingUp, Library, BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDocuments } from '../hooks/useDocuments';

const NAV_ITEMS = [
  { path: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { path: '/chat',       label: 'AI Chat',      icon: MessageSquare },
  { path: '/upload',     label: 'Upload Center',icon: Upload },
  { path: '/documents',  label: 'Documents',    icon: FileText },
  { path: '/modes',      label: 'Smart Modes',  icon: Zap },
];

/** Shared app shell: sidebar + main content + right utility panel */
export function AppLayout() {
  const { user, logout } = useAuth();
  const { documents } = useDocuments();
  const navigate = useNavigate();
  const location = useLocation();
  const categories = Array.from(new Set(documents.map((document) => document.category))).slice(0, 3);
  const subjectCount = new Set(documents.map((document) => document.category)).size;

  return (
    <div className="h-screen flex bg-bg-base overflow-hidden relative">
      {/* Ambient background particles */}
      <div className="particle-bg" />

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 flex flex-col z-10"
             style={{ background: '#0a0a0a', borderRight: '1px solid rgba(255,255,255,0.05)' }}>

        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #00ff9d22, #00c8ff22)', border: '1px solid rgba(0,255,157,0.3)' }}>
                <GraduationCap className="w-4 h-4" style={{ color: '#00ff9d' }} />
              </div>
              {/* Glow ping */}
              <span className="live-dot absolute -top-0.5 -right-0.5 w-1.5 h-1.5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white tracking-tight">CampusGPT</p>
              <p className="text-xs" style={{ color: '#00ff9d', opacity: 0.7 }}>AI Active</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="text-xs font-medium px-3 mb-3" style={{ color: '#3a3a3a', letterSpacing: '0.08em' }}>
            WORKSPACE
          </p>
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`nav-item w-full ${active ? 'active' : ''}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
                {active && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
              </button>
            );
          })}

          <div className="pt-4 mt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-xs font-medium px-3 mb-3" style={{ color: '#3a3a3a', letterSpacing: '0.08em' }}>
              SYSTEM
            </p>
            <button onClick={() => navigate('/settings')}
                    className={`nav-item w-full ${location.pathname === '/settings' ? 'active' : ''}`}>
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </nav>

        {/* User Profile Card */}
        <div className="px-3 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="glass-card p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(0,255,157,0.1)', border: '1px solid rgba(0,255,157,0.2)' }}>
              <User className="w-4 h-4" style={{ color: '#00ff9d' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.username}</p>
              <p className="text-xs truncate" style={{ color: '#3a3a3a' }}>{user?.email}</p>
            </div>
            <button onClick={logout}
                    className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                    style={{ color: '#3a3a3a' }}
                    title="Sign out">
              <LogOut className="w-3.5 h-3.5 hover:text-red-400 transition-colors" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-y-auto h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Right Utility Panel ──────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 flex flex-col z-10 overflow-y-auto"
             style={{ background: '#0a0a0a', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
        <RightPanel
          streakCount={user?.streakCount || 0}
          aiConfidence={user?.aiConfidence || 0}
          documentCount={documents.length}
          subjectCount={subjectCount}
          categories={categories}
        />
      </aside>
    </div>
  );
}

/** Right mini-widget panel */
function RightPanel({
  streakCount,
  aiConfidence,
  documentCount,
  subjectCount,
  categories,
}: {
  streakCount: number;
  aiConfidence: number;
  documentCount: number;
  subjectCount: number;
  categories: string[];
}) {
  return (
    <div className="p-4 space-y-4">
      <p className="text-xs font-medium px-1 pt-1" style={{ color: '#3a3a3a', letterSpacing: '0.08em' }}>
        ACTIVITY
      </p>

      {/* Study Streak */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4" style={{ color: '#ff6b35' }} />
            <span className="text-xs font-medium text-white">Study Streak</span>
          </div>
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255, 107, 53, 0.1)', border: '1px solid rgba(255, 107, 53, 0.2)' }}
          >
            <Flame className="w-3 h-3" style={{ color: '#ff6b35' }} />
            <span className="text-xs font-bold" style={{ color: '#ff6b35' }}>{streakCount}d</span>
          </motion.div>
        </div>
        <div className="flex gap-1 mt-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 h-1.5 rounded-full"
                 style={{ background: i < streakCount ? '#ff6b35' : 'rgba(255,255,255,0.06)' }} />
          ))}
        </div>
      </div>

      {/* Knowledge Base */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Library className="w-4 h-4" style={{ color: '#00c8ff' }} />
          <span className="text-xs font-medium text-white">Knowledge Base</span>
        </div>
        <p className="text-2xl font-bold" style={{ color: '#00c8ff' }}>
          {documentCount}<span className="text-sm font-normal text-[#5a5a5a] ml-1">docs</span>
        </p>
        <p className="text-xs mt-1" style={{ color: '#3a3a3a' }}>
          {subjectCount} subject{subjectCount === 1 ? '' : 's'} indexed for retrieval
        </p>
      </div>

      {/* AI Confidence Meter */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: '#00ff9d' }} />
            <span className="text-xs font-medium text-white">AI Confidence</span>
          </div>
          <span className="text-xs font-bold" style={{ color: '#00ff9d' }}>{aiConfidence}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${aiConfidence}%` }}
            transition={{ duration: 1, delay: 0.3 }}
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(to right, #00ff9d, #00c8ff)' }}
          />
        </div>
        <p className="text-xs mt-2" style={{ color: '#3a3a3a' }}>
          {documentCount > 0
            ? 'Based on recent RAG retrieval similarity'
            : 'Available after you upload material and run chat queries'}
        </p>
      </div>

      {/* Active Subjects */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-4 h-4" style={{ color: '#a259ff' }} />
          <span className="text-xs font-medium text-white">Active Subjects</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.length > 0 ? categories.map((category) => (
            <span key={category} className="badge-dim text-xs">{category}</span>
          )) : (
            <p className="text-xs leading-relaxed" style={{ color: '#707070' }}>
              Upload study material to populate your active subjects.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
