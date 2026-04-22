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
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.BreakIterator;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
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
                stripper.setSortByPosition(true);
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

        // 3. Chunk the extracted text into entities (with NLP)
        List<ChunkEntity> chunkEntities = buildChunkEntities(rawText, savedDoc);
        log.info("Created {} distinct chunks from document: {}", chunkEntities.size(), file.getOriginalFilename());

        // 4. Generate embeddings for the new chunks
        int validEmbeddings = 0;
        for (ChunkEntity chunk : chunkEntities) {
            try {
                // Generate embedding via Ollama nomic-embed-text
                float[] embedding = embeddingService.embed(chunk.getContent());
                String embeddingStr = embeddingService.vectorToString(embedding);
                chunk.setEmbedding(embeddingStr);
                validEmbeddings++;
            } catch (Exception e) {
                log.warn("Failed to embed chunk of {}: {}", file.getOriginalFilename(), e.getMessage());
                // Save chunk WITHOUT embedding (still useful for keyword context)
                chunk.setEmbedding(null);
            }
        }

        // 5. Save all chunks and update document's chunk count
        chunkRepository.saveAll(chunkEntities);
        savedDoc.setChunkCount(chunkEntities.size());
        documentRepository.save(savedDoc);

        log.info("Successfully processed document: {} ({} chunks, {} embedded)", 
                 file.getOriginalFilename(), chunkEntities.size(), validEmbeddings);
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
     * Splits a long text into overlapping chunks using NLP sentence boundaries.
     * Overlap is 1 sentence. Includes deduplication logic.
     */
    private List<ChunkEntity> buildChunkEntities(String text, DocumentEntity document) {
        List<ChunkEntity> chunks = new ArrayList<>();
        BreakIterator boundary = BreakIterator.getSentenceInstance(Locale.ENGLISH);
        boundary.setText(text);

        int start = boundary.first();
        int chunkStart = start;
        int sentenceCount = 0;
        int pageEstimate = 1;
        int sectionIndex = 0;
        int globalChunkIndex = 0;

        for (int end = boundary.next(); end != BreakIterator.DONE; end = boundary.next()) {
            sentenceCount++;

            // Window: 5 sentences per chunk with 1-sentence overlap
            if (sentenceCount >= 5) {
                String chunkText = text.substring(chunkStart, end).trim();
                if (!chunkText.isBlank()) {
                    String hash = sha256(chunkText);

                    // --- Deduplication guard: skip if hash already exists in DB ---
                    if (!chunkRepository.existsByContentHash(hash)) {
                        ChunkEntity chunk = new ChunkEntity();
                        chunk.setDocument(document);
                        chunk.setUserId(document.getUser().getId());
                        chunk.setCategory(document.getCategory());
                        chunk.setContent(chunkText);
                        chunk.setContentHash(hash);
                        chunk.setSectionIndex(sectionIndex++);
                        chunk.setPageNumber(pageEstimate);
                        chunk.setChunkIndex(globalChunkIndex++);
                        chunks.add(chunk);
                    }
                }
                // 1-sentence overlap: step back one sentence for the next window
                chunkStart = boundary.previous();
                boundary.next(); // restore iterator position
                sentenceCount = 0;
                // Rough page estimate: ~1500 chars (~250 words) per page
                pageEstimate = (int)(chunkStart / 1500) + 1;
            }
        }
        
        // Handle remaining sentences
        if (sentenceCount > 0 && chunkStart < text.length()) {
            String chunkText = text.substring(chunkStart).trim();
            if (!chunkText.isBlank()) {
                String hash = sha256(chunkText);
                if (!chunkRepository.existsByContentHash(hash)) {
                    ChunkEntity chunk = new ChunkEntity();
                    chunk.setDocument(document);
                    chunk.setUserId(document.getUser().getId());
                    chunk.setCategory(document.getCategory());
                    chunk.setContent(chunkText);
                    chunk.setContentHash(hash);
                    chunk.setSectionIndex(sectionIndex);
                    chunk.setPageNumber((int)(chunkStart / 1500) + 1);
                    chunk.setChunkIndex(globalChunkIndex);
                    chunks.add(chunk);
                }
            }
        }

        return chunks;
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    /** Looks up a user by username or throws an exception */
    private UserEntity getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
    }
}
