import axiosInstance from './axiosInstance';
import { Document } from '../types';

/**
 * documentService wraps the document management API endpoints.
 */
export const documentService = {

  /**
   * POST /api/upload (multipart/form-data)
   * Uploads a PDF file with an optional category tag.
   * Returns the processed document metadata.
   */
  upload: async (file: File, category: string): Promise<Document> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    const response = await axiosInstance.post<Document>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000, // 2 min — embedding can take time for large PDFs
    });
    return response.data;
  },

  /**
   * GET /api/documents
   * Returns all documents for the authenticated user.
   */
  list: async (): Promise<Document[]> => {
    const response = await axiosInstance.get<Document[]>('/documents');
    return response.data;
  },

  /**
   * DELETE /api/documents/:id
   * Deletes a document and all its chunks.
   */
  delete: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/documents/${id}`);
  },
};
