package com.campusgpt.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/** Response body returned after successful login or signup */
@Data
@AllArgsConstructor
public class AuthResponse {
    /** JWT Bearer token — include in Authorization header for protected requests */
    private String token;
    private String username;
    private String email;
}
