package com.campusgpt.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * SecurityHeadersFilter — adds OWASP-recommended HTTP security headers to every response.
 *
 * OWASP Coverage:
 *   A05:2021 – Security Misconfiguration
 *   A07:2021 – Identification & Authentication Failures (clickjacking, MIME attacks)
 *
 * These headers defend against:
 *   - X-Content-Type-Options: MIME-type sniffing attacks
 *   - X-Frame-Options: Clickjacking via iframe embedding
 *   - X-XSS-Protection: Legacy browser XSS filter activation
 *   - Referrer-Policy: Leaking sensitive URL info to third parties
 *   - Content-Security-Policy: Restricts resource loading origins
 *   - Permissions-Policy: Disables browser features that aren't needed
 *
 * Note: Spring Security adds some of these by default, but this filter ensures
 * they are applied uniformly even on non-Spring-Security-managed paths.
 */
@Component
@Order(2) // Run after RateLimitFilter
public class SecurityHeadersFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain chain
    ) throws ServletException, IOException {

        // ── Prevent MIME-type sniffing (OWASP A05) ─────────────────────────
        response.setHeader("X-Content-Type-Options", "nosniff");

        // ── Prevent clickjacking (OWASP A01) ───────────────────────────────
        response.setHeader("X-Frame-Options", "DENY");

        // ── Enable legacy XSS protection in older browsers ─────────────────
        response.setHeader("X-XSS-Protection", "1; mode=block");

        // ── Control referrer info sent to external sites ────────────────────
        response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

        // ── Content-Security-Policy ─────────────────────────────────────────
        // This is a REST API — not a page renderer. Restricts to same-origin only.
        // Adjust if you add WebSocket support or a CDN for static assets.
        response.setHeader("Content-Security-Policy", "default-src 'self'");

        // ── Disable unused browser permissions ──────────────────────────────
        response.setHeader("Permissions-Policy",
                "camera=(), microphone=(), geolocation=(), payment=()");

        // ── Disable caching for API responses (prevents stale auth data) ────
        // SSE endpoints (/api/chat) override this with their own cache-control
        if (!request.getRequestURI().contains("/api/chat")) {
            response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
            response.setHeader("Pragma", "no-cache");
        }

        chain.doFilter(request, response);
    }
}
