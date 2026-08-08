'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { BookText, X, ExternalLink, ArrowRight } from 'lucide-react';

interface CrossProjectInfo {
  ptsd: { type: string; fdr: number; direction: string };
  mdma: { type: string; fdr: number; deltaBeta: number; direction: string };
}

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
}

let cpCache: Record<string, CrossProjectInfo> | null = null;

export const GeneStoryButton: React.FC<GeneStoryProps> = ({
  gene,
  annotation,
  project,
  epicManifest,
  crossProjectData,
}) => {
  const [open, setOpen] = useState(false);
  const [crossData, setCrossData] = useState<Record<string, CrossProjectInfo> | null>(
    crossProjectData ?? cpCache ?? null
  );

  useEffect(() => {
    if (crossData) return;
    fetch('/data/common/crossProjectGenes.json')
      .then((r) => r.ok ? r.json() : {})
      .then((d) => { cpCache = d; setCrossData(d); })
      .catch(() => setCrossData({}));
  }, [crossData]);

  const story = useMemo(() => {
    if (!gene) return null;

    const manifest = epicManifest?.[gene];
    const cross = crossData?.[gene];
    const paragraphs: string[] = [];

    // Paragraph 1: Gene identity & clinical relevance
    if (annotation) {
      paragraphs.push(
        `${gene} (${annotation.fullName}) is classified under "${annotation.category}". ${annotation.summary}`
      );
    } else {
      paragraphs.push(
        `${gene} is a differentially methylated region identified in our multi-cohort analysis. Detailed psychiatric literature annotation is pending for this locus.`
      );
    }

    // Paragraph 2: EPIC array coverage
    if (manifest) {
      const featureList = manifest.features.length > 0 ? manifest.features.join(', ') : 'no annotated features';
      paragraphs.push(
        `On the Illumina EPIC 850K array, ${gene} is covered by ${manifest.totalProbes} probes across ${manifest.features.length} genomic feature region${manifest.features.length !== 1 ? 's' : ''} (${featureList}). ${manifest.nCpgIslands > 0 ? `${manifest.nCpgIslands} CpG island${manifest.nCpgIslands > 1 ? 's' : ''} ${manifest.nCpgIslands > 1 ? 'are' : 'is'} annotated within this locus (${manifest.cpgIslands.join('; ')}).` : 'No CpG islands are annotated within the probe footprint for this gene.'}`
      );
    }

    // Paragraph 3: Cross-project bridge narrative
    if (cross) {
      if (project === 'ptsd') {
        paragraphs.push(
          `Notably, ${gene} is also significant in the Treatment Response Atlas (MDMA/Ketamine/CPT), where it shows ${cross.mdma.direction.toLowerCase()} (${cross.mdma.type === 'cross' ? 'cross-cohort meta-analysis' : `${cross.mdma.type}-unique`}, FDR = ${cross.mdma.fdr < 1e-15 ? '< 1e-15' : cross.mdma.fdr.toExponential(2)}). This cross-project convergence — dysregulated in PTSD and responsive to treatment — suggests ${gene} may be a mechanistically relevant epigenetic target for trauma therapy.`
        );
      } else {
        paragraphs.push(
          `Notably, ${gene} is also significant in the PTSD Subtype DMR Atlas, where it shows ${cross.ptsd.direction.toLowerCase()} (${cross.ptsd.type === 'cross' ? 'cross-subtype common' : `${cross.ptsd.type}-unique`}, FDR = ${cross.ptsd.fdr < 1e-15 ? '< 1e-15' : cross.ptsd.fdr.toExponential(2)}). The observation that this locus is both dysregulated in PTSD and modified by treatment supports its potential as a mechanistic epigenetic marker of trauma and recovery.`
        );
      }
    }

    // Paragraph 4: Psychiatric associations
    if (annotation?.psychDisorders && annotation.psychDisorders.length > 0) {
      paragraphs.push(
        `In the published epigenetic literature, ${gene} has been associated with: ${annotation.psychDisorders.join(', ')}.`
      );
    }

    return paragraphs;
  }, [gene, annotation, epicManifest, crossData, project]);

  if (!story || story.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[11px] font-bold text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 px-2.5 py-1.5 rounded-lg border border-violet-200 transition shadow-xs"
      >
        <BookText className="w-3.5 h-3.5" />
        Gene Story
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-slate-200">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">{gene} — Scientific Narrative</h2>
                <p className="text-[11px] text-slate-500 font-medium">Auto-generated from project data, EPIC manifest, and cross-project linkage</p>
              </div>
              <button
                onClick={() => setOpen(false)}
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
                  href={`https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=${gene}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 hover:bg-amber-100 transition"
                >
                  UCSC <ExternalLink className="w-3 h-3" />
                </a>
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
                This narrative is auto-assembled from project data, the EPIC 850K gene manifest, cross-project gene linkage, and curated literature annotations. It is intended as a research aid, not a peer-reviewed statement.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
