'use client';

import React, { useState, useEffect, useMemo, useId, useRef } from 'react';
import { BookText, X, ExternalLink } from 'lucide-react';
import { getGeneMetadata } from '@/lib/commonDatabase';
import type { CrossProjectInfo } from '@/types/annotation';
import type { SelectedPtsdResult, SelectedTreatmentResult } from '@/types/dmr';

interface EpicManifestEntry {
  chr: string;
  totalProbes: number;
  probesWithStats: number;
  features: string[];
  nCpgIslands: number;
  cpgIslands: string[];
}

interface GeneAnnotation {
  fullName: string;
  category: string;
  summary: string;
  psychDisorders: string[];
  references?: { pmid: string; citation: string }[];
}

interface GeneStoryProps {
  gene: string;
  annotation: GeneAnnotation | null;
  project: 'ptsd' | 'mdma';
  epicManifest?: Record<string, EpicManifestEntry>;
  /** Cross-project lookup loaded externally — if null, component will load itself */
  crossProjectData?: Record<string, CrossProjectInfo> | null;
  /** Exact active statistical result; omitted when this is only an annotation/manifest story. */
  result?: SelectedPtsdResult | SelectedTreatmentResult | null;
}

function formatProbability(value: number): string {
  if (value === 0) return '0 (below numeric precision)';
  return value < 0.001 ? value.toExponential(2) : value.toFixed(3);
}

function formatDeltaBeta(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(4)}`;
}

export const GeneStoryButton: React.FC<GeneStoryProps> = ({
  gene,
  annotation,
  project,
  epicManifest,
  crossProjectData,
  result,
}) => {
  const [open, setOpen] = useState(false);
  const dialogTitleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [crossInfo, setCrossInfo] = useState<CrossProjectInfo | null | undefined>(
    crossProjectData?.[gene],
  );
  const hasProvidedCrossInfo = Boolean(crossProjectData && Object.hasOwn(crossProjectData, gene));
  const effectiveCrossInfo = hasProvidedCrossInfo ? crossProjectData?.[gene] ?? null : crossInfo;

  useEffect(() => {
    if (hasProvidedCrossInfo) return;
    let cancelled = false;
    getGeneMetadata(gene)
      .then((metadata) => { if (!cancelled) setCrossInfo(metadata.crossProject); })
      .catch(() => { if (!cancelled) setCrossInfo(null); });
    return () => { cancelled = true; };
  }, [gene, hasProvidedCrossInfo]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  const story = useMemo(() => {
    if (!gene) return null;

    const manifest = epicManifest?.[gene];
    const cross = effectiveCrossInfo;
    const paragraphs: string[] = [];

    // Paragraph 1: Gene identity & clinical relevance
    if (annotation) {
      paragraphs.push(
        `${gene} (${annotation.fullName}) is classified under "${annotation.category}". ${annotation.summary}`
      );
    } else {
      paragraphs.push(
          `${gene} is available for inspection in this atlas. A curated psychiatric literature annotation is not yet available for this locus; consult the active statistical result before treating it as a DMR.`
      );
    }

    // Paragraph 2: array-manifest coverage
    if (manifest) {
      const featureList = manifest.features.length > 0 ? manifest.features.join(', ') : 'no annotated features';
      paragraphs.push(
        `The compiled array manifest maps ${manifest.totalProbes} probes to ${gene}; ${manifest.probesWithStats} have records in the compiled statistical inventory. The mapped probes span ${manifest.features.length} annotated feature categor${manifest.features.length === 1 ? 'y' : 'ies'} (${featureList}). ${manifest.nCpgIslands > 0 ? `${manifest.nCpgIslands} CpG island annotation${manifest.nCpgIslands > 1 ? 's' : ''} overlap the mapped probe footprint (${manifest.cpgIslands.join('; ')}).` : 'No CpG island annotation overlaps the mapped probe footprint.'}`
      );
    }

    // Paragraph 3: exact active result scope
    if (result) {
      if (result.kind === 'cross-subtype') {
        const directions = Object.entries(result.result.subtypes).map(([subtype, stat]) => `${subtype}: ${stat.direction}, Δβ ${formatDeltaBeta(stat.deltaBeta)}, FDR ${formatProbability(stat.fdr)}`).join('; ');
        paragraphs.push(
          `The active result is a cross-subtype PTSD DMR (${result.result.nSubtypesSig} of 4 subtype results have FDR below 0.05; cross-subtype FDR ${formatProbability(result.result.crossFdr)}). Subtype estimates are ${directions}. “Mixed” means the selected probes have opposing directions; a negative or positive signed mean does not make a mixed result concordant.`
        );
      } else if (result.kind === 'subtype-unique') {
        paragraphs.push(
          `This is a ${result.subtype}-selected gene: only ${result.subtype} passes the source FDR < 0.05 rule. Its Δβ is ${formatDeltaBeta(result.result.deltaBeta)}, direction is ${result.result.direction.toLowerCase()}, nominal P is ${formatProbability(result.result.pValue)}, and FDR is ${formatProbability(result.result.fdr)}. The application shows the observed SSS, ADS, ICF, and ISS values side by side; the other three are not missing or replaced with zero.`
        );
      } else if (result.kind === 'pooled-cross-cohort') {
        paragraphs.push(
          `The active treatment result is the combined analysis across MDMA, ketamine, and CPT: Δβ ${formatDeltaBeta(result.result.deltaBeta)}, ${result.result.direction.toLowerCase()}, nominal P ${formatProbability(result.result.pValue)}, and reported FDR ${formatProbability(result.result.fdr)}. ${result.result.nCohortsNominal} of 3 study component P values are below 0.05, and the three component mean Δβ signs ${result.result.componentSignsConsistent ? 'are consistent' : 'differ'}. This combined result is separate from the Baseline and Follow-up comparisons and does not imply that every study visit has the same effect.`
        );
      } else {
        const timepointLabel = result.timepoint === 'Pre'
          ? 'Baseline (Pre)'
          : result.cohort === 'MDMA'
            ? 'Follow-up (FUP1 / E2)'
            : 'Follow-up (FUP2)';
        paragraphs.push(
          `The active treatment result is from the ${result.cohort} study at ${timepointLabel}: weighted Top-3 Δβ ${formatDeltaBeta(result.result.deltaBeta)}, ${result.result.direction.toLowerCase()}, nominal Fisher P ${formatProbability(result.result.pValue)}, reported FDR ${formatProbability(result.result.fdr)}, and ${result.result.nSigProbes} of ${result.result.totalProbes} mapped probes with P < 0.05. This study-and-visit result should not be generalized to the other studies or to the overall combined result.`
        );
      }
    }

    // Cross-project bridge narrative
    if (cross) {
      if (project === 'ptsd') {
        paragraphs.push(
          `${gene} also has a selected result in the Treatment Response Atlas (MDMA/Ketamine/CPT), with a summary direction of ${cross.mdma.direction.toLowerCase()} (${cross.mdma.type === 'pooled-cross-cohort' ? 'overall combined analysis' : 'individual study/visit analysis'}, FDR ${cross.mdma.fdr < 1e-15 ? '< 1×10⁻¹⁵' : cross.mdma.fdr.toExponential(2)}). This cross-project overlap is hypothesis-generating; it does not establish treatment responsiveness, mediation, or a therapeutic target.`
        );
      } else {
        paragraphs.push(
          `${gene} also has a selected result in the PTSD Subtype DMR Atlas, with a summary direction of ${cross.ptsd.direction.toLowerCase()} (${cross.ptsd.type === 'cross-subtype' ? 'shared cross-subtype analysis' : 'subtype-selected analysis'}, FDR ${cross.ptsd.fdr < 1e-15 ? '< 1×10⁻¹⁵' : cross.ptsd.fdr.toExponential(2)}). The overlap is hypothesis-generating and does not establish a mechanistic marker of trauma or recovery.`
        );
      }
    }

    // Paragraph 4: Psychiatric associations
    if (annotation?.psychDisorders && annotation.psychDisorders.length > 0) {
      paragraphs.push(
        `The curated annotation lists reported literature associations with: ${annotation.psychDisorders.join(', ')}. These labels do not indicate that the present analysis tested or replicated every association.`
      );
    }

    return paragraphs;
  }, [gene, annotation, epicManifest, effectiveCrossInfo, project, result]);

  if (!story || story.length === 0) return null;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[11px] font-bold text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 px-2.5 py-1.5 rounded-lg border border-violet-200 transition shadow-xs"
      >
        <BookText className="w-3.5 h-3.5" />
        Gene Story
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={dialogTitleId} className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-slate-200">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 id={dialogTitleId} className="text-lg font-extrabold text-slate-900 tracking-tight">{gene} — Data-linked summary</h2>
                <p className="text-[11px] text-slate-500 font-medium">Automatically assembled; verify against the statistical views and cited sources</p>
              </div>
              <button
                type="button"
                ref={closeButtonRef}
                onClick={() => setOpen(false)}
                aria-label="Close gene summary"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4">
              {story.map((paragraph, i) => (
                <p key={i} className="text-sm text-slate-700 leading-relaxed">
                  {paragraph}
                </p>
              ))}

              {/* Quick links */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                <a
                  href={`https://www.ewascatalog.org/search?query=${gene}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 hover:bg-emerald-100 transition"
                >
                  EWAS <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={`https://pubmed.ncbi.nlm.nih.gov/?term=${gene}+methylation+PTSD`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 hover:bg-blue-100 transition"
                >
                  PubMed <ExternalLink className="w-3 h-3" />
                </a>
                {annotation?.references?.filter((r) => /^\d+$/.test(r.pmid)).slice(0, 3).map((ref, i) => (
                  <a
                    key={i}
                    href={`https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-200 transition"
                  >
                    PMID:{ref.pmid} <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 rounded-b-2xl">
              <p className="text-[10px] text-slate-400 italic">
                This summary combines project data, the compiled array manifest, cross-project linkage, and curated annotations. It is a research navigation aid—not a causal interpretation, clinical claim, or peer-reviewed conclusion.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
