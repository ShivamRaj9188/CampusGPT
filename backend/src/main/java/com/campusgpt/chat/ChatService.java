package com.campusgpt.chat;

import com.campusgpt.auth.entity.UserEntity;
import com.campusgpt.auth.repository.UserRepository;
import com.campusgpt.chat.dto.ChatMode;
import com.campusgpt.chat.dto.ChatRequest;
import com.campusgpt.document.repository.ChunkRepository;
import com.campusgpt.document.repository.ChunkSearchResult;
import com.campusgpt.embedding.OllamaEmbeddingService;
import com.campusgpt.security.InputSanitizer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * ChatService implements the full RAG (Retrieval-Augmented Generation) pipeline:
 *
 *   1. Embed user's question via Ollama nomic-embed-text
 *   2. Retrieve top-5 similar chunks from pgvector (user-scoped)
 *   3. Build mode-specific prompt with context
 *   4. Stream response from llama3 via Ollama /api/generate
 *   5. Forward each token to the client via SSE (Server-Sent Events)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final WebClient webClient;
    private final OllamaEmbeddingService embeddingService;
    private final ChunkRepository chunkRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Value("${ollama.base-url}")
    private String ollamaBaseUrl;

    @Value("${ollama.model}")
    private String ollamaModel;

    /** Number of similar chunks to retrieve per RAG query */
    private static final int TOP_K = 5;

    /**
     * Runs the full RAG pipeline asynchronously and streams the LLM response
     * to the client via the provided SseEmitter.
     *
     * @param request   The chat request (question + mode)
     * @param username  Username of the authenticated user
     * @param emitter   SSE emitter to stream tokens to the client
     */
    public void streamChat(ChatRequest request, String username, SseEmitter emitter) {
        // Run async so we don't block the web server thread
        CompletableFuture.runAsync(() -> {
            try {
                UserEntity user = getUser(username);

                // ── Sanitize the question (OWASP A03 — Injection defense-in-depth)
                // @Valid already enforced length, but we strip control chars here
                // to prevent prompt-injection via Unicode tricks or null bytes
                String question = InputSanitizer.sanitizeQuestion(request.getQuestion());

                // ── Step 1: Embed the (sanitized) question ────────────────────
                log.debug("[RAG] Embedding question for user: {}", username);
                float[] questionEmbedding = embeddingService.embed(question);
                String queryVector = embeddingService.vectorToString(questionEmbedding);

                // ── Step 2: Retrieve top-K similar chunks from pgvector ────────
                List<ChunkSearchResult> similarChunks =
                        chunkRepository.findSimilarChunks(user.getId(), queryVector, TOP_K);
                log.debug("[RAG] Retrieved {} similar chunks", similarChunks.size());

                // ── Step 3: Build context from chunks ──────────────────────────
                String context = similarChunks.stream()
                        .map(ChunkSearchResult::getContent)
                        .collect(Collectors.joining("\n---\n"));

                // ── Step 4: Build the full prompt (mode-specific) ──────────────
                String prompt = buildPrompt(question, context, request.getMode());

                // ── Step 5: Stream response from Ollama llama3 ─────────────
                Map<String, Object> ollamaRequest = Map.of(
                        "model", ollamaModel,
                        "prompt", prompt,
                        "stream", true   // Enable NDJSON streaming
                );

                webClient.post()
                        .uri(ollamaBaseUrl + "/api/generate")
                        .bodyValue(ollamaRequest)
                        .retrieve()
                        .bodyToFlux(String.class)   // Each element is one NDJSON line
                        .subscribe(
                                line -> handleOllamaLine(line, emitter),
                                error -> handleStreamError(error, emitter),
                                emitter::complete
                        );

            } catch (Exception e) {
                log.error("[RAG] Chat stream failed: {}", e.getMessage(), e);
                try {
                    emitter.send(SseEmitter.event().data("[ERROR] " + e.getMessage()));
                    emitter.complete();
                } catch (Exception ex) {
                    emitter.completeWithError(ex);
                }
            }
        });
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    /**
     * Parses a single NDJSON line from Ollama's streaming response.
     * Format: {"model":"llama3","response":"token","done":false}
     * Sends the token to the SSE client; sends [DONE] when streaming completes.
     */
    private void handleOllamaLine(String line, SseEmitter emitter) {
        if (line == null || line.isBlank()) return;

        try {
            JsonNode node = objectMapper.readTree(line);
            String token = node.has("response") ? node.get("response").asText("") : "";
            boolean done  = node.has("done") && node.get("done").asBoolean();

            if (done) {
                emitter.send(SseEmitter.event().data("[DONE]"));
                emitter.complete();
            } else if (!token.isEmpty()) {
                emitter.send(SseEmitter.event().data(token));
            }
        } catch (Exception e) {
            log.warn("[RAG] Failed to parse Ollama line: {}", line);
        }
    }

    /** Handles WebClient errors during the Ollama stream */
    private void handleStreamError(Throwable error, SseEmitter emitter) {
        log.error("[RAG] Ollama stream error: {}", error.getMessage());
        try {
            emitter.send(SseEmitter.event().data("[ERROR] LLM service error: " + error.getMessage()));
            emitter.complete();
        } catch (Exception e) {
            emitter.completeWithError(e);
        }
    }

    /**
     * Builds the full LLM prompt based on the selected smart mode.
     *
     * Structure:
     *   [Mode-specific system instruction]
     *   \n\n
     *   Context from study materials (if any):
     *   ---
     *   [chunk 1]
     *   ---
     *   [chunk 2]
     *   ...
     *   \n\n
     *   Question: [user's question]
     *   \n\nAnswer:
     */
    private String buildPrompt(String question, String context, ChatMode mode) {
        String systemPrompt = switch (mode) {
            case EXPLAIN_CONCEPT ->
                "You are a knowledgeable and patient professor. " +
                "Explain the concept clearly and thoroughly, breaking down complex ideas with analogies and examples. " +
                "Base your explanation primarily on the context provided from the student's study materials.";

            case TEN_MARK ->
                "You are an experienced exam coach. " +
                "Provide a comprehensive, well-structured answer suitable for 10 marks in a university exam. " +
                "Structure your answer with: (1) a brief introduction, (2) numbered key points with explanations, " +
                "(3) relevant examples from the context, and (4) a concise conclusion.";

            case SHORT_NOTES ->
                "You are a concise study assistant. " +
                "Create well-organized short notes in bullet-point format. " +
                "Highlight key terms, keep explanations brief but complete, " +
                "and organize points under clear headings. " +
                "Make them ideal for quick revision before an exam.";
        };

        if (context.isBlank()) {
            // No context found (no documents uploaded or unrelated query) — answer directly
            return systemPrompt + "\n\nQuestion: " + question + "\n\nAnswer:";
        }

        return systemPrompt
                + "\n\nContext from uploaded study materials:\n---\n"
                + context
                + "\n---\n\nQuestion: " + question
                + "\n\nAnswer:";
    }

    private UserEntity getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
    }
}
