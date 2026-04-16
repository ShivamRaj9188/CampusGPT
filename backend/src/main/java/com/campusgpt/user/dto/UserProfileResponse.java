package com.campusgpt.user.dto;

import com.campusgpt.auth.entity.UserEntity;
import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * Read model for the authenticated user's current profile and live metrics.
 */
@Data
@AllArgsConstructor
public class UserProfileResponse {
    private String username;
    private String email;
    private Integer streakCount;
    private Integer aiConfidence;

    public static UserProfileResponse from(UserEntity user) {
        return new UserProfileResponse(
                user.getUsername(),
                user.getEmail(),
                user.getStreakCount(),
                user.getAiConfidence()
        );
    }
}
