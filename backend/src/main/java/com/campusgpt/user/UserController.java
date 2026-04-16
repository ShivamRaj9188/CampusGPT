package com.campusgpt.user;

import com.campusgpt.auth.AuthService;
import com.campusgpt.auth.dto.AuthResponse;
import com.campusgpt.user.dto.UpdatePasswordRequest;
import com.campusgpt.user.dto.UpdateProfileRequest;
import com.campusgpt.user.dto.UserProfileResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * Controller for managing user-specific profile and settings.
 * All endpoints require a valid JWT.
 */
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final AuthService authService;

    @GetMapping("/profile")
    public ResponseEntity<UserProfileResponse> getProfile(
            @AuthenticationPrincipal UserDetails currentUser) {
        return ResponseEntity.ok(authService.getCurrentUserProfile(currentUser.getUsername()));
    }

    /**
     * PUT /api/user/profile
     * Updates the basic profile (username, email) for the authenticated user.
     * Returns a new JWT if the username was changed.
     */
    @PutMapping("/profile")
    public ResponseEntity<AuthResponse> updateProfile(
            @AuthenticationPrincipal UserDetails currentUser,
            @Valid @RequestBody UpdateProfileRequest request) {
        
        AuthResponse response = authService.updateProfile(currentUser.getUsername(), request);
        return ResponseEntity.ok(response);
    }

    /**
     * PUT /api/user/password
     * Securely rotates the password for the authenticated user.
     */
    @PutMapping("/password")
    public ResponseEntity<Void> updatePassword(
            @AuthenticationPrincipal UserDetails currentUser,
            @Valid @RequestBody UpdatePasswordRequest request) {
        
        authService.updatePassword(currentUser.getUsername(), request);
        return ResponseEntity.noContent().build();
    }
}
