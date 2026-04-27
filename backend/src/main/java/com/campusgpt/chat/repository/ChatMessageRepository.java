package com.campusgpt.chat.repository;

import com.campusgpt.auth.entity.UserEntity;
import com.campusgpt.chat.entity.ChatMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessageEntity, Long> {
    List<ChatMessageEntity> findByUserOrderByCreatedAtDesc(UserEntity user);
    
    // Get last N messages for a user
    List<ChatMessageEntity> findTop50ByUserOrderByCreatedAtDesc(UserEntity user);

    @Modifying
    void deleteByUserAndSessionId(UserEntity user, String sessionId);
}
