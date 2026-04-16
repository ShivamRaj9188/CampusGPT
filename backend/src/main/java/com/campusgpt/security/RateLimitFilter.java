package com.campusgpt.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * RateLimitFilter — IP-based rate limiting using the token-bucket algorithm.
 *
 * OWASP Coverage:
 *   A07:2021 – Identification & Authentication Failures (brute-force prevention)
 *   API4:2023 – Unrestricted Resource Consumption
 *
 * Strategy:
 *   • Public endpoints (/api/auth/**): strict limit (default 10 req/min)
 *     — prevents credential stuffing and brute-force attacks.
 *   • Authenticated endpoints: permissive limit (default 60 req/min)
 *     — prevents API abuse while allowing normal usage.
 *
 * IP extraction: respects X-Forwarded-For for reverse-proxy deployments.
 *
 * Memory note: buckets live in ConcurrentHashMap indefinitely while the process runs.
 * For production at scale, replace with Caffeine (TTL eviction) or a Redis-backed store.
 */
@Component
@Order(1) // Run before all other filters
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    @Value("${rate-limit.public.capacity:10}")
    private int publicCapacity;

    @Value("${rate-limit.public.refill-minutes:1}")
    private int publicRefillMinutes;

    @Value("${rate-limit.authenticated.capacity:60}")
    private int authCapacity;

    @Value("${rate-limit.authenticated.refill-minutes:1}")
    private int authRefillMinutes;

    // Separate maps for public vs authenticated endpoints
    private final Map<String, Bucket> publicBuckets        = new ConcurrentHashMap<>();
    private final Map<String, Bucket> authenticatedBuckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain chain
    ) throws ServletException, IOException {

        // Skip rate limiting for OPTIONS preflight requests (CORS)
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }

        String clientIp      = extractClientIp(request);
        String requestPath   = request.getRequestURI();
        boolean isPublicPath = requestPath.startsWith("/api/auth/");

        // Select the appropriate bucket map and configuration
        Bucket bucket = isPublicPath
                ? publicBuckets.computeIfAbsent(clientIp, k -> buildPublicBucket())
                : authenticatedBuckets.computeIfAbsent(clientIp, k -> buildAuthenticatedBucket());

        long remainingTokens = bucket.getAvailableTokens();

        if (bucket.tryConsume(1)) {
            // ── Request allowed ─────────────────────────────────────────────
            // Add rate-limit headers so clients can self-throttle gracefully
            int limit = isPublicPath ? publicCapacity : authCapacity;
            response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
            response.setHeader("X-RateLimit-Remaining", String.valueOf(remainingTokens - 1));
            chain.doFilter(request, response);
        } else {
            // ── Rate limit exceeded ─────────────────────────────────────────
            int retryAfterSeconds = isPublicPath
                    ? publicRefillMinutes * 60
                    : authRefillMinutes * 60;

            log.warn("[RateLimit] IP {} exceeded limit on {} {}",
                    clientIp, request.getMethod(), requestPath);

            response.setStatus(429); // HTTP 429 Too Many Requests
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
            response.setHeader("X-RateLimit-Limit",
                    String.valueOf(isPublicPath ? publicCapacity : authCapacity));
            response.setHeader("X-RateLimit-Remaining", "0");

            // Graceful JSON error body (no stack trace exposed)
            response.getWriter().write(String.format(
                    "{\"error\":\"Too many requests. Please wait before retrying.\"," +
                    "\"retryAfterSeconds\":%d}", retryAfterSeconds));
        }
    }

    // ─── Bucket factories ─────────────────────────────────────────────────────

    /**
     * Public bucket: strict limit for unauthenticated endpoints.
     * Uses "greedy" refill — all tokens refill at once after the window expires.
     * This is the recommended model for login-endpoint protection.
     */
    private Bucket buildPublicBucket() {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(publicCapacity)
                        .refillGreedy(publicCapacity, Duration.ofMinutes(publicRefillMinutes))
                        .build())
                .build();
    }

    /**
     * Authenticated bucket: more generous limit for logged-in users.
     */
    private Bucket buildAuthenticatedBucket() {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(authCapacity)
                        .refillGreedy(authCapacity, Duration.ofMinutes(authRefillMinutes))
                        .build())
                .build();
    }

    // ─── IP extraction ────────────────────────────────────────────────────────

    /**
     * Extracts the real client IP address, respecting common reverse-proxy headers.
     *
     * CAUTION (OWASP A05): X-Forwarded-For can be spoofed by clients.
     * If you control your reverse proxy (Nginx, AWS ALB), configure it to
     * overwrite this header so only the proxy's value is trusted.
     *
     * We take the FIRST IP in the chain (the original client), not the proxy IP.
     */
    private String extractClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr();
    }
}
