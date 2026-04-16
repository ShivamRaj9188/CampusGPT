import { useState, useEffect } from 'react';
import { documentService } from '../services/documentService';
import { Document } from '../types';

/**
 * Custom hook to fetch the authenticated user's document list.
 * Handles loading state and errors transparently.
 */
export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    documentService.list()
      .then(setDocuments)
      .catch(() => setError('Failed to load documents'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const remove = (id: number) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
  };

  return { documents, loading, error, refresh, remove };
}
