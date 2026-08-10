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
import { nominalPStars } from '../lib/scientificData';
import type { Direction } from '../types/dmr';

interface VolcanoItem {
  gene: string;
  chr: string;
  totalProbes: number;
  isPtsd: boolean;
  pValue: number | null;
  deltaBeta: number;
  effectDefinition: string;
  direction: Direction;
}

interface PlottedVolcanoItem extends VolcanoItem {
  pValue: number;
  negLogP: number;
}

interface VolcanoProps {
  data: VolcanoItem[];
  onSelectGene: (gene: string) => void;
  selectedGene: string | null;
}

const MAX_POINTS = 500;
const MAX_NEG_LOG_P = 8;

function probabilityScore(value: number): number {
  if (value === 0) return MAX_NEG_LOG_P;
  return Math.min(-Math.log10(value), MAX_NEG_LOG_P);
}

function formatProbability(value: number): string {
  if (value === 0) return '0 (below numeric precision)';
  return value < 0.001 ? value.toExponential(2) : value.toFixed(3);
}

function VolcanoTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload.length) return null;
  const item = payload[0].payload as PlottedVolcanoItem;
  const stars = nominalPStars(item.pValue);
  return (
    <div className="z-50 max-w-xs space-y-1 rounded-lg border border-slate-300 bg-white p-3 text-xs shadow-lg">
      <div className="mb-1 flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
        <span className="text-sm font-bold text-slate-900">{item.gene}</span>
        <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-800">{item.direction}</span>
      </div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Chromosome</span><span className="font-mono text-slate-800">{item.chr}</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">{item.effectDefinition}</span><span className="font-mono font-bold text-slate-900">{item.deltaBeta > 0 ? '+' : ''}{item.deltaBeta.toFixed(4)}</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Nominal DMR P</span><span className="font-mono text-slate-800">{formatProbability(item.pValue)} {stars}</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">DMR tested probes</span><span className="font-mono text-slate-800">{item.totalProbes}</span></div>
      {item.direction === 'Mixed' && <p className="rounded border border-amber-200 bg-amber-50 p-1.5 text-[10px] text-amber-900">Opposing selected-probe directions can partially cancel in the signed mean; inspect the subtype and probe-level views before interpreting direction.</p>}
    </div>
  );
}

export const DmrVolcanoPlot: React.FC<VolcanoProps> = ({ data, onSelectGene, selectedGene }) => {
  const { concordantData, mixedData } = React.useMemo(() => {
    const sorted = data
      .filter((item): item is VolcanoItem & { pValue: number } => (
        Number.isFinite(item.deltaBeta) &&
        item.pValue != null &&
        Number.isFinite(item.pValue) &&
        item.pValue >= 0 &&
        item.pValue <= 1
      ))
      .sort((a, b) => a.pValue - b.pValue)
      .slice(0, MAX_POINTS)
      .map((item): PlottedVolcanoItem => ({ ...item, negLogP: probabilityScore(item.pValue) }));
    return {
      concordantData: sorted.filter((item) => item.direction !== 'Mixed'),
      mixedData: sorted.filter((item) => item.direction === 'Mixed'),
    };
  }, [data]);

  const nMixed = mixedData.length;
  const nTotal = concordantData.length + mixedData.length;
  const plottedData = React.useMemo(
    () => [...concordantData, ...mixedData].sort((a, b) => a.pValue - b.pValue),
    [concordantData, mixedData],
  );
  const maxAbsoluteDeltaBeta = Math.max(...plottedData.map((item) => Math.abs(item.deltaBeta)), 0.01) * 1.05;
  const effectAxisLabel = plottedData[0]?.effectDefinition ?? 'Δβ summary';

  const getColor = (item: PlottedVolcanoItem) => item.direction === 'Mixed'
    ? '#b45309'
    : item.direction === 'Hypermethylated' ? '#b91c1c' : '#1d4ed8';
  const getStroke = (item: PlottedVolcanoItem) => selectedGene === item.gene ? '#0f172a' : 'none';
  const getStrokeWidth = (item: PlottedVolcanoItem) => selectedGene === item.gene ? 2.5 : 0;
  const getOpacity = (item: PlottedVolcanoItem) => selectedGene === item.gene ? 1 : 0.75;

  const handleClick = (entry: ScatterPointItem) => {
    const gene = (entry.payload as PlottedVolcanoItem | undefined)?.gene;
    if (gene) onSelectGene(gene);
  };

  if (nTotal === 0) {
    return (
      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-xs">
        <h3 className="text-sm font-bold text-slate-900">DMR effect–significance plot unavailable</h3>
        <p className="mt-1 text-xs text-slate-500">Nominal DMR P values are not supplied for this result set. FDR values are not substituted, and significance stars are not shown.</p>
      </section>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h3 id="dmr-volcano-title" className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
            <span>DMR effect–significance plot</span>
            <span className="text-xs font-normal text-slate-500">({effectAxisLabel} vs −log₁₀ nominal P)</span>
          </h3>
          <p className="text-xs text-slate-500">Showing {nTotal.toLocaleString()} of {data.length.toLocaleString()} DMRs, ranked by lowest nominal P. Select a point for details.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" /><span className="font-medium text-slate-600">Hyper (Δβ &gt; 0)</span></div>
          <div className="flex items-center space-x-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600" /><span className="font-medium text-slate-600">Hypo (Δβ &lt; 0)</span></div>
          <div className="flex items-center space-x-1.5"><svg width="10" height="10" viewBox="0 0 10 10" className="inline-block"><polygon points="5,0 10,5 5,10 0,5" fill="#d97706" /></svg><span className="font-medium text-slate-600">Mixed ({nMixed})</span></div>
        </div>
      </div>

      <div className="h-80 min-h-72 w-full" role="img" aria-labelledby="dmr-volcano-title" aria-describedby="dmr-volcano-note">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart accessibilityLayer margin={{ top: 10, right: 32, bottom: 28, left: 12 }}>
            <XAxis type="number" dataKey="deltaBeta" name={effectAxisLabel} stroke="#64748b" fontSize={11} tickFormatter={(value: number) => value.toFixed(2)} domain={[-maxAbsoluteDeltaBeta, maxAbsoluteDeltaBeta]} label={{ value: effectAxisLabel, position: 'bottom', offset: 0, fill: '#475569', fontSize: 11 }} />
            <YAxis type="number" dataKey="negLogP" name="−log₁₀ nominal P" stroke="#64748b" fontSize={11} domain={[0, MAX_NEG_LOG_P]} label={{ value: '−log₁₀(nominal P)', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 11 }} />
            <ZAxis type="number" range={[40, 40]} />
            <Tooltip content={VolcanoTooltip} />
            <ReferenceLine x={0} stroke="#cbd5e1" strokeDasharray="3 3" />
            <ReferenceLine y={-Math.log10(0.05)} stroke="#475569" strokeWidth={1.2} strokeDasharray="6 4" label={{ value: '*', position: 'insideRight', fill: '#475569', fontWeight: 700 }} />
            <ReferenceLine y={2} stroke="#7c3aed" strokeWidth={1.2} strokeDasharray="4 4" label={{ value: '**', position: 'insideRight', fill: '#7c3aed', fontWeight: 700 }} />
            <ReferenceLine y={3} stroke="#b45309" strokeWidth={1.2} strokeDasharray="2 3" label={{ value: '***', position: 'insideRight', fill: '#b45309', fontWeight: 700 }} />
            <Scatter data={concordantData} shape="circle" onClick={handleClick}>{concordantData.map((item) => <Cell key={`${item.gene}-${item.chr}`} fill={getColor(item)} stroke={getStroke(item)} strokeWidth={getStrokeWidth(item)} opacity={getOpacity(item)} className="cursor-pointer" />)}</Scatter>
            <Scatter data={mixedData} shape="diamond" onClick={handleClick}>{mixedData.map((item) => <Cell key={`${item.gene}-${item.chr}`} fill={getColor(item)} stroke={getStroke(item)} strokeWidth={getStrokeWidth(item)} opacity={getOpacity(item)} className="cursor-pointer" />)}</Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div id="dmr-volcano-note" className="mt-2 flex flex-wrap items-center justify-center gap-4 border-t border-slate-100 pt-2 text-[10px] text-slate-600">
        <span><strong>*</strong> P &lt; 0.05</span><span><strong>**</strong> P &lt; 0.01</span><span><strong>***</strong> P &lt; 0.001</span><span>Nominal, uncorrected P values</span>
      </div>
      {nMixed > 0 && <p className="mt-2 rounded border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-[10px] text-amber-900"><strong>◆ Mixed:</strong> opposing top-three probe directions can cancel in the mean. Significance stars use nominal P only; the plot does not show confidence intervals.</p>}
      <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">Accessible plotted-data table ({nTotal.toLocaleString()} DMRs)</summary>
        <div className="max-h-80 overflow-auto border-t border-slate-200">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">DMRs plotted by {effectAxisLabel} and nominal P value</caption>
            <thead className="sticky top-0 bg-slate-100 text-slate-600"><tr><th className="px-3 py-2">Gene</th><th className="px-3 py-2">Chromosome</th><th className="px-3 py-2">{effectAxisLabel}</th><th className="px-3 py-2">Direction</th><th className="px-3 py-2">Nominal DMR P</th><th className="px-3 py-2">Stars</th><th className="px-3 py-2"><span className="sr-only">Action</span></th></tr></thead>
            <tbody>{plottedData.map((item) => <tr key={`${item.gene}-${item.chr}`} className="border-t border-slate-200"><td className="px-3 py-2 font-semibold">{item.gene}</td><td className="px-3 py-2 font-mono">{item.chr}</td><td className="px-3 py-2 font-mono">{item.deltaBeta.toFixed(4)}</td><td className="px-3 py-2">{item.direction}</td><td className="px-3 py-2 font-mono">{formatProbability(item.pValue)}</td><td className="px-3 py-2 font-bold">{nominalPStars(item.pValue) || '—'}</td><td className="px-3 py-2"><button type="button" onClick={() => onSelectGene(item.gene)} className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100">Select</button></td></tr>)}</tbody>
          </table>
        </div>
      </details>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">The vertical scale is capped at −log₁₀(P) = 8; exact P values remain in the tooltip and table. Nominal thresholds do not control the high-throughput multiple-testing error rate.</p>
    </div>
  );
};
