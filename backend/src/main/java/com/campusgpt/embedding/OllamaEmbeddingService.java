package com.campusgpt.embedding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

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

    /**
     * Generates an embedding vector for the given text.
     *
     * @param text The input text to embed
     * @return float[] — the embedding vector (768 dimensions for nomic-embed-text)
     * @throws RuntimeException if Ollama is unreachable or returns an error
     */
    public float[] embed(String text) {
        log.debug("Embedding text of length {} with model {}", text.length(), embeddingModel);

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

            log.debug("Generated embedding of dimension {}", embedding.length);
            return embedding;

        } catch (Exception e) {
            log.error("Failed to generate embedding: {}", e.getMessage());
            throw new RuntimeException("Embedding service unavailable. Is Ollama running with nomic-embed-text?", e);
        }
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
}
