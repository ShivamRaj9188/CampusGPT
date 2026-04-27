package com.campusgpt.analytics;

import com.campusgpt.analytics.dto.AnalyticsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

/**
 * REST controller exposing the unsupervised-learning analytics endpoint.
 *
 * GET /api/analytics/projection?k=4
 *   Runs k-Means, PCA, t-SNE simulation and LOF anomaly detection
 *   on the authenticated user's document chunks.
 */
@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final EmbeddingAnalyticsService analyticsService;

    @GetMapping("/projection")
    public ResponseEntity<AnalyticsResponse> projection(
            Principal principal,
            @RequestParam(defaultValue = "4") int k) {

        AnalyticsResponse response = analyticsService.analyse(principal.getName(), k);
        return ResponseEntity.ok(response);
    }
}
