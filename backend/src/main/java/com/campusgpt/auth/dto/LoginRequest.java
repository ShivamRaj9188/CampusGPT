package com.campusgpt.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Login request DTO — validated via @Valid in AuthController.
 *
 * OWASP A07: Strict input validation prevents username enumeration timing attacks
 * and limits brute-force payload size.
 */
@Data
public class LoginRequest {

    /**
     * Username: 3-50 chars, alphanumeric + underscore/hyphen only.
     * The pattern prevents SQL injection probes and shell injection chars.
     * OWASP A03 (Injection) — schema-level whitelist validation.
     */
    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be 3–50 characters")
    @Pattern(
        regexp = "^[a-zA-Z0-9_-]+$",
        message = "Username may only contain letters, digits, underscores, and hyphens"
    )
    private String username;

    /**
     * Password: 6–128 chars.
     * Upper limit prevents bcrypt DoS (bcrypt truncates at 72 bytes but the HTTP
     * server still decodes the full payload — cap at 128 to avoid abuse).
     * OWASP A07 — prevent credential stuffing with extremely large payloads.
     */
    @NotBlank(message = "Password is required")
    @Size(min = 6, max = 128, message = "Password must be 6–128 characters")
    private String password;
}
