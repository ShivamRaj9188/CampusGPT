package com.campusgpt.document;

import com.campusgpt.auth.entity.UserEntity;
import com.campusgpt.auth.repository.UserRepository;
import com.campusgpt.document.dto.DocumentResponse;
import com.campusgpt.document.entity.ChunkEntity;
import com.campusgpt.document.entity.DocumentEntity;
import com.campusgpt.document.repository.ChunkRepository;
import com.campusgpt.document.repository.DocumentRepository;
import com.campusgpt.embedding.OllamaEmbeddingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * DocumentService handles the full PDF processing pipeline:
 *   1. Extract text from PDF using Apache PDFBox 3.x
 *   2. Chunk text into overlapping windows (512 chars, 64-char overlap)
 *   3. Generate embeddings for each chunk via Ollama
 *   4. Persist document + chunks with embeddings to PostgreSQL
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final ChunkRepository chunkRepository;
    private final UserRepository userRepository;
    private final OllamaEmbeddingService embeddingService;

    // ─── Chunking parameters ─────────────────────────────────────────────────
    private static final int CHUNK_SIZE    = 512;  // characters per chunk
    private static final int CHUNK_OVERLAP = 64;   // overlap between consecutive chunks

    /**
     * Uploads and processes a PDF document:
     *   - Extracts text with PDFBox
     *   - Splits into overlapping chunks
     *   - Generates embeddings for each chunk
     *   - Saves everything to the database
     *
     * @param file     The uploaded PDF file
     * @param category User-defined subject/category tag (e.g., "Physics")
     * @param username Authenticated user's username
     * @return DocumentResponse with metadata about the processed document
     */
    @Transactional
    public DocumentResponse uploadDocument(MultipartFile file, String category, String username) {
        UserEntity user = getUser(username);

        // 1. Extract text from PDF using PDFBox 3.x API
        String rawText;
        try {
            byte[] pdfBytes = file.getBytes();
            try (PDDocument pdfDoc = Loader.loadPDF(pdfBytes)) {
                PDFTextStripper stripper = new PDFTextStripper();
                rawText = stripper.getText(pdfDoc);
            }
            log.info("Extracted {} characters from PDF: {}", rawText.length(), file.getOriginalFilename());
        } catch (IOException e) {
            throw new RuntimeException("Failed to extract text from PDF: " + e.getMessage(), e);
        }

        // 2. Build and save the Document entity (get an ID before saving chunks)
        DocumentEntity document = DocumentEntity.builder()
                .user(user)
                .originalFilename(file.getOriginalFilename())
                .filename(UUID.randomUUID() + "_" + file.getOriginalFilename())
                .category(category != null && !category.isBlank() ? category : "General")
                .sizeBytes(file.getSize())
                .build();

        DocumentEntity savedDoc = documentRepository.save(document);

        // 3. Chunk the extracted text
        List<String> chunks = chunkText(rawText);
        log.info("Created {} chunks from document: {}", chunks.size(), file.getOriginalFilename());

        // 4. Generate embeddings and build ChunkEntities
        List<ChunkEntity> chunkEntities = new ArrayList<>();
        for (int i = 0; i < chunks.size(); i++) {
            String chunkText = chunks.get(i);
            try {
                // Generate embedding via Ollama nomic-embed-text
                float[] embedding = embeddingService.embed(chunkText);
                String embeddingStr = embeddingService.vectorToString(embedding);

                ChunkEntity chunk = ChunkEntity.builder()
                        .document(savedDoc)
                        .content(chunkText)
                        .chunkIndex(i)
                        .embedding(embeddingStr)
                        .build();
                chunkEntities.add(chunk);

            } catch (Exception e) {
                log.warn("Failed to embed chunk {} of {}: {}", i, file.getOriginalFilename(), e.getMessage());
                // Save chunk WITHOUT embedding (still useful for keyword context)
                ChunkEntity chunk = ChunkEntity.builder()
                        .document(savedDoc)
                        .content(chunkText)
                        .chunkIndex(i)
                        .embedding(null)
                        .build();
                chunkEntities.add(chunk);
            }
        }

        // 5. Save all chunks and update document's chunk count
        chunkRepository.saveAll(chunkEntities);
        savedDoc.setChunkCount(chunkEntities.size());
        documentRepository.save(savedDoc);

        log.info("Successfully processed document: {} ({} chunks)", file.getOriginalFilename(), chunkEntities.size());
        return DocumentResponse.from(savedDoc);
    }

    /**
     * Returns all documents belonging to the authenticated user.
     */
    public List<DocumentResponse> listDocuments(String username) {
        UserEntity user = getUser(username);
        return documentRepository.findByUserOrderByCreatedAtDesc(user)
                .stream()
                .map(DocumentResponse::from)
                .collect(Collectors.toList());
    }

    /**
     * Deletes a document and all its chunks (cascaded).
     * Only the document owner can delete it.
     */
    @Transactional
    public void deleteDocument(Long documentId, String username) {
        UserEntity user = getUser(username);
        DocumentEntity document = documentRepository.findByIdAndUser(documentId, user)
                .orElseThrow(() -> new IllegalArgumentException("Document not found or access denied"));

        documentRepository.delete(document);
        log.info("Deleted document {} for user {}", documentId, username);
    }

    // ─── Helper methods ───────────────────────────────────────────────────────

    /**
     * Splits a long text into overlapping chunks.
     *
     * Example with CHUNK_SIZE=10, OVERLAP=3, text="ABCDEFGHIJKLMNO":
     *   Chunk 0: "ABCDEFGHIJ"  (start=0)
     *   Chunk 1: "HIJKLMNOPQ"  (start=7 = 10-3)
     *   ...
     *
     * Overlap helps the LLM understand context at chunk boundaries.
     */
    private List<String> chunkText(String text) {
        List<String> chunks = new ArrayList<>();
        int start = 0;
        int step = CHUNK_SIZE - CHUNK_OVERLAP;

        while (start < text.length()) {
            int end = Math.min(start + CHUNK_SIZE, text.length());
            String chunk = text.substring(start, end).trim();

            if (!chunk.isBlank()) {
                chunks.add(chunk);
            }

            if (end == text.length()) break;
            start += step;
        }

        return chunks;
    }

    /** Looks up a user by username or throws an exception */
    private UserEntity getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
    }
}
