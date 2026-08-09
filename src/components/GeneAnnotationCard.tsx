'use client';

import React, { useEffect, useState } from 'react';
import type { CrossProjectInfo, GeneAnnotation } from '../types/annotation';
import { getGeneMetadata } from '@/lib/commonDatabase';
import { BookOpen, BrainCircuit, ExternalLink, Tag, ArrowRight, FlaskConical, Shield } from 'lucide-react';

interface AnnotationCardProps {
  gene: string;
  annotation: GeneAnnotation | null;
  /** Which project context we're in — affects cross-project bridge direction */
  project?: 'ptsd' | 'mdma';
}

export const GeneAnnotationCard: React.FC<AnnotationCardProps> = ({
  gene,
  annotation,
  project = 'ptsd',
}) => {
  const [crossInfo, setCrossInfo] = useState<CrossProjectInfo | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getGeneMetadata(gene)
      .then((metadata) => { if (!cancelled) setCrossInfo(metadata.crossProject); })
      .catch(() => { if (!cancelled) setCrossInfo(null); });
    return () => { cancelled = true; };
  }, [gene]);

  const crossLinkHref = project === 'ptsd' ? '/mdma' : '/ptsd';
  const crossLinkLabel = project === 'ptsd' ? 'Treatment Response Atlas' : 'PTSD DMR Atlas';
  const crossLinkIcon = project === 'ptsd' ? FlaskConical : Shield;
  const CrossIcon = crossLinkIcon;

  const crossFdr = crossInfo ? (project === 'ptsd' ? crossInfo.mdma.fdr : crossInfo.ptsd.fdr) : null;
  const crossDirection = crossInfo ? (project === 'ptsd' ? crossInfo.mdma.direction : crossInfo.ptsd.direction) : null;

  if (!annotation) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-500 shadow-xs space-y-3">
        <p className="italic">No curated biological or psychiatric literature annotation is available for this gene. Use the statistical and probe views for project-specific evidence.</p>
        {crossInfo && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
            <CrossIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-emerald-800 font-semibold text-[11px]">
              Stored overlap in {crossLinkLabel} (FDR {crossFdr! < 1e-15 ? '< 1×10⁻¹⁵' : crossFdr!.toExponential(2)}; summary direction: {crossDirection})
            </span>
            <a href={crossLinkHref} className="ml-auto text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 text-[11px] font-bold whitespace-nowrap">
              View <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        )}
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

      {/* Cross-Project Bridge Banner */}
      {crossInfo && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
          <div className="p-1.5 rounded-md bg-emerald-100 text-emerald-700 shrink-0">
            <CrossIcon className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-0.5">Cross-project statistical overlap</div>
            <div className="text-xs text-emerald-900 font-medium">
              Stored significant record in {crossLinkLabel}
              <span className="ml-2 font-mono text-emerald-700">
                FDR {crossFdr! < 1e-15 ? '< 1e-15' : crossFdr!.toExponential(2)}
              </span>
              <span className={`ml-2 px-1.5 py-0.5 text-[10px] rounded font-bold ${
                crossDirection === 'Hypermethylated' ? 'bg-red-100 text-red-700' :
                crossDirection === 'Hypomethylated' ? 'bg-blue-100 text-blue-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {crossDirection}
              </span>
            </div>
          </div>
          <a
            href={crossLinkHref}
            className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1.5 rounded-lg border border-emerald-300 transition whitespace-nowrap"
          >
            View <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      )}

      {crossInfo && <p className="-mt-2 text-[10px] leading-relaxed text-slate-500">Cross-project badges reproduce the stored project-level summary. “Mixed” denotes opposing selected-probe directions; overlap does not establish replication, mediation, or causality.</p>}

      {/* Biological Function Summary */}
      <div className="text-xs text-slate-800 leading-relaxed bg-slate-50 border border-slate-200 p-3.5 rounded-lg">
        <p className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
          <BrainCircuit className="w-4 h-4 text-slate-700" />
          Curated biological context
        </p>
        <p className="text-slate-700 leading-normal">{annotation.summary}</p>
      </div>

      {/* Psychological / Psychiatric Disorders */}
      <div>
        <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-amber-600" />
          Reported psychiatric literature associations
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
                  Curated PubMed references
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
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href={`https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=${gene}&highlight=`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded border border-amber-200 transition"
              >
                UCSC Genome Browser <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={`https://www.ewascatalog.org/search?query=${gene}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded border border-emerald-200 transition"
              >
                EWAS Catalog <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={`https://www.genecards.org/cgi-bin/carddisp.pl?gene=${gene}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded border border-slate-300 transition"
              >
                GeneCards <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={`https://pubmed.ncbi.nlm.nih.gov/?term=${gene}+methylation+PTSD`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[11px] font-bold text-blue-800 hover:text-blue-950 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded border border-blue-200 transition"
              >
                PubMed <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
