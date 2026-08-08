import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
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

// Custom diamond shape for Mixed genes
const DiamondShape = (props: any) => {
  const { cx, cy, fill, stroke, strokeWidth, opacity } = props;
  const s = 5; // diamond half-size
  return (
    <polygon
      points={`${cx},${cy - s} ${cx + s},${cy} ${cx},${cy + s} ${cx - s},${cy}`}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
      style={{ cursor: 'pointer' }}
    />
  );
};

// Custom circle shape for concordant genes
const CircleShape = (props: any) => {
  const { cx, cy, fill, stroke, strokeWidth, opacity } = props;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
      style={{ cursor: 'pointer' }}
    />
  );
};

export const DmrVolcanoPlot: React.FC<VolcanoProps> = ({
  data,
  onSelectGene,
  selectedGene,
}) => {
  // Split data into concordant (circle) and mixed (diamond) groups
  const { concordantData, mixedData } = React.useMemo(() => {
    const sorted = [...data].sort((a, b) => b.negLogFdr - a.negLogFdr).slice(0, 500);
    return {
      concordantData: sorted.filter((d) => d.direction !== 'Mixed'),
      mixedData: sorted.filter((d) => d.direction === 'Mixed'),
    };
  }, [data]);

  const nMixed = mixedData.length;
  const nTotal = concordantData.length + mixedData.length;

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
            <span className="text-slate-500">{item.direction === 'Mixed' ? 'Avg Δβ (cancellation):' : 'Avg Δβ (Top-3):'}</span>
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
          {item.direction === 'Mixed' && (
            <div className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
              ⚠ Top-3 probes have opposing directions. X position reflects cancellation — actual CpG effects are larger. Click to see split in bar chart.
            </div>
          )}
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

  const getColor = (item: VolcanoItem) => {
    if (item.direction === 'Mixed') return '#d97706';
    return item.deltaBeta > 0 ? '#dc2626' : '#2563eb';
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

  const handleClick = (entry: any) => {
    const gene = entry?.payload?.gene ?? entry?.gene;
    if (gene) onSelectGene(gene);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>DMR Volcano Plot</span>
            <span className="text-xs font-normal text-slate-500">
              (Top-3 Avg Δβ vs -log₁₀ FDR)
            </span>
          </h3>
          <p className="text-xs text-slate-500">
            {nTotal} DMRs shown. Click a point to inspect probe details.
          </p>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span>
            <span className="text-slate-600 font-medium">Hyper</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
            <span className="text-slate-600 font-medium">Hypo</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <svg width="10" height="10" viewBox="0 0 10 10" className="inline-block">
              <polygon points="5,0 10,5 5,10 0,5" fill="#d97706" />
            </svg>
            <span className="text-slate-600 font-medium">Mixed ({nMixed})</span>
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
              tickFormatter={(v: number) => v.toFixed(2)}
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
            <ZAxis type="number" range={[40, 40]} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={0} stroke="#cbd5e1" strokeDasharray="3 3" />
            <ReferenceLine y={-Math.log10(0.05)} stroke="#ef4444" strokeDasharray="3 3" />

            {/* Concordant genes — circles */}
            <Scatter
              data={concordantData}
              shape={(props: any) => {
                const item = props.payload;
                return (
                  <CircleShape
                    {...props}
                    fill={getColor(item)}
                    stroke={getStroke(item)}
                    strokeWidth={getStrokeWidth(item)}
                    opacity={getOpacity(item)}
                  />
                );
              }}
              onClick={handleClick}
            />

            {/* Mixed genes — diamonds */}
            <Scatter
              data={mixedData}
              shape={(props: any) => {
                const item = props.payload;
                return (
                  <DiamondShape
                    {...props}
                    fill={getColor(item)}
                    stroke={getStroke(item)}
                    strokeWidth={getStrokeWidth(item)}
                    opacity={getOpacity(item)}
                  />
                );
              }}
              onClick={handleClick}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Footnote about Mixed */}
      {nMixed > 0 && (
        <p className="text-[10px] text-amber-700 bg-amber-50/60 border border-amber-200 rounded px-3 py-1.5 mt-2">
          <strong>◆ Diamond = Mixed:</strong> Top-3 probes have opposing CpG directions. X position reflects cancellation — actual per-direction effects are larger. See bar chart for split.
        </p>
      )}
    </div>
  );
};
