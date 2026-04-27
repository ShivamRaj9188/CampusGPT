import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { 
  Send, StopCircle, Bot, User, Sparkles, Trash2,
  AlertTriangle, Lightbulb, FileText, Zap, Mic, Rocket, Target,
  Plus, ChevronDown, Copy, Check
} from 'lucide-react';
import { useDocuments } from '../hooks/useDocuments';
import { chatService } from '../services/chatService';
import { Message, ChatMode, CHAT_MODES } from '../types';
import { useAuth } from '../context/AuthContext';

// Simple tooltip-capable pill
const MetricPill: React.FC<{ label: string; value: string; status?: 'good'|'warn'|'bad'; tooltip?: string }> = ({ label, value, status }) => (
  <div className="flex flex-col px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }} title={value}>
    <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#707070' }}>{label}</span>
    <span className="text-xs font-semibold" style={{ color: status === 'bad' ? '#ff6b35' : status === 'warn' ? '#fbbf24' : '#00ff9d' }}>{value}</span>
  </div>
);

const MatchTypeBadge: React.FC<{ breakdown: any }> = ({ breakdown }) => {
  const total = breakdown.semantic + breakdown.keyword + breakdown.hybrid;
  if (!total) return null;
  return (
    <div className="flex gap-2">
      {breakdown.semantic > 0 && <MetricPill label="Semantic" value={breakdown.semantic.toString()} />}
      {breakdown.keyword > 0 && <MetricPill label="Keyword" value={breakdown.keyword.toString()} />}
      {breakdown.hybrid > 0 && <MetricPill label="Hybrid" value={breakdown.hybrid.toString()} />}
    </div>
  );
};

const RetrievalMetricsBar: React.FC<{ metrics: any }> = ({ metrics }) => (
  <div className="flex flex-wrap gap-2 mt-2 mb-1 p-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
    <MetricPill
      label="Latency"
      value={`${metrics.latencyMs}ms`}
      status={metrics.latencyMs < 200 ? 'good' : metrics.latencyMs < 500 ? 'warn' : 'bad'}
    />
    <MetricPill
      label="Filter Funnel"
      value={`${metrics.chunksAfterSearch} → ${metrics.chunksInContext}`}
    />
    <MetricPill
      label="Top Match Score"
      value={`${(metrics.topRrfScore * 100).toFixed(1)}%`}
    />
    <MatchTypeBadge breakdown={metrics.matchTypeBreakdown} />
  </div>
);

// Map icon string names back to Lucide components
const ModeIcons: Record<string, React.ElementType> = {
  Lightbulb,
  FileText,
  Zap,
  Mic,
  Rocket,
  Target
};

const CodeBlock: React.FC<{ children: string }> = ({ children }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4 rounded-xl overflow-hidden border border-white/5 bg-black/30">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
        <span className="text-[10px] font-bold text-[#5a5a5a] uppercase tracking-widest">Code Block</span>
        <button 
          onClick={handleCopy}
          className="p-1 rounded-md transition-all hover:bg-white/10"
        >
          {copied ? <Check className="w-3 h-3 text-[#00ff9d]" /> : <Copy className="w-3 h-3 text-[#5a5a5a]" />}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="text-xs text-[#00ff9d] font-mono leading-relaxed">{children}</code>
      </pre>
    </div>
  );
};

let msgId = 0;
const uid = () => `m${++msgId}`;

const PROMPT_CHIPS = [
  'Explain the OSI model in detail',
  'Give 10-mark answer on DBMS normalization',
  'Summarize Unit 3 from my notes',
  'Create short notes on CN protocols',
  'Generate viva questions on this topic',
];

const MODE_COLORS: Record<ChatMode, string> = {
  EXPLAIN_CONCEPT: '#00ff9d',
  TEN_MARK:        '#00c8ff',
  SHORT_NOTES:     '#a259ff',
  VIVA:            '#ff6b35',
  REVISION_BLAST:  '#fbbf24',
  EXAM_STRATEGY:   '#ec4899',
};

export default function ChatPage() {
  const { refreshUser } = useAuth();

  const [sessions, setSessions]       = useState<Record<string, Message[]>>({});
  const [activeSessionId, setActiveSessionId] = useState<string>(uid());
  const messages = sessions[activeSessionId] || [];
  const [input, setInput]             = useState('');
  const [mode, setMode]               = useState<ChatMode>('EXPLAIN_CONCEPT');
  const [isStreaming, setIsStreaming]  = useState(false);
  const { documents }                 = useDocuments();
  const abortRef                      = useRef<AbortController | null>(null);
  const bottomRef                     = useRef<HTMLDivElement>(null);
  const textareaRef                   = useRef<HTMLTextAreaElement>(null);

  // Load persistent history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await chatService.getHistory();
        if (history && history.length > 0) {
          const grouped: Record<string, Message[]> = {};
          // History from backend is Descending (newest first). Reverse it for chron. order
          history.reverse().forEach(h => {
            const sid = h.sessionId || 'default';
            if (!grouped[sid]) grouped[sid] = [];
            grouped[sid].push({
              id: uid(),
              role: h.role as 'user' | 'assistant',
              content: h.content,
              timestamp: new Date(h.createdAt)
            });
          });
          setSessions(grouped);
          // Set active session to the most recently active one (which is the last one processed)
          setActiveSessionId(history[history.length - 1].sessionId || 'default');
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      }
    };
    void loadHistory();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + 'px';
    }
  }, [input]);

  const send = useCallback(() => {
    const q = input.trim();
    if (!q || isStreaming) return;
    setInput('');

    const userMsg: Message  = { id: uid(), role: 'user', content: q, timestamp: new Date() };
    const aiMsg: Message    = { id: uid(), role: 'assistant', content: '', timestamp: new Date(), isStreaming: true };
    const updateSession = (updater: (prev: Message[]) => Message[]) => {
      setSessions(prev => ({
        ...prev,
        [activeSessionId]: updater(prev[activeSessionId] || [])
      }));
    };

    updateSession(prev => [...prev, userMsg, aiMsg]);
    setIsStreaming(true);
    const aiId = aiMsg.id;

    const historyPayload = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));

    abortRef.current?.abort();
    abortRef.current = chatService.stream(
      q, mode, historyPayload, activeSessionId,
      (token) => updateSession(prev => prev.map(m => m.id === aiId ? { ...m, content: m.content + token } : m)),
      (metrics) => updateSession(prev => prev.map(m => m.id === aiId ? { ...m, metrics } : m)),
      ()      => {
        updateSession(prev => prev.map(m => m.id === aiId ? { ...m, isStreaming: false } : m));
        setIsStreaming(false);
        void refreshUser();
      },
      (err)   => { 
        updateSession(prev => prev.map(m => m.id === aiId ? { ...m, content: `Error: ${err}`, isStreaming: false } : m)); 
        setIsStreaming(false); 
      }
    );
  }, [input, isStreaming, mode, messages, activeSessionId]);

  const stop = () => { 
    abortRef.current?.abort(); 
    setIsStreaming(false); 
    setSessions(prev => ({
      ...prev,
      [activeSessionId]: (prev[activeSessionId] || []).map(m => m.isStreaming ? { ...m, isStreaming: false } : m)
    })); 
  };

  const clearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear ALL chat history?')) return;
    try {
      await chatService.clearHistory();
      setSessions({});
      setActiveSessionId(uid());
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const startNewChat = () => {
    setActiveSessionId(uid());
  };

  const deleteCurrentSession = async () => {
    if (!sessions[activeSessionId]) {
      // If it's a "New Chat" with no messages, just reset it
      setActiveSessionId(uid());
      return;
    }
    if (!window.confirm('Delete this specific conversation?')) return;
    try {
      await chatService.deleteSession(activeSessionId);
      setSessions(prev => {
        const next = { ...prev };
        delete next[activeSessionId];
        return next;
      });
      setActiveSessionId(uid());
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  return (
    <div className="h-full flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 py-3 flex flex-col gap-3"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
        
        {/* Top Row: Title and Session Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-end gap-0.5 h-5">
              {[1,2,3,4,5].map((_, i) => (
                <div key={i} className="wave-bar" style={{
                  height: ['10px','16px','8px','14px','6px'][i],
                  opacity: isStreaming ? 1 : 0.3,
                  animationPlayState: isStreaming ? 'running' : 'paused',
                  animationDelay: `${i*0.1}s`
                }} />
              ))}
            </div>
            <div>
              <p className="text-sm font-bold text-white tracking-tight">CampusGPT AI</p>
              <p className="text-[10px] font-medium" style={{ color: '#505050' }}>
                {documents.length} Source{documents.length !== 1 ? 's' : ''} Linked
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {Object.keys(sessions).length > 0 && (
              <div className="flex items-center gap-1">
                <div className="relative group">
                  <select
                    value={activeSessionId}
                    onChange={(e) => setActiveSessionId(e.target.value)}
                    className="pl-3 pr-8 py-1.5 rounded-lg text-[11px] font-medium outline-none cursor-pointer appearance-none transition-all"
                    style={{ 
                      background: 'rgba(255,255,255,0.03)', 
                      border: '1px solid rgba(255,255,255,0.08)', 
                      color: '#a0a0a0',
                      minWidth: '140px'
                    }}
                  >
                    {Object.entries(sessions).map(([sid, msgs], i) => (
                      <option key={sid} value={sid} style={{ background: '#111' }}>
                        {msgs[0] ? msgs[0].content.slice(0, 24) + '...' : `Chat ${i + 1}`}
                      </option>
                    ))}
                    {!sessions[activeSessionId] && <option value={activeSessionId} style={{ background: '#111' }}>Current New Chat</option>}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                    <ChevronDown className="w-3 h-3" />
                  </div>
                </div>

                <button 
                  onClick={deleteCurrentSession}
                  className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 text-[#404040] hover:text-red-400"
                  title="Delete current session"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button 
              onClick={startNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:brightness-110 active:scale-95"
              style={{ background: '#00ff9d', color: '#000' }}
            >
              <Plus className="w-3.5 h-3.5" />
              New Chat
            </button>

            <button 
              onClick={clearHistory}
              className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 text-[#404040] hover:text-red-400"
              title="Wipe All History"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Bottom Row: Mode Selector */}
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-bold text-[#404040] mr-2">Smart Modes:</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(CHAT_MODES) as [ChatMode, typeof CHAT_MODES[ChatMode]][]).map(([key, val]) => {
              const Icon = ModeIcons[val.iconName] || Sparkles;
              const isActive = mode === key;
              return (
                <button 
                  key={key} 
                  onClick={() => setMode(key)}
                  className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-[11px] font-medium transition-all duration-300 border ${
                    isActive ? 'border-transparent' : 'border-white/5 hover:border-white/10'
                  }`}
                  style={{
                    background: isActive ? `${MODE_COLORS[key]}15` : 'rgba(255,255,255,0.02)',
                    color: isActive ? MODE_COLORS[key] : '#707070',
                    borderColor: isActive ? `${MODE_COLORS[key]}40` : ''
                  }}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'animate-pulse' : ''}`} />
                  {val.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center max-w-md"
            >
              {/* Floating AI orb */}
              <div className="relative mx-auto w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full animate-pulse-neon"
                     style={{ background: 'radial-gradient(circle, rgba(0,255,157,0.15), rgba(0,200,255,0.05))' }} />
                <div className="w-20 h-20 rounded-full flex items-center justify-center relative"
                     style={{ background: 'rgba(0,255,157,0.06)', border: '1px solid rgba(0,255,157,0.2)' }}>
                  <Sparkles className="w-8 h-8" style={{ color: '#00ff9d' }} />
                </div>
              </div>

              <h2 className="text-xl font-bold text-white mb-2">Ask anything</h2>
              <p className="text-sm mb-8" style={{ color: '#3a3a3a' }}>
                Your RAG-powered AI assistant is ready. Upload PDFs and ask questions.
              </p>

              {/* Prompt suggestion chips */}
              <div className="flex flex-wrap gap-2 justify-center">
                {PROMPT_CHIPS.map((chip, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    onClick={() => { setInput(chip); textareaRef.current?.focus(); }}
                    className="glass-card-hover px-3 py-2 text-xs rounded-xl"
                    style={{ color: '#707070' }}
                  >
                    {chip}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* Message bubbles */}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 mb-6 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* AI Avatar */}
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                     style={{ background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.2)' }}>
                  <Bot className="w-4 h-4" style={{ color: '#00ff9d' }} />
                </div>
              )}

              {/* Bubble */}
              <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'rounded-tr-sm'
                  : 'glass-card rounded-tl-sm'
              }`} style={msg.role === 'user' ? {
                background: 'rgba(0,255,157,0.08)',
                border: '1px solid rgba(0,255,157,0.15)',
                color: '#e0e0e0',
              } : {}}>
                {msg.role === 'assistant' ? (
                  <>
                    {msg.metrics && msg.metrics.latencyMs > 0 && <RetrievalMetricsBar metrics={msg.metrics} />}
                    {msg.isStreaming && msg.content === '' ? (
                      <div className="flex gap-1.5 py-1">
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                      </div>
                    ) : (
                      <div className="ai-prose">
                        <ReactMarkdown
                          components={{
                            code({ inline, children }) {
                              if (inline) return <code className="bg-white/5 px-1.5 py-0.5 rounded text-[#00ff9d] text-[13px]">{children}</code>;
                              return <CodeBlock>{String(children).replace(/\n$/, '')}</CodeBlock>;
                            }
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                        {msg.isStreaming && (
                          <span className="inline-block w-0.5 h-4 ml-0.5 rounded-full animate-pulse"
                                style={{ background: '#00ff9d', verticalAlign: '-0.15em' }} />
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[#d0d0d0]">{msg.content}</p>
                )}
              </div>

              {/* User Avatar */}
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                     style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <User className="w-4 h-4" style={{ color: '#5a5a5a' }} />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* ── Input Bar ────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 py-4"
           style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-3xl mx-auto">
          {/* Mode indicator */}
          <div className="flex items-center gap-2 mb-2.5">
            <div className="live-dot w-1.5 h-1.5" />
            <span className="text-xs flex items-center gap-1.5" style={{ color: MODE_COLORS[mode] }}>
              {(() => {
                const Icon = ModeIcons[CHAT_MODES[mode].iconName] || Sparkles;
                return <Icon className="w-3 h-3" />;
              })()}
              {CHAT_MODES[mode].label}
            </span>
            <span className="text-xs" style={{ color: '#2a2a2a' }}>· Enter to send · Shift+Enter for new line</span>
          </div>

          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                id="chat-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask a question about your study material..."
                rows={1}
                disabled={isStreaming}
                className="input-field resize-none leading-relaxed"
                style={{ minHeight: '48px', maxHeight: '140px', paddingRight: '3rem' }}
              />
            </div>

            {isStreaming ? (
              <button id="stop-btn" onClick={stop}
                      className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all"
                      style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.25)', color: '#ff5050' }}>
                <StopCircle className="w-5 h-5" />
              </button>
            ) : (
              <button id="send-btn" onClick={send} disabled={!input.trim()}
                      className="flex-shrink-0 btn-primary w-12 h-12 p-0">
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
