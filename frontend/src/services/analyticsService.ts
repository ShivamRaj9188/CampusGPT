import axiosInstance from './axiosInstance';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClusterPoint {
  chunkId:      number;
  content:      string;
  category:     string;
  docTitle:     string;
  clusterId:    number;
  x:            number;
  y:            number;
  anomalyScore: number;
}

export interface AnalyticsData {
  pcaPoints:            ClusterPoint[];
  tsnePoints:           ClusterPoint[];
  numClusters:          number;
  silhouetteScore:      number;
  inertia:              number;
  clusterLabels:        Record<number, string>;
  totalChunks:          number;
  anomalyCount:         number;
  anomalyThreshold:     number;
  pc1VarianceExplained: number;
  pc2VarianceExplained: number;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const analyticsService = {
  /** Fetch projection + clustering + anomaly data for the current user */
  async getProjection(k = 4): Promise<AnalyticsData> {
    const res = await axiosInstance.get<AnalyticsData>('/analytics/projection', {
      params: { k },
      timeout: 120_000, // analytics can take ~30s on first run
    });
    return res.data;
  },
};
