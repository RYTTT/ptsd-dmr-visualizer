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
  // Sample or cap data for chart performance if necessary (e.g. max 500 top points)
  const chartData = React.useMemo(() => {
    return [...data]
      .sort((a, b) => b.negLogFdr - a.negLogFdr)
      .slice(0, 400);
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item: VolcanoItem = payload[0].payload;
      return (
        <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-lg shadow-xl backdrop-blur-md max-w-xs z-50">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-bold text-white text-sm">{item.gene}</span>
            {item.isPtsd && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded">
                PTSD Target
              </span>
            )}
          </div>
          <div className="text-xs space-y-1 text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Chromosome:</span>
              <span>{item.chr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Avg Δβ (Top-3):</span>
              <span
                className={
                  item.deltaBeta > 0
                    ? 'text-emerald-400 font-mono font-semibold'
                    : 'text-cyan-400 font-mono font-semibold'
                }
              >
                {item.deltaBeta > 0 ? `+${item.deltaBeta.toFixed(4)}` : item.deltaBeta.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">FDR P-value:</span>
              <span className="font-mono">{item.fdr < 1e-15 ? '< 1e-15' : item.fdr.toExponential(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Direction:</span>
              <span className="font-medium text-slate-200">{item.direction}</span>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-cyan-400/80 italic border-t border-slate-800 pt-1">
            Click point to inspect full details
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 backdrop-blur-md">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>DMR Volcano & Effect Size Distribution</span>
            <span className="text-xs font-normal text-slate-400">
              (Δβ vs -log10 FDR)
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Showing top {chartData.length} significant DMRs. Click any node to inspect probe details.
          </p>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
            <span className="text-slate-300">Hypermethylated</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span>
            <span className="text-slate-300">Hypomethylated</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block ring-2 ring-amber-400/30"></span>
            <span className="text-slate-300 font-semibold text-amber-300">PTSD Target</span>
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
                fill: '#94a3b8',
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
                value: '-log10(FDR)',
                angle: -90,
                position: 'insideLeft',
                fill: '#94a3b8',
                fontSize: 11,
              }}
            />
            <ZAxis type="number" range={[40, 140]} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={0} stroke="#334155" strokeDasharray="3 3" />
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
                let fillColor = entry.deltaBeta > 0 ? '#34d399' : '#38bdf8';
                if (entry.direction === 'Mixed') fillColor = '#f59e0b';
                if (entry.isPtsd) fillColor = '#fbbf24'; // Amber for PTSD

                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={fillColor}
                    stroke={isSelected ? '#ffffff' : entry.isPtsd ? '#f59e0b' : 'none'}
                    strokeWidth={isSelected ? 3 : entry.isPtsd ? 1.5 : 0}
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
