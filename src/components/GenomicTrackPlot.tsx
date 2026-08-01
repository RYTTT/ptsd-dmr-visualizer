'use client';

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { GeneProbeData, ProbeEntry } from '../types/probe';

interface GenomicTrackProps {
  geneData: GeneProbeData;
}

const SUBTYPES = [
  { key: 'SSS', label: 'SSS (Severe Stress)', color: '#dc2626' },
  { key: 'ADS', label: 'ADS (Depressive)', color: '#2563eb' },
  { key: 'ICF', label: 'ICF (Cognitive)', color: '#7c3aed' },
  { key: 'ISS', label: 'ISS (Intermediate)', color: '#059669' },
] as const;

const HYPER_COLOR = '#dc2626';
const HYPO_COLOR = '#2563eb';
const ISLAND_COLOR = 'rgba(250, 204, 21, 0.22)';
const ISLAND_BORDER = 'rgba(202, 138, 4, 0.6)';

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

  const panelHeight = 130;
  const topMargin = 60;
  const bottomMargin = 65;
  const leftMargin = 72;
  const rightMargin = 30;
  const panelGap = 14;
  const totalHeight = topMargin + SUBTYPES.length * (panelHeight + panelGap) - panelGap + bottomMargin;

  const { minPos, maxPos, posRange } = useMemo(() => {
    const positions = geneData.probes.map((p) => p.pos);
    const min = Math.min(...positions);
    const max = Math.max(...positions);
    const pad = Math.max((max - min) * 0.05, 100);
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
    return Math.min(maxVal * 1.15, 30);
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
      const plotAreaHeight = panelHeight - 30;
      return panelTop + 20 + plotAreaHeight - (val / maxNegLogP) * plotAreaHeight;
    },
    [maxNegLogP]
  );

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
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 15px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${geneData.gene} — Probe-Level Methylation Significance Across PTSD Subtypes`,
      dimensions.width / 2,
      22
    );
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(
      `${geneData.chr} | ${geneData.totalProbes} CpG Probes | Genomic Position ${minPos.toLocaleString()}–${maxPos.toLocaleString()}`,
      dimensions.width / 2,
      40
    );

    SUBTYPES.forEach((sub, idx) => {
      const panelTop = topMargin + idx * (panelHeight + panelGap);
      const plotAreaTop = panelTop + 20;
      const plotAreaBottom = panelTop + panelHeight - 10;
      const plotAreaHeight = plotAreaBottom - plotAreaTop;

      // Panel background — very faint gray
      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(leftMargin - 5, panelTop, plotWidth + 10, panelHeight);
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(leftMargin - 5, panelTop, plotWidth + 10, panelHeight);

      // Subtype label strip
      ctx.fillStyle = sub.color;
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(sub.label, leftMargin, panelTop + 14);

      // CpG Island shading
      for (const island of geneData.cpgIslands) {
        const x1 = posToX(island.start);
        const x2 = posToX(island.end);
        const clippedX1 = Math.max(x1, leftMargin);
        const clippedX2 = Math.min(x2, leftMargin + plotWidth);
        if (clippedX2 > clippedX1) {
          ctx.fillStyle = ISLAND_COLOR;
          ctx.fillRect(clippedX1, plotAreaTop, clippedX2 - clippedX1, plotAreaHeight);
          ctx.strokeStyle = ISLAND_BORDER;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(clippedX1, plotAreaTop, clippedX2 - clippedX1, plotAreaHeight);
          ctx.setLineDash([]);

          if (idx === 0) {
            ctx.fillStyle = '#a16207';
            ctx.font = 'bold 9px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('CpG Island', (clippedX1 + clippedX2) / 2, plotAreaTop - 3);
          }
        }
      }

      // Y-axis gridlines
      const yTicks = [0, 1.301, 2, 3, 5, 10, 15, 20, 25].filter((v) => v <= maxNegLogP);
      ctx.font = '9px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      for (const tick of yTicks) {
        const y = valToY(tick, panelTop);
        if (y >= plotAreaTop && y <= plotAreaBottom) {
          if (tick === 1.301) {
            // p = 0.05 line
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 3]);
          } else if (tick === 2) {
            // p = 0.01 line
            ctx.strokeStyle = '#991b1b';
            ctx.lineWidth = 0.8;
            ctx.setLineDash([3, 3]);
          } else {
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([2, 3]);
          }
          ctx.beginPath();
          ctx.moveTo(leftMargin, y);
          ctx.lineTo(leftMargin + plotWidth, y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = tick === 1.301 ? '#ef4444' : tick === 2 ? '#991b1b' : '#9ca3af';
          const label = tick === 1.301 ? 'p=.05' : tick === 2 ? 'p=.01' : tick.toFixed(0);
          ctx.fillText(label, leftMargin - 8, y + 3);
        }
      }

      // Lollipop stems and heads
      const pKey = `${sub.key}_P` as keyof ProbeEntry;
      const lfcKey = `${sub.key}_logFC` as keyof ProbeEntry;

      for (const probe of geneData.probes) {
        const pVal = probe[pKey] as number | null;
        const logFC = probe[lfcKey] as number | null;
        if (!pVal || pVal <= 0) continue;

        const nlp = -Math.log10(pVal);
        const x = posToX(probe.pos);
        const yBase = valToY(0, panelTop);
        const yTop = valToY(Math.min(nlp, maxNegLogP), panelTop);
        const dotColor = logFC && logFC > 0 ? HYPER_COLOR : HYPO_COLOR;

        // Stem
        ctx.strokeStyle = dotColor;
        ctx.lineWidth = 1.3;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(x, yBase);
        ctx.lineTo(x, yTop);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Head
        const isSig = nlp > -Math.log10(0.05);
        const radius = isSig ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(x, yTop, radius, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
        if (nlp > -Math.log10(0.01)) {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    });

    // X-axis
    const xAxisY = topMargin + SUBTYPES.length * (panelHeight + panelGap) - panelGap + 10;
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftMargin, xAxisY);
    ctx.lineTo(leftMargin + plotWidth, xAxisY);
    ctx.stroke();

    const nTicks = 8;
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#374151';
    ctx.textAlign = 'center';
    for (let i = 0; i <= nTicks; i++) {
      const pos = minPos + (posRange * i) / nTicks;
      const x = posToX(pos);
      ctx.beginPath();
      ctx.moveTo(x, xAxisY);
      ctx.lineTo(x, xAxisY + 5);
      ctx.stroke();
      ctx.fillText(Math.round(pos).toLocaleString(), x, xAxisY + 18);
    }

    ctx.fillStyle = '#374151';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillText('Genomic Position (bp)', dimensions.width / 2, xAxisY + 35);

    // Y-axis label
    ctx.save();
    ctx.translate(14, topMargin + (SUBTYPES.length * (panelHeight + panelGap)) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#374151';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('-log₁₀(P-value)', 0, 0);
    ctx.restore();

    // Legend
    const legendY = xAxisY + 48;
    const legendItems = [
      { color: HYPER_COLOR, label: 'Hypermethylated (logFC > 0)' },
      { color: HYPO_COLOR, label: 'Hypomethylated (logFC < 0)' },
      { color: 'transparent', border: ISLAND_BORDER, bgColor: ISLAND_COLOR, label: 'CpG Island' },
      { color: '#ef4444', label: 'p = 0.05', isDash: true },
      { color: '#991b1b', label: 'p = 0.01', isDash: true },
    ];
    let legendX = dimensions.width / 2 - 340;
    ctx.font = '10px Inter, system-ui, sans-serif';
    for (const item of legendItems) {
      if (item.bgColor) {
        ctx.fillStyle = item.bgColor;
        ctx.fillRect(legendX, legendY - 5, 16, 10);
        ctx.strokeStyle = item.border!;
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(legendX, legendY - 5, 16, 10);
        ctx.setLineDash([]);
      } else if (item.isDash) {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(legendX, legendY);
        ctx.lineTo(legendX + 16, legendY);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.beginPath();
        ctx.arc(legendX + 7, legendY, 4, 0, Math.PI * 2);
        ctx.fillStyle = item.color;
        ctx.fill();
      }
      ctx.fillStyle = '#374151';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, legendX + 22, legendY + 4);
      legendX += ctx.measureText(item.label).width + 44;
    }
  }, [geneData, dimensions, minPos, maxPos, posRange, maxNegLogP, posToX, valToY]);

  // Tooltip on hover
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      let found: TooltipData | null = null;
      const hitRadius = 8;

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
        className="rounded-lg cursor-crosshair border border-gray-200 shadow-sm"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />

      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none bg-white border border-gray-300 rounded-lg p-3 shadow-xl text-xs space-y-1 max-w-[280px]"
          style={{
            left: Math.min(tooltip.x + 12, dimensions.width - 290),
            top: tooltip.y - 10,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold text-gray-900 text-sm">{tooltip.probe.probe}</span>
            <span
              className="px-1.5 py-0.5 text-[10px] font-bold rounded"
              style={{
                backgroundColor:
                  SUBTYPES.find((s) => s.key === tooltip.subtype)?.color + '1a',
                color: SUBTYPES.find((s) => s.key === tooltip.subtype)?.color,
              }}
            >
              {tooltip.subtype}
            </span>
          </div>
          <div className="text-gray-500">
            Position: <span className="text-gray-900 font-mono">{tooltip.probe.pos.toLocaleString()}</span>
          </div>
          <div className="text-gray-500">
            Feature: <span className="text-gray-700">{tooltip.probe.feature || 'N/A'}</span>
          </div>
          {tooltip.probe.cpgIsland && (
            <div className="text-gray-500">
              CpG Island: <span className="text-amber-700 text-[10px]">{tooltip.probe.cpgIsland}</span>
            </div>
          )}
          <div className="border-t border-gray-200 pt-1 mt-1 grid grid-cols-3 gap-x-3 text-[11px]">
            <div>
              <span className="text-gray-400">logFC</span>
              <div className="font-mono font-semibold">
                {(() => {
                  const v = tooltip.probe[`${tooltip.subtype}_logFC` as keyof ProbeEntry] as number | null;
                  if (v == null) return 'N/A';
                  return (
                    <span className={v > 0 ? 'text-red-600' : 'text-blue-600'}>
                      {v > 0 ? '+' : ''}{v.toFixed(4)}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div>
              <span className="text-gray-400">P-value</span>
              <div className="font-mono font-semibold text-gray-900">
                {(() => {
                  const v = tooltip.probe[`${tooltip.subtype}_P` as keyof ProbeEntry] as number | null;
                  return v != null ? (v < 1e-10 ? v.toExponential(1) : v.toExponential(2)) : 'N/A';
                })()}
              </div>
            </div>
            <div>
              <span className="text-gray-400">FDR</span>
              <div className="font-mono font-semibold text-gray-900">
                {(() => {
                  const v = tooltip.probe[`${tooltip.subtype}_FDR` as keyof ProbeEntry] as number | null;
                  return v != null ? (v < 1e-10 ? v.toExponential(1) : v.toExponential(2)) : 'N/A';
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
