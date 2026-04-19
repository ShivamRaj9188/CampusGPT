package com.campusgpt.document.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * JPA entity representing a text chunk from a PDF document.
 *
 * Each chunk stores:
 * - A segment of the extracted PDF text (typically 512 characters)
 * - Its embedding vector as a pgvector-compatible string "[f1, f2, ...]"
 *   which is cast to the vector type at query time for similarity search.
 */
@Entity
@Table(name = "chunks", indexes = {
    @Index(name = "idx_chunks_document_id", columnList = "document_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChunkEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The document this chunk belongs to */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private DocumentEntity document;

    /** The actual text content of this chunk */
    @Column(name = "content", columnDefinition = "TEXT", nullable = false)
    private String content;

    /** Index of this chunk within its parent document (0-based) */
    @Column(name = "chunk_index")
    private Integer chunkIndex;

    /**
     * Embedding vector stored as a pgvector-compatible TEXT string.
     * Format: "[0.12345, -0.98765, ...]" — 768 dimensions (nomic-embed-text).
     * At query time, cast with ::vector for cosine similarity: embedding::vector <=> query::vector
     */
    @Column(name = "embedding", columnDefinition = "vector(768)")
    @org.hibernate.annotations.ColumnTransformer(read = "embedding::text", write = "?::vector")
    private String embedding;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
