package com.campusgpt.auth.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

/**
 * Signup request DTO — validated via @Valid in AuthController.
 *
 * OWASP Coverage:
 *   A03 – Schema-based whitelist validation (username pattern)
 *   A07 – Length caps to prevent credential stuffing / bcrypt DoS
 */
@Data
public class SignupRequest {

    /**
     * Username: 3-30 chars, alphanumeric + underscore/hyphen.
     * Whitelist pattern rejects SQL metacharacters, HTML tags, and shell operators.
     */
    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 30, message = "Username must be 3–30 characters")
    @Pattern(
        regexp = "^[a-zA-Z0-9 ._-]+$",
        message = "Username may only contain letters, digits, spaces, dots, underscores, and hyphens"
    )
    private String username;

    /**
     * Email: standard format validation.
     * Length cap of 100 prevents padding attacks on the email column index.
     */
    @NotBlank(message = "Email is required")
    @Email(message = "Must be a valid email address")
    @Size(max = 100, message = "Email must not exceed 100 characters")
    private String email;

    /**
     * Password: 8-128 chars.
     * Minimum bumped to 8 (NIST SP 800-63B recommendation).
     * Maximum 128 prevents bcrypt DoS — bcrypt ignores anything past 72 bytes,
     * but Spring still parses the body.
     */
    @NotBlank(message = "Password is required")
    @Size(min = 8, max = 128, message = "Password must be 8–128 characters")
    private String password;
}
