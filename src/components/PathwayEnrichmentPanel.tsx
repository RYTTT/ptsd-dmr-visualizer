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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    fetch('/data/common/pathwayEnrichment.json')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  const getCount = (entry: PathwayEntry) => {
    if (activeTab === 'cross') return entry.crossSubtype.count;
    return entry.subtypes[activeTab]?.count ?? 0;
  };

  const getGenes = (entry: PathwayEntry) => {
    if (activeTab === 'cross') return entry.crossSubtype.genes;
    return entry.subtypes[activeTab]?.genes ?? [];
  };

  const sortedData = [...data].sort((a, b) => getCount(b) - getCount(a));
  const maxCount = Math.max(...sortedData.map(getCount), 1);
  const color = activeTab === 'cross' ? '#0f172a' : SUBTYPE_COLORS[activeTab] ?? '#0f172a';

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden mb-6">
      {/* Header */}
      <button
        onClick={() => setVisible((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition text-left"
      >
        <div className="flex items-center gap-2">
          <Dna className="w-4 h-4 text-slate-700" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Pathway Coverage Analysis
          </h3>
          <span className="text-[10px] text-slate-500 font-medium">
            — DMR genes overlapping key PTSD-relevant gene sets
          </span>
        </div>
        {visible ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {visible && (
        <div className="p-4 space-y-2.5">
          {sortedData.map((entry) => {
            const count = getCount(entry);
            const genes = getGenes(entry);
            const pct = Math.round((count / entry.geneSetSize) * 100);
            const barWidth = Math.round((count / maxCount) * 100);
            const isExpanded = expanded === entry.pathway;

            return (
              <div key={entry.pathway} className="group">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : entry.pathway)}
                >
                  {/* Pathway label */}
                  <div className="w-52 shrink-0">
                    <span className="text-[11px] font-semibold text-slate-700 group-hover:text-slate-900 transition">
                      {entry.pathway}
                    </span>
                  </div>

                  {/* Bar */}
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden relative">
                      <div
                        className="h-full rounded transition-all duration-500"
                        style={{ width: `${barWidth}%`, backgroundColor: color, opacity: 0.85 }}
                      />
                      {count > 0 && (
                        <span className="absolute left-2 top-0 h-full flex items-center text-[10px] font-bold text-white leading-none">
                          {count} genes
                        </span>
                      )}
                    </div>
                    <div className="w-20 shrink-0 text-right">
                      <span className="text-[11px] font-mono text-slate-500">
                        {pct}% of {entry.geneSetSize}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </div>
                </div>

                {/* Expanded gene chips */}
                {isExpanded && genes.length > 0 && (
                  <div className="mt-2 ml-[13.5rem] flex flex-wrap gap-1.5 pb-1">
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
                    {count === 0 && (
                      <span className="text-[11px] text-slate-400 italic">No overlap with current filter</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
            Gene set membership based on curated PTSD-relevant pathway annotations. Click a gene chip to load its genomic track.
          </p>
        </div>
      )}
    </div>
  );
};
