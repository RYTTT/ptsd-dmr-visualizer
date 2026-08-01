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
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 backdrop-blur-md flex flex-col items-center justify-center text-center h-full min-h-[280px]">
        <span className="text-slate-500 text-sm">
          Select or hover over a gene to view its cross-subtype effect size comparison.
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
      color: '#f43f5e',
    },
    {
      subtype: 'ADS (Depressive)',
      deltaBeta: geneData.subtypes.ADS.deltaBeta,
      fdr: geneData.subtypes.ADS.fdr,
      direction: geneData.subtypes.ADS.direction,
      color: '#3b82f6',
    },
    {
      subtype: 'ICF (Cognitive)',
      deltaBeta: geneData.subtypes.ICF.deltaBeta,
      fdr: geneData.subtypes.ICF.fdr,
      direction: geneData.subtypes.ICF.direction,
      color: '#a855f7',
    },
    {
      subtype: 'ISS (Intermediate)',
      deltaBeta: geneData.subtypes.ISS.deltaBeta,
      fdr: geneData.subtypes.ISS.fdr,
      direction: geneData.subtypes.ISS.direction,
      color: '#10b981',
    },
  ];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 backdrop-blur-md">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-white">{geneData.gene}</h3>
            {geneData.isPtsd && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded">
                PTSD Hallmark Gene
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Cross-Subtype Top-3 Effect Size (Δβ) Profile | {geneData.chr} ({geneData.totalProbes} mapped CpGs)
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Combined Cross FDR</div>
          <div className="text-sm font-bold font-mono text-cyan-400">
            {geneData.crossFdr < 1e-15 ? '< 1e-15' : geneData.crossFdr.toExponential(2)}
          </div>
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="subtype" stroke="#64748b" fontSize={11} />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickFormatter={(v) => v.toFixed(2)}
              label={{
                value: 'Top-3 Avg Δβ Difference',
                angle: -90,
                position: 'insideLeft',
                fill: '#94a3b8',
                fontSize: 11,
              }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-slate-900 border border-slate-700 p-2.5 rounded shadow-xl text-xs space-y-1">
                      <div className="font-bold text-white">{data.subtype}</div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400">Avg Δβ:</span>
                        <span className="font-mono font-semibold text-white">
                          {data.deltaBeta > 0 ? `+${data.deltaBeta.toFixed(4)}` : data.deltaBeta.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400">Subtype FDR:</span>
                        <span className="font-mono">{data.fdr < 1e-15 ? '< 1e-15' : data.fdr.toExponential(2)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-400">Direction:</span>
                        <span className="text-slate-200">{data.direction}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
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
