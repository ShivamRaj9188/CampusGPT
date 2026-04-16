package com.campusgpt.embedding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Service for generating text embeddings using Ollama's embedding API.
 *
 * Model: nomic-embed-text (768-dimensional output)
 * Endpoint: POST http://localhost:11434/api/embeddings
 *
 * Used during:
 *   1. Document upload — embed each text chunk for storage
 *   2. Chat requests  — embed the user's question for similarity search
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OllamaEmbeddingService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${ollama.base-url}")
    private String ollamaBaseUrl;

    @Value("${ollama.embedding-model}")
    private String embeddingModel;

    @Value("${rag.embedding-cache-minutes:15}")
    private long embeddingCacheMinutes;

    @Value("${rag.max-cached-embeddings:200}")
    private int maxCachedEmbeddings;

    /**
     * Small LRU cache for repeated question embeddings.
     * This keeps common retries and repeat questions snappy without adding dependencies.
     */
    private final Map<String, CachedEmbedding> embeddingCache = new LinkedHashMap<>(16, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, CachedEmbedding> eldest) {
            return size() > maxCachedEmbeddings;
        }
    };

    /**
     * Generates an embedding vector for the given text.
     *
     * @param text The input text to embed
     * @return float[] — the embedding vector (768 dimensions for nomic-embed-text)
     * @throws RuntimeException if Ollama is unreachable or returns an error
     */
    public float[] embed(String text) {
        log.debug("Embedding text of length {} with model {}", text.length(), embeddingModel);
        float[] cached = getCachedEmbedding(text);
        if (cached != null) {
            return cached;
        }

        // Build request payload for Ollama embeddings API
        Map<String, String> request = Map.of(
                "model", embeddingModel,
                "prompt", text   // Ollama uses "prompt" (not "input") for embeddings
        );

        try {
            // Call Ollama synchronously (block for embedding — latency is acceptable here)
            String responseBody = webClient.post()
                    .uri(ollamaBaseUrl + "/api/embeddings")
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            // Parse the JSON response and extract the "embedding" array
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode embeddingNode = root.get("embedding");

            if (embeddingNode == null || !embeddingNode.isArray()) {
                throw new RuntimeException("Invalid embedding response from Ollama");
            }

            // Convert JSON array → float[]
            float[] embedding = new float[embeddingNode.size()];
            for (int i = 0; i < embeddingNode.size(); i++) {
                embedding[i] = (float) embeddingNode.get(i).asDouble();
            }

            cacheEmbedding(text, embedding);
            log.debug("Generated embedding of dimension {}", embedding.length);
            return embedding;

        } catch (Exception e) {
            log.error("Failed to generate embedding: {}", e.getMessage());
            throw new RuntimeException("Embedding service unavailable. Is Ollama running with nomic-embed-text?", e);
        }
    }

    private synchronized float[] getCachedEmbedding(String text) {
        CachedEmbedding cached = embeddingCache.get(text);
        if (cached == null) {
            return null;
        }
        if (cached.expiresAt().isBefore(Instant.now())) {
            embeddingCache.remove(text);
            return null;
        }
        return cached.embedding();
    }

    private synchronized void cacheEmbedding(String text, float[] embedding) {
        embeddingCache.put(
                text,
                new CachedEmbedding(
                        embedding.clone(),
                        Instant.now().plus(Duration.ofMinutes(embeddingCacheMinutes))
                )
        );
    }

    /**
     * Converts a float[] to the pgvector string format: "[f1,f2,...,fn]"
     * This format is understood by PostgreSQL's ::vector cast.
     */
    public String vectorToString(float[] embedding) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < embedding.length; i++) {
            sb.append(embedding[i]);
            if (i < embedding.length - 1) sb.append(",");
        }
        sb.append("]");
        return sb.toString();
    }

    private record CachedEmbedding(float[] embedding, Instant expiresAt) {}
}
