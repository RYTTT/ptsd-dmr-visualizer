'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { GeneProbeData, ProbeEntry } from '../types/probe';

interface GenomicTrackProps {
  geneData: GeneProbeData;
}

const SUBTYPES = [
  { key: 'SSS', label: 'SSS — Severe Stress Subtype', color: '#b91c1c', bg: '#fef2f2' },
  { key: 'ADS', label: 'ADS — Affective/Depressive Subtype', color: '#1d4ed8', bg: '#eff6ff' },
  { key: 'ICF', label: 'ICF — Cognitive Function Subtype', color: '#6d28d9', bg: '#f5f3ff' },
  { key: 'ISS', label: 'ISS — Intermediate Stress Subtype', color: '#047857', bg: '#ecfdf5' },
] as const;

const HYPER_COLOR = '#dc2626';
const HYPO_COLOR = '#2563eb';
const ISLAND_FILL = 'rgba(253, 224, 71, 0.18)';
const ISLAND_STROKE = 'rgba(161, 98, 7, 0.55)';

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

  // ---- ENLARGED DIMENSIONS ----
  const panelHeight = 180;
  const topMargin = 50;
  const bottomMargin = 75;
  const leftMargin = 80;
  const rightMargin = 24;
  const panelGap = 20;
  const totalHeight = topMargin + SUBTYPES.length * (panelHeight + panelGap) - panelGap + bottomMargin;

  const { minPos, maxPos, posRange } = useMemo(() => {
    const positions = geneData.probes.map((p) => p.pos);
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
  }, [geneData]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: totalHeight });
      }
    });
    observer.observe(container);
    setDimensions({ width: container.clientWidth, height: totalHeight });
    return () => observer.disconnect();
  }, [totalHeight]);

  const plotWidth = dimensions.width - leftMargin - rightMargin;

  const posToX = useCallback(
    (pos: number) => leftMargin + ((pos - minPos) / posRange) * plotWidth,
    [minPos, posRange, plotWidth]
  );

  const valToY = useCallback(
    (val: number, panelTop: number) => {
      const areaTop = panelTop + 28;
      const areaBot = panelTop + panelHeight - 8;
      const areaH = areaBot - areaTop;
      return areaBot - (val / maxNegLogP) * areaH;
    },
    [maxNegLogP]
  );

  // ---- MAIN DRAW ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${totalHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dimensions.width, totalHeight);

    // Title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${geneData.gene} — CpG Probe-Level Methylation Significance`,
      dimensions.width / 2,
      24
    );
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(
      `Chr ${geneData.chr} | ${geneData.totalProbes} CpG Probes | Range: ${minPos.toLocaleString()} – ${maxPos.toLocaleString()} bp`,
      dimensions.width / 2,
      42
    );

    // ---- Draw each subtype panel ----
    SUBTYPES.forEach((sub, idx) => {
      const panelTop = topMargin + idx * (panelHeight + panelGap);
      const areaTop = panelTop + 28;
      const areaBot = panelTop + panelHeight - 8;
      const areaH = areaBot - areaTop;

      // Panel background with subtle tint
      ctx.fillStyle = sub.bg;
      ctx.fillRect(leftMargin - 2, panelTop, plotWidth + 4, panelHeight);

      // Panel border
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.strokeRect(leftMargin - 2, panelTop, plotWidth + 4, panelHeight);

      // Colored left accent bar
      ctx.fillStyle = sub.color;
      ctx.fillRect(leftMargin - 2, panelTop, 4, panelHeight);

      // Subtype label
      ctx.fillStyle = sub.color;
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(sub.label, leftMargin + 8, panelTop + 18);

      // ---- CpG Island shading ----
      for (const island of geneData.cpgIslands) {
        const x1 = Math.max(posToX(island.start), leftMargin);
        const x2 = Math.min(posToX(island.end), leftMargin + plotWidth);
        if (x2 > x1) {
          ctx.fillStyle = ISLAND_FILL;
          ctx.fillRect(x1, areaTop, x2 - x1, areaH);
          ctx.strokeStyle = ISLAND_STROKE;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(x1, areaTop, x2 - x1, areaH);
          ctx.setLineDash([]);

          // Label on first panel only
          if (idx === 0) {
            ctx.fillStyle = '#92400e';
            ctx.font = 'bold 10px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('CpG Island', (x1 + x2) / 2, areaTop - 4);
          }
        }
      }

      // ---- Y-axis grid and tick labels ----
      const tickValues = [0, 1.301, 2, 3, 5, 8, 10, 15, 20, 25, 30].filter((v) => v <= maxNegLogP);
      for (const tick of tickValues) {
        const y = valToY(tick, panelTop);
        if (y < areaTop - 1 || y > areaBot + 1) continue;

        // Grid line
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
        ctx.moveTo(leftMargin, y);
        ctx.lineTo(leftMargin + plotWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Tick label
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        if (tick === 1.301) {
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 10px Inter, system-ui, sans-serif';
          ctx.fillText('p=.05', leftMargin - 10, y + 4);
        } else if (tick === 2) {
          ctx.fillStyle = '#b91c1c';
          ctx.font = 'bold 10px Inter, system-ui, sans-serif';
          ctx.fillText('p=.01', leftMargin - 10, y + 4);
        } else if (tick > 0) {
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(tick.toFixed(0), leftMargin - 10, y + 4);
        }
      }

      // ---- Lollipop stems and heads ----
      const pKey = `${sub.key}_P` as keyof ProbeEntry;
      const lfcKey = `${sub.key}_logFC` as keyof ProbeEntry;

      // Sort by significance so the most significant probes render on top
      const sortedProbes = [...geneData.probes].sort((a, b) => {
        const pa = (a[pKey] as number | null) ?? 1;
        const pb = (b[pKey] as number | null) ?? 1;
        return pb - pa; // least significant first, most significant on top
      });

      for (const probe of sortedProbes) {
        const pVal = probe[pKey] as number | null;
        const logFC = probe[lfcKey] as number | null;
        if (!pVal || pVal <= 0) continue;

        const nlp = -Math.log10(pVal);
        const x = posToX(probe.pos);
        const yBase = valToY(0, panelTop);
        const yTop = valToY(Math.min(nlp, maxNegLogP), panelTop);
        const isHyper = logFC && logFC > 0;
        const dotColor = isHyper ? HYPER_COLOR : HYPO_COLOR;
        const isSig05 = nlp > 1.301;
        const isSig01 = nlp > 2;

        // Stem — thicker and more visible
        ctx.strokeStyle = dotColor;
        ctx.lineWidth = isSig05 ? 2 : 1.2;
        ctx.globalAlpha = isSig05 ? 0.65 : 0.3;
        ctx.beginPath();
        ctx.moveTo(x, yBase);
        ctx.lineTo(x, yTop);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Head — larger dots
        let radius: number;
        if (isSig01) {
          radius = 5.5;
        } else if (isSig05) {
          radius = 4;
        } else {
          radius = 2.5;
        }

        ctx.beginPath();
        ctx.arc(x, yTop, radius, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();

        // White border on significant probes
        if (isSig05) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // Dark outline
          ctx.strokeStyle = dotColor;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        // Diamond marker for p < 0.001
        if (nlp > 3) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x, yTop, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // ---- X-axis ----
    const xAxisY = topMargin + SUBTYPES.length * (panelHeight + panelGap) - panelGap + 14;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(leftMargin, xAxisY);
    ctx.lineTo(leftMargin + plotWidth, xAxisY);
    ctx.stroke();

    // X-axis ticks
    const nTicks = Math.min(8, Math.floor(plotWidth / 80));
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    for (let i = 0; i <= nTicks; i++) {
      const pos = minPos + (posRange * i) / nTicks;
      const x = posToX(pos);
      ctx.beginPath();
      ctx.moveTo(x, xAxisY);
      ctx.lineTo(x, xAxisY + 6);
      ctx.stroke();
      ctx.fillText(Math.round(pos).toLocaleString(), x, xAxisY + 20);
    }

    // X-axis label
    ctx.fillStyle = '#334155';
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillText('Genomic Position (bp)', dimensions.width / 2, xAxisY + 38);

    // Y-axis label (rotated)
    ctx.save();
    ctx.translate(18, topMargin + (SUBTYPES.length * (panelHeight + panelGap)) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#334155';
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('−log₁₀(P-value)', 0, 0);
    ctx.restore();

    // ---- Legend (at bottom) ----
    const legendY = xAxisY + 55;
    ctx.font = '11px Inter, system-ui, sans-serif';

    const legendItems = [
      { type: 'dot', color: HYPER_COLOR, label: 'Hypermethylated (logFC > 0)' },
      { type: 'dot', color: HYPO_COLOR, label: 'Hypomethylated (logFC < 0)' },
      { type: 'island', label: 'CpG Island Region' },
      { type: 'dash', color: '#ef4444', label: 'p = 0.05' },
      { type: 'dash', color: '#b91c1c', label: 'p = 0.01' },
    ];

    let lx = dimensions.width / 2 - 320;
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
  }, [geneData, dimensions, minPos, maxPos, posRange, maxNegLogP, posToX, valToY]);

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

      for (let idx = 0; idx < SUBTYPES.length; idx++) {
        const sub = SUBTYPES[idx];
        const panelTop = topMargin + idx * (panelHeight + panelGap);
        const pKey = `${sub.key}_P` as keyof ProbeEntry;

        for (const probe of geneData.probes) {
          const pVal = probe[pKey] as number | null;
          if (!pVal || pVal <= 0) continue;
          const nlp = -Math.log10(pVal);
          const x = posToX(probe.pos);
          const y = valToY(Math.min(nlp, maxNegLogP), panelTop);
          const dist = Math.sqrt((mx - x) ** 2 + (my - y) ** 2);
          if (dist < hitRadius) {
            found = { x: mx, y: my, probe, subtype: sub.key };
            break;
          }
        }
        if (found) break;
      }
      setTooltip(found);
    },
    [geneData, posToX, valToY, maxNegLogP]
  );

  return (
    <div ref={containerRef} className="relative w-full">
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
                  SUBTYPES.find((s) => s.key === tooltip.subtype)?.color + '18',
                color: SUBTYPES.find((s) => s.key === tooltip.subtype)?.color,
              }}
            >
              {tooltip.subtype}
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
