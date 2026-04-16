import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

interface StatCardProps {
  value: number | string;
  label: string;
  icon: React.ReactNode;
  color: string;
  delay?: number;
}

/**
 * Reusable stat card for displaying a numeric metric with a label and icon.
 * Used on the Dashboard to show PDFs, chunks, subjects, etc.
 */
export function StatCard({ value, label, icon, color, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="stat-card"
    >
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-xl" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
          <div style={{ color }}>{icon}</div>
        </div>
        <TrendingUp className="w-3.5 h-3.5" style={{ color: '#2a2a2a' }} />
      </div>
      <p className="text-2xl font-bold text-white mt-2">{value}</p>
      <p className="text-xs" style={{ color: '#5a5a5a' }}>{label}</p>
    </motion.div>
  );
}
