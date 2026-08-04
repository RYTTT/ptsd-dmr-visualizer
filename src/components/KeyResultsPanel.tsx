'use client';

import React from 'react';
import { Flame, Activity, Dna, ArrowUpRight, Sparkles, ShieldCheck, Zap } from 'lucide-react';

export interface KeyGeneItem {
  gene: string;
  category: string;
  categoryColor: string;
  categoryBg: string;
  finding: string;
  statsLabel: string;
  direction: 'Hypermethylated' | 'Hypomethylated' | 'Mixed';
  pmid?: string;
}

interface KeyResultsPanelProps {
  projectTitle: string;
  projectDescription: string;
  genes: KeyGeneItem[];
  selectedGene: string | null;
  onSelectGene: (gene: string) => void;
}

export const FTC_KEY_GENES: KeyGeneItem[] = [
  {
    gene: 'FKBP5',
    category: 'HPA Axis Regulator',
    categoryColor: '#b91c1c',
    categoryBg: '#fef2f2',
    finding: 'Glucocorticoid receptor chaperone. Shows cross-subtype differential methylation in promoter CpG islands, driving altered stress sensitivity.',
    statsLabel: '52 EPIC Probes | 3 CpG Islands',
    direction: 'Hypermethylated',
  },
  {
    gene: 'AHRR',
    category: 'Environmental / Stress Locus',
    categoryColor: '#1d4ed8',
    categoryBg: '#eff6ff',
    finding: 'Aryl hydrocarbon receptor repressor. Canonical epigenetic landmark of environmental stress & trauma exposure with robust CpG island changes.',
    statsLabel: '167 EPIC Probes | 8 CpG Islands',
    direction: 'Hypomethylated',
  },
  {
    gene: 'NR3C1',
    category: 'Glucocorticoid Receptor',
    categoryColor: '#6d28d9',
    categoryBg: '#f5f3ff',
    finding: 'Central glucocorticoid receptor governing HPA-axis negative feedback inhibition and stress susceptibility in military & trauma cohorts.',
    statsLabel: '89 EPIC Probes | 1 CpG Island',
    direction: 'Hypomethylated',
  },
  {
    gene: 'BDNF',
    category: 'Neuroplasticity Factor',
    categoryColor: '#047857',
    categoryBg: '#ecfdf5',
    finding: 'Brain-derived neurotrophic factor. Key regulator of synaptic plasticity and hippocampal memory consolidation altered across PTSD clinical subtypes.',
    statsLabel: '93 EPIC Probes | 4 CpG Islands',
    direction: 'Hypermethylated',
  },
  {
    gene: 'CRHR1',
    category: 'Corticotropin Receptor',
    categoryColor: '#c2410c',
    categoryBg: '#fff7ed',
    finding: 'CRH Receptor 1. Primary central mediator of stress response, hyperarousal, and endocrine cascade in PTSD.',
    statsLabel: '41 EPIC Probes | 1 CpG Island',
    direction: 'Hypermethylated',
  },
  {
    gene: 'SLC6A4',
    category: 'Serotonin Transporter',
    categoryColor: '#0891b2',
    categoryBg: '#ecfeff',
    finding: 'Serotonin transporter gene (5-HTT). Epigenetic promoter modification associated with mood dysregulation and affective PTSD phenotypes.',
    statsLabel: '31 EPIC Probes | 1 CpG Island',
    direction: 'Hypomethylated',
  },
  {
    gene: 'STAT5B',
    category: 'Immune-Endocrine Crosstalk',
    categoryColor: '#4f46e5',
    categoryBg: '#eeef2ff',
    finding: 'Signal transducer 5B. Key junction connecting growth hormone and neuroimmune inflammatory signaling in severe stress subtypes.',
    statsLabel: '39 EPIC Probes | 1 CpG Island',
    direction: 'Hypermethylated',
  },
];

export const MDMA_KEY_GENES: KeyGeneItem[] = [
  {
    gene: 'ATE1',
    category: 'Treatment DMR Anchor',
    categoryColor: '#7c3aed',
    categoryBg: '#f5f3ff',
    finding: 'Arginyl-tRNA protein transferase. Top treatment-responsive DMR showing consistent post-therapy methylation shift across MDMA, Ketamine, and CPT.',
    statsLabel: '44 EPIC Probes | 1 CpG Island',
    direction: 'Hypomethylated',
  },
  {
    gene: 'AHRR',
    category: 'Trauma & Epigenetic Aging Locus',
    categoryColor: '#1d4ed8',
    categoryBg: '#eff6ff',
    finding: 'Aryl hydrocarbon receptor repressor. Canonical hallmark of trauma exposure & epigenetic aging showing highly significant cross-cohort therapy response (Meta FDR = 3.45e-7).',
    statsLabel: '167 EPIC Probes | 8 CpG Islands | Meta FDR = 3.45e-7',
    direction: 'Hypermethylated',
  },
  {
    gene: 'NR3C1',
    category: 'Glucocorticoid Receptor',
    categoryColor: '#6d28d9',
    categoryBg: '#f5f3ff',
    finding: 'Central HPA axis receptor exhibiting significant cross-cohort treatment remethylation in meta-analysis (Meta FDR = 3.6e-5).',
    statsLabel: '55 EPIC Probes | Meta FDR = 3.6e-5',
    direction: 'Hypermethylated',
  },
  {
    gene: 'BDNF',
    category: 'Neuroplasticity Recovery',
    categoryColor: '#047857',
    categoryBg: '#ecfdf5',
    finding: 'Brain-derived neurotrophic factor. Key driver of fear extinction and neuroplasticity restoration following MDMA-assisted therapy (Meta FDR = 9.56e-6).',
    statsLabel: '75 EPIC Probes | 4 CpG Islands | Meta FDR = 9.56e-6',
    direction: 'Hypermethylated',
  },
  {
    gene: 'HOXB9',
    category: 'Chromatin Remodeling',
    categoryColor: '#0891b2',
    categoryBg: '#ecfeff',
    finding: 'Homeobox B9. Developmental & epigenetic architecture gene demonstrating robust differential methylation following MDMA-assisted therapy.',
    statsLabel: '22 EPIC Probes | Meta FDR < 1e-8',
    direction: 'Hypermethylated',
  },
  {
    gene: 'GNAS',
    category: 'cAMP Neuroendocrine Signaling',
    categoryColor: '#059669',
    categoryBg: '#ecfdf5',
    finding: 'G-protein alpha subunit. Central neuroendocrine signaling gene with significant pre-to-post treatment methylation restoration in CD4+ T cells.',
    statsLabel: '178 EPIC Probes | 1 CpG Island',
    direction: 'Hypomethylated',
  },
  {
    gene: 'FKBP5',
    category: 'HPA Recovery Marker',
    categoryColor: '#c2410c',
    categoryBg: '#fff7ed',
    finding: 'HPA axis chaperone evaluated across pre- and post-treatment timepoints, tracking glucocorticoid sensitivity recovery following MDMA therapy.',
    statsLabel: '52 EPIC Probes | 3 CpG Islands',
    direction: 'Hypomethylated',
  },
];

export const KeyResultsPanel: React.FC<KeyResultsPanelProps> = ({
  projectTitle,
  projectDescription,
  genes,
  selectedGene,
  onSelectGene,
}) => {
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
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Key Study Findings</span>
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">{projectTitle}</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl font-medium leading-relaxed">
            {projectDescription}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl text-xs text-slate-300 font-semibold self-start md:self-auto">
          <Dna className="w-4 h-4 text-blue-400" />
          <span>{genes.length} Key Landmark Genes</span>
        </div>
      </div>

      {/* Landmark Genes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
        {genes.map((item) => {
          const isSelected = selectedGene === item.gene;
          return (
            <div
              key={item.gene}
              onClick={() => onSelectGene(item.gene)}
              className={`group cursor-pointer rounded-xl p-4 transition-all duration-200 border relative flex flex-col justify-between ${
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

              {/* Footer row */}
              <div className="pt-2.5 border-t border-slate-700/50 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-mono font-medium">{item.statsLabel}</span>
                <span
                  className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                    item.direction === 'Hypermethylated'
                      ? 'bg-red-950/60 text-red-300 border border-red-800/40'
                      : 'bg-blue-950/60 text-blue-300 border border-blue-800/40'
                  }`}
                >
                  {item.direction === 'Hypermethylated' ? 'Hyper' : 'Hypo'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
