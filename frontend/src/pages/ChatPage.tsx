import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Send, StopCircle, Bot, User, Sparkles, Plus, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { documentService } from '../services/documentService';
import { chatService } from '../services/chatService';
import { Document, Message, ChatMode, CHAT_MODES } from '../types';

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
  const { user } = useAuth();
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState('');
  const [mode, setMode]               = useState<ChatMode>('EXPLAIN_CONCEPT');
  const [isStreaming, setIsStreaming]  = useState(false);
  const [documents, setDocuments]     = useState<Document[]>([]);
  const abortRef                      = useRef<AbortController | null>(null);
  const bottomRef                     = useRef<HTMLDivElement>(null);
  const textareaRef                   = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { documentService.list().then(setDocuments).catch(() => {}); }, []);
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
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setIsStreaming(true);
    const aiId = aiMsg.id;

    abortRef.current?.abort();
    abortRef.current = chatService.stream(
      q, mode,
      (token) => setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: m.content + token } : m)),
      ()      => { setMessages(prev => prev.map(m => m.id === aiId ? { ...m, isStreaming: false } : m)); setIsStreaming(false); },
      (err)   => { setMessages(prev => prev.map(m => m.id === aiId ? { ...m, content: `⚠ ${err}`, isStreaming: false } : m)); setIsStreaming(false); }
    );
  }, [input, isStreaming, mode]);

  const stop = () => { abortRef.current?.abort(); setIsStreaming(false); setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m)); };

  return (
    <div className="h-full flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 py-4 flex items-center justify-between"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-end gap-0.5 h-5">
            {[1,2,3,4,5].map((_, i) => (
              <div key={i} className={isStreaming ? 'wave-bar' : 'wave-bar'} style={{
                height: ['10px','16px','8px','14px','6px'][i],
                opacity: isStreaming ? 1 : 0.3,
                animationPlayState: isStreaming ? 'running' : 'paused',
                animationDelay: `${i*0.1}s`
              }} />
            ))}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">CampusGPT Chat</p>
            <p className="text-xs" style={{ color: '#3a3a3a' }}>
              {documents.length} doc{documents.length !== 1 ? 's' : ''} in context · {CHAT_MODES[mode].label} mode
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode selector */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {(Object.entries(CHAT_MODES) as [ChatMode, typeof CHAT_MODES[ChatMode]][]).map(([key, val]) => (
              <button key={key} onClick={() => setMode(key)}
                      className={`mode-pill text-xs py-1.5 px-2.5 ${mode === key ? 'active' : ''}`}
                      style={mode === key ? { '--tw-border-opacity': 1, color: MODE_COLORS[key] } as React.CSSProperties : {}}>
                {val.emoji} {val.label}
              </button>
            ))}
          </div>

          <button className="btn-ghost py-2 px-3 text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
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
                    {msg.isStreaming && msg.content === '' ? (
                      <div className="flex gap-1.5 py-1">
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                      </div>
                    ) : (
                      <div className="ai-prose">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
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
            <span className="text-xs" style={{ color: MODE_COLORS[mode] }}>{CHAT_MODES[mode].emoji} {CHAT_MODES[mode].label}</span>
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
