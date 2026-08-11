export const SUBTYPE_KEYS = ['SSS', 'ADS', 'ICF', 'ISS'] as const;
export type SubtypeKey = (typeof SUBTYPE_KEYS)[number];
export type Direction = 'Hypermethylated' | 'Hypomethylated' | 'Mixed';

export interface SubtypeStat {
  pValue: number;
  deltaBeta: number;
  fdr: number;
  direction: Direction;
  nSigProbes: number;
  avgPosLogFC?: number | null;
  avgNegLogFC?: number | null;
  nPosTop3?: number;
  nNegTop3?: number;
}

export interface CrossSubtypeDMR {
  gene: string;
  chr: string;
  totalProbes: number;
  isPtsd: boolean;
  crossP: number;
  crossFdr: number;
  nSubtypesSig: number;
  subtypes: Record<SubtypeKey, SubtypeStat>;
}

export interface UniqueDMR {
  gene: string;
  chr: string;
  totalProbes: number;
  isPtsd: boolean;
  pValue: number;
  fdr: number;
  deltaBeta: number;
  direction: Direction;
  nSigProbes: number;
  subtypes: Record<SubtypeKey, SubtypeStat>;
  avgPosLogFC?: number | null;
  avgNegLogFC?: number | null;
  nPosTop3?: number;
  nNegTop3?: number;
}

export interface MasterDMRData {
  crossSubtype: CrossSubtypeDMR[];
  uniqueSubtypes: Record<SubtypeKey, UniqueDMR[]>;
  ptsdGenesList: string[];
}

export type SelectedPtsdResult =
  | { kind: 'cross-subtype'; result: CrossSubtypeDMR }
  | { kind: 'subtype-unique'; subtype: SubtypeKey; result: UniqueDMR };

export const TREATMENT_COHORTS = ['MDMA', 'Ketamine', 'CPT'] as const;
export type TreatmentCohort = (typeof TREATMENT_COHORTS)[number];
export const TREATMENT_TIMEPOINTS = ['Pre', 'FUP'] as const;
export type TreatmentTimepoint = (typeof TREATMENT_TIMEPOINTS)[number];
export const CPT_HC_GROUPS = ['Responder', 'NonResponder'] as const;
export type CptHealthyControlGroup = (typeof CPT_HC_GROUPS)[number];

export interface TreatmentComponentStat {
  pValue: number;
  deltaBeta: number;
  direction: Direction;
  nPosTop3: number;
  avgPosDeltaBeta: number | null;
  nNegTop3: number;
  avgNegDeltaBeta: number | null;
}

export interface CrossCohortGene {
  gene: string;
  fdr: number;
  pValue: number;
  deltaBeta: number;
  direction: Direction;
  totalProbes: number;
  nSigProbes: number;
  cohortPValues: Record<TreatmentCohort, number>;
  cohortComponents: Record<TreatmentCohort, TreatmentComponentStat>;
  nCohortsNominal: number;
  componentSignsConsistent: boolean;
}

export interface TreatmentGeneResult {
  gene: string;
  totalProbes: number;
  nSigProbes: number;
  pValue: number;
  fdr: number;
  deltaBeta: number;
  direction: Direction;
  nPosTop3: number;
  avgPosDeltaBeta: number | null;
  nNegTop3: number;
  avgNegDeltaBeta: number | null;
}

export interface TreatmentTimepointData {
  cohorts: Record<TreatmentCohort, TreatmentGeneResult[]>;
}

export type TreatmentGeneContext = Record<
  TreatmentTimepoint,
  Record<TreatmentCohort, TreatmentGeneResult | null>
>;

export interface TreatmentDatasetMetadata {
  version: string;
  generatedAt: string;
  selectionRule: string;
  contextRule: string;
  metaSources: Record<TreatmentTimepoint, { selected: string; full: string }>;
  cptHealthyControlSources: Record<TreatmentTimepoint, Record<CptHealthyControlGroup, string>>;
  cohortSources: Record<TreatmentTimepoint, Record<TreatmentCohort, string>>;
  contextSources: Record<TreatmentTimepoint, Record<TreatmentCohort, string>>;
}

export interface MdmaMasterData {
  metadata: TreatmentDatasetMetadata;
  metaAnalyses: Record<TreatmentTimepoint, CrossCohortGene[]>;
  cptHealthyControl: Record<
    TreatmentTimepoint,
    { groups: Record<CptHealthyControlGroup, TreatmentGeneResult[]> }
  >;
  timepoints: Record<TreatmentTimepoint, TreatmentTimepointData>;
  geneContexts: Record<string, TreatmentGeneContext>;
}

export type SelectedTreatmentResult =
  | { kind: 'timepoint-meta-analysis'; timepoint: TreatmentTimepoint; result: CrossCohortGene }
  | {
      kind: 'cpt-healthy-control';
      timepoint: TreatmentTimepoint;
      group: CptHealthyControlGroup;
      result: TreatmentGeneResult;
    }
  | {
      kind: 'timepoint-cohort';
      timepoint: TreatmentTimepoint;
      cohort: TreatmentCohort;
      result: TreatmentGeneResult;
    };
