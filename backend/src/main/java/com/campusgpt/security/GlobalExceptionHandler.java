package com.campusgpt.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.HashMap;
import java.util.Map;

/**
 * GlobalExceptionHandler — centralized error handling for all controllers.
 *
 * OWASP Coverage:
 *   A03:2021 – Injection (sanitized validation error messages)
 *   A05:2021 – Security Misconfiguration (no stack traces exposed to clients)
 *
 * Rules enforced:
 *   1. NEVER expose stack traces, internal class names, or DB errors to clients.
 *   2. Log full exception details server-side for debugging.
 *   3. Return friendly, actionable error messages in a consistent JSON structure:
 *      { "error": "...", "details": { "field": "message" } }
 *   4. Use appropriate HTTP status codes (400, 413, 422, 500).
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    // ─── Validation Errors ────────────────────────────────────────────────────

    /**
     * Handles @Valid / @Validated constraint violations on request bodies.
     * Returns 400 with a map of field → error message (no internal details).
     *
     * Example response:
     * {
     *   "error": "Validation failed",
     *   "details": {
     *     "username": "must not be blank",
     *     "password": "size must be between 6 and 128"
     *   }
     * }
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationErrors(
            MethodArgumentNotValidException ex
    ) {
        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            // Use the field name and message — never the rejected value (could be a password)
            fieldErrors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }

        Map<String, Object> body = new HashMap<>();
        body.put("error", "Validation failed");
        body.put("details", fieldErrors);

        log.warn("[Validation] Request validation failed: {}", fieldErrors.keySet());
        return ResponseEntity.badRequest().body(body);
    }

    // ─── Malformed JSON ───────────────────────────────────────────────────────

    /**
     * Handles completely malformed JSON request bodies (syntax errors, wrong types).
     * Returns 400 without exposing parse details.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> handleMalformedJson(
            HttpMessageNotReadableException ex
    ) {
        // Log full error server-side, return generic message to client
        log.warn("[Security] Malformed JSON request body: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(
                Map.of("error", "Invalid request body — malformed JSON")
        );
    }

    // ─── File Upload Too Large ────────────────────────────────────────────────

    /**
     * Handles multipart file uploads exceeding the configured MAX_UPLOAD_SIZE.
     * Returns 413 Payload Too Large.
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleFileTooLarge(
            MaxUploadSizeExceededException ex
    ) {
        log.warn("[Security] File upload exceeded size limit: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(
                Map.of("error", "File is too large. Maximum allowed size is 20MB")
        );
    }

    // ─── Business Logic Errors ────────────────────────────────────────────────

    /**
     * Handles expected business errors (duplicate username, document not found, etc.).
     * Returns 400 with the specific error message (already sanitized by the service layer).
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBusinessError(
            IllegalArgumentException ex
    ) {
        // Message is controlled by our service layer — safe to return
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
    }

    // ─── Catch-All ────────────────────────────────────────────────────────────

    /**
     * Last-resort handler for any unexpected exception.
     * CRITICAL: logs full details server-side but NEVER exposes them to the client.
     * Returns a generic 500 message.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpectedError(Exception ex) {
        // Full stack trace goes to server logs, not to the HTTP response
        log.error("[Security] Unexpected error: {}", ex.getMessage(), ex);
        return ResponseEntity.internalServerError().body(
                Map.of("error", "An internal error occurred. Please try again later.")
        );
    }
}
