package com.campusgpt.analytics.dto;

import lombok.Builder;
import lombok.Data;

/**
 * A single data point in a 2-D projection of document embedding space.
 * Used for both PCA and t-SNE (simulated) projections.
 */
@Data
@Builder
public class ClusterPoint {
    private Long   chunkId;
    private String content;       // short preview (first 80 chars)
    private String category;
    private String docTitle;
    private int    clusterId;     // k-Means cluster assignment (0-based)
    private double x;             // 2-D projection X
    private double y;             // 2-D projection Y
    private double anomalyScore;  // 0 = normal, 1 = highly anomalous
}
