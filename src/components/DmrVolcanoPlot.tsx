import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

interface VolcanoItem {
  gene: string;
  chr: string;
  totalProbes: number;
  isPtsd: boolean;
  fdr: number;
  deltaBeta: number;
  direction: string;
  negLogFdr: number;
}

interface VolcanoProps {
  data: VolcanoItem[];
  onSelectGene: (gene: string) => void;
  selectedGene: string | null;
}

export const DmrVolcanoPlot: React.FC<VolcanoProps> = ({
  data,
  onSelectGene,
  selectedGene,
}) => {
  const chartData = React.useMemo(() => {
    return [...data]
      .sort((a, b) => b.negLogFdr - a.negLogFdr)
      .slice(0, 400);
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item: VolcanoItem = payload[0].payload;
      return (
        <div className="bg-white border border-slate-300 p-3 rounded-lg shadow-lg max-w-xs z-50 text-xs space-y-1">
          <div className="flex items-center justify-between gap-2 mb-1 border-b border-slate-100 pb-1">
            <span className="font-bold text-slate-900 text-sm">{item.gene}</span>
            <span
              className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                item.direction === 'Hypermethylated'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : item.direction === 'Hypomethylated'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {item.direction}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Chromosome:</span>
            <span className="font-mono text-slate-800">{item.chr}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Avg Δβ (Top-3):</span>
            <span
              className={
                item.deltaBeta > 0
                  ? 'text-red-600 font-mono font-bold'
                  : 'text-blue-600 font-mono font-bold'
              }
            >
              {item.deltaBeta > 0 ? `+${item.deltaBeta.toFixed(4)}` : item.deltaBeta.toFixed(4)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">FDR P-value:</span>
            <span className="font-mono text-slate-800">
              {item.fdr < 1e-15 ? '< 1e-15' : item.fdr.toExponential(2)}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>DMR Volcano Effect Size Distribution</span>
            <span className="text-xs font-normal text-slate-500">
              (Top-3 Δβ vs -log₁₀ FDR)
            </span>
          </h3>
          <p className="text-xs text-slate-500">
            Top {chartData.length} significant DMRs. Click point to inspect probe details.
          </p>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span>
            <span className="text-slate-600 font-medium">Hypermethylated</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
            <span className="text-slate-600 font-medium">Hypomethylated</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block"></span>
            <span className="text-slate-600 font-medium">Mixed</span>
          </div>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <XAxis
              type="number"
              dataKey="deltaBeta"
              name="Delta Beta"
              stroke="#64748b"
              fontSize={11}
              tickFormatter={(v) => v.toFixed(2)}
              domain={['auto', 'auto']}
              label={{
                value: 'Top-3 Avg Δβ (Methylation Difference)',
                position: 'bottom',
                offset: 0,
                fill: '#475569',
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="negLogFdr"
              name="-log10 FDR"
              stroke="#64748b"
              fontSize={11}
              label={{
                value: '-log₁₀(FDR)',
                angle: -90,
                position: 'insideLeft',
                fill: '#475569',
                fontSize: 11,
              }}
            />
            <ZAxis type="number" range={[40, 140]} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={0} stroke="#cbd5e1" strokeDasharray="3 3" />
            <ReferenceLine y={-Math.log10(0.05)} stroke="#ef4444" strokeDasharray="3 3" />
            <Scatter
              data={chartData}
              onClick={(entry: any) => {
                if (entry && entry.payload && entry.payload.gene) {
                  onSelectGene(entry.payload.gene);
                } else if (entry && entry.gene) {
                  onSelectGene(entry.gene);
                }
              }}
              className="cursor-pointer"
            >
              {chartData.map((entry, index) => {
                const isSelected = selectedGene === entry.gene;
                let fillColor = entry.deltaBeta > 0 ? '#dc2626' : '#2563eb';
                if (entry.direction === 'Mixed') fillColor = '#d97706';

                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={fillColor}
                    stroke={isSelected ? '#0f172a' : 'none'}
                    strokeWidth={isSelected ? 2.5 : 0}
                    opacity={isSelected ? 1 : 0.8}
                  />
                );
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
