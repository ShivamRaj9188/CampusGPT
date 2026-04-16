/**
 * Application-wide constants for CampusGPT.
 * Keep all magic strings / numbers in one place.
 */

export const APP_NAME = 'CampusGPT';
export const APP_TAGLINE = 'AI Academic Operating System';

/** Category → brand colour mapping used by Documents, Dashboard, and Chat */
export const CATEGORY_COLORS: Record<string, string> = {
  Physics:   '#00ff9d',
  Chemistry: '#00c8ff',
  Math:      '#a259ff',
  DBMS:      '#00ff9d',
  OS:        '#00c8ff',
  CN:        '#ff6b35',
  AI:        '#a259ff',
  ML:        '#00c8ff',
  Java:      '#ff6b35',
  General:   '#5a5a5a',
  Default:   '#5a5a5a',
};

/** Brand palette tokens */
export const COLORS = {
  neonGreen:  '#00ff9d',
  teal:       '#00c8ff',
  purple:     '#a259ff',
  orange:     '#ff6b35',
  yellow:     '#fbbf24',
  pink:       '#ec4899',
  bgBase:     '#050505',
  bgCard:     '#0a0a0a',
  textMuted:  '#5a5a5a',
  textDim:    '#3a3a3a',
} as const;
