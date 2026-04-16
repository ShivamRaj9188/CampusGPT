import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, username: string, email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY    = 'campusgpt_token';
const USERNAME_KEY = 'campusgpt_username';
const EMAIL_KEY    = 'campusgpt_email';

/**
 * AuthProvider wraps the entire app and provides authentication state.
 * Token is persisted in localStorage so sessions survive page refreshes.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedToken    = localStorage.getItem(TOKEN_KEY);
    const savedUsername = localStorage.getItem(USERNAME_KEY);
    const savedEmail    = localStorage.getItem(EMAIL_KEY);

    if (savedToken && savedUsername && savedEmail) {
      setToken(savedToken);
      setUser({ id: 0, username: savedUsername, email: savedEmail });
    }

    setIsLoading(false);
  }, []);

  /** Called after successful login/signup */
  const login = (newToken: string, username: string, email: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USERNAME_KEY, username);
    localStorage.setItem(EMAIL_KEY, email);
    setToken(newToken);
    setUser({ id: 0, username, email });
  };

  /** Clears all auth state and storage */
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(EMAIL_KEY);
    setToken(null);
    setUser(null);
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
