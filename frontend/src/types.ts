// ─── Shared TypeScript types for CampusGPT ───────────────────────────────────

export interface User {
  id: number;
  username: string;
  email: string;
  streakCount?: number;
  aiConfidence?: number;
}

export interface AuthResponse {
  token: string;
  username: string;
  email: string;
  streakCount: number;
  aiConfidence: number;
}

export interface UserProfileResponse {
  username: string;
  email: string;
  streakCount: number;
  aiConfidence: number;
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
  metrics?: any;
}

/** Display labels and descriptions for each mode */
export const CHAT_MODES: Record<ChatMode, {
  label: string;
  iconName: string;
  description: string;
  color: string;
  tags: string[];
  useCase: string;
}> = {
  EXPLAIN_CONCEPT: {
    label: 'Explain Concept',
    iconName: 'Lightbulb',
    description: 'Clear explanation with analogies',
    color: '#00ff9d',
    tags: ['Deep Learning', 'Analogies', 'Examples'],
    useCase: 'Best for understanding new or difficult concepts',
  },
  TEN_MARK: {
    label: '10-Mark Answer',
    iconName: 'FileText',
    description: 'Structured exam-ready answer',
    color: '#00c8ff',
    tags: ['Exam Ready', 'Structured', '10 Marks'],
    useCase: 'Best for university exam preparation',
  },
  SHORT_NOTES: {
    label: 'Short Notes',
    iconName: 'Zap',
    description: 'Bullet-point quick revision',
    color: '#a259ff',
    tags: ['Bullet Points', 'Quick Revision', 'Key Terms'],
    useCase: 'Best for rapid revision before exams',
  },
  VIVA: {
    label: 'Viva Questions',
    iconName: 'Mic',
    description: 'Q&A for oral exams',
    color: '#ff6b35',
    tags: ['Oral Exam', 'Q&A Format', 'Interview Prep'],
    useCase: 'Best for lab viva and oral examinations',
  },
  REVISION_BLAST: {
    label: 'Revision Blast',
    iconName: 'Rocket',
    description: 'Ultra-fast key-point summary',
    color: '#fbbf24',
    tags: ['Speed Study', 'Key Points', 'Rapid'],
    useCase: 'Best for day-before exam revision',
  },
  EXAM_STRATEGY: {
    label: 'Exam Strategy',
    iconName: 'Target',
    description: 'Topic prioritization & planning',
    color: '#ec4899',
    tags: ['Strategy', 'PYQ Analysis', 'Time Plan'],
    useCase: 'Best for exam planning and prioritization',
  },
};
