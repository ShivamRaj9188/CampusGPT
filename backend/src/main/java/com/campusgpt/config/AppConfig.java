package com.campusgpt.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Application-wide Spring bean configuration.
 * Separating beans here avoids circular dependency between SecurityConfig and AuthService.
 */
@Configuration
public class AppConfig {

    /**
     * BCrypt password encoder for hashing user passwords.
     * Strength factor defaults to 10 (good balance of security and performance).
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * WebClient for reactive HTTP calls to the Ollama API.
     * Buffer size increased to 16MB to handle large LLM streaming responses.
     */
    @Bean
    public WebClient webClient() {
        return WebClient.builder()
                .codecs(configurer -> configurer
                        .defaultCodecs()
                        .maxInMemorySize(16 * 1024 * 1024)) // 16 MB in-memory buffer
                .build();
    }

    /**
     * Jackson ObjectMapper for parsing Ollama NDJSON streaming responses.
     */
    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }
}
