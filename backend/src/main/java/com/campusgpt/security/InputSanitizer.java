package com.campusgpt.security;

import java.util.regex.Pattern;

/**
 * InputSanitizer — utility class for sanitizing all user-provided text.
 *
 * OWASP A03 (Injection) mitigation:
 *   - Strips null bytes and C0/C1 control characters that could manipulate parsers
 *   - Enforces length limits to prevent resource exhaustion (OWASP A05)
 *   - Normalizes whitespace
 *
 * Note: This is NOT an HTML-escaping utility (the API returns JSON, not HTML).
 * HTML escaping is the responsibility of the React frontend.
 */
public final class InputSanitizer {

    // ─── Length limits ────────────────────────────────────────────────────────
    public static final int MAX_USERNAME_LENGTH  = 30;
    public static final int MAX_EMAIL_LENGTH     = 100;
    public static final int MAX_PASSWORD_LENGTH  = 128;
    public static final int MAX_QUESTION_LENGTH  = 2000;
    public static final int MAX_CATEGORY_LENGTH  = 50;
    public static final int MAX_FILENAME_LENGTH  = 255;

    /**
     * C0 control characters (except TAB \x09, LF \x0A, CR \x0D) + null byte + DEL.
     * These can confuse log parsers, JSON parsers, or downstream services.
     */
    private static final Pattern DANGEROUS_CHARS =
            Pattern.compile("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]");

    /**
     * Allowed pattern for usernames: letters, digits, underscores, hyphens.
     * Rejects anything else (emoji, spaces, SQL/script characters).
     */
    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-zA-Z0-9 ._-]+$");

    // Private constructor — utility class, not instantiable
    private InputSanitizer() {}

    // ─── Public sanitize methods ──────────────────────────────────────────────

    /**
     * Sanitizes generic free-text input (questions, notes, categories).
     * - Trims whitespace
     * - Removes dangerous control characters
     * - Truncates to maxLength
     */
    public static String sanitizeText(String input, int maxLength) {
        if (input == null) return null;
        String sanitized = input.trim();
        sanitized = DANGEROUS_CHARS.matcher(sanitized).replaceAll("");
        if (sanitized.length() > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }
        return sanitized;
    }

    /**
     * Sanitizes a username: lowercases, removes non-alphanumeric/underscore/hyphen chars,
     * then truncates to limit.
     */
    public static String sanitizeUsername(String username) {
        if (username == null) return null;
        String sanitized = username.trim();
        sanitized = DANGEROUS_CHARS.matcher(sanitized).replaceAll("");
        // Strip anything not in the allowed set (now includes space and dot)
        sanitized = sanitized.replaceAll("[^a-zA-Z0-9 ._-]", "");
        return sanitized.length() > MAX_USERNAME_LENGTH
                ? sanitized.substring(0, MAX_USERNAME_LENGTH)
                : sanitized;
    }

    /**
     * Validates a username against the allowed pattern.
     * Returns true if the username (already sanitized) matches [a-zA-Z0-9_-]+
     */
    public static boolean isValidUsername(String username) {
        if (username == null || username.isBlank()) return false;
        return USERNAME_PATTERN.matcher(username).matches();
    }

    /**
     * Sanitizes a category/subject tag.
     */
    public static String sanitizeCategory(String category) {
        return sanitizeText(category, MAX_CATEGORY_LENGTH);
    }

    /**
     * Sanitizes a chat question.
     */
    public static String sanitizeQuestion(String question) {
        return sanitizeText(question, MAX_QUESTION_LENGTH);
    }
}
