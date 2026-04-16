import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, BookOpen, Zap, MessageSquare, BarChart2, Target, ArrowRight } from 'lucide-react';
import { CHAT_MODES, ChatMode } from '../types';

const MODE_ICONS: Record<string, React.ElementType> = {
  Lightbulb: Brain,
  FileText: BookOpen,
  Zap,
  Mic: MessageSquare,
  Rocket: BarChart2,
  Target,
};

export default function SmartModesPage() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="p-6">
      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: '#00ff9d', letterSpacing: '0.1em' }}>SMART MODES</p>
        <h1 className="text-2xl font-bold text-white">AI Answer Modes</h1>
        <p className="text-sm mt-1" style={{ color: '#5a5a5a' }}>
          Each mode applies a distinct response pattern tuned for a specific study outcome.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(Object.entries(CHAT_MODES) as [ChatMode, typeof CHAT_MODES[ChatMode]][]).map(([key, mode], index) => {
          const Icon = MODE_ICONS[mode.iconName] ?? Brain;
          const isHovered = hovered === key;

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.07 }}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              className="glass-card p-5 flex flex-col gap-4 cursor-pointer transition-all duration-300"
              style={isHovered ? {
                borderColor: `${mode.color}40`,
                background: `${mode.color}05`,
                boxShadow: `0 0 30px ${mode.color}10, 0 8px 40px rgba(0,0,0,0.6)`,
                transform: 'translateY(-3px)',
              } : {}}
              onClick={() => navigate('/chat')}
            >
              <div className="flex items-start justify-between">
                <div
                  className="p-3 rounded-xl transition-all duration-300"
                  style={{
                    background: isHovered ? `${mode.color}18` : `${mode.color}0d`,
                    border: `1px solid ${isHovered ? mode.color + '40' : mode.color + '20'}`,
                  }}
                >
                  <Icon className="w-5 h-5 transition-all" style={{ color: mode.color }} />
                </div>
                <motion.div
                  animate={{ x: isHovered ? 0 : 6, opacity: isHovered ? 1 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ArrowRight className="w-4 h-4" style={{ color: mode.color }} />
                </motion.div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="text-sm font-semibold text-white">{mode.label}</h3>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#707070' }}>{mode.description}</p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {mode.tags.map((tag) => (
                  <span
                    key={tag}
                    className="badge text-xs"
                    style={{ background: `${mode.color}0d`, color: mode.color, border: `1px solid ${mode.color}20` }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <p
                className="text-xs px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.03)', color: '#3a3a3a', borderLeft: `2px solid ${mode.color}40` }}
              >
                {mode.useCase}
              </p>

              <button
                className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all duration-200"
                style={{
                  background: isHovered ? `${mode.color}18` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isHovered ? mode.color + '40' : 'rgba(255,255,255,0.07)'}`,
                  color: isHovered ? mode.color : '#5a5a5a',
                }}
              >
                Use This Mode
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
