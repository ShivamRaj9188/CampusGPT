import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, BookOpen, Zap, MessageSquare, BarChart2, Target, ArrowRight } from 'lucide-react';

const MODES = [
  {
    key: 'EXPLAIN_CONCEPT',
    icon: Brain,
    emoji: '💡',
    title: 'Explain Concept',
    desc: 'Get a clear, thorough explanation with analogies and examples. Perfect for understanding new topics deeply.',
    color: '#00ff9d',
    tags: ['Deep Learning', 'Analogies', 'Examples'],
    useCase: 'Best for understanding new or difficult concepts',
  },
  {
    key: 'TEN_MARK',
    icon: BookOpen,
    emoji: '📝',
    title: '10-Mark Answer',
    desc: 'Structured, comprehensive exam-ready answers with intro, numbered points, examples, and conclusion.',
    color: '#00c8ff',
    tags: ['Exam Ready', 'Structured', '10 Marks'],
    useCase: 'Best for university exam preparation',
  },
  {
    key: 'SHORT_NOTES',
    icon: Zap,
    emoji: '⚡',
    title: 'Short Notes',
    desc: 'Concise bullet-point notes with key terms highlighted. Ideal for last-minute revision.',
    color: '#a259ff',
    tags: ['Bullet Points', 'Quick Revision', 'Key Terms'],
    useCase: 'Best for rapid revision before exams',
  },
  {
    key: 'VIVA',
    icon: MessageSquare,
    emoji: '🎤',
    title: 'Viva Questions',
    desc: 'Generate likely viva/oral exam questions and model answers for any topic from your notes.',
    color: '#ff6b35',
    tags: ['Oral Exam', 'Q&A Format', 'Interview Prep'],
    useCase: 'Best for lab viva and oral examinations',
  },
  {
    key: 'REVISION_BLAST',
    icon: BarChart2,
    emoji: '🚀',
    title: 'Revision Blast',
    desc: 'Ultra-fast key-point summary of everything important. Cover maximum content in minimum time.',
    color: '#fbbf24',
    tags: ['Speed Study', 'Key Points', 'Rapid'],
    useCase: 'Best for day-before exam revision',
  },
  {
    key: 'EXAM_STRATEGY',
    icon: Target,
    emoji: '🎯',
    title: 'Exam Strategy',
    desc: 'AI analyzes your PYQs and syllabus to suggest what topics to focus on and how to allocate study time.',
    color: '#ec4899',
    tags: ['Strategy', 'PYQ Analysis', 'Time Plan'],
    useCase: 'Best for exam planning and prioritization',
  },
];

export default function SmartModesPage() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="p-6">
      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: '#00ff9d', letterSpacing: '0.1em' }}>SMART MODES</p>
        <h1 className="text-2xl font-bold text-white">AI Answer Modes</h1>
        <p className="text-sm mt-1" style={{ color: '#5a5a5a' }}>
          Each mode injects a different system prompt to tune the AI's response style.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {MODES.map((mode, i) => {
          const Icon  = mode.icon;
          const color = mode.color;
          const isHovered = hovered === mode.key;

          return (
            <motion.div
              key={mode.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              onMouseEnter={() => setHovered(mode.key)}
              onMouseLeave={() => setHovered(null)}
              className="glass-card p-5 flex flex-col gap-4 cursor-pointer transition-all duration-300"
              style={isHovered ? {
                borderColor: `${color}40`,
                background: `${color}05`,
                boxShadow: `0 0 30px ${color}10, 0 8px 40px rgba(0,0,0,0.6)`,
                transform: 'translateY(-3px)',
              } : {}}
              onClick={() => navigate('/chat')}
            >
              {/* Icon + title */}
              <div className="flex items-start justify-between">
                <div className="p-3 rounded-xl transition-all duration-300"
                     style={{
                       background: isHovered ? `${color}18` : `${color}0d`,
                       border: `1px solid ${isHovered ? color + '40' : color + '20'}`,
                     }}>
                  <Icon className="w-5 h-5 transition-all" style={{ color }} />
                </div>
                <motion.div
                  animate={{ x: isHovered ? 0 : 6, opacity: isHovered ? 1 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ArrowRight className="w-4 h-4" style={{ color }} />
                </motion.div>
              </div>

              {/* Title + desc */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xl">{mode.emoji}</span>
                  <h3 className="text-sm font-semibold text-white">{mode.title}</h3>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#707070' }}>{mode.desc}</p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {mode.tags.map(tag => (
                  <span key={tag} className="badge text-xs"
                        style={{ background: `${color}0d`, color: `${color}`, border: `1px solid ${color}20` }}>
                    {tag}
                  </span>
                ))}
              </div>

              {/* Use case */}
              <p className="text-xs px-3 py-2 rounded-lg"
                 style={{ background: 'rgba(255,255,255,0.03)', color: '#3a3a3a', borderLeft: `2px solid ${color}40` }}>
                {mode.useCase}
              </p>

              {/* CTA */}
              <button
                className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all duration-200"
                style={{
                  background: isHovered ? `${color}18` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isHovered ? color + '40' : 'rgba(255,255,255,0.07)'}`,
                  color: isHovered ? color : '#5a5a5a',
                }}
              >
                Use This Mode →
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
