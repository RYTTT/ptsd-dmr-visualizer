'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Dna } from 'lucide-react';

interface SubtypeOverlap {
  count: number;
  genes: string[];
  pct: number;
}

interface PathwayEntry {
  pathway: string;
  geneSetSize: number;
  crossSubtype: SubtypeOverlap;
  subtypes: Record<string, SubtypeOverlap>;
}

interface Props {
  activeTab: string;
  onSelectGene: (gene: string) => void;
}

const SUBTYPE_COLORS: Record<string, string> = {
  cross: '#0f172a',
  SSS: '#e11d48',
  ADS: '#2563eb',
  ICF: '#7c3aed',
  ISS: '#059669',
};

export const PathwayEnrichmentPanel: React.FC<Props> = ({ activeTab, onSelectGene }) => {
  const [data, setData] = useState<PathwayEntry[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    fetch('/data/common/pathwayEnrichment.json')
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load curated gene-set coverage');
        return response.json() as Promise<PathwayEntry[]>;
      })
      .then((entries) => { setData(entries); setStatus('ready'); })
      .catch(() => { setData(null); setStatus('error'); });
  }, []);

  if (status === 'loading') return <div role="status" className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-xs">Loading curated gene-set coverage…</div>;
  if (status === 'error' || !data) return <div role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 shadow-xs">Curated gene-set coverage could not be loaded. Statistical DMR results remain available.</div>;

  const getCount = (entry: PathwayEntry) => {
    if (activeTab === 'cross') return entry.crossSubtype.count;
    return entry.subtypes[activeTab]?.count ?? 0;
  };

  const getGenes = (entry: PathwayEntry) => {
    if (activeTab === 'cross') return entry.crossSubtype.genes;
    return entry.subtypes[activeTab]?.genes ?? [];
  };

  const getPct = (entry: PathwayEntry) => {
    const overlap = activeTab === 'cross' ? entry.crossSubtype : entry.subtypes[activeTab];
    if (!overlap || entry.geneSetSize <= 0) return 0;
    return (overlap.count / entry.geneSetSize) * 100;
  };

  const sortedData = [...data].sort((a, b) => getPct(b) - getPct(a));
  const color = activeTab === 'cross' ? '#0f172a' : SUBTYPE_COLORS[activeTab] ?? '#0f172a';

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden mb-6">
      {/* Header */}
      <button
        onClick={() => setVisible((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition text-left"
        aria-expanded={visible}
      >
        <div className="flex items-center gap-2">
          <Dna className="w-4 h-4 text-slate-700" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Curated gene-set coverage
          </h3>
          <span className="text-[10px] text-slate-500 font-medium">
            — descriptive overlap, not enrichment testing
          </span>
        </div>
        {visible ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {visible && (
        <div className="p-4 space-y-2.5">
          {sortedData.length === 0 && <p className="py-4 text-center text-xs text-slate-500">No curated gene sets are available.</p>}
          {sortedData.map((entry) => {
            const count = getCount(entry);
            const genes = getGenes(entry);
            const pct = getPct(entry);
            const isExpanded = expanded === entry.pathway;

            return (
              <div key={entry.pathway} className="group border-b border-slate-100 last:border-0 pb-2.5 last:pb-0">
                <button
                  type="button"
                  className="grid w-full grid-cols-1 items-center gap-2 text-left sm:grid-cols-[minmax(10rem,13rem)_minmax(0,1fr)_5.5rem_1rem]"
                  onClick={() => setExpanded(isExpanded ? null : entry.pathway)}
                  aria-expanded={isExpanded}
                  aria-controls={`pathway-${entry.pathway.replace(/[^a-zA-Z0-9]/g, '-')}`}
                >
                  {/* Pathway label */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-700 group-hover:text-slate-900 transition">
                      {entry.pathway}
                    </span>
                  </div>

                  {/* Bar */}
                  <div className="h-3.5 w-full overflow-hidden rounded bg-slate-100" aria-hidden="true">
                      <div
                        className="h-full rounded transition-all duration-500"
                        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color, opacity: 0.85 }}
                      />
                  </div>
                    <span className="text-[11px] font-mono text-slate-600 sm:text-right">
                      {count}/{entry.geneSetSize} ({pct.toFixed(1)}%)
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                </button>

                {/* Expanded gene chips */}
                {isExpanded && (
                  <div id={`pathway-${entry.pathway.replace(/[^a-zA-Z0-9]/g, '-')}`} className="mt-2 flex flex-wrap gap-1.5 pb-1 sm:ml-[13.5rem]">
                    {genes.map((gene) => (
                      <button
                        key={gene}
                        onClick={(e) => { e.stopPropagation(); onSelectGene(gene); }}
                        className="px-2 py-0.5 text-[10px] font-bold rounded border transition hover:shadow-sm"
                        style={{
                          backgroundColor: color + '15',
                          color,
                          borderColor: color + '40',
                        }}
                      >
                        {gene}
                      </button>
                    ))}
                    {genes.length === 0 && (
                      <span className="text-[11px] text-slate-400 italic">No genes from this curated set occur in the active result group</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
            Denominators are curated gene-set sizes; percentages are directly comparable because every bar uses a fixed 0–100% scale. No background universe, odds ratio, confidence interval, or enrichment P value is provided, so these overlaps must not be interpreted as pathway enrichment.
          </p>
        </div>
      )}
    </div>
  );
};
