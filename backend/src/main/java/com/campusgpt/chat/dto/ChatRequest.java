package com.campusgpt.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Chat request DTO with strict input bounds.
 *
 * OWASP Coverage:
 *   A03 – Injection: length cap prevents prompt-injection via oversized inputs.
 *   A05 – Resource exhaustion: extremely long questions waste embedding computation.
 */
@Data
public class ChatRequest {

    /**
     * The user's question.
     * Cap at 2000 chars: enough for any legitimate academic question,
     * prevents prompt-injection attempts via huge payloads, and
     * limits Ollama embedding computation cost.
     */
    @NotBlank(message = "Question cannot be empty")
    @Size(min = 2, max = 2000, message = "Question must be 2–2000 characters")
    private String question;

    /**
     * Smart mode selector.
     * Validated against the ChatMode enum — Spring rejects any unexpected string value.
     * This prevents unexpected mode injection or arbitrary string values.
     */
    @NotNull(message = "Mode is required (EXPLAIN_CONCEPT, TEN_MARK, or SHORT_NOTES)")
    private ChatMode mode;

    /**
     * Optional multi-turn chat history.
     * Contains recent previous messages to maintain context across API calls.
     */
    private java.util.List<MessageDto> history;
}
