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

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "category", length = 100)
    private String category;

    /** The actual text content of this chunk */
    @Column(name = "content", columnDefinition = "TEXT", nullable = false)
    private String content;

    /** Index of this chunk within its parent document (0-based) */
    @Column(name = "chunk_index")
    private Integer chunkIndex;

    @Column(name = "embedding", columnDefinition = "vector(768)")
    @org.hibernate.annotations.ColumnTransformer(read = "embedding::text", write = "?::vector")
    private String embedding;

    @Column(name = "content_hash", length = 64, unique = true)
    private String contentHash;

    @Column(name = "section_index")
    private Integer sectionIndex;

    @Column(name = "page_number")
    private Integer pageNumber;

    @Column(name = "search_vector", columnDefinition = "tsvector",
            insertable = false, updatable = false)
    private String searchVector;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
