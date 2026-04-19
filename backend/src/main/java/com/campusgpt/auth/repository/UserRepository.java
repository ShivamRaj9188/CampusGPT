package com.campusgpt.auth.repository;

import com.campusgpt.auth.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Spring Data JPA repository for UserEntity.
 */
@Repository
public interface UserRepository extends JpaRepository<UserEntity, Long> {

    /** Find a user by their username (used for JWT validation and login) */
    Optional<UserEntity> findByUsername(String username);

    /** Check if a username is already taken (used during signup) */
    boolean existsByUsername(String username);

    /** Check if an email is already registered */
    boolean existsByEmail(String email);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("UPDATE UserEntity u SET u.streakCount = 0 WHERE u.lastActivityAt < :threshold")
    int resetExpiredStreaks(@org.springframework.data.repository.query.Param("threshold") java.time.LocalDateTime threshold);
}
