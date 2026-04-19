package com.campusgpt.document.repository;

import com.campusgpt.document.entity.ChunkEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for text chunks.
 * Contains the core pgvector similarity search query used by the RAG pipeline.
 */
@Repository
public interface ChunkRepository extends JpaRepository<ChunkEntity, Long> {

    /**
     * Finds the top-K most similar chunks to a query vector using pgvector cosine distance.
     *
     * The query:
     *   1. Joins chunks → documents → user filter (so users only search their own docs)
     *   2. Casts the stored TEXT embedding and query string to pgvector's vector type
     *   3. Orders by <=> (cosine distance, lower = more similar)
     *   4. Returns only the top :limit results
     *
     * Prerequisites:
     *   - PostgreSQL with pgvector extension installed
     *   - The embedding column stores vectors in format "[f1,f2,...,f768]"
     *
     * @param userId      ID of the authenticated user (security isolation)
     * @param queryVector Embedding of the user's question as "[f1,f2,...,f768]"
     * @param limit       Number of chunks to return (typically 5)
     * @return List of matching chunks projected to ChunkSearchResult
     */
    @Query(value = """
            SELECT c.id,
                   c.content,
                   c.document_id AS documentId,
                   GREATEST(0, LEAST(1, 1 - (c.embedding <=> CAST(:queryVector AS vector)))) AS similarityScore
            FROM   chunks c
            JOIN   documents d ON c.document_id = d.id
            WHERE  d.user_id = :userId
              AND  c.embedding IS NOT NULL
            ORDER  BY c.embedding <=> CAST(:queryVector AS vector)
            LIMIT  :limit
            """, nativeQuery = true)
    List<ChunkSearchResult> findSimilarChunks(
            @Param("userId") Long userId,
            @Param("queryVector") String queryVector,
            @Param("limit") int limit
    );

    /** Delete all chunks for a given document (used when deleting a document) */
    void deleteByDocumentId(Long documentId);
}
