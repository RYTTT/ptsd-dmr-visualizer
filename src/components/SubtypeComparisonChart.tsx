import React from 'react';
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
} from 'recharts';
import { CrossSubtypeDMR } from '../types/dmr';

interface ComparisonProps {
  geneData: CrossSubtypeDMR | null;
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
      subtype: 'SSS (Severe Stress)',
      deltaBeta: geneData.subtypes.SSS.deltaBeta,
      fdr: geneData.subtypes.SSS.fdr,
      direction: geneData.subtypes.SSS.direction,
      color: '#e11d48',
    },
    {
      subtype: 'ADS (Depressive)',
      deltaBeta: geneData.subtypes.ADS.deltaBeta,
      fdr: geneData.subtypes.ADS.fdr,
      direction: geneData.subtypes.ADS.direction,
      color: '#2563eb',
    },
    {
      subtype: 'ICF (Cognitive)',
      deltaBeta: geneData.subtypes.ICF.deltaBeta,
      fdr: dummyFdr(geneData.subtypes.ICF.fdr),
      direction: geneData.subtypes.ICF.direction,
      color: '#7c3aed',
    },
    {
      subtype: 'ISS (Intermediate)',
      deltaBeta: geneData.subtypes.ISS.deltaBeta,
      fdr: geneData.subtypes.ISS.fdr,
      direction: geneData.subtypes.ISS.direction,
      color: '#059669',
    },
  ];

  function dummyFdr(val: number) {
    return val;
  }

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
          <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="subtype" stroke="#64748b" fontSize={11} />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickFormatter={(v) => v.toFixed(2)}
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
                      <div className="font-bold text-slate-900">{data.subtype}</div>
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
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
