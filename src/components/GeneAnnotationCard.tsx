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
      <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-500 shadow-xs">
        <p className="italic">Standard genomic annotation available. Literature psychiatric profile pending.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      {/* Header with Full Name and Category */}
      <div>
        <div className="flex items-center space-x-2.5">
          <span className="text-xl font-extrabold text-slate-900 tracking-tight">{gene}</span>
          <span className="text-xs text-slate-700 font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-300">
            {annotation.category}
          </span>
        </div>
        <h4 className="text-xs font-semibold text-slate-600 mt-1 italic">
          {annotation.fullName}
        </h4>
      </div>

      {/* Biological Function Summary */}
      <div className="text-xs text-slate-800 leading-relaxed bg-slate-50 border border-slate-200 p-3.5 rounded-lg">
        <p className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
          <BrainCircuit className="w-4 h-4 text-slate-700" />
          Biological & Epigenetic Function:
        </p>
        <p className="text-slate-700 leading-normal">{annotation.summary}</p>
      </div>

      {/* Psychological / Psychiatric Disorders */}
      <div>
        <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-amber-600" />
          Associated Psychiatric & Psychological Disorders:
        </h5>
        <div className="flex flex-wrap gap-1.5">
          {annotation.psychDisorders.map((disorder, idx) => (
            <span
              key={idx}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${
                disorder.includes('PTSD')
                  ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-xs'
                  : disorder.includes('Depress')
                  ? 'bg-blue-50 text-blue-900 border-blue-200'
                  : disorder.includes('Substance') || disorder.includes('Tobacco')
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-purple-50 text-purple-900 border-purple-200'
              }`}
            >
              {disorder}
            </span>
          ))}
        </div>
      </div>

      {/* PubMed Literature & Database References */}
      {annotation.references && annotation.references.length > 0 && (() => {
        const peerReviewedRefs = annotation.references.filter((r) => /^\d+$/.test(r.pmid));
        return (
          <div className="border-t border-slate-100 pt-3 space-y-2">
            {peerReviewedRefs.length > 0 && (
              <div>
                <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-700" />
                  Key Peer-Reviewed PubMed Literature:
                </h5>
                <ul className="space-y-1.5">
                  {peerReviewedRefs.map((ref, idx) => (
                    <li key={idx} className="text-xs flex items-center justify-between text-slate-800 bg-slate-50 px-3 py-1.5 rounded border border-slate-200">
                      <span className="font-semibold text-slate-900">{ref.citation}</span>
                      <a
                        href={`https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] font-mono text-blue-700 hover:text-blue-900 hover:underline font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                      >
                        PMID: {ref.pmid} <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Database & External Resources */}
            <div className="flex items-center gap-2 pt-1">
              <a
                href={`https://www.genecards.org/cgi-bin/carddisp.pl?gene=${gene}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded border border-slate-300 transition"
              >
                GeneCards Profile <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={`https://pubmed.ncbi.nlm.nih.gov/?term=${gene}+methylation+PTSD`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[11px] font-bold text-blue-800 hover:text-blue-950 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded border border-blue-200 transition"
              >
                NCBI PubMed Query <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
