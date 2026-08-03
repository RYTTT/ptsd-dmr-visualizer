'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { GeneProbeData, ProbeEntry } from '../types/probe';

interface GenomicTrackProps {
  geneData: GeneProbeData;
}

const SUBTYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SSS: { label: 'SSS — Severe Stress Subtype', color: '#b91c1c', bg: '#fef2f2' },
  ADS: { label: 'ADS — Affective/Depressive Subtype', color: '#1d4ed8', bg: '#eff6ff' },
  ICF: { label: 'ICF — Cognitive Function Subtype', color: '#6d28d9', bg: '#f5f3ff' },
  ISS: { label: 'ISS — Intermediate Stress Subtype', color: '#047857', bg: '#ecfdf5' },
  MDMA: { label: 'MDMA-AT — Responder vs HC', color: '#7c3aed', bg: '#f5f3ff' },
  Ketamine: { label: 'Ketamine — Resp vs NonResp', color: '#0891b2', bg: '#ecfeff' },
  CPT: { label: 'CPT — Resp vs NonResp', color: '#059669', bg: '#ecfdf5' },
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
      { key: 'MDMA_FUP', title: 'MDMA — Follow-Up (Post)', color: '#7c3aed', bg: '#ede9fe' },
    ],
  },
  {
    cohort: 'Ketamine',
    label: 'Ketamine',
    cols: [
      { key: 'Ketamine_Pre', title: 'Ketamine — Baseline (Pre)', color: '#0891b2', bg: '#ecfeff' },
      { key: 'Ketamine_FUP', title: 'Ketamine — Follow-Up (Post)', color: '#0891b2', bg: '#cffafe' },
    ],
  },
  {
    cohort: 'CPT',
    label: 'CPT',
    cols: [
      { key: 'CPT_Pre', title: 'CPT — Baseline (Pre)', color: '#059669', bg: '#ecfdf5' },
      { key: 'CPT_FUP', title: 'CPT — Follow-Up (Post)', color: '#059669', bg: '#d1fae5' },
    ],
  },
];

const HYPER_COLOR = '#dc2626';
const HYPO_COLOR = '#2563eb';
const ISLAND_FILL = 'rgba(245, 158, 11, 0.28)';
const ISLAND_STROKE = 'rgba(180, 83, 9, 0.75)';

interface TooltipData {
  x: number;
  y: number;
  probe: ProbeEntry;
  subtype: string;
}

export const GenomicTrackPlot: React.FC<GenomicTrackProps> = ({ geneData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 0 });

  // ---- Auto-detect subtypes from probe data ----
  const SUBTYPES = useMemo(() => {
    if (!geneData.probes.length) return [];
    const firstProbe = geneData.probes[0];
    const keys = Object.keys(firstProbe);
    const detected = new Set<string>();
    for (const k of keys) {
      const m = k.match(/^(.+)_P$/);
      if (m && m[1] !== 'adj') detected.add(m[1]);
    }
    const order = ['SSS', 'ADS', 'ICF', 'ISS', 'MDMA_Pre', 'MDMA_FUP', 'Ketamine_Pre', 'Ketamine_FUP', 'CPT_Pre', 'CPT_FUP', 'MDMA', 'Ketamine', 'CPT'];
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

  // ---- DIMENSIONS ----
  const panelHeight = 175;
  const topMargin = isGrid ? 74 : 50;
  const bottomMargin = 80;
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

  const maxNegLogP = useMemo(() => {
    let maxVal = 2;
    for (const probe of geneData.probes) {
      for (const sub of SUBTYPES) {
        const pKey = `${sub.key}_P` as keyof ProbeEntry;
        const pVal = probe[pKey] as number | null;
        if (pVal && pVal > 0) {
          const nlp = -Math.log10(pVal);
          if (nlp > maxVal) maxVal = nlp;
        }
      }
    }
    return Math.min(Math.ceil(maxVal * 1.15), 32);
  }, [geneData, SUBTYPES]);

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

  const effectiveWidth = Math.max(dimensions.width, isGrid ? 850 : 700);

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
      `${geneData.gene} — CpG Probe-Level Methylation Significance`,
      effectiveWidth / 2,
      24
    );
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(
      `Chr ${geneData.chr} | ${geneData.totalProbes} CpG Probes | Range: ${minPos.toLocaleString()} – ${maxPos.toLocaleString()} bp`,
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
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(leftMargin1 - 2, headerY, colWidth + 4, headerH, 4);
      } else {
        ctx.rect(leftMargin1 - 2, headerY, colWidth + 4, headerH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Baseline (Pre-Treatment)', leftMargin1 + colWidth / 2, headerY + 13);

      // Col 1 Header: Post / Follow-Up
      ctx.fillStyle = '#ede9fe';
      ctx.strokeStyle = '#c4b5fd';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(leftMargin2 - 2, headerY, colWidth + 4, headerH, 4);
      } else {
        ctx.rect(leftMargin2 - 2, headerY, colWidth + 4, headerH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#5b21b6';
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Follow-Up (Post-Treatment)', leftMargin2 + colWidth / 2, headerY + 13);

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
                  if (typeof (ctx as any).roundRect === 'function') {
                    (ctx as any).roundRect(centerX - badgeW / 2, panelTop + 3, badgeW, badgeH, 3);
                  } else {
                    ctx.rect(centerX - badgeW / 2, panelTop + 3, badgeW, badgeH);
                  }
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
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 1.2;
              ctx.setLineDash([6, 4]);
            } else if (tick === 2) {
              ctx.strokeStyle = '#b91c1c';
              ctx.lineWidth = 1;
              ctx.setLineDash([4, 4]);
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
              ctx.fillStyle = '#ef4444';
              ctx.font = 'bold 9px Inter, system-ui, sans-serif';
              ctx.fillText('p=.05', colLeft - 5, y + 3);
            } else if (tick === 2) {
              ctx.fillStyle = '#b91c1c';
              ctx.font = 'bold 9px Inter, system-ui, sans-serif';
              ctx.fillText('p=.01', colLeft - 5, y + 3);
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

          for (const probe of sortedProbes) {
            const pVal = probe[pKey] as number | null;
            const logFC = probe[lfcKey] as number | null;
            if (!pVal || pVal <= 0) continue;

            const nlp = -Math.log10(pVal);
            const x = posToX(probe.pos, cIdx);
            const yBase = valToY(0, panelTop);
            const yTop = valToY(Math.min(nlp, maxNegLogP), panelTop);
            const isHyper = logFC && logFC > 0;
            const dotColor = isHyper ? HYPER_COLOR : HYPO_COLOR;
            const isSig05 = nlp > 1.301;
            const isSig01 = nlp > 2;

            ctx.strokeStyle = dotColor;
            ctx.lineWidth = isSig05 ? 1.8 : 1.1;
            ctx.globalAlpha = isSig05 ? 0.65 : 0.3;
            ctx.beginPath();
            ctx.moveTo(x, yBase);
            ctx.lineTo(x, yTop);
            ctx.stroke();
            ctx.globalAlpha = 1;

            let radius = isSig01 ? 5 : isSig05 ? 3.5 : 2.2;
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
      const xAxisY = topMargin + 3 * panelHeight + 2 * panelGap + 12;

      [0, 1].forEach((cIdx) => {
        const colLeft = cIdx === 0 ? leftMargin1 : leftMargin2;
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
                if (typeof (ctx as any).roundRect === 'function') {
                  (ctx as any).roundRect(centerX - badgeW / 2, panelTop + 4, badgeW, badgeH, 3);
                } else {
                  ctx.rect(centerX - badgeW / 2, panelTop + 4, badgeW, badgeH);
                }
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
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([6, 4]);
          } else if (tick === 2) {
            ctx.strokeStyle = '#b91c1c';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
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
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 10px Inter, system-ui, sans-serif';
            ctx.fillText('p=.05', leftMargin1 - 10, y + 4);
          } else if (tick === 2) {
            ctx.fillStyle = '#b91c1c';
            ctx.font = 'bold 10px Inter, system-ui, sans-serif';
            ctx.fillText('p=.01', leftMargin1 - 10, y + 4);
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

        for (const probe of sortedProbes) {
          const pVal = probe[pKey] as number | null;
          const logFC = probe[lfcKey] as number | null;
          if (!pVal || pVal <= 0) continue;

          const nlp = -Math.log10(pVal);
          const x = posToX(probe.pos, 0);
          const yBase = valToY(0, panelTop);
          const yTop = valToY(Math.min(nlp, maxNegLogP), panelTop);
          const isHyper = logFC && logFC > 0;
          const dotColor = isHyper ? HYPER_COLOR : HYPO_COLOR;
          const isSig05 = nlp > 1.301;
          const isSig01 = nlp > 2;

          ctx.strokeStyle = dotColor;
          ctx.lineWidth = isSig05 ? 2 : 1.2;
          ctx.globalAlpha = isSig05 ? 0.65 : 0.3;
          ctx.beginPath();
          ctx.moveTo(x, yBase);
          ctx.lineTo(x, yTop);
          ctx.stroke();
          ctx.globalAlpha = 1;

          let radius = isSig01 ? 5.5 : isSig05 ? 4 : 2.5;

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

      const xAxisY = topMargin + SUBTYPES.length * (panelHeight + panelGap) - panelGap + 14;
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

    // ---- Legend (at bottom) ----
    const xAxisY = isGrid
      ? topMargin + 3 * panelHeight + 2 * panelGap + 12
      : topMargin + SUBTYPES.length * (panelHeight + panelGap) - panelGap + 14;
    const legendY = xAxisY + (isGrid ? 54 : 55);

    ctx.font = '11px Inter, system-ui, sans-serif';
    const legendItems = [
      { type: 'dot', color: HYPER_COLOR, label: 'Hypermethylated (logFC > 0)' },
      { type: 'dot', color: HYPO_COLOR, label: 'Hypomethylated (logFC < 0)' },
      { type: 'island', label: 'CpG Island Region' },
      { type: 'dash', color: '#ef4444', label: 'p = 0.05' },
      { type: 'dash', color: '#b91c1c', label: 'p = 0.01' },
    ];

    let lx = effectiveWidth / 2 - 320;
    for (const item of legendItems) {
      if (item.type === 'dot') {
        ctx.beginPath();
        ctx.arc(lx + 6, legendY, 5, 0, Math.PI * 2);
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
        ctx.fillRect(lx, legendY - 6, 18, 12);
        ctx.strokeStyle = ISLAND_STROKE;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(lx, legendY - 6, 18, 12);
        ctx.setLineDash([]);
      } else if (item.type === 'dash') {
        ctx.strokeStyle = item.color!;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(lx, legendY);
        ctx.lineTo(lx + 18, legendY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = '#334155';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, lx + 24, legendY + 4);
      lx += ctx.measureText(item.label).width + 46;
    }
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
              const pVal = probe[pKey] as number | null;
              if (!pVal || pVal <= 0) continue;
              const nlp = -Math.log10(pVal);
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
            const pVal = probe[pKey] as number | null;
            if (!pVal || pVal <= 0) continue;
            const nlp = -Math.log10(pVal);
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
    <div ref={containerRef} className="relative w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: totalHeight }}
        className="rounded-lg cursor-crosshair border border-slate-200 shadow-sm"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />

      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none bg-white border border-slate-300 rounded-xl p-3.5 shadow-xl text-xs space-y-1.5 max-w-[300px]"
          style={{
            left: Math.min(tooltip.x + 14, dimensions.width - 310),
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
          <div className="border-t border-slate-100 pt-1.5 grid grid-cols-3 gap-x-3 text-[11px]">
            <div>
              <span className="text-slate-400 block mb-0.5">logFC</span>
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
              <span className="text-slate-400 block mb-0.5">P-value</span>
              <div className="font-mono font-bold text-slate-900">
                {(() => {
                  const v = tooltip.probe[`${tooltip.subtype}_P` as keyof ProbeEntry] as number | null;
                  return v != null ? (v < 1e-10 ? v.toExponential(1) : v.toExponential(2)) : '—';
                })()}
              </div>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">FDR</span>
              <div className="font-mono font-bold text-slate-900">
                {(() => {
                  const v = tooltip.probe[`${tooltip.subtype}_FDR` as keyof ProbeEntry] as number | null;
                  return v != null ? (v < 1e-10 ? v.toExponential(1) : v.toExponential(2)) : '—';
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
