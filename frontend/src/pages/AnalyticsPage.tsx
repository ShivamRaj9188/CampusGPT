import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, AlertTriangle, Layers, RefreshCw, Info, Sparkles } from 'lucide-react';
import { analyticsService, AnalyticsData, ClusterPoint } from '../services/analyticsService';

// ── Colour palette for clusters ───────────────────────────────────────────────
const CLUSTER_COLORS = ['#00ff9d', '#00c8ff', '#a259ff', '#ff6b35', '#ffcc00', '#ff4d88'];
const ANOMALY_COLOR  = '#ff2d55';

// ── Small scatter-plot (canvas-based, no extra lib) ──────────────────────────
function ScatterPlot({
  points, title, subtitle,
}: { points: ClusterPoint[]; title: string; subtitle: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<ClusterPoint | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  // Determine canvas coords once
  const PAD = 24;
  const getCoords = (p: ClusterPoint, W: number, H: number) => {
    const xs = points.map(q => q.x);
    const ys = points.map(q => q.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rx = maxX - minX || 1, ry = maxY - minY || 1;
    return {
      cx: PAD + ((p.x - minX) / rx) * (W - 2 * PAD),
      cy: PAD + (1 - (p.y - minY) / ry) * (H - 2 * PAD),
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;

    // HiDPI / Retina fix: scale canvas resolution by devicePixelRatio
    const dpr = window.devicePixelRatio || 1;
    const cssW = 500, cssH = 360;
    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width  = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr); // all subsequent drawing in CSS pixels
    ctx.clearRect(0, 0, cssW, cssH);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = PAD + (i / 4) * (cssW - 2 * PAD);
      const y = PAD + (i / 4) * (cssH - 2 * PAD);
      ctx.beginPath(); ctx.moveTo(x, PAD); ctx.lineTo(x, cssH - PAD); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(cssW - PAD, y); ctx.stroke();
    }

    // Points
    for (const p of points) {
      const { cx, cy } = getCoords(p, cssW, cssH);
      const isAnomaly = p.anomalyScore > 0.65;
      const color = isAnomaly ? ANOMALY_COLOR : CLUSTER_COLORS[p.clusterId % CLUSTER_COLORS.length];
      const radius = isAnomaly ? 5 : 4;

      // Glow
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.5);
      grad.addColorStop(0, color + '88');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, radius * 2.5, 0, Math.PI * 2); ctx.fill();

      // Dot
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    }
  }, [points]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    // Map to CSS pixels (the ctx is already in CSS pixel space after ctx.scale(dpr,dpr))
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMouse({ x: e.clientX, y: e.clientY });
    const close = points.find(p => {
      const { cx, cy } = getCoords(p, 500, 360);
      return Math.hypot(cx - mx, cy - my) < 10;
    });
    setHovered(close ?? null);
  };

  return (
    <div className="relative">
      <div className="mb-2">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs" style={{ color: '#5a5a5a' }}>{subtitle}</p>
      </div>
      <div className="relative rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <canvas
          ref={canvasRef}
          width={500}
          height={360}
          style={{ width: '100%', height: 'auto', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        />
        {hovered && (
          <div
            className="pointer-events-none fixed z-50 max-w-xs rounded-xl p-3 text-xs"
            style={{
              left: mouse.x + 14, top: mouse.y - 10,
              background: 'rgba(10,10,10,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            <p className="font-semibold text-white mb-1">{hovered.category} · Cluster {hovered.clusterId}</p>
            <p style={{ color: '#aaa' }}>{hovered.content}</p>
            {hovered.anomalyScore > 0.65 && (
              <p className="mt-1 font-medium" style={{ color: ANOMALY_COLOR }}>
                ⚠ Anomaly score: {(hovered.anomalyScore * 100).toFixed(0)}%
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Layman Summary Component ──────────────────────────────────────────────────
function LaymanSummary({ data }: { data: AnalyticsData }) {
  const getClusteringInsight = () => {
    if (data.silhouetteScore > 0.5) return "Your study materials are very well organized into distinct, clear topics.";
    if (data.silhouetteScore > 0.2) return "Your materials cover related concepts that blend into each other naturally.";
    return "Your documents contain many overlapping ideas; the AI might find it hard to distinguish between specific topics.";
  };

  const getAnomalyInsight = () => {
    if (data.anomalyCount === 0) return "Great news! All your uploaded content is consistent and relevant to your subjects.";
    if (data.anomalyCount < 5) return `We found ${data.anomalyCount} small parts (like indexes or page numbers) that don't quite fit the main topics.`;
    return `We flagged ${data.anomalyCount} sections as 'anomalies'. These might be irrelevant pages, ads, or very unique information that stands out from the rest.`;
  };

  const getDiversityInsight = () => {
    if (data.pc1VarianceExplained > 50) return "Your notes are highly focused on a single core theme.";
    return "Your materials cover a wide variety of different perspectives and sub-topics.";
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-6 relative overflow-hidden"
      style={{ background: 'rgba(0,255,157,0.03)', border: '1px solid rgba(0,255,157,0.1)' }}
    >
      <div className="absolute top-0 right-0 p-6 opacity-10">
        <Sparkles className="w-12 h-12 text-[#00ff9d]" />
      </div>
      
      <h3 className="text-sm font-bold text-[#00ff9d] mb-4 flex items-center gap-2">
        <Info className="w-4 h-4" /> AI Knowledge Report
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-[#505050]">Topic Structure</p>
          <p className="text-xs text-white leading-relaxed">{getClusteringInsight()}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-[#505050]">Quality Check</p>
          <p className="text-xs text-white leading-relaxed">{getAnomalyInsight()}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-[#505050]">Material Focus</p>
          <p className="text-xs text-white leading-relaxed">{getDiversityInsight()}</p>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-white/5">
        <p className="text-[11px] text-[#707070] italic leading-relaxed">
          <strong>Summary:</strong> Based on the analysis of {data.totalChunks} information blocks, your knowledge base is organized into {data.numClusters} main conceptual groups. 
          The AI is currently {Math.round(data.silhouetteScore * 100)}% confident in how these topics are separated.
        </p>
      </div>
    </motion.div>
  );
}

// ── Stat pill ────────────────────────────────────────────────────────────────
function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-xs mb-1" style={{ color: '#5a5a5a' }}>{label}</p>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [k, setK] = useState(4);
  const [tab, setTab] = useState<'pca' | 'tsne' | 'anomaly'>('pca');

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const d = await analyticsService.getProjection(k);
      setData(d);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  // No auto-run — user explicitly clicks "Run Analysis"

  const anomalyPoints = data?.pcaPoints.filter(p => p.anomalyScore > (data.anomalyThreshold ?? 0.65)) ?? [];

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs font-medium mb-1" style={{ color: '#00ff9d', letterSpacing: '0.1em' }}>UNSUPERVISED LEARNING</p>
        <h1 className="text-2xl font-bold text-white">Embedding Analytics</h1>
        <p className="text-sm mt-1" style={{ color: '#5a5a5a' }}>
          K-Means clustering · PCA vs t-SNE projection · LOF anomaly detection
        </p>
      </motion.div>

      {/* Controls */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: '#5a5a5a' }}>Clusters k =</label>
          {[2, 3, 4, 5, 6].map(n => (
            <button key={n} onClick={() => setK(n)}
              className="w-8 h-8 rounded-lg text-xs font-bold transition-all"
              style={{
                background: k === n ? 'rgba(0,255,157,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${k === n ? '#00ff9d40' : 'rgba(255,255,255,0.07)'}`,
                color: k === n ? '#00ff9d' : '#5a5a5a',
              }}>{n}</button>
          ))}
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ background: 'rgba(0,255,157,0.1)', border: '1px solid rgba(0,255,157,0.25)', color: '#00ff9d' }}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Running…' : 'Run Analysis'}
        </button>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 text-sm flex items-center gap-3"
          style={{ background: 'rgba(255,45,85,0.08)', border: '1px solid rgba(255,45,85,0.2)', color: '#ff4d88' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error} — Upload documents first so embeddings exist.
        </div>
      )}

      {/* Stats row */}
      {data && (
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Stat label="Total Chunks"     value={data.totalChunks}            color="#00c8ff" />
            <Stat label="Clusters"         value={data.numClusters}            color="#a259ff" />
            <Stat label="Silhouette"       value={data.silhouetteScore.toFixed(2)} color="#00ff9d" />
            <Stat label="Inertia (WCSS)"   value={data.inertia.toFixed(0)}     color="#ff6b35" />
            <Stat label="Anomalies"        value={data.anomalyCount}           color={ANOMALY_COLOR} />
            <Stat label="PC1 Variance"     value={`${data.pc1VarianceExplained.toFixed(1)}%`} color="#ffcc00" />
          </motion.div>

          <LaymanSummary data={data} />
        </div>
      )}

      {/* Tabs */}
      {data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <div className="flex gap-2 mb-4">
            {([
              { id: 'pca',    label: 'PCA Projection',  icon: Layers },
              { id: 'tsne',   label: 't-SNE Projection', icon: BarChart2 },
              { id: 'anomaly',label: 'Anomaly Detection',icon: AlertTriangle },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: tab === id ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${tab === id ? '#00c8ff40' : 'rgba(255,255,255,0.07)'}`,
                  color: tab === id ? '#00c8ff' : '#5a5a5a',
                }}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>

          {/* PCA tab */}
          {tab === 'pca' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ScatterPlot
                  points={data.pcaPoints}
                  title="PCA — 2D Projection"
                  subtitle={`PC1: ${data.pc1VarianceExplained.toFixed(1)}% variance · PC2: ${data.pc2VarianceExplained.toFixed(1)}% variance`}
                />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium" style={{ color: '#3a3a3a', letterSpacing: '0.08em' }}>CLUSTER LEGEND</p>
                {Object.entries(data.clusterLabels).map(([id, label]) => (
                  <div key={id} className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: CLUSTER_COLORS[+id % CLUSTER_COLORS.length] }} />
                    <p className="text-xs text-white">Cluster {id} — <span style={{ color: '#aaa' }}>{label}</span></p>
                  </div>
                ))}
                <div className="flex items-center gap-3 rounded-xl px-3 py-2 mt-1"
                  style={{ background: 'rgba(255,45,85,0.05)', border: '1px solid rgba(255,45,85,0.15)' }}>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ANOMALY_COLOR }} />
                  <p className="text-xs" style={{ color: ANOMALY_COLOR }}>Anomalous chunks</p>
                </div>
                <div className="rounded-xl p-3 mt-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#5a5a5a' }} />
                    <p className="text-xs leading-relaxed" style={{ color: '#5a5a5a' }}>
                      PCA finds linear axes of maximum variance in 768-D embedding space and projects onto the top 2 principal components. Hover dots for details.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* t-SNE tab */}
          {tab === 'tsne' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ScatterPlot
                  points={data.tsnePoints}
                  title="t-SNE — 2D Projection"
                  subtitle="Non-linear neighbourhood-preserving projection (category-aware)"
                />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium" style={{ color: '#3a3a3a', letterSpacing: '0.08em' }}>PCA vs t-SNE</p>
                {[
                  { label: 'Linear?',         pca: 'Yes', tsne: 'No' },
                  { label: 'Global structure', pca: '✓',   tsne: '✗' },
                  { label: 'Local clusters',   pca: 'Partial', tsne: '✓✓' },
                  { label: 'Speed',            pca: 'Fast', tsne: 'Slow' },
                  { label: 'Interpretable',    pca: '✓', tsne: '✗' },
                ].map(row => (
                  <div key={row.label} className="grid grid-cols-3 gap-1 text-xs">
                    <span style={{ color: '#5a5a5a' }}>{row.label}</span>
                    <span className="text-center" style={{ color: '#00ff9d' }}>{row.pca}</span>
                    <span className="text-center" style={{ color: '#00c8ff' }}>{row.tsne}</span>
                  </div>
                ))}
                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#5a5a5a' }} />
                    <p className="text-xs leading-relaxed" style={{ color: '#5a5a5a' }}>
                      t-SNE uses perplexity-based probability distributions to tightly cluster semantically similar chunks. Clusters appear tighter than PCA.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Anomaly tab */}
          {tab === 'anomaly' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <ScatterPlot
                    points={data.pcaPoints}
                    title="Anomaly Map (PCA space)"
                    subtitle={`${data.anomalyCount} anomalous chunks (LOF score > ${data.anomalyThreshold})`}
                  />
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-medium" style={{ color: '#3a3a3a', letterSpacing: '0.08em' }}>
                    TOP ANOMALIES
                  </p>
                  {anomalyPoints.slice(0, 6).map(p => (
                    <div key={p.chunkId} className="rounded-xl p-3"
                      style={{ background: 'rgba(255,45,85,0.05)', border: '1px solid rgba(255,45,85,0.15)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: ANOMALY_COLOR }}>{p.category}</span>
                        <span className="text-xs font-bold" style={{ color: ANOMALY_COLOR }}>
                          {(p.anomalyScore * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: '#707070' }}>{p.content}</p>
                    </div>
                  ))}
                  {anomalyPoints.length === 0 && (
                    <p className="text-xs" style={{ color: '#5a5a5a' }}>No anomalies detected. Knowledge base looks clean ✓</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && !data && !error && (
        <div className="glass-card p-12 text-center">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm text-white mb-1">No data yet</p>
          <p className="text-xs" style={{ color: '#3a3a3a' }}>Upload PDFs and click Run Analysis to start.</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="glass-card p-12 flex flex-col items-center gap-4">
          <div className="flex gap-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <p className="text-xs" style={{ color: '#5a5a5a' }}>Running k-Means · PCA · LOF on your embeddings…</p>
        </div>
      )}
    </div>
  );
}
