package com.campusgpt.auth;

import com.campusgpt.auth.dto.AuthResponse;
import com.campusgpt.auth.dto.LoginRequest;
import com.campusgpt.auth.dto.SignupRequest;
import com.campusgpt.auth.entity.UserEntity;
import com.campusgpt.auth.jwt.JwtUtil;
import com.campusgpt.auth.repository.UserRepository;
import com.campusgpt.security.InputSanitizer;
import com.campusgpt.user.dto.UpdatePasswordRequest;
import com.campusgpt.user.dto.UpdateProfileRequest;
import com.campusgpt.user.dto.UserProfileResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
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
                .streakCount(0)
                .build();

        userRepository.save(user);
        log.info("New user registered: {}", user.getUsername());

        // Generate and return JWT token
        String token = jwtUtil.generateToken(user.getUsername());
        return new AuthResponse(token, user.getUsername(), user.getEmail(), user.getStreakCount(), user.getAiConfidence());
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
        recordActivity(user.getUsername()); // Update streak on login
        user = userRepository.findByUsername(user.getUsername())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String token = jwtUtil.generateToken(user.getUsername());
        return new AuthResponse(token, user.getUsername(), user.getEmail(), user.getStreakCount(), user.getAiConfidence());
    }

    /**
     * Updates user profile (username/email).
     * If username changes, a new JWT is issued.
     */
    public AuthResponse updateProfile(String currentUsername, UpdateProfileRequest request) {
        UserEntity user = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String newUsername = InputSanitizer.sanitizeUsername(request.getUsername());
        String newEmail    = InputSanitizer.sanitizeText(request.getEmail(), InputSanitizer.MAX_EMAIL_LENGTH).toLowerCase();

        // If username is changing, check for uniqueness
        if (!user.getUsername().equalsIgnoreCase(newUsername) && userRepository.existsByUsername(newUsername)) {
            throw new IllegalArgumentException("Username already taken");
        }
        
        // If email is changing, check for uniqueness
        if (!user.getEmail().equalsIgnoreCase(newEmail) && userRepository.existsByEmail(newEmail)) {
            throw new IllegalArgumentException("Email already registered");
        }

        user.setUsername(newUsername);
        user.setEmail(newEmail);
        userRepository.save(user);

        log.info("User profile updated: {}", newUsername);

        // Re-generate token with new username
        String token = jwtUtil.generateToken(newUsername);
        return new AuthResponse(token, user.getUsername(), user.getEmail(), user.getStreakCount(), user.getAiConfidence());
    }

    /**
     * Returns the latest user profile and derived live metrics.
     */
    public UserProfileResponse getCurrentUserProfile(String currentUsername) {
        UserEntity user = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return UserProfileResponse.from(user);
    }

    /**
     * Updates user password securely.
     */
    public void updatePassword(String currentUsername, UpdatePasswordRequest request) {
        UserEntity user = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Verify current password
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            log.warn("[Security] Failed password change attempt for user: {}", currentUsername);
            throw new IllegalArgumentException("Current password is incorrect");
        }

        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new IllegalArgumentException("New password must be different from the current password");
        }

        // Hash and save new password
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        log.info("User password rotated: {}", currentUsername);
    }

    /**
     * Records an activity for the user and updates study streak.
     * Logic:
     * - If last activity was yesterday, increment streak.
     * - If last activity was today, do nothing (already active).
     * - If last activity was > 1 day ago, reset streak to 1.
     */
    public void recordActivity(String username) {
        userRepository.findByUsername(username).ifPresent(user -> {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime last = user.getLastActivityAt();

            if (last == null) {
                user.setStreakCount(1);
            } else {
                long daysBetween = ChronoUnit.DAYS.between(last.toLocalDate(), now.toLocalDate());
                if (daysBetween == 1) {
                    user.setStreakCount(user.getStreakCount() + 1);
                } else if (daysBetween > 1) {
                    user.setStreakCount(1);
                }
            }
            
            user.setLastActivityAt(now);
            userRepository.save(user);
        });
    }
}
