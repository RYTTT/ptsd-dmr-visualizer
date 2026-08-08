import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { CrossSubtypeDMR } from '../types/dmr';

interface ComparisonProps {
  geneData: CrossSubtypeDMR | null;
}

function sigStars(fdr: number): string {
  if (fdr < 0.001) return '***';
  if (fdr < 0.01) return '**';
  if (fdr < 0.05) return '*';
  return 'ns';
}

const SUBTYPE_COLORS: Record<string, string> = {
  SSS: '#e11d48',
  ADS: '#2563eb',
  ICF: '#7c3aed',
  ISS: '#059669',
};

/**
 * Custom bar shape that draws from the zero line.
 * Uses `background` (the full category slot rectangle) + symmetric yDomain
 * to compute pixel positions — does NOT rely on yAxis which Recharts
 * doesn't pass to custom shapes.
 */
const CustomBarShape = (props: any) => {
  const { x, width, payload, background } = props;
  if (!payload || !background) return null;

  const plotTop = background.y as number;
  const plotH = background.height as number;
  const domainMax = payload._yDomainMax as number;

  // scale: pixels per data-unit. Domain is [-domainMax, +domainMax]
  const scale = plotH / (2 * domainMax);
  // y0: pixel Y of the zero line (center of symmetric domain)
  const y0 = plotTop + plotH / 2;
  // Convert a data value to SVG pixel Y
  const toY = (v: number) => y0 - v * scale;

  const isMixed = payload.isMixed;
  const sig = payload.sig as string;
  const isNs = sig === 'ns';
  const opacity = isNs ? 0.35 : 1;

  if (isMixed) {
    const posVal: number = payload.avgPosLogFC ?? 0;
    const negVal: number = payload.avgNegLogFC ?? 0;

    const yPos = toY(posVal);
    const yNeg = toY(negVal);

    const posH = Math.max(0, y0 - yPos);
    const negH = Math.max(0, yNeg - y0);

    // Label positions:
    //   ySig  at fixed top of plot (never overlaps)
    //   yUp   just above red bar
    //   yDown just below blue bar
    const ySig = plotTop - 2; // fixed at top of chart area
    const yUp = posH > 0 ? yPos - 4 : y0 - 4;
    const yDown = negH > 0 ? yNeg + 14 : y0 + 14;

    return (
      <g>
        {/* Red hyper bar: UP from zero */}
        {posH > 0 && (
          <rect x={x} y={yPos} width={width} height={posH}
            fill="#dc2626" rx={3} ry={3} opacity={opacity} />
        )}
        {/* Blue hypo bar: DOWN from zero */}
        {negH > 0 && (
          <rect x={x} y={y0} width={width} height={negH}
            fill="#2563eb" rx={3} ry={3} opacity={opacity} />
        )}
        {/* ↑n label */}
        {payload.nPos > 0 && posH > 0 && (
          <text x={x + width / 2} y={yUp} textAnchor="middle"
            fill="#dc2626" fontSize={10} fontWeight={700}>
            ↑{payload.nPos}
          </text>
        )}
        {/* ↓n label */}
        {payload.nNeg > 0 && negH > 0 && (
          <text x={x + width / 2} y={yDown} textAnchor="middle"
            fill="#2563eb" fontSize={10} fontWeight={700}>
            ↓{payload.nNeg}
          </text>
        )}
        {/* Significance stars at top */}
        <text x={x + width / 2} y={ySig} textAnchor="middle"
          fill={isNs ? '#94a3b8' : '#0f172a'}
          fontSize={isNs ? 9 : 11} fontWeight={isNs ? 400 : 700}
          fontStyle={isNs ? 'italic' : 'normal'}>
          {sig}
        </text>
      </g>
    );
  }

  // ---- Concordant bar (single direction) ----
  const val = payload.deltaBeta as number;
  const yVal = toY(val);
  const isPos = val >= 0;

  const barY = isPos ? yVal : y0;
  const barH = Math.max(1, Math.abs(y0 - yVal));
  const labelY = plotTop - 2; // fixed at top, same as Mixed

  return (
    <g>
      <rect x={x} y={barY} width={width} height={barH}
        fill={payload.color} rx={3} ry={3} opacity={opacity} />
      <text x={x + width / 2} y={labelY} textAnchor="middle"
        fill={isNs ? '#94a3b8' : '#0f172a'}
        fontSize={isNs ? 9 : 11} fontWeight={isNs ? 400 : 700}
        fontStyle={isNs ? 'italic' : 'normal'}>
        {sig}
      </text>
    </g>
  );
};

export const SubtypeComparisonChart: React.FC<ComparisonProps> = ({ geneData }) => {
  if (!geneData) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col items-center justify-center text-center h-full min-h-[280px]">
        <span className="text-slate-400 text-xs">
          Select or click a gene to compare its effect size (Δβ) profile across the 4 subtypes.
        </span>
      </div>
    );
  }

  const subtypeKeys = ['SSS', 'ADS', 'ICF', 'ISS'] as const;

  // Compute yDomain first so we can pass it into each data entry
  const yDomainMax = useMemo(() => {
    const allVals = subtypeKeys.flatMap((sub) => {
      const s = geneData.subtypes[sub];
      return [s.deltaBeta, s.avgPosLogFC ?? 0, s.avgNegLogFC ?? 0];
    });
    const maxAbs = Math.max(...allVals.map(Math.abs), 0.02);
    return maxAbs * 1.55; // 55% padding for labels
  }, [geneData]);

  // Build chart data — include _yDomainMax so CustomBarShape can compute pixel positions
  const chartData = subtypeKeys.map((sub) => {
    const s = geneData.subtypes[sub];
    return {
      subtype: sub,
      deltaBeta: s.deltaBeta,
      fdr: s.fdr,
      direction: s.direction,
      sig: sigStars(s.fdr),
      color: SUBTYPE_COLORS[sub],
      isMixed: s.direction === 'Mixed',
      avgPosLogFC: s.avgPosLogFC ?? null,
      avgNegLogFC: s.avgNegLogFC ?? null,
      nPos: s.nPosTop3 ?? 0,
      nNeg: s.nNegTop3 ?? 0,
      _yDomainMax: yDomainMax,
    };
  });

  const hasMixed = chartData.some((d) => d.isMixed);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-slate-900">{geneData.gene}</h3>
            {geneData.isPtsd && (
              <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded">
                PTSD Target Gene
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-Subtype Top-3 Effect Size (Δβ) Profile | {geneData.chr} ({geneData.totalProbes} CpGs)
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-500 font-medium">Combined Cross FDR</div>
          <div className="text-sm font-bold font-mono text-slate-900">
            {geneData.crossFdr < 1e-15 ? '< 1e-15' : geneData.crossFdr.toExponential(2)}
          </div>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 30, right: 20, bottom: 25, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="subtype" stroke="#64748b" fontSize={11} />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              domain={[-yDomainMax, yDomainMax]}
              tickFormatter={(v: number) => v.toFixed(2)}
              label={{
                value: 'Top-3 Avg Δβ',
                angle: -90,
                position: 'insideLeft',
                fill: '#475569',
                fontSize: 11,
              }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white border border-slate-300 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[200px] z-50">
                      <div className="font-extrabold text-slate-900 text-sm border-b border-slate-100 pb-1 flex items-center justify-between">
                        <span>{data.subtype} Subtype</span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                          data.direction === 'Hypermethylated' ? 'bg-red-50 text-red-700' :
                          data.direction === 'Hypomethylated' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {data.direction}
                        </span>
                      </div>

                      {data.isMixed ? (
                        <div className="space-y-1 bg-slate-50 p-2 rounded border border-slate-200 text-[11px]">
                          <div className="flex justify-between gap-3">
                            <span className="text-red-600 font-bold">↑ Hyper ({data.nPos} CpGs):</span>
                            <span className="font-mono font-bold text-red-700">+{(data.avgPosLogFC ?? 0).toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-blue-600 font-bold">↓ Hypo ({data.nNeg} CpGs):</span>
                            <span className="font-mono font-bold text-blue-700">{(data.avgNegLogFC ?? 0).toFixed(4)}</span>
                          </div>
                          <div className="text-slate-400 text-[10px] pt-0.5 border-t border-slate-200">
                            Net Avg Δβ: {data.deltaBeta.toFixed(4)} (cancellation)
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">Avg Δβ:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {data.deltaBeta > 0 ? `+${data.deltaBeta.toFixed(4)}` : data.deltaBeta.toFixed(4)}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between gap-4 pt-0.5">
                        <span className="text-slate-500">Subtype FDR:</span>
                        <span className="font-mono text-slate-800 font-bold">{data.fdr < 1e-15 ? '< 1e-15' : data.fdr.toExponential(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Significance:</span>
                        <span className="font-bold text-slate-900">{data.sig}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine y={0} stroke="#64748b" strokeWidth={1.5} />

            {/* Custom SVG shape uses `background` slot to compute zero line */}
            <Bar
              dataKey="deltaBeta"
              shape={<CustomBarShape />}
              background={{ fill: 'transparent' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-slate-500 border-t border-slate-100 pt-2.5 flex-wrap">
        <span><strong className="text-slate-900">***</strong> FDR &lt; 0.001</span>
        <span><strong className="text-slate-900">**</strong> FDR &lt; 0.01</span>
        <span><strong className="text-slate-900">*</strong> FDR &lt; 0.05</span>
        <span><em className="text-slate-400">ns</em> not significant</span>
        {hasMixed && (
          <span className="border-l border-slate-200 pl-4 flex items-center gap-2">
            <span className="text-red-600 font-bold">↑ Red = Hyper</span>
            <span className="text-blue-600 font-bold">↓ Blue = Hypo</span>
            <span className="text-amber-700 font-semibold">(Mixed = opposing CpG directions)</span>
          </span>
        )}
      </div>
    </div>
  );
};
