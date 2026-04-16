import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText, MessageSquare, Upload, Zap, TrendingUp,
  ArrowRight, BookOpen, Clock, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { documentService } from '../services/documentService';
import { Document } from '../types';
import { format } from 'date-fns';

const CATEGORY_COLORS: Record<string, string> = {
  Physics: '#00ff9d', Chemistry: '#00c8ff', Math: '#a259ff',
  DBMS: '#00ff9d', OS: '#00c8ff', CN: '#ff6b35',
  AI: '#a259ff', ML: '#00c8ff', Java: '#ff6b35', Default: '#5a5a5a',
};

/** Stat card component */
function StatCard({ value, label, icon, color, delay }: {
  value: number | string; label: string; icon: React.ReactNode;
  color: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="stat-card"
    >
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-xl" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
          <div style={{ color }}>{icon}</div>
        </div>
        <TrendingUp className="w-3.5 h-3.5" style={{ color: '#2a2a2a' }} />
      </div>
      <p className="text-2xl font-bold text-white mt-2">{value}</p>
      <p className="text-xs" style={{ color: '#5a5a5a' }}>{label}</p>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    documentService.list().then(setDocuments).finally(() => setLoading(false));
  }, []);

  const totalChunks    = documents.reduce((a, d) => a + (d.chunkCount ?? 0), 0);
  const uniqueSubjects = new Set(documents.map(d => d.category)).size;

  const suggestedSessions = [
    { subject: 'DBMS Normalization', type: '10-Mark Answer', icon: '🗄️' },
    { subject: 'Computer Networks — OSI model', type: 'Explain Concept', icon: '🌐' },
    { subject: 'Exam Strategy for tomorrow', type: 'Revision Blast', icon: '🎯' },
  ];

  return (
    <div className="p-6 max-w-5xl">

      {/* ── Hero Welcome ─────────────────────────────────────────────── */}
      <div className="mb-8 relative">
        {/* Ambient glow across top */}
        <div className="absolute -top-6 -left-6 right-0 h-32 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse 60% 80% at 20% 0%, rgba(0,255,157,0.06), transparent)' }} />

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs font-medium mb-1" style={{ color: '#00ff9d', letterSpacing: '0.1em' }}>
            WELCOME BACK
          </p>
          <h1 className="text-3xl font-bold text-white mb-1">
            {user?.username ?? 'Student'} 👋
          </h1>
          <p className="text-sm" style={{ color: '#5a5a5a' }}>
            Your AI academic operating system — ready when you are.
          </p>
        </motion.div>
      </div>

      {/* ── Stats Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard value={documents.length} label="PDFs Uploaded"   icon={<FileText className="w-4 h-4" />} color="#00ff9d"   delay={0.05} />
        <StatCard value={uniqueSubjects}    label="Subjects Indexed" icon={<BookOpen className="w-4 h-4" />}  color="#00c8ff"   delay={0.1}  />
        <StatCard value={totalChunks}       label="Chunks Indexed"   icon={<Zap className="w-4 h-4" />}      color="#a259ff"   delay={0.15} />
        <StatCard value="87%"              label="AI Accuracy"      icon={<TrendingUp className="w-4 h-4" />} color="#ff6b35"  delay={0.2}  />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Recent Uploads ────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Recent Uploads</h2>
            <button onClick={() => navigate('/documents')}
                    className="text-xs flex items-center gap-1 transition-colors"
                    style={{ color: '#00ff9d' }}>
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {loading ? (
              <div className="glass-card p-8 flex justify-center">
                <div className="flex gap-1.5">
                  {[0,1,2].map(i => <div key={i} className="typing-dot" style={{ animationDelay: `${i*0.2}s` }} />)}
                </div>
              </div>
            ) : documents.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <FileText className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm" style={{ color: '#3a3a3a' }}>No documents yet</p>
                <button onClick={() => navigate('/upload')}
                        className="mt-3 text-xs" style={{ color: '#00ff9d' }}>
                  Upload your first PDF →
                </button>
              </div>
            ) : (
              documents.slice(0, 4).map((doc) => {
                const color = CATEGORY_COLORS[doc.category] ?? CATEGORY_COLORS.Default;
                return (
                  <div key={doc.id} className="glass-card-hover px-4 py-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg flex-shrink-0"
                         style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                      <FileText className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{doc.originalFilename}</p>
                      <p className="text-xs" style={{ color: '#3a3a3a' }}>
                        {doc.chunkCount} chunks · {format(new Date(doc.createdAt), 'MMM d')}
                      </p>
                    </div>
                    <span className="badge-dim text-xs">{doc.category}</span>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* ── Suggested Study Sessions ──────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Study Sessions</h2>
            <button onClick={() => navigate('/chat')}
                    className="text-xs flex items-center gap-1" style={{ color: '#00ff9d' }}>
              Start chat <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {suggestedSessions.map((session, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                onClick={() => navigate('/chat')}
                className="glass-card-hover w-full px-4 py-3 text-left flex items-center gap-3"
              >
                <span className="text-xl">{session.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{session.subject}</p>
                  <p className="text-xs" style={{ color: '#3a3a3a' }}>{session.type}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#2a2a2a' }} />
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── Quick Actions ─────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <h2 className="text-sm font-semibold text-white mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Start AI Chat', icon: MessageSquare, color: '#00ff9d', path: '/chat' },
              { label: 'Upload PDF',    icon: Upload,        color: '#00c8ff', path: '/upload' },
              { label: 'Smart Modes',  icon: Zap,           color: '#a259ff', path: '/modes' },
              { label: 'My Documents', icon: FileText,      color: '#ff6b35', path: '/documents' },
            ].map(({ label, icon: Icon, color, path }) => (
              <button key={path} onClick={() => navigate(path)}
                      className="glass-card-hover p-4 flex flex-col items-start gap-3">
                <div className="p-2 rounded-lg" style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <p className="text-xs font-medium text-white">{label}</p>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Upcoming Exams ────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <h2 className="text-sm font-semibold text-white mb-3">Upcoming Exams</h2>
          <div className="space-y-2">
            {[
              { subject: 'Database Management Systems', date: 'Apr 28', daysLeft: 12, urgency: '#ff6b35' },
              { subject: 'Computer Networks',           date: 'May 3',  daysLeft: 17, urgency: '#00c8ff' },
              { subject: 'Artificial Intelligence',     date: 'May 10', daysLeft: 24, urgency: '#00ff9d' },
            ].map((exam, i) => (
              <div key={i} className="glass-card px-4 py-3 flex items-center gap-3">
                <div className="w-1 h-10 rounded-full flex-shrink-0"
                     style={{ background: exam.urgency }} />
                <div className="flex-1">
                  <p className="text-xs font-medium text-white">{exam.subject}</p>
                  <p className="text-xs" style={{ color: '#3a3a3a' }}>{exam.date}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold" style={{ color: exam.urgency }}>{exam.daysLeft}d</p>
                  <div className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" style={{ color: '#3a3a3a' }} />
                    <span className="text-xs" style={{ color: '#3a3a3a' }}>left</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
