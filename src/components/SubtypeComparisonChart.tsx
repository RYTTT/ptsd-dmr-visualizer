import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { nominalPStars } from '../lib/scientificData';
import {
  SUBTYPE_KEYS,
  type Direction,
  type SelectedPtsdResult,
  type SubtypeKey,
  type SubtypeStat,
} from '../types/dmr';

interface ComparisonProps {
  geneData: SelectedPtsdResult | null;
}

interface ComparisonDatum {
  subtype: SubtypeKey;
  pValue: number;
  deltaBeta: number;
  fdr: number;
  direction: Direction;
  nSigProbes: number;
  selected: boolean;
  avgPositiveDeltaBeta: number | null;
  avgNegativeDeltaBeta: number | null;
  nPositive: number;
  nNegative: number;
  domainMax: number;
}

interface CustomBarShapeProps {
  x?: number;
  width?: number;
  payload?: ComparisonDatum;
  background?: { y?: number; height?: number };
}

function formatProbability(value: number): string {
  if (value === 0) return '0 (below numeric precision)';
  return value < 0.001 ? value.toExponential(2) : value.toFixed(3);
}

function toDatum(subtype: SubtypeKey, stat: SubtypeStat, selected: boolean): Omit<ComparisonDatum, 'domainMax'> {
  return {
    subtype,
    pValue: stat.pValue,
    deltaBeta: stat.deltaBeta,
    fdr: stat.fdr,
    direction: stat.direction,
    nSigProbes: stat.nSigProbes,
    selected,
    avgPositiveDeltaBeta: stat.avgPosLogFC ?? null,
    avgNegativeDeltaBeta: stat.avgNegLogFC ?? null,
    nPositive: stat.nPosTop3 ?? 0,
    nNegative: stat.nNegTop3 ?? 0,
  };
}

function DirectionBar(props: CustomBarShapeProps) {
  const { x, width, payload, background } = props;
  if (x == null || width == null || !payload || background?.y == null || background.height == null) return null;

  const plotTop = background.y;
  const plotHeight = background.height;
  const zeroY = plotTop + plotHeight / 2;
  const toY = (value: number) => zeroY - value * (plotHeight / (2 * payload.domainMax));
  const opacity = payload.selected ? 1 : 0.72;
  const stroke = payload.selected ? '#0f172a' : 'none';
  const strokeWidth = payload.selected ? 2 : 0;
  const stars = nominalPStars(payload.pValue);
  const canSplitMixed =
    payload.direction === 'Mixed' &&
    payload.avgPositiveDeltaBeta != null &&
    payload.avgNegativeDeltaBeta != null;

  if (canSplitMixed) {
    const positiveY = toY(payload.avgPositiveDeltaBeta!);
    const negativeY = toY(payload.avgNegativeDeltaBeta!);
    const positiveHeight = Math.max(0, zeroY - positiveY);
    const negativeHeight = Math.max(0, negativeY - zeroY);
    return (
      <g>
        {positiveHeight > 0 && <rect x={x} y={positiveY} width={width} height={positiveHeight} fill="#b91c1c" stroke={stroke} strokeWidth={strokeWidth} rx={3} opacity={opacity} />}
        {negativeHeight > 0 && <rect x={x} y={zeroY} width={width} height={negativeHeight} fill="#1d4ed8" stroke={stroke} strokeWidth={strokeWidth} rx={3} opacity={opacity} />}
        {payload.nPositive > 0 && positiveHeight > 0 && <text x={x + width / 2} y={positiveY - 4} textAnchor="middle" fill="#991b1b" fontSize={10} fontWeight={700}>↑{payload.nPositive}</text>}
        {payload.nNegative > 0 && negativeHeight > 0 && <text x={x + width / 2} y={negativeY + 13} textAnchor="middle" fill="#1e40af" fontSize={10} fontWeight={700}>↓{payload.nNegative}</text>}
        {stars && <text x={x + width / 2} y={plotTop + 11} textAnchor="middle" fill="#0f172a" fontSize={11} fontWeight={800}>{stars}</text>}
      </g>
    );
  }

  const valueY = toY(payload.deltaBeta);
  const barY = payload.deltaBeta >= 0 ? valueY : zeroY;
  const barHeight = Math.max(1, Math.abs(zeroY - valueY));
  const fill = payload.direction === 'Hypermethylated' ? '#b91c1c' : payload.direction === 'Hypomethylated' ? '#1d4ed8' : '#b45309';
  return (
    <g>
      <rect x={x} y={barY} width={width} height={barHeight} fill={fill} stroke={stroke} strokeWidth={strokeWidth} rx={3} opacity={opacity} />
      {stars && <text x={x + width / 2} y={plotTop + 11} textAnchor="middle" fill="#0f172a" fontSize={11} fontWeight={800}>{stars}</text>}
    </g>
  );
}

export const SubtypeComparisonChart: React.FC<ComparisonProps> = ({ geneData }) => {
  const chartData = useMemo(() => {
    if (!geneData) return [];
    const selectedSubtype = geneData.kind === 'subtype-unique' ? geneData.subtype : null;
    const raw = SUBTYPE_KEYS.map((subtype) => toDatum(
      subtype,
      geneData.result.subtypes[subtype],
      subtype === selectedSubtype,
    ));
    const values = raw.flatMap((datum) => [datum.deltaBeta, datum.avgPositiveDeltaBeta ?? 0, datum.avgNegativeDeltaBeta ?? 0]);
    const domainMax = Math.max(...values.map(Math.abs), 0.02) * 1.55;
    return raw.map((datum) => ({ ...datum, domainMax }));
  }, [geneData]);

  if (!geneData) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex min-h-[280px] h-full items-center justify-center text-center">
        <p className="max-w-md text-xs text-slate-500">Select a DMR to compare the four observed subtype results.</p>
      </div>
    );
  }

  const result = geneData.result;
  const isCrossSubtype = geneData.kind === 'cross-subtype';
  const summaryP = isCrossSubtype ? geneData.result.crossP : geneData.result.pValue;
  const summaryStars = nominalPStars(summaryP);
  const domainMax = chartData[0]?.domainMax ?? 0.1;
  const hasMixed = chartData.some((datum) => datum.direction === 'Mixed');
  const titleId = `subtype-comparison-${result.gene.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" aria-labelledby={titleId}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={titleId} className="text-base font-bold text-slate-900">{result.gene}</h3>
            <span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {isCrossSubtype ? `Passes the adjusted threshold in ${geneData.result.nSubtypesSig}/4 subtypes` : `${geneData.subtype}-selected gene`}
            </span>
            {result.isPtsd && <span className="rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">Curated PTSD-related list</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">Mean of up to three probes selected by the DMR pipeline | {result.chr} | {result.totalProbes} probes tested in the DMR analysis</p>
        </div>
        <div className="sm:text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{isCrossSubtype ? 'Combined P across four subtypes' : `${geneData.subtype} nominal P`}</div>
          <div className="font-mono text-sm font-bold text-slate-900">{formatProbability(summaryP)} <span aria-label={`${summaryStars.length} significance stars`}>{summaryStars}</span></div>
        </div>
      </div>

      <div className="h-72 w-full" role="img" aria-label={`${result.gene} methylation difference chart with observed SSS, ADS, ICF, and ISS estimates.${isCrossSubtype ? '' : ` ${geneData.subtype} is the only subtype that passes the source FDR cutoff.`}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart accessibilityLayer data={chartData} margin={{ top: 20, right: 20, bottom: 28, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="subtype" stroke="#64748b" fontSize={11} label={{ value: 'PTSD subtype', position: 'bottom', offset: 4, fill: '#475569', fontSize: 11 }} />
            <YAxis stroke="#64748b" fontSize={11} domain={[-domainMax, domainMax]} tickFormatter={(value: number) => value.toFixed(2)} label={{ value: 'Mean top-three Δβ', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 11 }} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const datum = payload[0].payload as ComparisonDatum;
              return (
                <div className="min-w-[220px] space-y-1.5 rounded-xl border border-slate-300 bg-white p-3 text-xs shadow-xl">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1">
                    <strong className="text-sm text-slate-900">{datum.subtype} subtype</strong>
                    <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-800">{datum.direction}</span>
                  </div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Mean top-three Δβ</span><span className="font-mono font-bold">{datum.deltaBeta > 0 ? '+' : ''}{datum.deltaBeta.toFixed(4)}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Nominal P</span><span className="font-mono font-bold">{formatProbability(datum.pValue)} {nominalPStars(datum.pValue) || 'P ≥ 0.05'}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Reported FDR</span><span className="font-mono">{formatProbability(datum.fdr)}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-slate-500">Probes with P &lt; 0.05</span><span className="font-mono">{datum.nSigProbes}</span></div>
                  {datum.direction === 'Mixed' && datum.avgPositiveDeltaBeta != null && datum.avgNegativeDeltaBeta != null && (
                    <div className="space-y-1 rounded border border-amber-200 bg-amber-50 p-2 text-[11px]">
                      <div className="flex justify-between gap-3"><span>Positive probes ({datum.nPositive})</span><span className="font-mono font-bold text-red-800">+{datum.avgPositiveDeltaBeta.toFixed(4)}</span></div>
                      <div className="flex justify-between gap-3"><span>Negative probes ({datum.nNegative})</span><span className="font-mono font-bold text-blue-800">{datum.avgNegativeDeltaBeta.toFixed(4)}</span></div>
                      <p className="text-amber-900">Mixed is assigned from opposing directions among the selected probes; the signed mean does not override that classification.</p>
                    </div>
                  )}
                </div>
              );
            }} />
            <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
            <Bar dataKey="deltaBeta" shape={<DirectionBar />} background={{ fill: 'transparent' }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 border-t border-slate-100 pt-2 text-[10px] text-slate-600">
        <span><span className="mr-1 inline-block h-2.5 w-3 rounded-sm bg-red-700" />Higher methylation</span>
        <span><span className="mr-1 inline-block h-2.5 w-3 rounded-sm bg-blue-700" />Lower methylation</span>
        {hasMixed && <span><span className="mr-1 inline-block h-2.5 w-3 rounded-sm bg-amber-700" />Mixed/opposing selected probes</span>}
        <span><strong>*</strong> P &lt; 0.05</span><span><strong>**</strong> P &lt; 0.01</span><span><strong>***</strong> P &lt; 0.001</span><span>No star: P ≥ 0.05</span>
        {!isCrossSubtype && <span className="font-semibold text-slate-800">Outlined bar: the only subtype passing FDR &lt; 0.05</span>}
      </div>

      <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">Accessible data table</summary>
        <div className="overflow-x-auto border-t border-slate-200">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Observed subtype estimates for {result.gene}</caption>
            <thead className="bg-slate-100 text-slate-600"><tr><th className="px-3 py-2">Subtype</th><th className="px-3 py-2">Mean top-three Δβ</th><th className="px-3 py-2">Direction</th><th className="px-3 py-2">Nominal P</th><th className="px-3 py-2">Reported FDR</th><th className="px-3 py-2">Probes P&lt;.05</th></tr></thead>
            <tbody>{chartData.map((datum) => <tr key={datum.subtype} className={`border-t border-slate-200 ${datum.selected ? 'bg-slate-100 font-semibold' : ''}`}><td className="px-3 py-2">{datum.subtype}{datum.selected ? ' · selected' : ''}</td><td className="px-3 py-2 font-mono">{datum.deltaBeta.toFixed(4)}</td><td className="px-3 py-2">{datum.direction}</td><td className="px-3 py-2 font-mono">{formatProbability(datum.pValue)} {nominalPStars(datum.pValue)}</td><td className="px-3 py-2 font-mono">{formatProbability(datum.fdr)}</td><td className="px-3 py-2 font-mono">{datum.nSigProbes}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">All four bars are observed subtype summaries; none are placeholders. Stars use each subtype’s nominal P. The combined P is shown separately and must not be read as the significance of every bar. For a subtype-selected gene, only the outlined subtype met the source FDR &lt; 0.05 rule; a star in another subtype does not mean that subtype passed the adjusted threshold. No confidence intervals or standard errors are available.</p>
    </section>
  );
};
