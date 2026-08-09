import React from 'react';
import {
  ScatterChart,
  Scatter,
  Cell,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  type ScatterPointItem,
  type TooltipContentProps,
} from 'recharts';
import type { Direction } from '../types/dmr';

interface VolcanoItem {
  gene: string;
  chr: string;
  totalProbes: number;
  isPtsd: boolean;
  fdr: number;
  deltaBeta: number;
  direction: Direction;
  negLogFdr: number;
}

interface VolcanoProps {
  data: VolcanoItem[];
  onSelectGene: (gene: string) => void;
  selectedGene: string | null;
}

const MAX_POINTS = 500;

function formatProbability(value: number): string {
  if (!Number.isFinite(value)) return 'Unavailable';
  if (value === 0) return '0 (below numeric precision)';
  return value < 0.001 ? value.toExponential(2) : value.toFixed(3);
}

function VolcanoTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload.length) return null;
  const item = payload[0].payload as VolcanoItem;
  return (
    <div className="bg-white border border-slate-300 p-3 rounded-lg shadow-lg max-w-xs z-50 text-xs space-y-1">
      <div className="flex items-center justify-between gap-2 mb-1 border-b border-slate-100 pb-1">
        <span className="font-bold text-slate-900 text-sm">{item.gene}</span>
        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-800 border border-slate-300">
          {item.direction}
        </span>
      </div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Chromosome</span><span className="font-mono text-slate-800">{item.chr}</span></div>
      <div className="flex justify-between gap-4">
        <span className="text-slate-500">Mean top-3 Δβ</span>
        <span className="font-mono font-bold text-slate-900">{item.deltaBeta > 0 ? '+' : ''}{item.deltaBeta.toFixed(4)}</span>
      </div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">DMR FDR</span><span className="font-mono text-slate-800">{formatProbability(item.fdr)}</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">DMR tested probes</span><span className="font-mono text-slate-800">{item.totalProbes}</span></div>
      {item.direction === 'Mixed' && <p className="text-[10px] text-amber-900 bg-amber-50 p-1.5 rounded border border-amber-200">Opposing selected-probe directions can partially cancel in the signed mean; inspect the subtype and probe-level views before interpreting direction.</p>}
    </div>
  );
}

export const DmrVolcanoPlot: React.FC<VolcanoProps> = ({
  data,
  onSelectGene,
  selectedGene,
}) => {
  // Split data into concordant (circle) and mixed (diamond) groups
  const { concordantData, mixedData } = React.useMemo(() => {
    const sorted = data
      .filter((item) => Number.isFinite(item.deltaBeta) && Number.isFinite(item.fdr) && item.fdr >= 0 && item.fdr <= 1)
      .sort((a, b) => a.fdr - b.fdr)
      .slice(0, MAX_POINTS);
    return {
      concordantData: sorted.filter((d) => d.direction !== 'Mixed'),
      mixedData: sorted.filter((d) => d.direction === 'Mixed'),
    };
  }, [data]);

  const nMixed = mixedData.length;
  const nTotal = concordantData.length + mixedData.length;
  const plottedData = React.useMemo(() => [...concordantData, ...mixedData].sort((a, b) => a.fdr - b.fdr), [concordantData, mixedData]);
  const maxAbsoluteDeltaBeta = Math.max(...plottedData.map((item) => Math.abs(item.deltaBeta)), 0.01) * 1.05;

  const getColor = (item: VolcanoItem) => {
    if (item.direction === 'Mixed') return '#b45309';
    return item.direction === 'Hypermethylated' ? '#b91c1c' : '#1d4ed8';
  };

  const getStroke = (item: VolcanoItem) => {
    return selectedGene === item.gene ? '#0f172a' : 'none';
  };

  const getStrokeWidth = (item: VolcanoItem) => {
    return selectedGene === item.gene ? 2.5 : 0;
  };

  const getOpacity = (item: VolcanoItem) => {
    return selectedGene === item.gene ? 1 : 0.75;
  };

  const handleClick = (entry: ScatterPointItem) => {
    const gene = (entry.payload as VolcanoItem | undefined)?.gene;
    if (gene) onSelectGene(gene);
  };

  if (nTotal === 0) {
    return (
      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-xs">
        <h3 className="text-sm font-bold text-slate-900">DMR effect–significance plot</h3>
        <p className="mt-1 text-xs text-slate-500">No finite DMR effect and FDR values are available for the current result set.</p>
      </section>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs mb-4">
      <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h3 id="dmr-volcano-title" className="text-sm font-bold text-slate-900 flex flex-wrap items-center gap-2">
            <span>DMR effect–significance plot</span>
            <span className="text-xs font-normal text-slate-500">
              (mean top-3 Δβ vs −log₁₀ FDR)
            </span>
          </h3>
          <p className="text-xs text-slate-500">
            Showing {nTotal.toLocaleString()} of {data.length.toLocaleString()} DMRs, ranked by lowest FDR. Select a point for details.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span>
            <span className="text-slate-600 font-medium">Hyper (Δβ &gt; 0)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
            <span className="text-slate-600 font-medium">Hypo (Δβ &lt; 0)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <svg width="10" height="10" viewBox="0 0 10 10" className="inline-block">
              <polygon points="5,0 10,5 5,10 0,5" fill="#d97706" />
            </svg>
            <span className="text-slate-600 font-medium">Mixed ({nMixed})</span>
          </div>
        </div>
      </div>

      <div className="h-80 min-h-72 w-full" role="img" aria-labelledby="dmr-volcano-title" aria-describedby="dmr-volcano-note">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart accessibilityLayer margin={{ top: 10, right: 20, bottom: 28, left: 12 }}>
            <XAxis
              type="number"
              dataKey="deltaBeta"
              name="Mean top-3 Δβ"
              stroke="#64748b"
              fontSize={11}
              tickFormatter={(v: number) => v.toFixed(2)}
              domain={[-maxAbsoluteDeltaBeta, maxAbsoluteDeltaBeta]}
              label={{
                value: 'Mean top-3 Δβ (case − comparison)',
                position: 'bottom',
                offset: 0,
                fill: '#475569',
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="negLogFdr"
              name="−log₁₀ FDR"
              stroke="#64748b"
              fontSize={11}
              label={{
                value: '−log₁₀(FDR)',
                angle: -90,
                position: 'insideLeft',
                fill: '#475569',
                fontSize: 11,
              }}
            />
            <ZAxis type="number" range={[40, 40]} />
            <Tooltip content={VolcanoTooltip} />
            <ReferenceLine x={0} stroke="#cbd5e1" strokeDasharray="3 3" />
            <ReferenceLine y={-Math.log10(0.05)} stroke="#475569" strokeWidth={1.5} strokeDasharray="4 3" />

            {/* Concordant genes — circles */}
            <Scatter
              data={concordantData}
              shape="circle"
              onClick={handleClick}
            >
              {concordantData.map((item) => <Cell key={`${item.gene}-${item.chr}`} fill={getColor(item)} stroke={getStroke(item)} strokeWidth={getStrokeWidth(item)} opacity={getOpacity(item)} className="cursor-pointer" />)}
            </Scatter>

            {/* Mixed genes — diamonds */}
            <Scatter
              data={mixedData}
              shape="diamond"
              onClick={handleClick}
            >
              {mixedData.map((item) => <Cell key={`${item.gene}-${item.chr}`} fill={getColor(item)} stroke={getStroke(item)} strokeWidth={getStrokeWidth(item)} opacity={getOpacity(item)} className="cursor-pointer" />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Footnote about Mixed */}
      {nMixed > 0 && (
        <p id="dmr-volcano-note" className="text-[10px] text-amber-900 bg-amber-50/60 border border-amber-200 rounded px-3 py-1.5 mt-2">
          <strong>◆ Mixed:</strong> opposing top-three probe directions can cancel in the mean. The dashed horizontal line marks DMR FDR = 0.05; the plot is descriptive and does not show confidence intervals.
        </p>
      )}
      <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">Accessible plotted-data table ({nTotal.toLocaleString()} DMRs)</summary>
        <div className="max-h-80 overflow-auto border-t border-slate-200">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">DMRs plotted by mean top-three methylation difference and FDR</caption>
            <thead className="sticky top-0 bg-slate-100 text-slate-600"><tr><th className="px-3 py-2">Gene</th><th className="px-3 py-2">Chromosome</th><th className="px-3 py-2">Mean top-three Δβ</th><th className="px-3 py-2">Direction</th><th className="px-3 py-2">DMR FDR</th><th className="px-3 py-2"><span className="sr-only">Action</span></th></tr></thead>
            <tbody>{plottedData.map((item) => <tr key={`${item.gene}-${item.chr}`} className="border-t border-slate-200"><td className="px-3 py-2 font-semibold">{item.gene}</td><td className="px-3 py-2 font-mono">{item.chr}</td><td className="px-3 py-2 font-mono">{item.deltaBeta.toFixed(4)}</td><td className="px-3 py-2">{item.direction}</td><td className="px-3 py-2 font-mono">{formatProbability(item.fdr)}</td><td className="px-3 py-2"><button type="button" onClick={() => onSelectGene(item.gene)} className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100">Select</button></td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
};
