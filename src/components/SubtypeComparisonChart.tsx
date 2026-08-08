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

  const chartData = [
    {
      subtype: 'SSS',
      subtypeFull: 'SSS (Severe Stress)',
      deltaBeta: geneData.subtypes.SSS.deltaBeta,
      fdr: geneData.subtypes.SSS.fdr,
      direction: geneData.subtypes.SSS.direction,
      sig: sigStars(geneData.subtypes.SSS.fdr),
      color: '#e11d48',
    },
    {
      subtype: 'ADS',
      subtypeFull: 'ADS (Depressive)',
      deltaBeta: geneData.subtypes.ADS.deltaBeta,
      fdr: geneData.subtypes.ADS.fdr,
      direction: geneData.subtypes.ADS.direction,
      sig: sigStars(geneData.subtypes.ADS.fdr),
      color: '#2563eb',
    },
    {
      subtype: 'ICF',
      subtypeFull: 'ICF (Cognitive)',
      deltaBeta: geneData.subtypes.ICF.deltaBeta,
      fdr: geneData.subtypes.ICF.fdr,
      direction: geneData.subtypes.ICF.direction,
      sig: sigStars(geneData.subtypes.ICF.fdr),
      color: '#7c3aed',
    },
    {
      subtype: 'ISS',
      subtypeFull: 'ISS (Intermediate)',
      deltaBeta: geneData.subtypes.ISS.deltaBeta,
      fdr: geneData.subtypes.ISS.fdr,
      direction: geneData.subtypes.ISS.direction,
      sig: sigStars(geneData.subtypes.ISS.fdr),
      color: '#059669',
    },
  ];

  // Force symmetric Y-axis domain around zero so bars are visually comparable
  const yDomain = useMemo(() => {
    const values = chartData.map((d) => d.deltaBeta);
    const maxAbs = Math.max(...values.map(Math.abs), 0.01); // at least ±0.01
    const pad = maxAbs * 1.3; // 30% padding for star labels
    return [-pad, pad];
  }, [chartData]);

  // Custom label renderer: shows significance stars above/below each bar
  const renderSigLabel = (props: any) => {
    const { x, y, width, value, index } = props;
    if (index === undefined || !chartData[index]) return null;
    const entry = chartData[index];
    const isPositive = entry.deltaBeta >= 0;
    const labelY = isPositive ? y - 6 : y + 16;
    const sigColor = entry.sig === 'ns' ? '#94a3b8' : '#0f172a';
    return (
      <text
        x={x + width / 2}
        y={labelY}
        textAnchor="middle"
        fill={sigColor}
        fontSize={entry.sig === 'ns' ? 9 : 11}
        fontWeight={entry.sig === 'ns' ? 400 : 700}
        fontStyle={entry.sig === 'ns' ? 'italic' : 'normal'}
      >
        {entry.sig}
      </text>
    );
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

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="subtype" stroke="#64748b" fontSize={11} />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              domain={yDomain}
              tickFormatter={(v: number) => v.toFixed(2)}
              label={{
                value: 'Top-3 Avg Δβ Difference',
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
                    <div className="bg-white border border-slate-300 p-2.5 rounded shadow-lg text-xs space-y-1">
                      <div className="font-bold text-slate-900">{data.subtypeFull}</div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Avg Δβ:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {data.deltaBeta > 0 ? `+${data.deltaBeta.toFixed(4)}` : data.deltaBeta.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Subtype FDR:</span>
                        <span className="font-mono text-slate-800">{data.fdr < 1e-15 ? '< 1e-15' : data.fdr.toExponential(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Significance:</span>
                        <span className={`font-bold ${data.sig === 'ns' ? 'text-slate-400' : 'text-slate-900'}`}>{data.sig} (FDR {data.fdr < 0.05 ? '< 0.05' : '≥ 0.05'})</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Direction:</span>
                        <span className="text-slate-800 font-medium">{data.direction}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.2} />
            <Bar dataKey="deltaBeta" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} opacity={entry.sig === 'ns' ? 0.4 : 1} />
              ))}
              <LabelList content={renderSigLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Significance Legend */}
      <div className="flex items-center justify-center gap-4 mt-1 text-[10px] text-slate-500 border-t border-slate-100 pt-2">
        <span><strong className="text-slate-900">***</strong> FDR &lt; 0.001</span>
        <span><strong className="text-slate-900">**</strong> FDR &lt; 0.01</span>
        <span><strong className="text-slate-900">*</strong> FDR &lt; 0.05</span>
        <span><em className="text-slate-400">ns</em> not significant</span>
      </div>
    </div>
  );
};
