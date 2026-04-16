package com.campusgpt.document.dto;

import com.campusgpt.document.entity.DocumentEntity;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/** DTO returned when listing or uploading documents */
@Data
@Builder
public class DocumentResponse {
    private Long id;
    private String originalFilename;
    private String category;
    private Long sizeBytes;
    private Integer chunkCount;
    private LocalDateTime createdAt;

    /** Converts a DocumentEntity to a response DTO */
    public static DocumentResponse from(DocumentEntity entity) {
        return DocumentResponse.builder()
                .id(entity.getId())
                .originalFilename(entity.getOriginalFilename())
                .category(entity.getCategory())
                .sizeBytes(entity.getSizeBytes())
                .chunkCount(entity.getChunkCount())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
