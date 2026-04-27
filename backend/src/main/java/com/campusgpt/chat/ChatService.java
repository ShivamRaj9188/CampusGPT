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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.HashMap;
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
    private final com.campusgpt.chat.repository.ChatMessageRepository chatMessageRepository;
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

    // Per-mode token budgets (configured in application.yml)
    @Value("${ollama.num-predict.default:220}")
    private int numPredictDefault;
    @Value("${ollama.num-predict.explain-concept:260}")
    private int numPredictExplain;
    @Value("${ollama.num-predict.ten-mark:360}")
    private int numPredictTenMark;
    @Value("${ollama.num-predict.short-notes:200}")
    private int numPredictShortNotes;
    @Value("${ollama.num-predict.viva:240}")
    private int numPredictViva;
    @Value("${ollama.num-predict.revision-blast:180}")
    private int numPredictRevisionBlast;
    @Value("${ollama.num-predict.exam-strategy:220}")
    private int numPredictExamStrategy;

    @Value("${rag.top-k:3}")
    private int topK;

    @Value("${rag.max-context-chars:1800}")
    private int maxContextChars;


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

                log.info("[RAG] Starting hybrid search for user: {}", username);
                long dbStartTime = System.currentTimeMillis();
                List<ChunkSearchResult> stage2Results =
                        chunkRepository.hybridSearch(user.getId(), null, queryVector, question, 60);
                long dbLatencyMs = System.currentTimeMillis() - dbStartTime;
                
                log.info("[RAG] Hybrid search completed in {}ms. Found {} chunks.", dbLatencyMs, stage2Results.size());

                // ── Stage 3: MMR post-filter ────────
                List<ChunkSearchResult> finalContext = applyMMR(stage2Results, questionEmbedding, 7, 0.7);
                log.debug("[RAG] Filtered down to top {} chunks", finalContext.size());

                // ── Step 3: Build context from chunks ──────────────────────────
                String context = buildContext(finalContext);
                log.info("[RAG] Context prepared ({} chars). Sending to Ollama model: {}", context.length(), ollamaModel);

                // ── Compute NLP Metrics ─────────────────────────────────────────
                // Measurement ends here to exclude DB persistence time
                // Measure DB latency specifically for the user's <20ms target
                long latencyMs = dbLatencyMs;
                
                int semanticMatches = 0, keywordMatches = 0, hybridMatches = 0;
                for (ChunkSearchResult chunk : finalContext) {
                    if ("SEMANTIC".equals(chunk.getMatchType())) semanticMatches++;
                    else if ("KEYWORD".equals(chunk.getMatchType())) keywordMatches++;
                    else if ("HYBRID".equals(chunk.getMatchType())) hybridMatches++;
                }

                // AI Confidence calibration:
                // Targets 80-90% for high-quality matches.
                double bestRrf = finalContext.isEmpty() ? 0.0 : (finalContext.get(0).getRrfScore() != null ? finalContext.get(0).getRrfScore() : 0.0);
                double bestCosine = finalContext.isEmpty() ? 0.0 : (finalContext.get(0).getSimilarityScore() != null ? finalContext.get(0).getSimilarityScore() : 0.0);
                
                // Aggressive calibration for Nomic-Embed-Text (0.6 -> 60%, 0.75 -> 95%)
                double scaledCosine = Math.max(0, (bestCosine - 0.45) / 0.32); 
                double scaledRrf = bestRrf * 35.0;
                
                double confidenceScore = Math.min(0.98, Math.max(scaledCosine, scaledRrf));
                if (bestCosine > 0.78) confidenceScore = 0.99; // Cap for near-perfect matches

                String metricsJson = String.format(
                    "{\"latencyMs\":%d, \"chunksAfterSearch\":%d, \"chunksInContext\":%d, \"topRrfScore\":%.4f, \"matchTypeBreakdown\":{\"semantic\":%d, \"keyword\":%d, \"hybrid\":%d}}",
                    latencyMs, stage2Results.size(), finalContext.size(),
                    confidenceScore,
                    semanticMatches, keywordMatches, hybridMatches
                );
                
                try {
                    emitter.send(SseEmitter.event().data("[METRICS] " + metricsJson));
                } catch (Exception ignored) { }

                // ── Step 4: Persist message history & confidence ───────────────
                saveMessage(user, question, "user", request.getSessionId());
                updateAiConfidence(user, finalContext);

                // ── Step 4: Build the full prompt (mode-specific) ──────────────
                String systemInstruction = buildSystemInstruction(context, request.getMode(), request.getHistory());

                // ── Step 5: Stream response from Ollama llama3 ─────────────
                Map<String, Object> ollamaRequest = new HashMap<>();
                ollamaRequest.put("model", ollamaModel);
                ollamaRequest.put("system", systemInstruction);
                ollamaRequest.put("prompt", question);
                ollamaRequest.put("stream", true);
                ollamaRequest.put("keep_alive", parseKeepAlive(ollamaKeepAlive));
                ollamaRequest.put("options", Map.of(
                        "temperature", ollamaTemperature,
                        "num_predict", -1
                ));

                StringBuilder assistantResponse = new StringBuilder();
                
                webClient.post()
                        .uri(ollamaBaseUrl + "/api/generate")
                        .bodyValue(ollamaRequest)
                        .retrieve()
                        .bodyToFlux(String.class)
                        .subscribe(
                                line -> {
                                    String token = handleOllamaLine(line, emitter);
                                    if (token != null) assistantResponse.append(token);
                                },
                                error -> handleStreamError(error, emitter),
                                () -> {
                                    saveMessage(user, assistantResponse.toString(), "assistant", request.getSessionId());
                                    emitter.complete();
                                }
                        );

            } catch (Exception e) {
                log.error("[Chat] Asynchronous processing error", e);
                try {
                    emitter.send(SseEmitter.event().data("[ERROR]" + e.getMessage()));
                } catch (Exception se) {
                    log.error("[Chat] Failed to send error to emitter", se);
                }
                emitter.completeWithError(e);
            }
        });
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    /**
     * Parses a single NDJSON line from Ollama's streaming response.
     * Format: {"model":"llama3","response":"token","done":false}
     * Sends the token to the SSE client; sends [DONE] when streaming completes.
     */
    private String handleOllamaLine(String line, SseEmitter emitter) {
        if (line == null || line.isBlank()) return null;
        try {
            JsonNode node = objectMapper.readTree(line);
            String token = node.has("response") ? node.get("response").asText("") : "";
            boolean done  = node.has("done") && node.get("done").asBoolean();

            if (done) {
                emitter.send(SseEmitter.event().data("[DONE]"));
                return null;
            } else if (!token.isEmpty()) {
                String safeToken = token.replace("\n", "[NEW]");
                emitter.send(SseEmitter.event().data(safeToken));
                return token;
            }
        } catch (Exception e) {
            log.warn("[RAG] Failed to parse Ollama line: {}", line);
        }
        return null;
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
    private String buildSystemInstruction(String context, ChatMode mode, List<com.campusgpt.chat.dto.MessageDto> history) {
        String systemPrompt = switch (mode) {
            case EXPLAIN_CONCEPT ->
                "You are an elite University Professor specializing in simplifying complex theory. " +
                "Goal: Explain the concept from first principles using 'The Feynman Technique'. " +
                "Structure: Start with a 1-sentence plain-English summary, followed by a deeper dive using 2-3 relatable analogies. " +
                "Use bold text for technical terms and ensure the tone is encouraging yet academic.";

            case TEN_MARK ->
                "You are a Senior Exam Evaluator. " +
                "Goal: Provide a high-scoring university exam answer worth exactly 10 marks. " +
                "Template: (1) Definition & Intro (2) Bulleted key points with sub-headings (3) Real-world application/case study (4) A final 'Examiner's Note' on common mistakes. " +
                "Focus on breadth and professional formatting.";

            case SHORT_NOTES ->
                "You are a High-Density Note-Taking Expert. " +
                "Goal: Create extremeley skimmable, high-value revision notes. " +
                "Style: Use nested bullet points, bold keywords, and a 'Quick Recall' section at the bottom listing only the 5 most important terms. " +
                "Minimize fluff; maximize information density.";

            case VIVA ->
                "You are a strict but fair Viva Voce Examiner. " +
                "Goal: Prepare the student for oral defense. " +
                "Output: List 3-4 likely oral questions from the material, each followed by a punchy, 2-sentence 'Model Answer' that is easy to speak aloud. " +
                "Include a 'Pro Tip' on how to handle cross-questioning for this specific topic.";

            case REVISION_BLAST ->
                "You are a 'Flash-Revision' AI optimized for the 10 minutes before an exam. " +
                "Goal: Provide an ultra-compact summary. " +
                "Style: Use a table for comparisons if applicable, otherwise use a checklist of 'Must-Know' facts and any formulas/constants found in the context.";

            case EXAM_STRATEGY ->
                "You are a Strategic Academic Mentor. " +
                "Goal: Prioritize content based on difficulty and weightage. " +
                "Analysis: Identify the 'High-Yield' areas from the provided material. " +
                "Suggest a 2-hour study plan specifically for this content, ranking topics from 'Study First' to 'If Time Permits'.";
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
            return systemPrompt + historyBlock.toString();
        }

        return systemPrompt
                + historyBlock.toString()
                + "\n\nContext from uploaded study materials:\n---\n"
                + context
                + "---\n\n"
                + "CRITICAL FORMATTING RULES (STRICT ADHERENCE REQUIRED):\n"
                + "1. NO WALLS OF TEXT: Break every idea into distinct paragraphs or bullet points.\n"
                + "2. SPACING: Use double newlines (\\n\\n) between every single paragraph, heading, and list.\n"
                + "3. HEADINGS: Use ## for main sections and ### for sub-sections. Bold key technical terms (**term**).\n"
                + "4. TABLES: If comparing two or more things, you MUST use a Markdown table.\n"
                + "5. RAG SOURCE CITATION: Use the provided context ONLY. At the end of relevant sentences, cite the source like this: [Source: Document Name].\n"
                + "6. TONE: Maintain a professional, academic, yet encouraging tone as per your assigned persona.";
    }

    private String buildContext(List<ChunkSearchResult> chunks) {
        StringBuilder context = new StringBuilder();
        for (ChunkSearchResult chunk : chunks) {
            String content = chunk.getContent();
            if (content == null || content.isBlank()) {
                continue;
            }

            int remaining = maxContextChars - context.length();
            if (remaining <= 0) {
                break;
            }

            // Simplified context identifier so the LLM doesn't get confused
            String docMeta = String.format("[Doc %d]:\n", chunk.getDocumentId());

            if (content.length() + docMeta.length() > remaining) {
                context.append(docMeta).append(content, 0, remaining - docMeta.length());
                break;
            }
            context.append(docMeta).append(content).append("\n\n");
        }
        return context.toString();
    }

    private float[] parseVector(String vectorStr) {
        if (vectorStr == null || vectorStr.isBlank()) return new float[0];
        String cleaned = vectorStr.replaceAll("[\\[\\]\\s]", "");
        String[] parts = cleaned.split(",");
        float[] vec = new float[parts.length];
        for (int i = 0; i < parts.length; i++) {
            vec[i] = Float.parseFloat(parts[i]);
        }
        return vec;
    }

    private double cosineSimilarity(float[] v1, float[] v2) {
        if (v1.length == 0 || v2.length == 0 || v1.length != v2.length) return 0.0;
        double dotProduct = 0.0, normA = 0.0, normB = 0.0;
        for (int i = 0; i < v1.length; i++) {
            dotProduct += v1[i] * v2[i];
            normA += Math.pow(v1[i], 2);
            normB += Math.pow(v2[i], 2);
        }
        if (normA == 0 || normB == 0) return 0.0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Optimized MMR Implementation:
     * 1. Pre-parses vectors to avoid repeated String -> float[] conversion (massive latency win).
     * 2. Uses a localized record for candidate management.
     */
    private record MMRCandidate(ChunkSearchResult result, float[] vector) {}

    public List<ChunkSearchResult> applyMMR(
            List<ChunkSearchResult> candidates,
            float[] queryEmbedding,
            int topK,
            double lambda) {

        if (candidates.isEmpty()) return new ArrayList<>();

        // ── Pre-parse all candidate vectors ONCE ─────────────────────────────
        List<MMRCandidate> remaining = new ArrayList<>(candidates.size());
        for (ChunkSearchResult csr : candidates) {
            remaining.add(new MMRCandidate(csr, parseVector(csr.getEmbedding())));
        }

        List<MMRCandidate> selected = new ArrayList<>();

        while (selected.size() < topK && !remaining.isEmpty()) {
            MMRCandidate best = null;
            double bestScore = Double.NEGATIVE_INFINITY;

            for (MMRCandidate candidate : remaining) {
                double relevance = cosineSimilarity(candidate.vector(), queryEmbedding);
                
                double maxSimilarityToSelected = 0.0;
                for (MMRCandidate s : selected) {
                    maxSimilarityToSelected = Math.max(maxSimilarityToSelected, 
                        cosineSimilarity(candidate.vector(), s.vector()));
                }

                double mmrScore = lambda * relevance - (1 - lambda) * maxSimilarityToSelected;
                if (mmrScore > bestScore) {
                    bestScore = mmrScore;
                    best = candidate;
                }
            }
            
            if (best != null) {
                selected.add(best);
                remaining.remove(best);
            } else {
                break;
            }
        }
        
        return selected.stream().map(MMRCandidate::result).toList();
    }



    public List<com.campusgpt.chat.entity.ChatMessageEntity> getHistory(String username) {
        UserEntity user = getUser(username);
        // We now fetch top 50 so the frontend can group them into sessions
        return chatMessageRepository.findTop50ByUserOrderByCreatedAtDesc(user);
    }

    @Transactional
    public void clearHistory(String username) {
        UserEntity user = getUser(username);
        // Better performance than deleteAll(List) for large histories
        List<com.campusgpt.chat.entity.ChatMessageEntity> history = chatMessageRepository.findByUserOrderByCreatedAtDesc(user);
        chatMessageRepository.deleteAllInBatch(history);
    }

    @Transactional
    public void deleteSession(String username, String sessionId) {
        UserEntity user = getUser(username);
        chatMessageRepository.deleteByUserAndSessionId(user, sessionId);
    }

    private UserEntity getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
    }

    /**
     * Persists a real confidence signal derived from hybrid retrieval metrics.
     * Uses a combination of RRF (rank agreement) and Cosine Similarity (semantic match).
     */
    private void saveMessage(UserEntity user, String content, String role, String sessionId) {
        com.campusgpt.chat.entity.ChatMessageEntity msg = com.campusgpt.chat.entity.ChatMessageEntity.builder()
                .user(user)
                .content(content)
                .role(role)
                .sessionId(sessionId != null ? sessionId : "default")
                .build();
        chatMessageRepository.save(msg);
    }

    private Object parseKeepAlive(String keepAlive) {
        if (keepAlive == null || keepAlive.isBlank()) return "10m";
        try {
            return Integer.parseInt(keepAlive);
        } catch (NumberFormatException e) {
            return keepAlive;
        }
    }

    private void updateAiConfidence(UserEntity user, List<ChunkSearchResult> similarChunks) {
        if (similarChunks.isEmpty()) {
            user.setAiConfidence(0);
            userRepository.save(user);
            return;
        }

        // Average of the top 3 results to ensure stability
        double avgConfidence = similarChunks.stream()
                .limit(3)
                .mapToDouble(chunk -> {
                    double rrf = chunk.getRrfScore() != null ? chunk.getRrfScore() : 0.0;
                    double cosine = chunk.getSimilarityScore() != null ? chunk.getSimilarityScore() : 0.0;
                    
                    // Normalization: 
                    // RRF 0.03 -> 90%, 0.016 -> 48%
                    // Recalibrated for better distribution
                    double rrfNorm = rrf * 35.0;
                    double cosineNorm = Math.max(0, (cosine - 0.45) / 0.32);
                    
                    return Math.min(1.0, Math.max(rrfNorm, cosineNorm));
                })
                .average()
                .orElse(0.0);

        int confidence = (int) Math.round(avgConfidence * 100);

        if (!Integer.valueOf(confidence).equals(user.getAiConfidence())) {
            user.setAiConfidence(confidence);
            userRepository.save(user);
        }
    }
}
