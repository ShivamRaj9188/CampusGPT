package com.campusgpt.document.repository;

import com.campusgpt.auth.entity.UserEntity;
import com.campusgpt.document.entity.DocumentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data JPA repository for DocumentEntity.
 */
@Repository
public interface DocumentRepository extends JpaRepository<DocumentEntity, Long> {

    /** Get all documents for a user, most recent first */
    List<DocumentEntity> findByUserOrderByCreatedAtDesc(UserEntity user);

    /** Find a document by ID, ensuring it belongs to the given user (security check) */
    Optional<DocumentEntity> findByIdAndUser(Long id, UserEntity user);
}
