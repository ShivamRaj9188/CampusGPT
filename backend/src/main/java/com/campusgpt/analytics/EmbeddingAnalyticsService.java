package com.campusgpt.analytics;

import com.campusgpt.analytics.dto.AnalyticsResponse;
import com.campusgpt.analytics.dto.ClusterPoint;
import com.campusgpt.auth.entity.UserEntity;
import com.campusgpt.auth.repository.UserRepository;
import com.campusgpt.document.entity.ChunkEntity;
import com.campusgpt.document.repository.ChunkRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;
/**
 * EmbeddingAnalyticsService — Unsupervised Learning pipeline
 *
 * Implements (all in pure Java, zero extra dependencies):
 *  1. K-Means clustering  (Unit II – Partition-Based Clustering)
 *  2. PCA 2-D projection  (Unit IV – Dimensionality Reduction)
 *  3. t-SNE simulation    (Unit IV – Non-linear DR, conceptual approximation)
 *  4. LOF-style anomaly   (Unit V  – Local Outlier Factor)
 *  5. Silhouette score    (Unit VI – Cluster Validation)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmbeddingAnalyticsService {

    private final ChunkRepository chunkRepository;
    private final UserRepository  userRepository;

    private static final int    MAX_CHUNKS     = 300;  // cap to keep latency reasonable
    private static final int    K_DEFAULT      = 4;
    private static final int    KMEANS_ITERS   = 50;
    private static final double ANOMALY_THRESH = 0.65;

    // ──────────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────────

    public AnalyticsResponse analyse(String username, int k) {
        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        // 1. Load this user's embedded chunks only (scoped, capped at MAX_CHUNKS)
        List<ChunkEntity> all = chunkRepository.findEmbeddedByUserId(
                user.getId(), PageRequest.of(0, MAX_CHUNKS));

        if (all.isEmpty()) {
            return emptyResponse();
        }

        log.info("Analytics: running on {} chunks for user {}", all.size(), username);

        // 2. Parse embeddings → matrix
        double[][] matrix = parseEmbeddings(all);

        // 3. Centre data (mean subtraction) — needed for PCA
        double[] mean = columnMeans(matrix);
        double[][] centred = centre(matrix, mean);

        // 4. PCA → 2-D
        double[][] pca = pca2D(centred);

        // 5. t-SNE simulation (perturb PCA with category-aware repulsion)
        double[][] tsne = tsneSimulated(pca, all);

        // 6. K-Means on original high-dim embeddings
        int effectiveK = Math.min(k <= 0 ? K_DEFAULT : k, all.size());
        int[] assignments = kMeans(matrix, effectiveK);

        // 7. Anomaly scores via LOF-style local density
        double[] anomalyScores = lofAnomalyScores(pca);

        // 8. Cluster validation
        double silhouette = silhouetteScore(matrix, assignments, effectiveK);
        double inertia    = wcss(matrix, assignments, effectiveK);

        // 9. Variance explained (ratio of top-2 eigenvalue proxies)
        double[] varExplained = varianceExplained(centred);

        // 10. Cluster labels (most common category in each cluster)
        Map<Integer, String> clusterLabels = clusterLabels(all, assignments, effectiveK);

        // 11. Build points
        int anomalyCount = 0;
        List<ClusterPoint> pcaPoints  = new ArrayList<>();
        List<ClusterPoint> tsnePoints = new ArrayList<>();

        for (int i = 0; i < all.size(); i++) {
            ChunkEntity c = all.get(i);
            double score  = anomalyScores[i];
            if (score > ANOMALY_THRESH) anomalyCount++;

            String preview = c.getContent().length() > 80
                    ? c.getContent().substring(0, 80) + "…"
                    : c.getContent();

            pcaPoints.add(ClusterPoint.builder()
                    .chunkId(c.getId())
                    .content(preview)
                    .category(c.getCategory())
                    .docTitle(c.getDocument() != null ? c.getDocument().getOriginalFilename() : "")
                    .clusterId(assignments[i])
                    .x(pca[i][0])
                    .y(pca[i][1])
                    .anomalyScore(score)
                    .build());

            tsnePoints.add(ClusterPoint.builder()
                    .chunkId(c.getId())
                    .content(preview)
                    .category(c.getCategory())
                    .docTitle(c.getDocument() != null ? c.getDocument().getOriginalFilename() : "")
                    .clusterId(assignments[i])
                    .x(tsne[i][0])
                    .y(tsne[i][1])
                    .anomalyScore(score)
                    .build());
        }

        return AnalyticsResponse.builder()
                .pcaPoints(pcaPoints)
                .tsnePoints(tsnePoints)
                .numClusters(effectiveK)
                .silhouetteScore(round2(silhouette))
                .inertia(round2(inertia))
                .clusterLabels(clusterLabels)
                .totalChunks(all.size())
                .anomalyCount(anomalyCount)
                .anomalyThreshold(ANOMALY_THRESH)
                .pc1VarianceExplained(round2(varExplained[0]))
                .pc2VarianceExplained(round2(varExplained[1]))
                .build();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Embedding parsing
    // ──────────────────────────────────────────────────────────────────────────

    private double[][] parseEmbeddings(List<ChunkEntity> chunks) {
        // Embeddings stored as "[f1,f2,...,fn]"
        int dims = -1;
        List<double[]> rows = new ArrayList<>();
        for (ChunkEntity c : chunks) {
            String raw = c.getEmbedding().trim();
            if (raw.startsWith("[")) raw = raw.substring(1);
            if (raw.endsWith("]"))   raw = raw.substring(0, raw.length() - 1);
            String[] parts = raw.split(",");
            if (dims < 0) dims = parts.length;
            double[] vec = new double[dims];
            for (int i = 0; i < Math.min(dims, parts.length); i++) {
                try { vec[i] = Double.parseDouble(parts[i].trim()); }
                catch (NumberFormatException ignored) {}
            }
            rows.add(vec);
        }
        return rows.toArray(new double[0][]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. PCA (power iteration for top-2 eigenvectors)
    // ──────────────────────────────────────────────────────────────────────────

    private double[] columnMeans(double[][] m) {
        int n = m.length, d = m[0].length;
        double[] mean = new double[d];
        for (double[] row : m) for (int j = 0; j < d; j++) mean[j] += row[j];
        for (int j = 0; j < d; j++) mean[j] /= n;
        return mean;
    }

    private double[][] centre(double[][] m, double[] mean) {
        int n = m.length, d = m[0].length;
        double[][] c = new double[n][d];
        for (int i = 0; i < n; i++)
            for (int j = 0; j < d; j++)
                c[i][j] = m[i][j] - mean[j];
        return c;
    }

    /** Project centred matrix onto top-2 principal components via power iteration */
    private double[][] pca2D(double[][] centred) {
        int n = centred.length, d = centred[0].length;
        double[] pc1 = powerIterate(centred, null, 80);
        double[] pc2 = powerIterate(centred, pc1,  80);

        double[][] proj = new double[n][2];
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < d; j++) {
                proj[i][0] += centred[i][j] * pc1[j];
                proj[i][1] += centred[i][j] * pc2[j];
            }
        }
        return normalise2D(proj);
    }

    /** Power iteration: finds dominant eigenvector, optionally deflated by 'deflate' */
    private double[] powerIterate(double[][] X, double[] deflate, int iters) {
        int n = X.length, d = X[0].length;
        double[] v = new double[d];
        Random rng = new Random(42);
        for (int j = 0; j < d; j++) v[j] = rng.nextGaussian();
        normaliseVec(v);

        for (int it = 0; it < iters; it++) {
            // w = X^T (X v)
            double[] Xv = new double[n];
            for (int i = 0; i < n; i++)
                for (int j = 0; j < d; j++) Xv[i] += X[i][j] * v[j];

            double[] w = new double[d];
            for (int i = 0; i < n; i++)
                for (int j = 0; j < d; j++) w[j] += X[i][j] * Xv[i];

            // deflate by previous eigenvector
            if (deflate != null) {
                double dot = 0;
                for (int j = 0; j < d; j++) dot += w[j] * deflate[j];
                for (int j = 0; j < d; j++) w[j] -= dot * deflate[j];
            }
            normaliseVec(w);
            v = w;
        }
        return v;
    }

    private void normaliseVec(double[] v) {
        double norm = 0;
        for (double x : v) norm += x * x;
        norm = Math.sqrt(norm);
        if (norm > 1e-12) for (int i = 0; i < v.length; i++) v[i] /= norm;
    }

    private double[] varianceExplained(double[][] centred) {
        // Approximate: variance along PC1 and PC2 vs total Frobenius norm
        double[][] proj = pca2D(centred);
        double v1 = 0, v2 = 0, total = 0;
        for (double[] row : centred) for (double x : row) total += x * x;
        for (double[] p : proj) { v1 += p[0] * p[0]; v2 += p[1] * p[1]; }
        if (total < 1e-12) return new double[]{0, 0};
        return new double[]{ v1 / total * 100, v2 / total * 100 };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. t-SNE simulation (category-aware perturbation of PCA)
    // ──────────────────────────────────────────────────────────────────────────

    private double[][] tsneSimulated(double[][] pca, List<ChunkEntity> chunks) {
        int n = pca.length;
        double[][] tsne = new double[n][2];
        Map<String, Integer> catIndex = new HashMap<>();
        int ci = 0;
        for (ChunkEntity c : chunks) {
            catIndex.putIfAbsent(c.getCategory(), ci++);
        }
        Random rng = new Random(7);
        for (int i = 0; i < n; i++) {
            int cat = catIndex.getOrDefault(chunks.get(i).getCategory(), 0);
            // Attract towards category centroid with noise
            double angle = (2 * Math.PI * cat) / Math.max(catIndex.size(), 1);
            double r = 0.25 + 0.15 * rng.nextGaussian();
            tsne[i][0] = pca[i][0] * 0.6 + r * Math.cos(angle) + 0.05 * rng.nextGaussian();
            tsne[i][1] = pca[i][1] * 0.6 + r * Math.sin(angle) + 0.05 * rng.nextGaussian();
        }
        return normalise2D(tsne);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. K-Means (k-Means++ init, cosine-normalised space)
    // ──────────────────────────────────────────────────────────────────────────

    private int[] kMeans(double[][] data, int k) {
        int n = data.length, d = data[0].length;
        double[][] centroids = kMeansPlusPlusInit(data, k);
        int[] assignments = new int[n];

        for (int iter = 0; iter < KMEANS_ITERS; iter++) {
            boolean changed = false;

            // Assign each point to nearest centroid (Euclidean)
            for (int i = 0; i < n; i++) {
                int best = 0;
                double bestDist = Double.MAX_VALUE;
                for (int c = 0; c < k; c++) {
                    double dist = euclidean(data[i], centroids[c], d);
                    if (dist < bestDist) { bestDist = dist; best = c; }
                }
                if (best != assignments[i]) { assignments[i] = best; changed = true; }
            }

            if (!changed) break;

            // Update centroids
            double[][] sums  = new double[k][d];
            int[]      counts = new int[k];
            for (int i = 0; i < n; i++) {
                int c = assignments[i];
                for (int j = 0; j < d; j++) sums[c][j] += data[i][j];
                counts[c]++;
            }
            for (int c = 0; c < k; c++) {
                if (counts[c] > 0)
                    for (int j = 0; j < d; j++) centroids[c][j] = sums[c][j] / counts[c];
            }
        }
        return assignments;
    }

    /** k-Means++ initialisation — spreads centroids proportional to distance² */
    private double[][] kMeansPlusPlusInit(double[][] data, int k) {
        int n = data.length, d = data[0].length;
        Random rng = new Random(42);
        double[][] centroids = new double[k][d];
        centroids[0] = data[rng.nextInt(n)].clone();

        for (int c = 1; c < k; c++) {
            double[] dist2 = new double[n];
            double sum = 0;
            for (int i = 0; i < n; i++) {
                double minD = Double.MAX_VALUE;
                for (int prev = 0; prev < c; prev++) {
                    double d2 = euclidean2(data[i], centroids[prev], d);
                    if (d2 < minD) minD = d2;
                }
                dist2[i] = minD;
                sum += minD;
            }
            double r = rng.nextDouble() * sum;
            double cum = 0;
            int chosen = n - 1;
            for (int i = 0; i < n; i++) {
                cum += dist2[i];
                if (cum >= r) { chosen = i; break; }
            }
            centroids[c] = data[chosen].clone();
        }
        return centroids;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. LOF-style anomaly scoring (using 2-D PCA projections for speed)
    // ──────────────────────────────────────────────────────────────────────────

    private double[] lofAnomalyScores(double[][] pca2d) {
        int n = pca2d.length;
        int knn = Math.min(5, n - 1);
        double[] scores = new double[n];

        // Compute k-distance and local reachability density for each point
        double[] lrd = new double[n];
        double[][] kDistances = new double[n][knn];

        for (int i = 0; i < n; i++) {
            double[] dists = new double[n];
            for (int j = 0; j < n; j++)
                dists[j] = euclidean(pca2d[i], pca2d[j], 2);
            double[] sorted = dists.clone();
            Arrays.sort(sorted);
            // k-th nearest distance
            double kDist = sorted[Math.min(knn, sorted.length - 1)];
            // store distances to k-nearest neighbours
            int nn = 0;
            for (int j = 0; j < n && nn < knn; j++) {
                if (j != i && dists[j] <= kDist) {
                    kDistances[i][nn++] = dists[j];
                }
            }
        }

        // LRD
        for (int i = 0; i < n; i++) {
            double sumReach = 0;
            for (int ni = 0; ni < knn; ni++) {
                sumReach += Math.max(kDistances[i][ni], 1e-10);
            }
            lrd[i] = knn / Math.max(sumReach, 1e-10);
        }

        // LOF score per point
        double maxLof = 0;
        for (int i = 0; i < n; i++) {
            double sum = 0;
            int cnt = 0;
            for (int j = 0; j < n; j++) {
                double d = euclidean(pca2d[i], pca2d[j], 2);
                if (j != i && d <= kDistances[i][Math.min(knn - 1, kDistances[i].length - 1)] + 1e-10) {
                    sum += lrd[j] / Math.max(lrd[i], 1e-10);
                    cnt++;
                }
            }
            scores[i] = cnt > 0 ? sum / cnt : 1.0;
            if (scores[i] > maxLof) maxLof = scores[i];
        }

        // Normalise to [0, 1]
        for (int i = 0; i < n; i++)
            scores[i] = Math.min(1.0, scores[i] / Math.max(maxLof, 1.0));

        return scores;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Silhouette score (Unit VI validation metric)
    // ──────────────────────────────────────────────────────────────────────────

    private double silhouetteScore(double[][] data, int[] labels, int k) {
        int n = data.length, d = data[0].length;
        if (n < 2 || k < 2) return 0.0;
        double total = 0;
        for (int i = 0; i < n; i++) {
            double a = intraClusterDist(i, data, labels, d);
            double b = minInterClusterDist(i, data, labels, k, d);
            double s = (Math.max(a, b) > 1e-12) ? (b - a) / Math.max(a, b) : 0;
            total += s;
        }
        return total / n;
    }

    private double intraClusterDist(int i, double[][] data, int[] labels, int d) {
        int count = 0; double sum = 0;
        for (int j = 0; j < data.length; j++) {
            if (j != i && labels[j] == labels[i]) {
                sum += euclidean(data[i], data[j], d); count++;
            }
        }
        return count > 0 ? sum / count : 0;
    }

    private double minInterClusterDist(int i, double[][] data, int[] labels, int k, int d) {
        double min = Double.MAX_VALUE;
        for (int c = 0; c < k; c++) {
            if (c == labels[i]) continue;
            double sum = 0; int count = 0;
            for (int j = 0; j < data.length; j++) {
                if (labels[j] == c) { sum += euclidean(data[i], data[j], d); count++; }
            }
            if (count > 0 && sum / count < min) min = sum / count;
        }
        return min == Double.MAX_VALUE ? 0 : min;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 7. WCSS / Inertia (Elbow method metric)
    // ──────────────────────────────────────────────────────────────────────────

    private double wcss(double[][] data, int[] labels, int k) {
        int n = data.length, d = data[0].length;
        double[][] centroids = new double[k][d];
        int[] counts = new int[k];
        for (int i = 0; i < n; i++) {
            int c = labels[i];
            for (int j = 0; j < d; j++) centroids[c][j] += data[i][j];
            counts[c]++;
        }
        for (int c = 0; c < k; c++)
            if (counts[c] > 0)
                for (int j = 0; j < d; j++) centroids[c][j] /= counts[c];

        double total = 0;
        for (int i = 0; i < n; i++) {
            double e = euclidean2(data[i], centroids[labels[i]], d);
            total += e;
        }
        return total;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 8. Cluster labels — most common category
    // ──────────────────────────────────────────────────────────────────────────

    private Map<Integer, String> clusterLabels(List<ChunkEntity> chunks, int[] labels, int k) {
        Map<Integer, Map<String, Long>> freq = new HashMap<>();
        for (int i = 0; i < chunks.size(); i++) {
            int c = labels[i];
            freq.computeIfAbsent(c, x -> new HashMap<>())
                .merge(chunks.get(i).getCategory(), 1L, Long::sum);
        }
        Map<Integer, String> result = new HashMap<>();
        for (int c = 0; c < k; c++) {
            Map<String, Long> m = freq.get(c);
            if (m != null && !m.isEmpty()) {
                result.put(c, m.entrySet().stream()
                        .max(Map.Entry.comparingByValue())
                        .map(Map.Entry::getKey).orElse("?"));
            } else {
                result.put(c, "Empty");
            }
        }
        return result;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Utils
    // ──────────────────────────────────────────────────────────────────────────

    private double euclidean(double[] a, double[] b, int d) {
        return Math.sqrt(euclidean2(a, b, d));
    }

    private double euclidean2(double[] a, double[] b, int d) {
        double sum = 0;
        for (int j = 0; j < d; j++) { double diff = a[j] - b[j]; sum += diff * diff; }
        return sum;
    }

    private double[][] normalise2D(double[][] pts) {
        double minX = Double.MAX_VALUE, maxX = -Double.MAX_VALUE;
        double minY = Double.MAX_VALUE, maxY = -Double.MAX_VALUE;
        for (double[] p : pts) {
            if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
            if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
        }
        double rx = maxX - minX, ry = maxY - minY;
        double[][] out = new double[pts.length][2];
        for (int i = 0; i < pts.length; i++) {
            out[i][0] = rx > 1e-12 ? (pts[i][0] - minX) / rx * 200 - 100 : 0;
            out[i][1] = ry > 1e-12 ? (pts[i][1] - minY) / ry * 200 - 100 : 0;
        }
        return out;
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private AnalyticsResponse emptyResponse() {
        return AnalyticsResponse.builder()
                .pcaPoints(List.of())
                .tsnePoints(List.of())
                .numClusters(0)
                .silhouetteScore(0)
                .inertia(0)
                .clusterLabels(Map.of())
                .totalChunks(0)
                .anomalyCount(0)
                .anomalyThreshold(ANOMALY_THRESH)
                .pc1VarianceExplained(0)
                .pc2VarianceExplained(0)
                .build();
    }
}
