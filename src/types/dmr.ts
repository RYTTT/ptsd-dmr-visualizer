export const SUBTYPE_KEYS = ['SSS', 'ADS', 'ICF', 'ISS'] as const;
export type SubtypeKey = (typeof SUBTYPE_KEYS)[number];
export type Direction = 'Hypermethylated' | 'Hypomethylated' | 'Mixed';

export interface SubtypeStat {
  deltaBeta: number;
  fdr: number;
  direction: Direction;
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
  fdr: number;
  deltaBeta: number;
  direction: Direction;
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

export interface CrossCohortGene {
  gene: string;
  fdr: number;
  pValue: number;
  deltaBeta: number;
  direction: Direction;
  totalProbes: number;
  nSigProbes: number;
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
  coverageRule: string;
  pooledSource: string;
  cohortSources: Record<TreatmentTimepoint, Record<TreatmentCohort, string>>;
  coverageSources: Record<TreatmentTimepoint, Record<TreatmentCohort, string>>;
}

export interface MdmaMasterData {
  metadata: TreatmentDatasetMetadata;
  crossCohort: CrossCohortGene[];
  timepoints: Record<TreatmentTimepoint, TreatmentTimepointData>;
  geneContexts: Record<string, TreatmentGeneContext>;
}

export type SelectedTreatmentResult =
  | { kind: 'pooled-cross-cohort'; result: CrossCohortGene }
  | {
      kind: 'timepoint-cohort';
      timepoint: TreatmentTimepoint;
      cohort: TreatmentCohort;
      result: TreatmentGeneResult;
    };
