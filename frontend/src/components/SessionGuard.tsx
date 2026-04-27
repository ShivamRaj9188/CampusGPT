import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * SessionGuard — Frontend security component
 *
 * Decodes the JWT stored in localStorage (without a library — JWTs are
 * base64url-encoded JSON, readable client-side since they are not encrypted).
 *
 * Behaviour:
 *  - Checks expiry every 60 seconds
 *  - Shows a warning toast when < WARN_BEFORE_MS from expiry
 *  - Auto-logs out exactly at token expiry
 *
 * Note: This is a UX-layer guard only. The backend always validates the JWT
 * on every request — this just prevents the user being surprised by a 401.
 */

const WARN_BEFORE_MS = 5 * 60 * 1000; // warn 5 min before expiry
const CHECK_INTERVAL = 60 * 1000;     // check every 60s

function decodeJwtExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // base64url → base64 → JSON
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(json);
    return typeof exp === 'number' ? exp * 1000 : null; // convert Unix seconds → ms
  } catch {
    return null;
  }
}

export function SessionGuard() {
  const { logout } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [visible, setVisible]         = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = () => {
    const token = localStorage.getItem('campusgpt_token');
    if (!token) return;

    const expiryMs = decodeJwtExpiry(token);
    if (!expiryMs) return;

    const remaining = expiryMs - Date.now();

    if (remaining <= 0) {
      // Token has expired — force logout immediately
      logout();
      return;
    }

    if (remaining <= WARN_BEFORE_MS) {
      setSecondsLeft(Math.ceil(remaining / 1000));
      setVisible(true);
    } else {
      setVisible(false);
    }
  };

  useEffect(() => {
    check(); // run immediately on mount
    intervalRef.current = setInterval(check, CHECK_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <AnimatePresence>
      {visible && secondsLeft !== null && (
        <motion.div
          key="session-warn"
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="fixed bottom-6 right-6 z-[999] flex items-start gap-3 rounded-2xl px-5 py-4 max-w-sm"
          style={{
            background: 'rgba(10,10,10,0.97)',
            border: '1px solid rgba(255,107,53,0.35)',
            boxShadow: '0 0 40px rgba(255,107,53,0.15), 0 8px 40px rgba(0,0,0,0.8)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.25)' }}
          >
            <ShieldAlert className="w-4 h-4" style={{ color: '#ff6b35' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white mb-0.5">Session expiring soon</p>
            <p className="text-xs" style={{ color: '#707070' }}>
              Your session expires in{' '}
              <span className="font-bold" style={{ color: '#ff6b35' }}>{fmt(secondsLeft)}</span>.
              You will be logged out automatically.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: 'rgba(255,107,53,0.12)',
                  border: '1px solid rgba(255,107,53,0.25)',
                  color: '#ff6b35',
                }}
              >
                <LogOut className="w-3 h-3" /> Logout now
              </button>
              <button
                onClick={() => setVisible(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ color: '#5a5a5a', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
