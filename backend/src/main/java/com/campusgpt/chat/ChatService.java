package com.campusgpt.chat;

import com.campusgpt.auth.AuthService;
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
    private final AuthService authService;
    private final ObjectMapper objectMapper;

    @Value("${ollama.base-url}")
    private String ollamaBaseUrl;

    @Value("${ollama.model}")
    private String ollamaModel;

    @Value("${ollama.keep-alive:10m}")
    private String ollamaKeepAlive;

    @Value("${ollama.temperature:0.2}")
    private double ollamaTemperature;

    @Value("${rag.top-k:3}")
    private int topK;

    @Value("${rag.max-context-chars:1800}")
    private int maxContextChars;

    @Value("${ollama.num-predict.default:220}")
    private int defaultNumPredict;

    @Value("${ollama.num-predict.explain-concept:260}")
    private int explainConceptNumPredict;

    @Value("${ollama.num-predict.ten-mark:360}")
    private int tenMarkNumPredict;

    @Value("${ollama.num-predict.short-notes:200}")
    private int shortNotesNumPredict;

    @Value("${ollama.num-predict.viva:240}")
    private int vivaNumPredict;

    @Value("${ollama.num-predict.revision-blast:180}")
    private int revisionBlastNumPredict;

    @Value("${ollama.num-predict.exam-strategy:220}")
    private int examStrategyNumPredict;

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
                authService.recordActivity(username); // Hardening: Record activity for streak tracking
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
                        chunkRepository.findSimilarChunks(user.getId(), queryVector, topK);
                log.debug("[RAG] Retrieved {} similar chunks", similarChunks.size());
                updateAiConfidence(user, similarChunks);

                // ── Step 3: Build context from chunks ──────────────────────────
                String context = buildContext(similarChunks);

                // ── Step 4: Build the full prompt (mode-specific) ──────────────
                String prompt = buildPrompt(question, context, request.getMode(), request.getHistory());

                // ── Step 5: Stream response from Ollama llama3 ─────────────
                Map<String, Object> ollamaRequest = Map.of(
                        "model", ollamaModel,
                        "prompt", prompt,
                        "stream", true,
                        "keep_alive", ollamaKeepAlive,
                        "options", Map.of(
                                "temperature", ollamaTemperature,
                                "num_predict", getNumPredict(request.getMode())
                        )
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
    private String buildPrompt(String question, String context, ChatMode mode, List<com.campusgpt.chat.dto.MessageDto> history) {
        String systemPrompt = switch (mode) {
            case EXPLAIN_CONCEPT ->
                "You are a knowledgeable and patient professor. " +
                "Explain the concept clearly and thoroughly, breaking down complex ideas with analogies and examples. " +
                "Base your explanation primarily on the context provided from the student's study materials. " +
                "Stay concise unless the context clearly demands more detail.";

            case TEN_MARK ->
                "You are an experienced exam coach. " +
                "Provide a comprehensive, well-structured answer suitable for 10 marks in a university exam. " +
                "Structure your answer with: (1) a brief introduction, (2) numbered key points with explanations, " +
                "(3) relevant examples from the context, and (4) a concise conclusion. " +
                "Do not add filler beyond what improves the final answer.";

            case SHORT_NOTES ->
                "You are a concise study assistant. " +
                "Create well-organized short notes in bullet-point format. " +
                "Highlight key terms, keep explanations brief but complete, " +
                "and organize points under clear headings. " +
                "Make them ideal for quick revision before an exam.";

            case VIVA ->
                "You are a viva preparation coach. " +
                "Generate likely oral-exam questions followed by crisp model answers. " +
                "Focus on conceptual clarity, common follow-up questions, and concise language the student can speak naturally.";

            case REVISION_BLAST ->
                "You are a high-speed revision assistant. " +
                "Compress the topic into the most important ideas, formulas, and keywords. " +
                "Prioritize recall value, signal what matters most, and keep the output skimmable.";

            case EXAM_STRATEGY ->
                "You are an exam strategy mentor. " +
                "Analyze the topic coverage in the provided material and suggest what to study first, " +
                "what to revise next, and how to allocate time for efficient scoring.";
        };

        StringBuilder historyBlock = new StringBuilder();
        if (history != null && !history.isEmpty()) {
            historyBlock.append("\n\nPrevious Conversation:\n");
            for (com.campusgpt.chat.dto.MessageDto msg : history) {
                String role = "user".equalsIgnoreCase(msg.getRole()) ? "Student" : "Assistant";
                historyBlock.append(role).append(": ").append(msg.getContent()).append("\n");
            }
        }

        if (context.isBlank()) {
            // No context found (no documents uploaded or unrelated query) — answer directly
            return systemPrompt + historyBlock.toString() + "\n\nQuestion: " + question + "\n\nAnswer:";
        }

        return systemPrompt
                + historyBlock.toString()
                + "\n\nContext from uploaded study materials:\n---\n"
                + context
                + "\n---\n\nQuestion: " + question
                + "\n\nAnswer:";
    }

    private String buildContext(List<ChunkSearchResult> similarChunks) {
        StringBuilder context = new StringBuilder();
        for (ChunkSearchResult chunk : similarChunks) {
            String content = chunk.getContent();
            if (content == null || content.isBlank()) {
                continue;
            }

            int remaining = maxContextChars - context.length();
            if (remaining <= 0) {
                break;
            }

            if (context.length() > 0) {
                context.append("\n---\n");
                remaining = maxContextChars - context.length();
                if (remaining <= 0) {
                    break;
                }
            }

            if (content.length() > remaining) {
                context.append(content, 0, remaining);
                break;
            }
            context.append(content);
        }
        return context.toString();
    }

    private int getNumPredict(ChatMode mode) {
        return switch (mode) {
            case EXPLAIN_CONCEPT -> explainConceptNumPredict;
            case TEN_MARK -> tenMarkNumPredict;
            case SHORT_NOTES -> shortNotesNumPredict;
            case VIVA -> vivaNumPredict;
            case REVISION_BLAST -> revisionBlastNumPredict;
            case EXAM_STRATEGY -> examStrategyNumPredict;
        };
    }

    private UserEntity getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
    }

    /**
     * Persists a real confidence signal derived from the current RAG retrieval scores.
     * We average the top results to avoid a single noisy chunk dominating the metric.
     * Note: nomic-embed-text semantic similarities often naturally rest around 0.5 - 0.7 for relevant data.
     * We apply a 1.4x scale factor to map this into a more human-understandable 75-98% confidence curve.
     */
    private void updateAiConfidence(UserEntity user, List<ChunkSearchResult> similarChunks) {
        int confidence = similarChunks.isEmpty()
                ? 0
                : (int) Math.round(
                similarChunks.stream()
                        .map(ChunkSearchResult::getSimilarityScore)
                        .filter(score -> score != null)
                        .mapToDouble(score -> Math.min(1.0, score.doubleValue() * 1.4))
                        .average()
                        .orElse(0.0) * 100
        );

        if (!Integer.valueOf(confidence).equals(user.getAiConfidence())) {
            user.setAiConfidence(confidence);
            userRepository.save(user);
        }
    }
}
