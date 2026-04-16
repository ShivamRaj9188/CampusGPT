import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Tag, X, Loader2, CheckCircle, Trash2, AlertTriangle } from 'lucide-react';
import { documentService } from '../services/documentService';
import { Document } from '../types';
import { format } from 'date-fns';

const CATEGORY_SUGGESTIONS = ['DBMS', 'CN', 'AI', 'ML', 'Java', 'OS', 'Physics', 'Math', 'Chemistry', 'General'];

export default function UploadPage() {
  const [pendingFile, setPendingFile]   = useState<File | null>(null);
  const [category, setCategory]         = useState('');
  const [uploading, setUploading]       = useState(false);
  const [error, setError]               = useState('');
  const [recentUploads, setRecentUploads] = useState<Document[]>([]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop: (accepted) => { if (accepted[0]) { setPendingFile(accepted[0]); setError(''); } },
    onDropRejected: () => setError('Only PDF files are accepted'),
  });

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true); setError('');
    try {
      const doc = await documentService.upload(pendingFile, category || 'General');
      setRecentUploads(prev => [doc, ...prev]);
      setPendingFile(null); setCategory('');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? 'Upload failed. Is Ollama running?');
    } finally { setUploading(false); }
  };

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium mb-1" style={{ color: '#00ff9d', letterSpacing: '0.1em' }}>UPLOAD CENTER</p>
        <h1 className="text-2xl font-bold text-white">Add Study Materials</h1>
        <p className="text-sm mt-1" style={{ color: '#5a5a5a' }}>Upload PDFs to be chunked, embedded, and indexed for AI retrieval</p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        id="upload-dropzone"
        className="relative rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 mb-4"
        style={{
          border: `2px dashed ${isDragActive ? 'rgba(0,255,157,0.6)' : pendingFile ? 'rgba(0,255,157,0.35)' : 'rgba(255,255,255,0.08)'}`,
          background: isDragActive ? 'rgba(0,255,157,0.04)' : 'rgba(255,255,255,0.02)',
          animation: isDragActive ? 'borderPulse 1.5s ease-in-out infinite' : undefined,
        }}
      >
        <input {...getInputProps()} />

        {/* Decorative corner accents */}
        {['top-3 left-3', 'top-3 right-3', 'bottom-3 left-3', 'bottom-3 right-3'].map((pos, i) => (
          <div key={i} className={`absolute ${pos} w-4 h-4 transition-colors duration-300`}
               style={{
                 borderTop: i < 2 ? `1px solid ${isDragActive ? '#00ff9d' : 'rgba(255,255,255,0.15)'}` : undefined,
                 borderBottom: i >= 2 ? `1px solid ${isDragActive ? '#00ff9d' : 'rgba(255,255,255,0.15)'}` : undefined,
                 borderLeft: i % 2 === 0 ? `1px solid ${isDragActive ? '#00ff9d' : 'rgba(255,255,255,0.15)'}` : undefined,
                 borderRight: i % 2 === 1 ? `1px solid ${isDragActive ? '#00ff9d' : 'rgba(255,255,255,0.15)'}` : undefined,
               }} />
        ))}

        <div className="flex flex-col items-center gap-3">
          {isDragActive ? (
            <>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center animate-float"
                   style={{ background: 'rgba(0,255,157,0.1)', border: '1px solid rgba(0,255,157,0.3)' }}>
                <Upload className="w-7 h-7" style={{ color: '#00ff9d' }} />
              </div>
              <p className="text-base font-semibold" style={{ color: '#00ff9d' }}>Drop to upload!</p>
            </>
          ) : pendingFile ? (
            <>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                   style={{ background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.2)' }}>
                <FileText className="w-7 h-7" style={{ color: '#00ff9d' }} />
              </div>
              <div>
                <p className="text-base font-semibold text-white">{pendingFile.name}</p>
                <p className="text-sm" style={{ color: '#5a5a5a' }}>
                  {(pendingFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                   style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Upload className="w-7 h-7" style={{ color: '#3a3a3a' }} />
              </div>
              <div>
                <p className="text-base font-semibold text-white">Drop your PDF here</p>
                <p className="text-sm mt-1" style={{ color: '#3a3a3a' }}>or click to browse files</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {['Notes', 'PYQs', 'Syllabus', 'Research Papers'].map(tag => (
                  <span key={tag} className="badge-dim">{tag}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category + upload controls */}
      <AnimatePresence>
        {pendingFile && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3 mb-4"
          >
            {/* Category input */}
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#3a3a3a' }} />
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="Subject / Category"
                className="input-field pl-9"
              />
            </div>
            {/* Quick category chips */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_SUGGESTIONS.map(cat => (
                <button key={cat} onClick={() => setCategory(cat)}
                        className={`badge-dim cursor-pointer transition-all hover:border-[rgba(0,255,157,0.3)] hover:text-[#00ff9d] ${category === cat ? 'badge-green' : ''}`}>
                  {cat}
                </button>
              ))}
            </div>
            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                id="upload-btn"
                onClick={handleUpload}
                disabled={uploading}
                className="btn-primary flex-1 py-3"
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Indexing PDF...</span></>
                ) : (
                  <><Upload className="w-4 h-4" /><span>Process & Index</span></>
                )}
              </button>
              <button onClick={() => setPendingFile(null)} className="btn-ghost py-3 px-4">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Processing status notice */}
      {uploading && (
        <div className="glass-card-neon p-4 flex items-center gap-3 mb-4">
          <div className="flex gap-0.5 items-end h-5">
            {[1,2,3,4,5].map((_, i) => (
              <div key={i} className="wave-bar" style={{ animationDelay: `${i*0.1}s` }} />
            ))}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: '#00ff9d' }}>Indexing in progress</p>
            <p className="text-xs" style={{ color: '#5a5a5a' }}>Extracting text → chunking → generating embeddings via Ollama...</p>
          </div>
        </div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-sm px-4 py-3 rounded-xl mb-4"
            style={{ background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: '#ff6b6b' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent uploads this session */}
      {recentUploads.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" style={{ color: '#00ff9d' }} /> Indexed This Session
          </h2>
          <div className="space-y-2">
            {recentUploads.map(doc => (
              <div key={doc.id} className="glass-card px-4 py-3 flex items-center gap-3">
                <FileText className="w-4 h-4 flex-shrink-0" style={{ color: '#00ff9d' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{doc.originalFilename}</p>
                  <p className="text-xs" style={{ color: '#3a3a3a' }}>{doc.chunkCount} chunks indexed · {doc.category}</p>
                </div>
                <span className="badge-green text-xs">Indexed</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
