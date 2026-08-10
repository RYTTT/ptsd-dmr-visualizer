'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { GeneProbeData, ProbeEntry } from '../types/probe';

interface GenomicTrackProps {
  geneData: GeneProbeData;
}

const SUBTYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SSS: { label: 'SSS vs control', color: '#b91c1c', bg: '#fef2f2' },
  ADS: { label: 'ADS vs control', color: '#1d4ed8', bg: '#eff6ff' },
  ICF: { label: 'ICF vs control', color: '#6d28d9', bg: '#f5f3ff' },
  ISS: { label: 'ISS vs control', color: '#047857', bg: '#ecfdf5' },
  Meta: { label: 'Combined probe meta-analysis', color: '#0f172a', bg: '#f8fafc' },
  MDMA: { label: 'MDMA component — non-visit-specific', color: '#7c3aed', bg: '#f5f3ff' },
  Ketamine: { label: 'Ketamine component — non-visit-specific', color: '#0891b2', bg: '#ecfeff' },
  CPT: { label: 'CPT component — non-visit-specific', color: '#059669', bg: '#ecfdf5' },
  MDMA_Pre: { label: 'MDMA — Baseline', color: '#7c3aed', bg: '#f5f3ff' },
  MDMA_FUP: { label: 'MDMA — Follow-Up', color: '#7c3aed', bg: '#ede9fe' },
  Ketamine_Pre: { label: 'Ketamine — Baseline', color: '#0891b2', bg: '#ecfeff' },
  Ketamine_FUP: { label: 'Ketamine — Follow-Up', color: '#0891b2', bg: '#cffafe' },
  CPT_Pre: { label: 'CPT — Baseline', color: '#059669', bg: '#ecfdf5' },
  CPT_FUP: { label: 'CPT — Follow-Up', color: '#059669', bg: '#d1fae5' },
};

const TREATMENT_GRID_ROWS = [
  {
    cohort: 'MDMA',
    label: 'MDMA-AT',
    cols: [
      { key: 'MDMA_Pre', title: 'MDMA — Baseline (Pre)', color: '#7c3aed', bg: '#f5f3ff' },
      { key: 'MDMA_FUP', title: 'MDMA — Follow-up (FUP)', color: '#7c3aed', bg: '#ede9fe' },
    ],
  },
  {
    cohort: 'Ketamine',
    label: 'Ketamine',
    cols: [
      { key: 'Ketamine_Pre', title: 'Ketamine — Baseline (Pre)', color: '#0891b2', bg: '#ecfeff' },
      { key: 'Ketamine_FUP', title: 'Ketamine — Follow-up (FUP)', color: '#0891b2', bg: '#cffafe' },
    ],
  },
  {
    cohort: 'CPT',
    label: 'CPT',
    cols: [
      { key: 'CPT_Pre', title: 'CPT — Baseline (Pre)', color: '#059669', bg: '#ecfdf5' },
      { key: 'CPT_FUP', title: 'CPT — Follow-up (FUP)', color: '#059669', bg: '#d1fae5' },
    ],
  },
];

const HYPER_COLOR = '#dc2626';
const HYPO_COLOR = '#2563eb';
const NEUTRAL_COLOR = '#64748b';
const ZERO_EFFECT_COLOR = '#0f172a';
const ISLAND_FILL = 'rgba(245, 158, 11, 0.28)';
const ISLAND_STROKE = 'rgba(180, 83, 9, 0.75)';
const P_05_COLOR = '#475569';
const P_01_COLOR = '#7c3aed';
const P_001_COLOR = '#b45309';
const MAX_DISPLAY_NEG_LOG_P = 8;

const FEATURE_COLORS: Record<string, string> = {
  'TSS1500': '#f59e0b', // amber-500
  'TSS200': '#ef4444', // red-500
  '5\'UTR': '#8b5cf6', // violet-500
  '1stExon': '#3b82f6', // blue-500
  'Body': '#10b981', // emerald-500
  '3\'UTR': '#06b6d4', // cyan-500
};

interface TooltipData {
  x: number;
  y: number;
  probe: ProbeEntry;
  subtype: string;
}

function isProbability(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function probabilityScore(value: number, zeroScore: number): number {
  return value === 0 ? zeroScore : -Math.log10(value);
}

function formatProbability(value: number | null): string {
  if (value == null) return 'Unavailable';
  if (value === 0) return '0 (below numeric precision)';
  return value < 0.001 ? value.toExponential(2) : value.toFixed(3);
}

export const GenomicTrackPlot: React.FC<GenomicTrackProps> = ({ geneData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 0 });

  // ---- Auto-detect analyses from every retained probe ----
  const SUBTYPES = useMemo(() => {
    if (!geneData.probes.length) return [];
    const detected = new Set<string>();
    for (const probe of geneData.probes) {
      for (const key of Object.keys(probe)) {
        const match = key.match(/^(.+)_P$/u);
        if (match && match[1] !== 'adj') detected.add(match[1]);
      }
    }
    const order = ['SSS', 'ADS', 'ICF', 'ISS', 'MDMA_Pre', 'MDMA_FUP', 'Ketamine_Pre', 'Ketamine_FUP', 'CPT_Pre', 'CPT_FUP', 'Meta', 'MDMA', 'Ketamine', 'CPT'];
    const result: { key: string; label: string; color: string; bg: string }[] = [];
    for (const k of order) {
      if (detected.has(k) && SUBTYPE_CONFIG[k]) {
        result.push({ key: k, ...SUBTYPE_CONFIG[k] });
      }
    }
    for (const k of detected) {
      if (!order.includes(k)) {
        result.push({ key: k, label: k, color: '#64748b', bg: '#f8fafc' });
      }
    }
    return result;
  }, [geneData]);

  // Check if 3x2 treatment grid mode should be used
  const isGrid = useMemo(() => {
    return SUBTYPES.some((s) => s.key.includes('_Pre') || s.key.includes('_FUP'));
  }, [SUBTYPES]);
  const isPtsdSubtypeFigure = useMemo(
    () => SUBTYPES.some((subtype) => ['SSS', 'ADS', 'ICF', 'ISS'].includes(subtype.key)),
    [SUBTYPES],
  );

  // ---- DIMENSIONS ----
  const panelHeight = 175;
  const topMargin = isGrid ? 74 : 50;
  const bottomMargin = 165;
  const leftMargin1 = isGrid ? 55 : 80;
  const rightMargin = 24;
  const panelGap = 26;
  const colGap = 55;

  const totalHeight = useMemo(() => {
    if (isGrid) {
      return topMargin + 3 * panelHeight + 2 * panelGap + bottomMargin;
    }
    const count = SUBTYPES.length || 1;
    return topMargin + count * panelHeight + (count - 1) * panelGap + bottomMargin;
  }, [SUBTYPES, isGrid, topMargin, panelHeight, panelGap, bottomMargin]);

  const featureAnnotations = useMemo(() => {
    return geneData.probes
      .filter((probe) => probe.pos > 0 && probe.feature && probe.feature !== 'Unknown')
      .map((probe) => ({ feature: probe.feature, pos: probe.pos }));
  }, [geneData.probes]);

  const featureLegend = useMemo(() => [...new Set(featureAnnotations.map((item) => item.feature))].sort(), [featureAnnotations]);

  // ---- X-AXIS DOMAIN: INCLUDE BOTH PROBES AND CPG ISLANDS ----
  const { minPos, maxPos, posRange } = useMemo(() => {
    const positions = geneData.probes.map((p) => p.pos).filter((p) => p > 0);
    if (geneData.cpgIslands) {
      for (const isl of geneData.cpgIslands) {
        if (isl.start > 0) positions.push(isl.start);
        if (isl.end > 0) positions.push(isl.end);
      }
    }
    if (!positions.length) return { minPos: 0, maxPos: 1000, posRange: 1000 };
    const min = Math.min(...positions);
    const max = Math.max(...positions);
    const pad = Math.max((max - min) * 0.06, 200);
    return { minPos: min - pad, maxPos: max + pad, posRange: max - min + 2 * pad };
  }, [geneData]);

  const maxNegLogP = MAX_DISPLAY_NEG_LOG_P;

  const displayChr = geneData.chr.toLowerCase().startsWith('chr') ? geneData.chr : `chr${geneData.chr}`;

  const accessibleRows = useMemo(() => {
    return geneData.probes.flatMap((probe) => SUBTYPES.flatMap((subtype) => {
      const deltaBeta = probe[`${subtype.key}_logFC`];
      const nominalP = probe[`${subtype.key}_P`];
      const numericDeltaBeta = typeof deltaBeta === 'number' ? deltaBeta : null;
      const numericP = isProbability(nominalP) ? nominalP : null;
      if (numericP == null) return [];
      return [{ probe: probe.probe, pos: probe.pos, feature: probe.feature || 'Unannotated', comparison: subtype.label, deltaBeta: numericDeltaBeta, nominalP: numericP }];
    }));
  }, [geneData.probes, SUBTYPES]);
  const hasZeroP = accessibleRows.some((row) => row.nominalP === 0);
  const hasClippedP = accessibleRows.some((row) => row.nominalP != null && row.nominalP > 0 && -Math.log10(row.nominalP) > maxNegLogP);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setDimensions({ width: entry.contentRect.width, height: totalHeight });
        }
      }
    });
    observer.observe(container);
    if (container.clientWidth > 0) {
      setDimensions({ width: container.clientWidth, height: totalHeight });
    }
    return () => observer.disconnect();
  }, [totalHeight]);

  const effectiveWidth = Math.max(dimensions.width > 0 ? dimensions.width : (isGrid ? 850 : 700), isGrid ? 660 : 360);

  // Column metrics for Grid mode vs 1D mode
  const colWidth = useMemo(() => {
    if (!isGrid) return Math.max(effectiveWidth - leftMargin1 - rightMargin, 200);
    const availableW = effectiveWidth - leftMargin1 - rightMargin - colGap;
    return Math.max(availableW / 2, 250);
  }, [isGrid, effectiveWidth, leftMargin1, rightMargin, colGap]);

  const leftMargin2 = leftMargin1 + colWidth + colGap;

  const posToX = useCallback(
    (pos: number, colIndex = 0) => {
      const colLeft = !isGrid || colIndex === 0 ? leftMargin1 : leftMargin2;
      return colLeft + ((pos - minPos) / posRange) * colWidth;
    },
    [isGrid, leftMargin1, leftMargin2, minPos, posRange, colWidth]
  );

  const valToY = useCallback(
    (val: number, panelTop: number) => {
      const areaTop = panelTop + 26;
      const areaBot = panelTop + panelHeight - 8;
      const areaH = areaBot - areaTop;
      return areaBot - (val / maxNegLogP) * areaH;
    },
    [maxNegLogP, panelHeight]
  );

  // ---- MAIN DRAW ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = effectiveWidth * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${effectiveWidth}px`;
    canvas.style.height = `${totalHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, effectiveWidth, totalHeight);

    // Title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      geneData.probeDataset
        ? `${geneData.gene} — Treatment probes at Baseline and Follow-up`
        : `${geneData.gene} — CpG probe nominal P`,
      effectiveWidth / 2,
      24
    );
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(
      `${displayChr} | ${geneData.probes.length} probe records / ${geneData.totalProbes} array probes mapped | Display range: ${Math.round(minPos).toLocaleString()}–${Math.round(maxPos).toLocaleString()} bp`,
      effectiveWidth / 2,
      42
    );

    if (isGrid) {
      // ==========================================
      // 3x2 GRID LAYOUT (MDMA, Ketamine, CPT x Pre, Post)
      // ==========================================

      // ---- Draw Column Headers (Pre vs Post) ----
      const headerY = 52;
      const headerH = 18;

      // Col 0 Header: Pre / Baseline
      ctx.fillStyle = '#f1f5f9';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(leftMargin1 - 2, headerY, colWidth + 4, headerH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Baseline (Pre)', leftMargin1 + colWidth / 2, headerY + 13);

      // Col 1 Header: Post / Follow-Up
      ctx.fillStyle = '#ede9fe';
      ctx.strokeStyle = '#c4b5fd';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(leftMargin2 - 2, headerY, colWidth + 4, headerH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#5b21b6';
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Follow-Up (Post)', leftMargin2 + colWidth / 2, headerY + 13);

      // ---- Draw Panels for 3 Rows x 2 Cols ----
      TREATMENT_GRID_ROWS.forEach((rowConfig, rIdx) => {
        const panelTop = topMargin + rIdx * (panelHeight + panelGap);
        const areaTop = panelTop + 26;
        const areaBot = panelTop + panelHeight - 8;
        const areaH = areaBot - areaTop;

        rowConfig.cols.forEach((colSlot, cIdx) => {
          const colLeft = cIdx === 0 ? leftMargin1 : leftMargin2;

          // Panel background
          ctx.fillStyle = colSlot.bg;
          ctx.fillRect(colLeft - 2, panelTop, colWidth + 4, panelHeight);

          // Panel border
          ctx.strokeStyle = '#d1d5db';
          ctx.lineWidth = 1;
          ctx.strokeRect(colLeft - 2, panelTop, colWidth + 4, panelHeight);

          // Left accent bar
          ctx.fillStyle = colSlot.color;
          ctx.fillRect(colLeft - 2, panelTop, 4, panelHeight);

          // Panel Title
          ctx.fillStyle = colSlot.color;
          ctx.font = 'bold 11px Inter, system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(colSlot.title, colLeft + 8, panelTop + 16);

          // CpG Island shading
          if (geneData.cpgIslands) {
            for (const island of geneData.cpgIslands) {
              const rawX1 = posToX(island.start, cIdx);
              const rawX2 = posToX(island.end, cIdx);
              if (rawX2 >= colLeft && rawX1 <= colLeft + colWidth) {
                const x1 = Math.max(rawX1, colLeft);
                const x2 = Math.min(rawX2, colLeft + colWidth);
                const w = Math.max(x2 - x1, 4);

                ctx.fillStyle = ISLAND_FILL;
                ctx.fillRect(x1, areaTop, w, areaH);
                ctx.strokeStyle = ISLAND_STROKE;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 3]);
                ctx.strokeRect(x1, areaTop, w, areaH);
                ctx.setLineDash([]);

                // Label on top row panels
                if (rIdx === 0) {
                  const centerX = Math.max(colLeft + 35, Math.min(colLeft + colWidth - 35, (x1 + x2) / 2));
                  const badgeW = 64;
                  const badgeH = 13;
                  ctx.fillStyle = 'rgba(254, 243, 199, 0.95)';
                  ctx.strokeStyle = 'rgba(217, 119, 6, 0.8)';
                  ctx.lineWidth = 1;
                  ctx.beginPath();
                  ctx.roundRect(centerX - badgeW / 2, panelTop + 3, badgeW, badgeH, 3);
                  ctx.fill();
                  ctx.stroke();

                  ctx.fillStyle = '#b45309';
                  ctx.font = 'bold 8.5px Inter, system-ui, sans-serif';
                  ctx.textAlign = 'center';
                  ctx.fillText('CpG Island', centerX, panelTop + 12);
                }
              }
            }
          }

          // Y-axis grid lines and ticks
          const tickValues = [0, 1.301, 2, 3, 5, 8, 10, 15, 20, 25, 30].filter((v) => v <= maxNegLogP);
          for (const tick of tickValues) {
            const y = valToY(tick, panelTop);
            if (y < areaTop - 1 || y > areaBot + 1) continue;

            if (tick === 1.301) {
              ctx.strokeStyle = P_05_COLOR;
              ctx.lineWidth = 1.2;
              ctx.setLineDash([6, 4]);
            } else if (tick === 2) {
              ctx.strokeStyle = P_01_COLOR;
              ctx.lineWidth = 1;
              ctx.setLineDash([4, 4]);
            } else if (tick === 3) {
              ctx.strokeStyle = P_001_COLOR;
              ctx.lineWidth = 1.2;
              ctx.setLineDash([2, 3]);
            } else if (tick === 0) {
              ctx.strokeStyle = '#94a3b8';
              ctx.lineWidth = 1;
              ctx.setLineDash([]);
            } else {
              ctx.strokeStyle = '#e2e8f0';
              ctx.lineWidth = 0.6;
              ctx.setLineDash([3, 4]);
            }
            ctx.beginPath();
            ctx.moveTo(colLeft, y);
            ctx.lineTo(colLeft + colWidth, y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Tick text
            ctx.font = '9px Inter, system-ui, sans-serif';
            ctx.textAlign = 'right';
            if (tick === 1.301) {
              ctx.fillStyle = P_05_COLOR;
              ctx.font = 'bold 9px Inter, system-ui, sans-serif';
              ctx.fillText('* P=.05', colLeft - 5, y + 3);
            } else if (tick === 2) {
              ctx.fillStyle = P_01_COLOR;
              ctx.font = 'bold 9px Inter, system-ui, sans-serif';
              ctx.fillText('** P=.01', colLeft - 5, y + 3);
            } else if (tick === 3) {
              ctx.fillStyle = P_001_COLOR;
              ctx.font = 'bold 9px Inter, system-ui, sans-serif';
              ctx.fillText('*** P=.001', colLeft - 5, y + 3);
            } else if (tick > 0) {
              ctx.fillStyle = '#94a3b8';
              ctx.fillText(tick.toFixed(0), colLeft - 5, y + 3);
            }
          }

          // Probe lollipops
          const pKey = `${colSlot.key}_P` as keyof ProbeEntry;
          const lfcKey = `${colSlot.key}_logFC` as keyof ProbeEntry;

          const sortedProbes = [...geneData.probes].sort((a, b) => {
            const pa = (a[pKey] as number | null) ?? 1;
            const pb = (b[pKey] as number | null) ?? 1;
            return pb - pa;
          });
          const drawableProbes = sortedProbes.filter((probe) => isProbability(probe[pKey]));

          if (drawableProbes.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = 'italic 10px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No common probes in the P < 0.01 source export', colLeft + colWidth / 2, areaTop + areaH / 2);
          }

          for (const probe of drawableProbes) {
            const nominalP = probe[pKey];
            const logFC = probe[lfcKey] as number | null;
            if (!isProbability(nominalP)) continue;

            const nlp = probabilityScore(nominalP, maxNegLogP);
            const x = posToX(probe.pos, cIdx);
            const yBase = valToY(0, panelTop);
            const yTop = valToY(Math.min(nlp, maxNegLogP), panelTop);
            const dotColor = logFC == null ? NEUTRAL_COLOR : logFC === 0 ? ZERO_EFFECT_COLOR : logFC > 0 ? HYPER_COLOR : HYPO_COLOR;
            const isSig05 = nominalP < 0.05;
            const isSig01 = nominalP < 0.01;
            const isSig001 = nominalP < 0.001;

            ctx.strokeStyle = dotColor;
            ctx.lineWidth = isSig001 ? 2.2 : isSig05 ? 1.8 : 1.1;
            ctx.globalAlpha = isSig05 ? 0.65 : 0.3;
            ctx.beginPath();
            ctx.moveTo(x, yBase);
            ctx.lineTo(x, yTop);
            ctx.stroke();
            ctx.globalAlpha = 1;

            const radius = isSig001 ? 6 : isSig01 ? 5 : isSig05 ? 3.5 : 2.2;
            ctx.beginPath();
            ctx.arc(x, yTop, radius, 0, Math.PI * 2);
            ctx.fillStyle = dotColor;
            ctx.fill();

            if (isSig05) {
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.2;
              ctx.stroke();
              ctx.strokeStyle = dotColor;
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }

            if (nlp > 3) {
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(x, yTop, 1.8, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        });
      });

      // ---- X-Axis at bottom of grid (under Row 2) ----
      const xAxisY = topMargin + 3 * panelHeight + 2 * panelGap + 20;

      [0, 1].forEach((cIdx) => {
        const colLeft = cIdx === 0 ? leftMargin1 : leftMargin2;
        
        // Draw Feature Annotations above X-Axis
        const featY = xAxisY - 10;
        const featH = 6;
        featureAnnotations.forEach(({ feature, pos }) => {
          const x = Math.max(colLeft, Math.min(posToX(pos, cIdx), colLeft + colWidth));
          ctx.fillStyle = FEATURE_COLORS[feature] || '#94a3b8';
          ctx.globalAlpha = 0.75;
          ctx.fillRect(x - 2, featY, 4, featH);
        });
        ctx.globalAlpha = 1.0;

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(colLeft, xAxisY);
        ctx.lineTo(colLeft + colWidth, xAxisY);
        ctx.stroke();

        const nTicks = Math.min(6, Math.floor(colWidth / 70));
        ctx.font = '9px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        for (let i = 0; i <= nTicks; i++) {
          const pos = minPos + (posRange * i) / nTicks;
          const x = posToX(pos, cIdx);
          ctx.beginPath();
          ctx.moveTo(x, xAxisY);
          ctx.lineTo(x, xAxisY + 5);
          ctx.stroke();
          ctx.fillText(Math.round(pos).toLocaleString(), x, xAxisY + 16);
        }

        ctx.fillStyle = '#334155';
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.fillText('Genomic Position (bp)', colLeft + colWidth / 2, xAxisY + 32);
      });

    } else {
      // ==========================================
      // 1D STACKED LAYOUT (FTC PTSD Subtypes)
      // ==========================================
      SUBTYPES.forEach((sub, idx) => {
        const panelTop = topMargin + idx * (panelHeight + panelGap);
        const areaTop = panelTop + 26;
        const areaBot = panelTop + panelHeight - 8;
        const areaH = areaBot - areaTop;

        ctx.fillStyle = sub.bg;
        ctx.fillRect(leftMargin1 - 2, panelTop, colWidth + 4, panelHeight);

        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 1;
        ctx.strokeRect(leftMargin1 - 2, panelTop, colWidth + 4, panelHeight);

        ctx.fillStyle = sub.color;
        ctx.fillRect(leftMargin1 - 2, panelTop, 4, panelHeight);

        ctx.fillStyle = sub.color;
        ctx.font = 'bold 12px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(sub.label, leftMargin1 + 8, panelTop + 18);

        if (geneData.cpgIslands) {
          for (const island of geneData.cpgIslands) {
            const rawX1 = posToX(island.start, 0);
            const rawX2 = posToX(island.end, 0);
            if (rawX2 >= leftMargin1 && rawX1 <= leftMargin1 + colWidth) {
              const x1 = Math.max(rawX1, leftMargin1);
              const x2 = Math.min(rawX2, leftMargin1 + colWidth);
              const w = Math.max(x2 - x1, 4);

              ctx.fillStyle = ISLAND_FILL;
              ctx.fillRect(x1, areaTop, w, areaH);
              ctx.strokeStyle = ISLAND_STROKE;
              ctx.lineWidth = 1.5;
              ctx.setLineDash([5, 3]);
              ctx.strokeRect(x1, areaTop, w, areaH);
              ctx.setLineDash([]);

              if (idx === 0) {
                const centerX = Math.max(leftMargin1 + 40, Math.min(leftMargin1 + colWidth - 40, (x1 + x2) / 2));
                const badgeW = 68;
                const badgeH = 14;
                ctx.fillStyle = 'rgba(254, 243, 199, 0.95)';
                ctx.strokeStyle = 'rgba(217, 119, 6, 0.8)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(centerX - badgeW / 2, panelTop + 4, badgeW, badgeH, 3);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#b45309';
                ctx.font = 'bold 9px Inter, system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('CpG Island', centerX, panelTop + 14);
              }
            }
          }
        }

        const tickValues = [0, 1.301, 2, 3, 5, 8, 10, 15, 20, 25, 30].filter((v) => v <= maxNegLogP);
        for (const tick of tickValues) {
          const y = valToY(tick, panelTop);
          if (y < areaTop - 1 || y > areaBot + 1) continue;

          if (tick === 1.301) {
            ctx.strokeStyle = P_05_COLOR;
            ctx.lineWidth = 1.2;
            ctx.setLineDash([6, 4]);
          } else if (tick === 2) {
            ctx.strokeStyle = P_01_COLOR;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
          } else if (tick === 3) {
            ctx.strokeStyle = P_001_COLOR;
            ctx.lineWidth = 1.2;
            ctx.setLineDash([2, 3]);
          } else if (tick === 0) {
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1;
            ctx.setLineDash([]);
          } else {
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 0.6;
            ctx.setLineDash([3, 4]);
          }
          ctx.beginPath();
          ctx.moveTo(leftMargin1, y);
          ctx.lineTo(leftMargin1 + colWidth, y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.font = '10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'right';
          if (tick === 1.301) {
            ctx.fillStyle = P_05_COLOR;
            ctx.font = 'bold 10px Inter, system-ui, sans-serif';
            ctx.fillText('* P=.05', leftMargin1 - 10, y + 4);
          } else if (tick === 2) {
            ctx.fillStyle = P_01_COLOR;
            ctx.font = 'bold 10px Inter, system-ui, sans-serif';
            ctx.fillText('** P=.01', leftMargin1 - 10, y + 4);
          } else if (tick === 3) {
            ctx.fillStyle = P_001_COLOR;
            ctx.font = 'bold 10px Inter, system-ui, sans-serif';
            ctx.fillText('*** P=.001', leftMargin1 - 10, y + 4);
          } else if (tick > 0) {
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(tick.toFixed(0), leftMargin1 - 10, y + 4);
          }
        }

        const pKey = `${sub.key}_P` as keyof ProbeEntry;
        const lfcKey = `${sub.key}_logFC` as keyof ProbeEntry;

        const sortedProbes = [...geneData.probes].sort((a, b) => {
          const pa = (a[pKey] as number | null) ?? 1;
          const pb = (b[pKey] as number | null) ?? 1;
          return pb - pa;
        });
        const drawableProbes = sortedProbes.filter((probe) => isProbability(probe[pKey]));

        if (drawableProbes.length === 0) {
          ctx.fillStyle = '#64748b';
          ctx.font = 'italic 11px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('No nominal probe P values available', leftMargin1 + colWidth / 2, areaTop + areaH / 2);
        }

        for (const probe of drawableProbes) {
          const nominalP = probe[pKey];
          const logFC = probe[lfcKey] as number | null;
          if (!isProbability(nominalP)) continue;

          const nlp = probabilityScore(nominalP, maxNegLogP);
          const x = posToX(probe.pos, 0);
          const yBase = valToY(0, panelTop);
          const yTop = valToY(Math.min(nlp, maxNegLogP), panelTop);
          const dotColor = logFC == null ? NEUTRAL_COLOR : logFC === 0 ? ZERO_EFFECT_COLOR : logFC > 0 ? HYPER_COLOR : HYPO_COLOR;
          const isSig05 = nominalP < 0.05;
          const isSig01 = nominalP < 0.01;
          const isSig001 = nominalP < 0.001;

          ctx.strokeStyle = dotColor;
          ctx.lineWidth = isSig001 ? 2.4 : isSig05 ? 2 : 1.2;
          ctx.globalAlpha = isSig05 ? 0.65 : 0.3;
          ctx.beginPath();
          ctx.moveTo(x, yBase);
          ctx.lineTo(x, yTop);
          ctx.stroke();
          ctx.globalAlpha = 1;

          const radius = isSig001 ? 6.5 : isSig01 ? 5.5 : isSig05 ? 4 : 2.5;

          ctx.beginPath();
          ctx.arc(x, yTop, radius, 0, Math.PI * 2);
          ctx.fillStyle = dotColor;
          ctx.fill();

          if (isSig05) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.strokeStyle = dotColor;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }

          if (nlp > 3) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, yTop, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      const xAxisY = topMargin + SUBTYPES.length * (panelHeight + panelGap) - panelGap + 20;
      
      // Draw Feature Annotations above X-Axis
      const featY = xAxisY - 10;
      const featH = 6;
      featureAnnotations.forEach(({ feature, pos }) => {
        const x = Math.max(leftMargin1, Math.min(posToX(pos, 0), leftMargin1 + colWidth));
        ctx.fillStyle = FEATURE_COLORS[feature] || '#94a3b8';
        ctx.globalAlpha = 0.75;
        ctx.fillRect(x - 2, featY, 4, featH);
      });
      ctx.globalAlpha = 1.0;

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(leftMargin1, xAxisY);
      ctx.lineTo(leftMargin1 + colWidth, xAxisY);
      ctx.stroke();

      const nTicks = Math.min(8, Math.floor(colWidth / 80));
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'center';
      for (let i = 0; i <= nTicks; i++) {
        const pos = minPos + (posRange * i) / nTicks;
        const x = posToX(pos, 0);
        ctx.beginPath();
        ctx.moveTo(x, xAxisY);
        ctx.lineTo(x, xAxisY + 6);
        ctx.stroke();
        ctx.fillText(Math.round(pos).toLocaleString(), x, xAxisY + 20);
      }

      ctx.fillStyle = '#334155';
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.fillText('Genomic Position (bp)', effectiveWidth / 2, xAxisY + 38);
    }

    // Shared vertical-axis title
    ctx.save();
    ctx.translate(12, topMargin + (totalHeight - topMargin - bottomMargin) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#475569';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('−log₁₀(nominal probe P)', 0, 0);
    ctx.restore();

    // ---- Legend (at bottom) ----
    const legendXAxisY = isGrid
      ? topMargin + 3 * panelHeight + 2 * panelGap + 20
      : topMargin + SUBTYPES.length * (panelHeight + panelGap) - panelGap + 20;
    
    ctx.font = '11px Inter, system-ui, sans-serif';
    
    // Build legend items
    const legendItems = [
      { type: 'dot', color: HYPER_COLOR, label: 'Higher methylation (Δβ > 0)' },
      { type: 'dot', color: HYPO_COLOR, label: 'Lower methylation (Δβ < 0)' },
      { type: 'dot', color: NEUTRAL_COLOR, label: 'Effect unavailable' },
      { type: 'dot', color: ZERO_EFFECT_COLOR, label: 'Effect exactly 0' },
      { type: 'island', label: 'CpG Island Region' },
      { type: 'dash', color: P_05_COLOR, label: '* P < 0.05' },
      { type: 'dash', color: P_01_COLOR, label: '** P < 0.01' },
      { type: 'dash', color: P_001_COLOR, label: '*** P < 0.001' },
    ];
    
    // Add present feature annotations to legend
    featureLegend.forEach((feature) => {
      legendItems.push({
        type: 'feature',
        color: FEATURE_COLORS[feature] || '#94a3b8',
        label: feature
      });
    });

    // Layout legend with wrapping
    let lx = Math.max(leftMargin1, effectiveWidth / 2 - 380);
    let ly = legendXAxisY + 50;

    for (const item of legendItems) {
      const itemW = ctx.measureText(item.label).width + 36;
      if (lx + itemW > effectiveWidth - rightMargin) {
        lx = Math.max(leftMargin1, effectiveWidth / 2 - 380);
        ly += 22; // Next row
      }

      if (item.type === 'dot') {
        ctx.beginPath();
        ctx.arc(lx + 6, ly, 5, 0, Math.PI * 2);
        ctx.fillStyle = item.color!;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.strokeStyle = item.color!;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      } else if (item.type === 'island') {
        ctx.fillStyle = ISLAND_FILL;
        ctx.fillRect(lx, ly - 6, 18, 12);
        ctx.strokeStyle = ISLAND_STROKE;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(lx, ly - 6, 18, 12);
        ctx.setLineDash([]);
      } else if (item.type === 'dash') {
        ctx.strokeStyle = item.color!;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 18, ly);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (item.type === 'feature') {
        ctx.fillStyle = item.color!;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.roundRect(lx, ly - 4, 16, 8, 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
      
      ctx.fillStyle = '#334155';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, lx + (item.type === 'feature' ? 22 : 24), ly + 4);
      lx += (item.type === 'feature' ? 22 : 24) + ctx.measureText(item.label).width + 20;
    }

    // ---- EPIC Coverage Disclaimer ----
    ctx.font = 'italic 9px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Nominal P thresholds are uncorrected; −log₁₀(P) is capped at 8.',
      effectiveWidth / 2,
      ly + 22
    );
  }, [
    geneData,
    dimensions,
    minPos,
    maxPos,
    posRange,
    maxNegLogP,
    posToX,
    valToY,
    SUBTYPES,
    effectiveWidth,
    totalHeight,
    isGrid,
    colWidth,
    leftMargin1,
    leftMargin2,
    panelHeight,
    panelGap,
    topMargin,
    featureAnnotations,
    featureLegend,
    displayChr,
    bottomMargin,
  ]);

  // ---- Tooltip on hover ----
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      let found: TooltipData | null = null;
      const hitRadius = 10;

      if (isGrid) {
        // Grid mode: determine column and row
        let cIdx = -1;
        if (mx >= leftMargin1 - 10 && mx <= leftMargin1 + colWidth + 10) cIdx = 0;
        else if (mx >= leftMargin2 - 10 && mx <= leftMargin2 + colWidth + 10) cIdx = 1;

        if (cIdx >= 0) {
          TREATMENT_GRID_ROWS.forEach((rConfig, rIdx) => {
            if (found) return;
            const panelTop = topMargin + rIdx * (panelHeight + panelGap);
            if (my < panelTop - 5 || my > panelTop + panelHeight + 5) return;

            const slot = rConfig.cols[cIdx];
            const pKey = `${slot.key}_P` as keyof ProbeEntry;

            for (const probe of geneData.probes) {
              const nominalP = probe[pKey];
              if (!isProbability(nominalP)) continue;
              const nlp = probabilityScore(nominalP, maxNegLogP);
              const x = posToX(probe.pos, cIdx);
              const y = valToY(Math.min(nlp, maxNegLogP), panelTop);
              const dist = Math.sqrt((mx - x) ** 2 + (my - y) ** 2);
              if (dist < hitRadius) {
                found = { x: mx, y: my, probe, subtype: slot.key };
                break;
              }
            }
          });
        }
      } else {
        // 1D stacked mode
        for (let idx = 0; idx < SUBTYPES.length; idx++) {
          const sub = SUBTYPES[idx];
          const panelTop = topMargin + idx * (panelHeight + panelGap);
          const pKey = `${sub.key}_P` as keyof ProbeEntry;

          for (const probe of geneData.probes) {
            const nominalP = probe[pKey];
            if (!isProbability(nominalP)) continue;
            const nlp = probabilityScore(nominalP, maxNegLogP);
            const x = posToX(probe.pos, 0);
            const y = valToY(Math.min(nlp, maxNegLogP), panelTop);
            const dist = Math.sqrt((mx - x) ** 2 + (my - y) ** 2);
            if (dist < hitRadius) {
              found = { x: mx, y: my, probe, subtype: sub.key };
              break;
            }
          }
          if (found) break;
        }
      }
      setTooltip(found);
    },
    [
      isGrid,
      leftMargin1,
      leftMargin2,
      colWidth,
      topMargin,
      panelHeight,
      panelGap,
      geneData,
      posToX,
      valToY,
      maxNegLogP,
      SUBTYPES,
    ]
  );

  return (
    <div ref={containerRef} className="relative w-full overflow-x-auto">
      {geneData.probeDataset && (
        <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-950">
          <strong>Six matched study/timepoint panels.</strong>{' '}
          Each panel compares responders with non-responders at Baseline or Follow-up. The supplied DMP files are filtered to nominal P &lt; 0.01, and the figure restricts them to probes shared across the three studies so genomic positions are directly comparable. It does not test within-person change from Baseline to Follow-up.
        </div>
      )}
      {accessibleRows.length === 0 && <p role="status" className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">No probe-level statistics are available for this gene in the configured comparisons. No value has been imputed.</p>}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: totalHeight }}
        className="rounded-lg cursor-crosshair border border-slate-200 shadow-sm"
        role="img"
        aria-label={`${geneData.gene} ${geneData.probeDataset ? 'Baseline and Follow-up treatment probe' : 'probe'} track on ${displayChr}. Vertical axis is negative log10 uncorrected probe-level P value, with thresholds at P less than 0.05, 0.01, and 0.001; point color gives methylation-effect direction. Exact values are available in the table following the chart.`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />

      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none bg-white border border-slate-300 rounded-xl p-3.5 shadow-xl text-xs space-y-1.5 max-w-[300px]"
          style={{
            left: Math.max(8, Math.min(tooltip.x + 14, dimensions.width - 310)),
            top: Math.max(tooltip.y - 60, 0),
          }}
        >
          <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-slate-100">
            <span className="font-extrabold text-slate-900 text-sm tracking-tight">{tooltip.probe.probe}</span>
            <span
              className="px-2 py-0.5 text-[10px] font-bold rounded-full"
              style={{
                backgroundColor:
                  (SUBTYPE_CONFIG[tooltip.subtype]?.color || '#64748b') + '18',
                color: SUBTYPE_CONFIG[tooltip.subtype]?.color || '#64748b',
              }}
            >
              {SUBTYPE_CONFIG[tooltip.subtype]?.label || tooltip.subtype}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <div>
              <span className="text-slate-400">Position</span>
              <div className="font-mono font-bold text-slate-800">{tooltip.probe.pos.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-slate-400">Feature</span>
              <div className="font-semibold text-slate-700">{tooltip.probe.feature || 'Intergenic'}</div>
            </div>
          </div>
          {tooltip.probe.cpgIsland && (
            <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200 font-medium">
              CpG Island: {tooltip.probe.cpgIsland}
            </div>
          )}
          <div className="border-t border-slate-100 pt-1.5 grid grid-cols-2 gap-x-3 text-[11px]">
            <div>
              <span className="text-slate-400 block mb-0.5">Δβ</span>
              <div className="font-mono font-bold">
                {(() => {
                  const v = tooltip.probe[`${tooltip.subtype}_logFC` as keyof ProbeEntry] as number | null;
                  if (v == null) return <span className="text-slate-300">—</span>;
                  return (
                    <span className={v > 0 ? 'text-red-600' : 'text-blue-600'}>
                      {v > 0 ? '+' : ''}{v.toFixed(4)}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Nominal P</span>
              <div className="font-mono font-bold text-slate-900">
                {(() => {
                  const v = tooltip.probe[`${tooltip.subtype}_P` as keyof ProbeEntry] as number | null;
                  return formatProbability(v);
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
      <details className="mt-3 min-w-full rounded-lg border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">Accessible probe-statistics table ({accessibleRows.length.toLocaleString()} available probe–comparison records)</summary>
        <div className="max-h-96 overflow-auto border-t border-slate-200">
          <table className="w-full whitespace-nowrap text-left text-xs">
            <caption className="sr-only">Available probe statistics for {geneData.gene} on {displayChr}</caption>
            <thead className="sticky top-0 bg-slate-100 text-slate-600"><tr><th className="px-3 py-2">Probe</th><th className="px-3 py-2">Position (bp)</th><th className="px-3 py-2">Feature</th><th className="px-3 py-2">Comparison</th><th className="px-3 py-2">Δβ</th><th className="px-3 py-2">Nominal P</th><th className="px-3 py-2">Threshold tier</th></tr></thead>
            <tbody>{accessibleRows.map((row) => <tr key={`${row.probe}-${row.comparison}`} className="border-t border-slate-200"><td className="px-3 py-2 font-mono font-semibold">{row.probe}</td><td className="px-3 py-2 font-mono">{row.pos.toLocaleString()}</td><td className="px-3 py-2">{row.feature}</td><td className="px-3 py-2">{row.comparison}</td><td className="px-3 py-2 font-mono">{row.deltaBeta == null ? 'Unavailable' : `${row.deltaBeta > 0 ? '+' : ''}${row.deltaBeta.toFixed(4)}`}</td><td className="px-3 py-2 font-mono">{formatProbability(row.nominalP)}</td><td className="px-3 py-2">{row.nominalP == null ? 'Unavailable' : row.nominalP < 0.001 ? '*** P < 0.001' : row.nominalP < 0.01 ? '** P < 0.01' : row.nominalP < 0.05 ? '* P < 0.05' : 'P ≥ 0.05'}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{geneData.probeDataset ? 'The Treatment source exports include only probes with uncorrected P < 0.01; no additional significance filter is applied by this figure.' : 'The probe figure uses uncorrected P values.'} Thresholds at P &lt; 0.05, P &lt; 0.01, and P &lt; 0.001 are descriptive and do not control the high-throughput multiple-testing error rate. Interpret them with Δβ and independent validation. Missing statistics are not converted to zero or “not significant”; confidence intervals and standard errors are not present in the probe dataset.</p>
      {isPtsdSubtypeFigure && <p className="mt-1 text-[10px] font-medium text-slate-600">Subtype and control-group definitions were not supplied with these result files. Confirm SSS, ADS, ICF, and ISS definitions against the study protocol before interpretation.</p>}
      {hasClippedP && <p className="mt-1 text-[10px] font-medium text-slate-600">Nominal P values below 1×10⁻⁸ are plotted at the fixed upper boundary (−log₁₀P = 8) so the three reference thresholds remain legible. Exact P values remain available in the tooltip and table.</p>}
      {hasZeroP && <p className="mt-1 text-[10px] font-medium text-amber-800">One or more stored nominal P values equal numeric zero (underflow/rounding). They are reported as zero in the table and plotted at the upper display boundary, not interpreted as literally zero probability.</p>}
    </div>
  );
};
