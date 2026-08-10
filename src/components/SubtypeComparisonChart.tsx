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
  deltaBeta: number;
  fdr: number;
  direction: Direction;
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

function toDatum(subtype: SubtypeKey, stat: SubtypeStat): Omit<ComparisonDatum, 'domainMax'> {
  return {
    subtype,
    deltaBeta: stat.deltaBeta,
    fdr: stat.fdr,
    direction: stat.direction,
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
  const opacity = 0.95;
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
        {positiveHeight > 0 && <rect x={x} y={positiveY} width={width} height={positiveHeight} fill="#b91c1c" rx={3} opacity={opacity} />}
        {negativeHeight > 0 && <rect x={x} y={zeroY} width={width} height={negativeHeight} fill="#1d4ed8" rx={3} opacity={opacity} />}
        {payload.nPositive > 0 && positiveHeight > 0 && <text x={x + width / 2} y={positiveY - 4} textAnchor="middle" fill="#991b1b" fontSize={10} fontWeight={700}>↑{payload.nPositive}</text>}
        {payload.nNegative > 0 && negativeHeight > 0 && <text x={x + width / 2} y={negativeY + 13} textAnchor="middle" fill="#1e40af" fontSize={10} fontWeight={700}>↓{payload.nNegative}</text>}
      </g>
    );
  }

  const valueY = toY(payload.deltaBeta);
  const barY = payload.deltaBeta >= 0 ? valueY : zeroY;
  const barHeight = Math.max(1, Math.abs(zeroY - valueY));
  const fill = payload.direction === 'Hypermethylated' ? '#b91c1c' : payload.direction === 'Hypomethylated' ? '#1d4ed8' : '#b45309';
  return (
    <g>
      <rect x={x} y={barY} width={width} height={barHeight} fill={fill} rx={3} opacity={opacity} />
    </g>
  );
}

export const SubtypeComparisonChart: React.FC<ComparisonProps> = ({ geneData }) => {
  const chartData = useMemo(() => {
    if (!geneData) return [];
    const raw = geneData.kind === 'cross-subtype'
      ? SUBTYPE_KEYS.map((subtype) => toDatum(subtype, geneData.result.subtypes[subtype]))
      : [toDatum(geneData.subtype, geneData.result)];
    const values = raw.flatMap((datum) => [datum.deltaBeta, datum.avgPositiveDeltaBeta ?? 0, datum.avgNegativeDeltaBeta ?? 0]);
    const domainMax = Math.max(...values.map(Math.abs), 0.02) * 1.55;
    return raw.map((datum) => ({ ...datum, domainMax }));
  }, [geneData]);

  if (!geneData) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex min-h-[280px] h-full items-center justify-center text-center">
        <p className="max-w-md text-xs text-slate-500">Select a DMR to view its observed top-three-probe methylation summary. Subtype-unique results show only the selected subtype; unavailable subtypes are not replaced with zeros.</p>
      </div>
    );
  }

  const result = geneData.result;
  const isCrossSubtype = geneData.kind === 'cross-subtype';
  const summaryP = isCrossSubtype ? geneData.result.crossP : null;
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
              {isCrossSubtype ? `Cross-subtype (${geneData.result.nSubtypesSig}/4 called significant upstream)` : `${geneData.subtype} subtype-unique`}
            </span>
            {result.isPtsd && <span className="rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">Curated PTSD-related list</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">Mean of the three probes selected by the DMR pipeline | {result.chr} | {result.totalProbes} probes tested in the DMR analysis</p>
        </div>
        <div className="sm:text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Cross-subtype nominal P</div>
          {summaryP == null
            ? <div className="text-xs font-semibold text-slate-500">Unavailable · no stars</div>
            : <div className="font-mono text-sm font-bold text-slate-900">{formatProbability(summaryP)} <span aria-label={`${summaryStars.length} significance stars`}>{summaryStars}</span></div>}
        </div>
      </div>

      <div className="h-72 w-full" role="img" aria-label={`${result.gene} methylation difference chart. ${isCrossSubtype ? 'Four observed subtype estimates are shown.' : `Only the observed ${geneData.subtype} subtype-unique estimate is shown.`}`}>
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
        {summaryP != null && <><span><strong>*</strong> P &lt; 0.05</span><span><strong>**</strong> P &lt; 0.01</span><span><strong>***</strong> P &lt; 0.001</span></>}
      </div>

      <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">Accessible data table</summary>
        <div className="overflow-x-auto border-t border-slate-200">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Observed subtype estimates for {result.gene}</caption>
            <thead className="bg-slate-100 text-slate-600"><tr><th className="px-3 py-2">Subtype</th><th className="px-3 py-2">Mean top-three Δβ</th><th className="px-3 py-2">Direction</th><th className="px-3 py-2">Reported DMR FDR</th></tr></thead>
            <tbody>{chartData.map((datum) => <tr key={datum.subtype} className="border-t border-slate-200"><td className="px-3 py-2 font-semibold">{datum.subtype}</td><td className="px-3 py-2 font-mono">{datum.deltaBeta.toFixed(4)}</td><td className="px-3 py-2">{datum.direction}</td><td className="px-3 py-2 font-mono">{formatProbability(datum.fdr)}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Δβ is a methylation-proportion difference, not a fold change. Significance stars use the cross-subtype nominal P only. Subtype-level and subtype-unique nominal P values are not supplied, so no per-bar stars are shown; reported FDR remains available in the data table but is not used as a display threshold. No confidence intervals or standard errors are available.</p>
    </section>
  );
};
