package com.campusgpt.chat;

import com.campusgpt.chat.dto.ChatRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

import java.security.Principal;

/**
 * REST controller for the AI chat endpoint.
 *
 * POST /api/chat
 *   - Accepts a question + smart mode
 *   - Returns a Server-Sent Events (SSE) stream (text/event-stream)
 *   - Each SSE event contains one token from the LLM
 *   - Final event contains "[DONE]" signal
 *
 * Client should use fetch() with streaming (NOT EventSource — POST not supported by EventSource).
 *
 * SSE Event format:
 *   data:Hello\n\n
 *   data: world\n\n
 *   data:[DONE]\n\n
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final ChatService chatService;

    /**
     * POST /api/chat
     *
     * Returns a streaming text/event-stream response.
     * The SseEmitter has a 5-minute timeout to handle long LLM responses.
     */
    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chat(
            @Valid @RequestBody ChatRequest request,
            Principal principal
    ) {
        log.info("[Chat] {} asked (mode={}): {}", principal.getName(), request.getMode(), request.getQuestion());

        // Create SSE emitter with 5-minute timeout (llama3 can be slow on CPU)
        SseEmitter emitter = new SseEmitter(300_000L);

        // Set up timeout and error handlers
        emitter.onTimeout(emitter::complete);
        emitter.onError(e -> log.warn("[Chat] SSE emitter error: {}", e.getMessage()));

        // Delegate to ChatService (runs async, streams tokens back via emitter)
        chatService.streamChat(request, principal.getName(), emitter);
        return emitter;
    }

    /**
     * GET /api/chat/history
     * Returns the user's persistent chat history.
     */
    @GetMapping("/chat/history")
    public ResponseEntity<List<com.campusgpt.chat.entity.ChatMessageEntity>> getHistory(Principal principal) {
        return ResponseEntity.ok(chatService.getHistory(principal.getName()));
    }

    /**
     * DELETE /api/chat/history
     * Clears all chat history for the user.
     */
    @DeleteMapping("/chat/history")
    public ResponseEntity<Map<String, String>> clearHistory(Principal principal) {
        chatService.clearHistory(principal.getName());
        return ResponseEntity.ok(Map.of("message", "History cleared"));
    }

    /**
     * DELETE /api/chat/history/{sessionId}
     * Clears a specific chat session for the user.
     */
    @DeleteMapping("/chat/history/{sessionId}")
    public ResponseEntity<Map<String, String>> deleteSession(
            @PathVariable String sessionId,
            Principal principal
    ) {
        chatService.deleteSession(principal.getName(), sessionId);
        return ResponseEntity.ok(Map.of("message", "Session deleted"));
    }
}
