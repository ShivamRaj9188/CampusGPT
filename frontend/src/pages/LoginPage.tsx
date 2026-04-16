import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Eye, EyeOff, Loader2, ArrowRight, Brain, FileText, Zap } from 'lucide-react';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';

type Mode = 'login' | 'signup';

const FEATURES = [
  { icon: Brain,    text: 'RAG-powered contextual answers', color: '#00ff9d' },
  { icon: FileText, text: 'Chat with your uploaded PDFs',    color: '#00c8ff' },
  { icon: Zap,      text: 'Smart exam answer modes',         color: '#a259ff' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mode, setMode]               = useState<Mode>('login');
  const [username, setUsername]       = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPwd, setShowPwd]         = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setIsLoading(true);
    try {
      const res = mode === 'signup'
        ? await authService.signup(username, email, password)
        : await authService.login(username, password);
      login(res.token, res.username, res.email);
      navigate('/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; details?: Record<string,string> } } };
      const details = e.response?.data?.details;
      setError(details ? Object.values(details).join(' · ') : (e.response?.data?.error ?? 'An error occurred'));
    } finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#050505' }}>

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-100"
             style={{ background: 'radial-gradient(circle, rgba(0,255,157,0.06) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(0,200,255,0.05) 0%, transparent 70%)' }} />
        {/* Grid overlay */}
        <div className="absolute inset-0"
             style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* Left panel */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center px-12 relative">
        <div className="max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center relative"
                 style={{ background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.25)' }}>
              <GraduationCap className="w-6 h-6" style={{ color: '#00ff9d' }} />
              <div className="absolute inset-0 rounded-2xl animate-pulse-neon" style={{ background: 'transparent' }} />
            </div>
            <div>
              <p className="text-xl font-bold text-white">CampusGPT</p>
              <p className="text-xs" style={{ color: '#00ff9d', opacity: 0.7 }}>AI Academic OS</p>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white leading-tight mb-3">
            Your AI<br />
            <span style={{ background: 'linear-gradient(135deg, #00ff9d, #00c8ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Study Partner
            </span>
          </h1>
          <p className="text-sm mb-10 leading-relaxed" style={{ color: '#5a5a5a' }}>
            Upload notes, question papers, and syllabi. Ask anything and get intelligent answers powered by RAG and local LLM.
          </p>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text, color }, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="p-2 rounded-lg flex-shrink-0"
                     style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <span className="text-sm" style={{ color: '#a0a0a0' }}>{text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — Auth card */}
      <div className="flex-1 flex items-center justify-center px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.25)' }}>
              <GraduationCap className="w-5 h-5" style={{ color: '#00ff9d' }} />
            </div>
            <span className="text-xl font-bold text-white">CampusGPT</span>
          </div>

          {/* Card */}
          <div className="glass-card p-8" style={{ background: '#0d0d0d' }}>

            {/* Tabs */}
            <div className="flex mb-7 p-1 rounded-xl gap-1"
                 style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {(['login', 'signup'] as Mode[]).map(m => (
                <button key={m} onClick={() => { setMode(m); setError(''); }}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                        style={mode === m ? {
                          background: 'rgba(255,255,255,0.06)',
                          color: '#ffffff',
                          border: '1px solid rgba(255,255,255,0.08)',
                        } : { color: '#3a3a3a' }}>
                  {m === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#5a5a5a' }}>Username</label>
                <input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)}
                       placeholder="e.g. shivam_raj" required className="input-field" />
              </div>

              {/* Email (signup only) */}
              <AnimatePresence>
                {mode === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#5a5a5a' }}>Email</label>
                    <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                           placeholder="you@college.edu" required={mode === 'signup'} className="input-field" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#5a5a5a' }}>Password</label>
                <div className="relative">
                  <input id="password" type={showPwd ? 'text' : 'password'} value={password}
                         onChange={e => setPassword(e.target.value)}
                         placeholder="Min 8 characters" required className="input-field pr-11" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                          style={{ color: '#3a3a3a' }}>
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="text-xs px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: '#ff6b6b' }}>
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Submit */}
              <button id="auth-submit" type="submit" disabled={isLoading}
                      className="btn-primary w-full py-3 text-sm mt-2 gap-2">
                {isLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Please wait...</span></>
                  : <><span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>

            <p className="text-center text-xs mt-6" style={{ color: '#3a3a3a' }}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
                      className="font-medium transition-colors" style={{ color: '#00ff9d' }}>
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
