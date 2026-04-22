package com.campusgpt.document.repository;

/**
 * Spring Data projection for the chunk similarity search native query.
 * Maps the native SQL result columns to Java getters.
 */
public interface ChunkSearchResult {
    Long getId();
    String getContent();
    Long getDocumentId();
    String getDocTitle();
    Integer getPageNumber();
    String getEmbedding();
    Double getSimilarityScore();
    Double getRrfScore();
    String getMatchType();
}
