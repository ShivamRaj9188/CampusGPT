package com.campusgpt.analytics.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.Map;

/**
 * Full analytics response returned by GET /api/analytics/projection.
 * Contains PCA points, t-SNE points, cluster metadata and anomaly highlights.
 */
@Data
@Builder
public class AnalyticsResponse {

    // ── Projection results ────────────────────────────────────────────────────
    private List<ClusterPoint> pcaPoints;    // PCA-reduced 2-D coordinates
    private List<ClusterPoint> tsnePoints;   // Simulated t-SNE 2-D coordinates

    // ── Cluster metadata ──────────────────────────────────────────────────────
    private int    numClusters;
    private double silhouetteScore;          // –1 … 1; higher is better
    private double inertia;                  // WCSS (lower is better)
    private Map<Integer, String> clusterLabels; // cluster id → most common category

    // ── Anomaly stats ─────────────────────────────────────────────────────────
    private int    totalChunks;
    private int    anomalyCount;             // chunks with anomalyScore > threshold
    private double anomalyThreshold;         // score above which a point is anomalous

    // ── Variance explained by PCA ─────────────────────────────────────────────
    private double pc1VarianceExplained;     // % variance explained by PC1
    private double pc2VarianceExplained;     // % variance explained by PC2
}
