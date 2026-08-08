import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  LabelList,
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

const SUBTYPE_COLORS: Record<string, { main: string; light: string }> = {
  SSS: { main: '#e11d48', light: '#fecdd3' },
  ADS: { main: '#2563eb', light: '#bfdbfe' },
  ICF: { main: '#7c3aed', light: '#ddd6fe' },
  ISS: { main: '#059669', light: '#a7f3d0' },
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
  const subtypeLabels: Record<string, string> = {
    SSS: 'SSS',
    ADS: 'ADS',
    ICF: 'ICF',
    ISS: 'ISS',
  };

  // Build chart data: for each subtype, include avgPos/avgNeg for split bars
  const chartData = subtypeKeys.map((sub) => {
    const s = geneData.subtypes[sub];
    return {
      subtype: subtypeLabels[sub],
      subtypeKey: sub,
      deltaBeta: s.deltaBeta,
      fdr: s.fdr,
      direction: s.direction,
      sig: sigStars(s.fdr),
      color: SUBTYPE_COLORS[sub].main,
      isMixed: s.direction === 'Mixed',
      avgPosLogFC: s.avgPosLogFC ?? null,
      avgNegLogFC: s.avgNegLogFC ?? null,
      nPos: s.nPosTop3 ?? 0,
      nNeg: s.nNegTop3 ?? 0,
      // For the chart: if Mixed, use avgPos for the "hyper" bar and avgNeg for the "hypo" bar
      // If concordant, avgPos or avgNeg will be null and we use deltaBeta only
      hyperBar: s.direction === 'Mixed' ? (s.avgPosLogFC ?? 0) : (s.deltaBeta > 0 ? s.deltaBeta : 0),
      hypoBar: s.direction === 'Mixed' ? (s.avgNegLogFC ?? 0) : (s.deltaBeta < 0 ? s.deltaBeta : 0),
    };
  });

  const hasMixed = chartData.some((d) => d.isMixed);

  // Force symmetric Y-axis domain around zero
  const yDomain = useMemo(() => {
    const allVals = chartData.flatMap((d) => [d.hyperBar, d.hypoBar, d.deltaBeta]);
    const maxAbs = Math.max(...allVals.map(Math.abs), 0.01);
    const pad = maxAbs * 1.35;
    return [-pad, pad];
  }, [chartData]);

  // Significance label renderer for the hyper bar (positive)
  const renderHyperSigLabel = (props: any) => {
    const { x, y, width, index } = props;
    if (index === undefined || !chartData[index]) return null;
    const entry = chartData[index];
    if (!entry.isMixed && entry.deltaBeta <= 0) return null; // concordant hypo — skip this bar's label
    const sig = entry.sig;
    const sigColor = sig === 'ns' ? '#94a3b8' : '#0f172a';
    // Position: if bar is positive, label above; if zero bar, skip
    const barVal = entry.hyperBar;
    if (barVal === 0) return null;
    const labelY = y - 6;
    return (
      <text x={x + width / 2} y={labelY} textAnchor="middle" fill={sigColor}
        fontSize={sig === 'ns' ? 9 : 11} fontWeight={sig === 'ns' ? 400 : 700}
        fontStyle={sig === 'ns' ? 'italic' : 'normal'}>
        {entry.isMixed ? `↑${entry.nPos}` : sig}
      </text>
    );
  };

  // Significance label renderer for the hypo bar (negative)
  const renderHypoSigLabel = (props: any) => {
    const { x, y, width, height, index } = props;
    if (index === undefined || !chartData[index]) return null;
    const entry = chartData[index];
    if (!entry.isMixed && entry.deltaBeta >= 0) return null;
    const sig = entry.sig;
    const sigColor = sig === 'ns' ? '#94a3b8' : '#0f172a';
    const barVal = entry.hypoBar;
    if (barVal === 0) return null;
    const labelY = y + (height || 0) + 12;
    return (
      <text x={x + width / 2} y={labelY} textAnchor="middle" fill={sigColor}
        fontSize={sig === 'ns' ? 9 : 11} fontWeight={sig === 'ns' ? 400 : 700}
        fontStyle={sig === 'ns' ? 'italic' : 'normal'}>
        {entry.isMixed ? `↓${entry.nNeg}` : sig}
      </text>
    );
  };

  // For concordant genes: render sig stars once (above or below)
  const renderConcordantSigLabel = (props: any) => {
    const { x, y, width, height, index } = props;
    if (index === undefined || !chartData[index]) return null;
    const entry = chartData[index];
    if (entry.isMixed) {
      // For mixed: show sig between the two bars
      const sigColor = entry.sig === 'ns' ? '#94a3b8' : '#0f172a';
      return (
        <text x={x + width / 2} y={y + (height || 0) / 2 + 4} textAnchor="middle" fill={sigColor}
          fontSize={entry.sig === 'ns' ? 8 : 10} fontWeight={entry.sig === 'ns' ? 400 : 700}
          fontStyle={entry.sig === 'ns' ? 'italic' : 'normal'}>
          {entry.sig}
        </text>
      );
    }
    return null;
  };

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

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 22, right: 20, bottom: 22, left: 10 }} barGap={0} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="subtype" stroke="#64748b" fontSize={11} />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              domain={yDomain}
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
                    <div className="bg-white border border-slate-300 p-2.5 rounded shadow-lg text-xs space-y-1.5 min-w-[180px]">
                      <div className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-1">{data.subtype}</div>
                      {data.isMixed ? (
                        <>
                          <div className="text-[10px] font-bold text-amber-700 uppercase">Mixed Direction</div>
                          <div className="flex justify-between gap-3">
                            <span className="text-red-600 font-medium">↑ Hyper ({data.nPos} CpGs):</span>
                            <span className="font-mono font-bold text-red-700">+{(data.avgPosLogFC ?? 0).toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-blue-600 font-medium">↓ Hypo ({data.nNeg} CpGs):</span>
                            <span className="font-mono font-bold text-blue-700">{(data.avgNegLogFC ?? 0).toFixed(4)}</span>
                          </div>
                          <div className="text-slate-400 text-[10px]">Avg Δβ: {data.deltaBeta.toFixed(4)} (cancellation)</div>
                        </>
                      ) : (
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">Avg Δβ:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {data.deltaBeta > 0 ? `+${data.deltaBeta.toFixed(4)}` : data.deltaBeta.toFixed(4)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between gap-4 border-t border-slate-100 pt-1">
                        <span className="text-slate-500">FDR:</span>
                        <span className="font-mono text-slate-800">{data.fdr < 1e-15 ? '< 1e-15' : data.fdr.toExponential(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Significance:</span>
                        <span className={`font-bold ${data.sig === 'ns' ? 'text-slate-400' : 'text-slate-900'}`}>{data.sig}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.2} />

            {/* Hyper (positive) bar — red for all */}
            <Bar dataKey="hyperBar" stackId="a" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`hyper-${index}`}
                  fill={entry.isMixed ? '#dc2626' : entry.color}
                  opacity={entry.sig === 'ns' ? 0.35 : (entry.isMixed ? 0.75 : 1)}
                />
              ))}
              <LabelList content={renderHyperSigLabel} />
            </Bar>

            {/* Hypo (negative) bar — blue for Mixed, subtype color for concordant */}
            <Bar dataKey="hypoBar" stackId="a" radius={[0, 0, 4, 4]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`hypo-${index}`}
                  fill={entry.isMixed ? '#2563eb' : entry.color}
                  opacity={entry.sig === 'ns' ? 0.35 : (entry.isMixed ? 0.75 : 1)}
                />
              ))}
              <LabelList content={renderHypoSigLabel} />
              <LabelList content={renderConcordantSigLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-1 text-[10px] text-slate-500 border-t border-slate-100 pt-2 flex-wrap">
        <span><strong className="text-slate-900">***</strong> FDR &lt; 0.001</span>
        <span><strong className="text-slate-900">**</strong> FDR &lt; 0.01</span>
        <span><strong className="text-slate-900">*</strong> FDR &lt; 0.05</span>
        <span><em className="text-slate-400">ns</em> not significant</span>
        {hasMixed && (
          <>
            <span className="border-l border-slate-200 pl-4">
              <span className="text-red-600 font-bold">↑n</span> hyper CpGs
            </span>
            <span>
              <span className="text-blue-600 font-bold">↓n</span> hypo CpGs
            </span>
            <span className="text-amber-600 font-semibold">(Mixed = opposing top-3 probe directions)</span>
          </>
        )}
      </div>
    </div>
  );
};
