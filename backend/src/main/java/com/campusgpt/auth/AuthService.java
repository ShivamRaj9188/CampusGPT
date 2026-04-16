package com.campusgpt.auth;

import com.campusgpt.auth.dto.AuthResponse;
import com.campusgpt.auth.dto.LoginRequest;
import com.campusgpt.auth.dto.SignupRequest;
import com.campusgpt.auth.entity.UserEntity;
import com.campusgpt.auth.jwt.JwtUtil;
import com.campusgpt.auth.repository.UserRepository;
import com.campusgpt.security.InputSanitizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * AuthService handles user registration, login and acts as UserDetailsService
 * for Spring Security's authentication chain.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService implements UserDetailsService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    /**
     * Required by UserDetailsService — loads a user by username for JWT validation.
     */
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
    }

    /**
     * Registers a new user.
     * - Checks for duplicate username/email
     * - Hashes the password with BCrypt
     * - Persists the user and returns a JWT
     */
    public AuthResponse signup(SignupRequest request) {
        // Sanitize inputs (OWASP A03: strip control chars, normalize)
        // Note: @Valid already enforced the pattern — this is defense-in-depth
        String username = InputSanitizer.sanitizeUsername(request.getUsername());
        String email    = InputSanitizer.sanitizeText(request.getEmail(), InputSanitizer.MAX_EMAIL_LENGTH).toLowerCase();

        // Validate uniqueness against sanitized values
        if (userRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("Username already taken");
            // ↑ Don't echo back the value — user enumeration risk (OWASP A07)
        }
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already registered");
        }

        // Build and save the new user
        UserEntity user = UserEntity.builder()
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(request.getPassword())) // BCrypt hash
                .build();

        userRepository.save(user);
        log.info("New user registered: {}", user.getUsername());

        // Generate and return JWT token
        String token = jwtUtil.generateToken(user.getUsername());
        return new AuthResponse(token, user.getUsername(), user.getEmail());
    }

    /**
     * Authenticates an existing user.
     * - Looks up user by username
     * - Verifies password against BCrypt hash
     * - Returns a JWT token on success
     */
    public AuthResponse login(LoginRequest request) {
        // Sanitize before DB lookup (defense-in-depth after @Valid)
        String username = InputSanitizer.sanitizeUsername(request.getUsername());

        // OWASP A07: Use the same generic error for wrong username AND wrong password
        // — prevents username enumeration via different error messages
        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Invalid username or password"));

        // Verify password — BCryptPasswordEncoder.matches() is constant-time
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            log.warn("[Security] Failed login attempt for username: {}", username);
            throw new IllegalArgumentException("Invalid username or password");
        }

        log.info("User logged in: {}", user.getUsername());
        String token = jwtUtil.generateToken(user.getUsername());
        return new AuthResponse(token, user.getUsername(), user.getEmail());
    }
}
