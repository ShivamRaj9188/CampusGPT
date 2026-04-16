import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { userService } from '../services/userService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, username: string, email: string, streakCount: number, aiConfidence: number) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY    = 'campusgpt_token';
const USERNAME_KEY = 'campusgpt_username';
const EMAIL_KEY    = 'campusgpt_email';
const STREAK_KEY   = 'campusgpt_streak';
const AI_CONFIDENCE_KEY = 'campusgpt_ai_confidence';

/**
 * AuthProvider wraps the entire app and provides authentication state.
 * Token is persisted in localStorage so sessions survive page refreshes.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyUser = (nextUser: User | null) => {
    setUser(nextUser);

    if (!nextUser) {
      localStorage.removeItem(USERNAME_KEY);
      localStorage.removeItem(EMAIL_KEY);
      localStorage.removeItem(STREAK_KEY);
      localStorage.removeItem(AI_CONFIDENCE_KEY);
      return;
    }

    localStorage.setItem(USERNAME_KEY, nextUser.username);
    localStorage.setItem(EMAIL_KEY, nextUser.email);
    localStorage.setItem(STREAK_KEY, String(nextUser.streakCount ?? 0));
    localStorage.setItem(AI_CONFIDENCE_KEY, String(nextUser.aiConfidence ?? 0));
  };

  const refreshUser = async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return;

    try {
      const profile = await userService.getProfile();
      applyUser({
        id: 0,
        username: profile.username,
        email: profile.email,
        streakCount: profile.streakCount,
        aiConfidence: profile.aiConfidence,
      });
    } catch {
      // 401s are handled centrally by the axios interceptor.
    }
  };

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedToken    = localStorage.getItem(TOKEN_KEY);
    const savedUsername = localStorage.getItem(USERNAME_KEY);
    const savedEmail    = localStorage.getItem(EMAIL_KEY);
    const savedStreak   = localStorage.getItem(STREAK_KEY);
    const savedAiConfidence = localStorage.getItem(AI_CONFIDENCE_KEY);

    if (savedToken && savedUsername && savedEmail) {
      setToken(savedToken);
      applyUser({
        id: 0, 
        username: savedUsername, 
        email: savedEmail, 
        streakCount: savedStreak ? parseInt(savedStreak) : 0,
        aiConfidence: savedAiConfidence ? parseInt(savedAiConfidence) : 0,
      });
    }

    void (async () => {
      if (savedToken) {
        await refreshUser();
      }
      setIsLoading(false);
    })();
  }, []);

  /** Called after successful login/signup */
  const login = (newToken: string, username: string, email: string, streakCount: number, aiConfidence: number) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    applyUser({ id: 0, username, email, streakCount, aiConfidence });
  };

  /** Clears all auth state and storage */
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    applyUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Hook to consume auth context in any component */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
