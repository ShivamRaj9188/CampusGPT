package com.campusgpt.document;

import com.campusgpt.document.dto.DocumentResponse;
import com.campusgpt.security.InputSanitizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * REST controller for document management.
 *
 * Endpoints:
 *   POST   /api/upload           — Upload and process a PDF
 *   GET    /api/documents        — List user's documents
 *   DELETE /api/documents/{id}   — Delete a document
 */
@RestController
@RequiredArgsConstructor
@Slf4j
public class DocumentController {

    private final DocumentService documentService;

    // Max allowed upload size (defense-in-depth; also enforced at servlet level)
    private static final long MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024L; // 20 MB

    // PDF magic bytes: every valid PDF starts with "%PDF"
    private static final byte[] PDF_MAGIC = {'%', 'P', 'D', 'F'};

    /**
     * POST /api/upload
     * Validates the file before processing:
     *   1. Non-empty file
     *   2. .pdf extension (OWASP A01 — filename check)
     *   3. Content-type must be application/pdf (client-supplied — not fully trusted)
     *   4. PDF magic-bytes check (OWASP A01 — actual binary validation)
     *   5. File size check (OWASP A05 — resource exhaustion)
     *   6. Category sanitized (OWASP A03)
     */
    @PostMapping(value = "/api/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentResponse> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "category", defaultValue = "General") String category,
            Principal principal
    ) {
        // ── 1. Reject empty files ────────────────────────────────────────────
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        // ── 2. Extension check: must end with .pdf (case-insensitive) ────────
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null
                || !originalFilename.toLowerCase().trim().endsWith(".pdf")) {
            log.warn("[Security] Upload rejected: invalid extension for file '{}' by user '{}'",
                    originalFilename, principal.getName());
            return ResponseEntity.badRequest().build();
        }

        // ── 3. File size limit (defense-in-depth) ────────────────────────────
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            return ResponseEntity.status(413).build();
        }

        // ── 4. PDF magic-bytes validation ────────────────────────────────────
        // An attacker could rename a malicious file to "exploit.pdf".
        // Checking the first 4 bytes verifies actual PDF format.
        try {
            byte[] header = file.getInputStream().readNBytes(4);
            if (header.length < 4
                    || header[0] != PDF_MAGIC[0] || header[1] != PDF_MAGIC[1]
                    || header[2] != PDF_MAGIC[2] || header[3] != PDF_MAGIC[3]) {
                log.warn("[Security] Upload rejected: invalid PDF magic bytes from user '{}'",
                        principal.getName());
                return ResponseEntity.badRequest().build();
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }

        // ── 5. Sanitize category (OWASP A03) ────────────────────────────────
        String safeCategory = InputSanitizer.sanitizeCategory(
                category.isBlank() ? "General" : category
        );

        DocumentResponse response = documentService.uploadDocument(file, safeCategory, principal.getName());
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/documents
     * Returns all documents uploaded by the authenticated user.
     */
    @GetMapping("/api/documents")
    public ResponseEntity<List<DocumentResponse>> listDocuments(Principal principal) {
        List<DocumentResponse> documents = documentService.listDocuments(principal.getName());
        return ResponseEntity.ok(documents);
    }

    /**
     * DELETE /api/documents/{id}
     * Deletes a document and all its chunks. Only the owner can delete.
     */
    @DeleteMapping("/api/documents/{id}")
    public ResponseEntity<Map<String, String>> deleteDocument(
            @PathVariable Long id,
            Principal principal
    ) {
        documentService.deleteDocument(id, principal.getName());
        return ResponseEntity.ok(Map.of("message", "Document deleted successfully"));
    }

    /** Handle service-layer errors */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleError(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntimeError(RuntimeException ex) {
        return ResponseEntity.internalServerError().body(Map.of("error", ex.getMessage()));
    }
}
