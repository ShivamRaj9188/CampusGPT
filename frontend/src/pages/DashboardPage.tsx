import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  MessageSquare,
  Upload,
  Zap,
  ArrowRight,
  BookOpen,
  ChevronRight,
  BrainCircuit,
  Microscope,
  Network,
  Code2,
  Sigma,
  Layers3,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useDocuments } from '../hooks/useDocuments';
import { StatCard } from '../components/ui/StatCard';
import { CATEGORY_COLORS } from '../utils/constants';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  AI: BrainCircuit,
  ML: BrainCircuit,
  DBMS: Layers3,
  CN: Network,
  OS: Code2,
  Java: Code2,
  Physics: Microscope,
  Math: Sigma,
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { documents, loading } = useDocuments();

  const totalChunks = documents.reduce((acc, document) => acc + (document.chunkCount ?? 0), 0);
  const uniqueSubjects = new Set(documents.map((document) => document.category)).size;

  const suggestedSessions = documents.length > 0
    ? Array.from(new Set(documents.map((document) => document.category))).slice(0, 3).map((category) => ({
      subject: category,
      type: 'Deep Review',
      icon: CATEGORY_ICONS[category] ?? BookOpen,
    }))
    : [
      { subject: 'No subjects yet', type: 'Upload a PDF to start', icon: FileText },
    ];

  const focusAreas = Array.from(
    documents.reduce((acc, document) => {
      acc.set(document.category, (acc.get(document.category) ?? 0) + (document.chunkCount ?? 0));
      return acc;
    }, new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-8 relative">
        <div
          className="absolute -top-6 -left-6 right-0 h-32 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 80% at 20% 0%, rgba(0,255,157,0.06), transparent)' }}
        />

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs font-medium mb-1" style={{ color: '#00ff9d', letterSpacing: '0.1em' }}>
            WELCOME BACK
          </p>
          <h1 className="text-3xl font-bold text-white mb-1">{user?.username ?? 'Student'}</h1>
          <p className="text-sm" style={{ color: '#5a5a5a' }}>
            Your AI academic operating system — ready when you are.
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard value={documents.length} label="PDFs Uploaded" icon={<FileText className="w-4 h-4" />} color="#00ff9d" delay={0.05} />
        <StatCard value={uniqueSubjects} label="Subjects Indexed" icon={<BookOpen className="w-4 h-4" />} color="#00c8ff" delay={0.1} />
        <StatCard value={totalChunks} label="Chunks Indexed" icon={<Zap className="w-4 h-4" />} color="#a259ff" delay={0.15} />
        <StatCard
          value={`${user?.aiConfidence ?? 0}%`}
          label="AI Confidence"
          icon={<TrendingUp className="w-4 h-4" />}
          color="#ff6b35"
          delay={0.2}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Recent Uploads</h2>
            <button
              onClick={() => navigate('/documents')}
              className="text-xs flex items-center gap-1 transition-colors"
              style={{ color: '#00ff9d' }}
            >
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {loading ? (
              <div className="glass-card p-8 flex justify-center">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="typing-dot" style={{ animationDelay: `${index * 0.2}s` }} />
                  ))}
                </div>
              </div>
            ) : documents.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <FileText className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm" style={{ color: '#3a3a3a' }}>No documents yet</p>
                <button onClick={() => navigate('/upload')} className="mt-3 text-xs" style={{ color: '#00ff9d' }}>
                  Upload your first PDF
                </button>
              </div>
            ) : (
              documents.slice(0, 4).map((document) => {
                const color = CATEGORY_COLORS[document.category] ?? CATEGORY_COLORS.Default;
                return (
                  <div key={document.id} className="glass-card-hover px-4 py-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg flex-shrink-0" style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                      <FileText className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{document.originalFilename}</p>
                      <p className="text-xs" style={{ color: '#3a3a3a' }}>
                        {document.chunkCount} chunks · {format(new Date(document.createdAt), 'MMM d')}
                      </p>
                    </div>
                    <span className="badge-dim text-xs">{document.category}</span>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Study Sessions</h2>
            <button onClick={() => navigate('/chat')} className="text-xs flex items-center gap-1" style={{ color: '#00ff9d' }}>
              Start chat <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {suggestedSessions.map((session, index) => (
              <motion.button
                key={session.subject}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.08 }}
                onClick={() => navigate('/chat')}
                className="glass-card-hover w-full px-4 py-3 text-left flex items-center gap-3"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <session.icon className="w-5 h-5" style={{ color: '#00c8ff' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{session.subject}</p>
                  <p className="text-xs" style={{ color: '#3a3a3a' }}>{session.type}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#2a2a2a' }} />
              </motion.button>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <h2 className="text-sm font-semibold text-white mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Start AI Chat', icon: MessageSquare, color: '#00ff9d', path: '/chat' },
              { label: 'Upload PDF', icon: Upload, color: '#00c8ff', path: '/upload' },
              { label: 'Smart Modes', icon: Zap, color: '#a259ff', path: '/modes' },
              { label: 'My Documents', icon: FileText, color: '#ff6b35', path: '/documents' },
            ].map(({ label, icon: Icon, color, path }) => (
              <button key={path} onClick={() => navigate(path)} className="glass-card-hover p-4 flex flex-col items-start gap-3">
                <div className="p-2 rounded-lg" style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <p className="text-xs font-medium text-white">{label}</p>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <h2 className="text-sm font-semibold text-white mb-3">Focus Areas</h2>
          <div className="space-y-2">
            {focusAreas.length > 0 ? focusAreas.map(([subject, chunkCount], index) => (
              <div key={subject} className="glass-card px-4 py-3 flex items-center gap-3">
                <div
                  className="w-1 h-10 rounded-full flex-shrink-0"
                  style={{ background: Object.values(CATEGORY_COLORS)[index % Object.values(CATEGORY_COLORS).length] }}
                />
                <div className="flex-1">
                  <p className="text-xs font-medium text-white">{subject}</p>
                  <p className="text-xs" style={{ color: '#3a3a3a' }}>Derived from your uploaded material</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold" style={{ color: '#00ff9d' }}>{chunkCount}</p>
                  <span className="text-xs" style={{ color: '#3a3a3a' }}>chunks</span>
                </div>
              </div>
            )) : (
              <div className="glass-card px-4 py-5">
                <p className="text-xs font-medium text-white">No focus areas yet</p>
                <p className="text-xs mt-1" style={{ color: '#3a3a3a' }}>
                  Upload notes or question papers to build real subject-driven study recommendations.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
