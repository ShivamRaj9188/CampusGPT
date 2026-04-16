// ─── Shared TypeScript types for CampusGPT ───────────────────────────────────

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  username: string;
  email: string;
}

export interface Document {
  id: number;
  originalFilename: string;
  category: string;
  sizeBytes: number;
  chunkCount: number;
  createdAt: string;
}

/** Smart answer modes matching the backend ChatMode enum */
export type ChatMode = 'EXPLAIN_CONCEPT' | 'TEN_MARK' | 'SHORT_NOTES' | 'VIVA' | 'REVISION_BLAST' | 'EXAM_STRATEGY';

export interface ChatRequest {
  question: string;
  mode: ChatMode;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

/** Display labels and descriptions for each mode */
export const CHAT_MODES: Record<ChatMode, { label: string; emoji: string; description: string }> = {
  EXPLAIN_CONCEPT: {
    label: 'Explain Concept',
    emoji: '💡',
    description: 'Clear explanation with analogies',
  },
  TEN_MARK: {
    label: '10-Mark Answer',
    emoji: '📝',
    description: 'Structured exam-ready answer',
  },
  SHORT_NOTES: {
    label: 'Short Notes',
    emoji: '⚡',
    description: 'Bullet-point quick revision',
  },
  VIVA: {
    label: 'Viva Questions',
    emoji: '🎤',
    description: 'Q&A for oral exams',
  },
  REVISION_BLAST: {
    label: 'Revision Blast',
    emoji: '🚀',
    description: 'Ultra-fast key-point summary',
  },
  EXAM_STRATEGY: {
    label: 'Exam Strategy',
    emoji: '🎯',
    description: 'Topic prioritization & planning',
  },
};
