import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Trash2, Loader2, FolderOpen, Package } from 'lucide-react';
import { documentService } from '../services/documentService';
import { useDocuments } from '../hooks/useDocuments';
import { CATEGORY_COLORS } from '../utils/constants';
import { Document } from '../types';
import { format } from 'date-fns';

const SUBJECTS = ['All', 'DBMS', 'CN', 'AI', 'ML', 'Java', 'OS', 'Physics', 'Math', 'Chemistry', 'General'];

const COLORS: Record<string, string> = {
  ...CATEGORY_COLORS,
  All: '#5a5a5a',
};

export default function DocumentsPage() {
  const { documents, loading, remove } = useDocuments();
  const [filter, setFilter]            = useState('All');
  const [deletingId, setDeletingId]    = useState<number | null>(null);

  const filtered = filter === 'All' ? documents : documents.filter(d => d.category === filter);

  // Group by category for the summary row
  const grouped = documents.reduce<Record<string, Document[]>>((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {});

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try { await documentService.delete(id); remove(id); }
    catch { /* silently fail */ }
    finally { setDeletingId(null); }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: '#00ff9d', letterSpacing: '0.1em' }}>DOCUMENTS</p>
        <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
        <p className="text-sm mt-1" style={{ color: '#5a5a5a' }}>All indexed PDFs powering your RAG pipeline</p>
      </div>

      {/* Subject summary cards */}
      {!loading && Object.keys(grouped).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {Object.entries(grouped).map(([cat, docs]) => {
            const color = COLORS[cat] ?? '#5a5a5a';
            return (
              <motion.button
                key={cat}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setFilter(cat)}
                className="glass-card-hover p-4 text-left"
                style={filter === cat ? { borderColor: `${color}40`, background: `${color}08` } : {}}
              >
                <div className="p-2 rounded-lg mb-3 w-fit"
                     style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                  <Package className="w-4 h-4" style={{ color }} />
                </div>
                <p className="text-sm font-semibold text-white">{cat}</p>
                <p className="text-xs mt-0.5" style={{ color: '#3a3a3a' }}>
                  {docs.length} PDF{docs.length !== 1 ? 's' : ''} ·{' '}
                  {docs.reduce((a, d) => a + (d.chunkCount ?? 0), 0)} chunks
                </p>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {SUBJECTS.filter(s => s === 'All' || grouped[s]).map(s => {
          const color = COLORS[s] ?? '#5a5a5a';
          return (
            <button key={s} onClick={() => setFilter(s)}
                    className={`mode-pill text-xs ${filter === s ? 'active' : ''}`}
                    style={filter === s ? { color, borderColor: `${color}40` } : {}}>
              {s}
            </button>
          );
        })}
      </div>

      {/* Document grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => <div key={i} className="typing-dot" style={{ animationDelay: `${i*0.2}s` }} />)}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-10" />
          <p className="text-sm" style={{ color: '#3a3a3a' }}>No documents{filter !== 'All' ? ` in ${filter}` : ''}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map(doc => {
              const color = COLORS[doc.category] ?? '#5a5a5a';
              return (
                <motion.div
                  key={doc.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="glass-card p-5 flex flex-col gap-3 hover:border-[rgba(255,255,255,0.1)] transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl flex-shrink-0"
                         style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                      <FileText className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate" title={doc.originalFilename}>
                        {doc.originalFilename}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#3a3a3a' }}>
                        {doc.chunkCount} chunks indexed
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="badge-dim">{doc.category}</span>
                    <span className="text-xs" style={{ color: '#2a2a2a' }}>
                      {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>

                  {/* Indexed status bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="h-full rounded-full" style={{ width: '100%', background: `${color}40` }} />
                    </div>
                    <span className="text-xs" style={{ color: `${color}` }}>● Indexed</span>
                  </div>

                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs transition-all disabled:opacity-40"
                    style={{ background: 'rgba(255,80,80,0.05)', border: '1px solid rgba(255,80,80,0.15)', color: '#ff5a5a' }}
                  >
                    {deletingId === doc.id
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Deleting...</>
                      : <><Trash2 className="w-3 h-3" /> Delete</>}
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
