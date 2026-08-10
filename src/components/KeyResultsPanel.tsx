'use client';

import React, { useMemo } from 'react';
import { Dna, ArrowUpRight, Sparkles } from 'lucide-react';

export interface KeyGeneItem {
  gene: string;
  category: string;
  categoryColor: string;
  categoryBg: string;
  finding: string;
  pmid?: string;
}

export interface EpicManifestEntry {
  chr: string;
  totalProbes: number;
  probesWithStats: number;
  features: string[];
  nCpgIslands: number;
  cpgIslands: string[];
}

interface KeyResultsPanelProps {
  projectTitle: string;
  projectDescription: string;
  genes: KeyGeneItem[];
  selectedGene: string | null;
  onSelectGene: (gene: string) => void;
  epicManifest?: Record<string, EpicManifestEntry>;
}

export const FTC_KEY_GENES: KeyGeneItem[] = [
  {
    gene: 'FKBP5',
    category: 'HPA Axis Regulator',
    categoryColor: '#b91c1c',
    categoryBg: '#fef2f2',
    finding: 'Glucocorticoid-receptor chaperone and stress-biology candidate. In these data, the cross-subtype signal is predominantly negative, with mixed probe directions in SSS.',
  },
  {
    gene: 'AHRR',
    category: 'Environmental / Stress Locus',
    categoryColor: '#1d4ed8',
    categoryBg: '#eff6ff',
    finding: 'Aryl hydrocarbon receptor repressor and exposure-sensitive locus. Interpret alongside smoking and other environmental covariates; subtype-level probe directions are not fully concordant.',
  },
  {
    gene: 'NR3C1',
    category: 'Glucocorticoid Receptor',
    categoryColor: '#6d28d9',
    categoryBg: '#f5f3ff',
    finding: 'Glucocorticoid receptor involved in HPA-axis feedback. The cross-subtype DMR is significant, but the top probes have opposing directions in every subtype.',
  },
  {
    gene: 'BDNF',
    category: 'Neuroplasticity Factor',
    categoryColor: '#047857',
    categoryBg: '#ecfdf5',
    finding: 'Neurotrophic factor involved in synaptic plasticity. The cross-subtype DMR is significant, with mixed top-probe directions; direction should be assessed probe by probe.',
  },
  {
    gene: 'CRHR1',
    category: 'Corticotropin Receptor',
    categoryColor: '#c2410c',
    categoryBg: '#fff7ed',
    finding: 'Corticotropin-releasing hormone receptor relevant to stress signaling. Included as biological context; confirm its statistical status in the active result table.',
  },
  {
    gene: 'SLC6A4',
    category: 'Serotonin Transporter',
    categoryColor: '#0891b2',
    categoryBg: '#ecfeff',
    finding: 'Serotonin transporter with prior psychiatric epigenetics literature. Included as biological context; this card alone is not evidence of a project-level DMR.',
  },
  {
    gene: 'STAT5B',
    category: 'Immune-Endocrine Crosstalk',
    categoryColor: '#4f46e5',
    categoryBg: '#eef2ff',
    finding: 'Signal transducer connecting endocrine and immune pathways. Included as biological context; verify cohort, effect direction, and FDR in the result views.',
  },
];

export const MDMA_KEY_GENES: KeyGeneItem[] = [
  {
    gene: 'ATE1',
    category: 'Treatment DMR Anchor',
    categoryColor: '#7c3aed',
    categoryBg: '#f5f3ff',
    finding: 'Protein arginylation locus prioritized for inspection in the overall combined results. Compare the three study results before interpreting direction or consistency.',
  },
  {
    gene: 'AHRR',
    category: 'Trauma & Epigenetic Aging Locus',
    categoryColor: '#1d4ed8',
    categoryBg: '#eff6ff',
    finding: 'Exposure-sensitive locus prioritized for combined-result inspection. Study estimates can differ in direction and require smoking and environmental-confounder context.',
  },
  {
    gene: 'NR3C1',
    category: 'Glucocorticoid Receptor',
    categoryColor: '#6d28d9',
    categoryBg: '#f5f3ff',
    finding: 'HPA-axis receptor prioritized for combined-result inspection. Compare the overall effect with each study before biological interpretation.',
  },
  {
    gene: 'BDNF',
    category: 'Neuroplasticity Candidate',
    categoryColor: '#047857',
    categoryBg: '#ecfdf5',
    finding: 'Neuroplasticity candidate included for combined-result inspection. Observational methylation differences do not establish a driver of clinical recovery.',
  },
  {
    gene: 'HOXB9',
    category: 'Chromatin Remodeling',
    categoryColor: '#0891b2',
    categoryBg: '#ecfeff',
    finding: 'Developmental transcription factor included for combined-result inspection. Review each study and visit before interpreting generalizability.',
  },
  {
    gene: 'GNAS',
    category: 'cAMP Neuroendocrine Signaling',
    categoryColor: '#059669',
    categoryBg: '#ecfdf5',
    finding: 'G-protein signaling locus included for combined-result inspection. “Restoration” requires a prespecified healthy reference and longitudinal contrast.',
  },
  {
    gene: 'FKBP5',
    category: 'HPA-axis Candidate',
    categoryColor: '#c2410c',
    categoryBg: '#fff7ed',
    finding: 'HPA-axis chaperone included for combined-result inspection. Methylation estimates alone should not be presented as evidence of clinical recovery.',
  },
];

export const KeyResultsPanel: React.FC<KeyResultsPanelProps> = ({
  projectTitle,
  projectDescription,
  genes,
  selectedGene,
  onSelectGene,
  epicManifest,
}) => {
  // Build dynamic stats labels from the EPIC manifest
  const dynamicStats = useMemo(() => {
    const map: Record<string, string> = {};
    if (!epicManifest) return map;
    for (const item of genes) {
      const entry = epicManifest[item.gene];
      if (entry) {
        const parts: string[] = [];
        parts.push(`${entry.totalProbes} array probes mapped`);
        parts.push(`${entry.probesWithStats} with compiled statistics`);
        if (entry.nCpgIslands > 0) parts.push(`${entry.nCpgIslands} CpG island annotation${entry.nCpgIslands > 1 ? 's' : ''}`);
        parts.push(`${entry.features.length} feature categor${entry.features.length === 1 ? 'y' : 'ies'}`);
        map[item.gene] = parts.join(' | ');
      }
    }
    return map;
  }, [epicManifest, genes]);

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl mb-8 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Curated loci to inspect</span>
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">{projectTitle}</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl font-medium leading-relaxed">
            {projectDescription}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl text-xs text-slate-300 font-semibold self-start md:self-auto">
          <Dna className="w-4 h-4 text-blue-400" />
          <span>{genes.length} candidate loci</span>
        </div>
      </div>

      {/* Landmark Genes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
        {genes.map((item) => {
          const isSelected = selectedGene === item.gene;
          const statsLabel = dynamicStats[item.gene] || 'Manifest summary unavailable';
          return (
            <button
              type="button"
              key={item.gene}
              onClick={() => onSelectGene(item.gene)}
              aria-pressed={isSelected}
              className={`group cursor-pointer rounded-xl p-4 text-left transition-all duration-200 border relative flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-800 border-amber-400 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400'
                  : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 hover:border-slate-600'
              }`}
            >
              <div>
                {/* Header row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-white tracking-tight group-hover:text-amber-300 transition">
                      {item.gene}
                    </span>
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold rounded-full border"
                      style={{
                        backgroundColor: item.categoryBg,
                        color: item.categoryColor,
                        borderColor: item.categoryColor + '40',
                      }}
                    >
                      {item.category}
                    </span>
                  </div>
                  <ArrowUpRight className={`w-4 h-4 transition ${isSelected ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                </div>

                {/* Finding Summary */}
                <p className="text-xs text-slate-300 font-normal leading-relaxed mb-3">
                  {item.finding}
                </p>
              </div>

              {/* Footer row — DYNAMIC STATS */}
              <div className="flex flex-col gap-2 border-t border-slate-700/50 pt-2.5 text-[11px]">
                <span className="font-mono font-medium leading-relaxed text-slate-400">{statsLabel}</span>
                <span className="self-end text-[10px] font-semibold text-slate-300">Open result views</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
