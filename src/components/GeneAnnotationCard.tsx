'use client';

import React from 'react';
import { GeneAnnotation } from '../types/annotation';
import { BookOpen, BrainCircuit, ExternalLink, Tag } from 'lucide-react';

interface AnnotationCardProps {
  gene: string;
  annotation: GeneAnnotation | null;
}

export const GeneAnnotationCard: React.FC<AnnotationCardProps> = ({
  gene,
  annotation,
}) => {
  if (!annotation) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-400">
        <p className="italic">Standard genomic annotation available. Literature psychiatric profile pending.</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      {/* Header with Full Name and Category */}
      <div>
        <div className="flex items-center space-x-2">
          <span className="text-lg font-bold text-white tracking-wide">{gene}</span>
          <span className="text-xs text-cyan-400 font-semibold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
            {annotation.category}
          </span>
        </div>
        <h4 className="text-xs font-medium text-slate-300 mt-1 italic">
          {annotation.fullName}
        </h4>
      </div>

      {/* Biological Function Summary */}
      <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg">
        <p className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
          <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
          Biological & Epigenetic Function:
        </p>
        <p className="text-slate-400">{annotation.summary}</p>
      </div>

      {/* Psychological / Psychiatric Disorders */}
      <div>
        <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Tag className="w-3 h-3 text-amber-400" />
          Associated Psychiatric & Psychological Disorders:
        </h5>
        <div className="flex flex-wrap gap-1.5">
          {annotation.psychDisorders.map((disorder, idx) => (
            <span
              key={idx}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${
                disorder.includes('PTSD')
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 shadow-sm'
                  : disorder.includes('Depress')
                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                  : disorder.includes('Substance') || disorder.includes('Tobacco')
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
              }`}
            >
              {disorder}
            </span>
          ))}
        </div>
      </div>

      {/* PubMed Literature References */}
      {annotation.references && annotation.references.length > 0 && (
        <div className="border-t border-slate-800/80 pt-3">
          <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <BookOpen className="w-3 h-3 text-cyan-400" />
            Key PubMed Literature References:
          </h5>
          <ul className="space-y-1.5">
            {annotation.references.map((ref, idx) => (
              <li key={idx} className="text-xs flex items-center justify-between text-slate-300 bg-slate-950/40 px-3 py-1.5 rounded border border-slate-800/50">
                <span className="font-medium">{ref.citation}</span>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 hover:underline"
                >
                  PMID: {ref.pmid} <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
