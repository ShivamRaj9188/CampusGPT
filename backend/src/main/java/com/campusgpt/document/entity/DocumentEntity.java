package com.campusgpt.document.entity;

import com.campusgpt.auth.entity.UserEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * JPA entity representing an uploaded PDF document.
 * Each document belongs to one user and has many text chunks.
 */
@Entity
@Table(name = "documents")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The user who uploaded this document */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    /** Original filename as uploaded by the user */
    @Column(name = "original_filename", nullable = false)
    private String originalFilename;

    /** Internal unique filename to avoid collisions on disk */
    @Column(name = "filename", nullable = false, unique = true)
    private String filename;

    /** User-defined category/subject tag (e.g., "Physics", "DBMS") */
    @Column(name = "category", length = 100)
    private String category;

    /** File size in bytes */
    @Column(name = "size_bytes")
    private Long sizeBytes;

    /** Number of text chunks generated from this document */
    @Column(name = "chunk_count")
    private Integer chunkCount;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /** Associated text chunks (cascade delete when document is deleted) */
    @OneToMany(mappedBy = "document", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ChunkEntity> chunks = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
