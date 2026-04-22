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

    @Query(value = """
        WITH pre_filtered AS (
            -- STAGE 1: Fast B-Tree pre-filter on denormalized columns
            SELECT id, content, embedding, section_index, page_number, document_id, search_vector
            FROM chunks
            WHERE user_id = :userId
              AND (:category IS NULL OR category = :category)
        ),
        vector_ranked AS (
            -- STAGE 2a: ANN search
            SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> CAST(:queryEmbedding AS vector)) AS rank
            FROM pre_filtered
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:queryEmbedding AS vector)
            LIMIT 60
        ),
        keyword_ranked AS (
            -- STAGE 2b: Keyword search
            SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank(search_vector, query) DESC) AS rank
            FROM pre_filtered, plainto_tsquery('english', :queryText) query
            WHERE search_vector @@ query
            ORDER BY ts_rank(search_vector, query) DESC
            LIMIT 60
        ),
        rrf_fusion AS (
            -- STAGE 2c: Reciprocal Rank Fusion
            SELECT
                COALESCE(v.id, k.id) AS id,
                COALESCE(1.0/(60 + v.rank), 0) + COALESCE(1.0/(60 + k.rank), 0) AS rrf_score,
                CASE
                    WHEN v.id IS NOT NULL AND k.id IS NOT NULL THEN 'HYBRID'
                    WHEN v.id IS NOT NULL THEN 'SEMANTIC'
                    ELSE 'KEYWORD'
                END AS match_type
            FROM vector_ranked v
            FULL OUTER JOIN keyword_ranked k ON v.id = k.id
        )
        SELECT 
            p.id, p.content, p.document_id AS documentId, d.original_filename AS docTitle, 
            p.page_number AS pageNumber, CAST(p.embedding AS TEXT) AS embedding,
            GREATEST(0, LEAST(1, 1 - (p.embedding <=> CAST(:queryEmbedding AS vector)))) AS similarityScore,
            r.rrf_score AS rrfScore, r.match_type AS matchType
        FROM rrf_fusion r
        JOIN chunks p ON r.id = p.id
        JOIN documents d ON p.document_id = d.id
        ORDER BY r.rrf_score DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<ChunkSearchResult> hybridSearch(
            @Param("userId") Long userId,
            @Param("category") String category,
            @Param("queryEmbedding") String queryEmbedding,
            @Param("queryText") String queryText,
            @Param("limit") int limit
    );

    /** Check if chunk content already exists to avoid redundant embeddings */
    boolean existsByContentHash(String contentHash);

    /** Delete all chunks for a given document (used when deleting a document) */
    void deleteByDocumentId(Long documentId);
}
