package com.campusgpt.config;

import com.campusgpt.auth.jwt.JwtFilter;
import jakarta.servlet.DispatcherType;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Spring Security configuration.
 * - Stateless JWT-based authentication (no sessions)
 * - CORS configured for React frontend (localhost:5173)
 * - Public endpoints: /api/auth/**
 * - All other endpoints require a valid JWT
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;
    private final UserDetailsService userDetailsService;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // Disable CSRF (not needed for stateless JWT APIs)
            .csrf(AbstractHttpConfigurer::disable)
            // Configure CORS using our CorsConfigurationSource bean
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            // Use stateless sessions — no HttpSession is created or used
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // Define authorization rules
            .authorizeHttpRequests(auth -> auth
                // Async/error redispatches are used by streaming endpoints like SseEmitter.
                .dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll()
                // Allow preflight OPTIONS requests for all paths
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // Public auth endpoints (login, signup)
                .requestMatchers("/api/auth/**").permitAll()
                // Everything else requires authentication
                .anyRequest().authenticated()
            )
            // Set our custom UserDetailsService
            .userDetailsService(userDetailsService)
            // Add JWT filter BEFORE Spring's default username/password filter
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * CORS configuration: allows React dev server to make cross-origin requests,
     * including streaming fetch calls to the /api/chat (SSE) endpoint.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // Allow local dev origins (Vite runs on 5173 by default)
        config.setAllowedOriginPatterns(List.of("http://localhost:*", "http://127.0.0.1:*"));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        // Allow all headers including Authorization and Content-Type
        config.setAllowedHeaders(List.of("*"));
        // Expose headers the frontend might need to read
        config.setExposedHeaders(Arrays.asList("Authorization", "Content-Type", "Cache-Control"));
        // Allow cookies/credentials if needed
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    /**
     * Expose the AuthenticationManager as a Spring Bean
     * so it can be injected into controllers/services if needed.
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
