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

export interface TreatmentMeasurement {
  deltaBeta: number | null;
  fdr: number | null;
  direction: Direction | null;
}

export interface TreatmentCohortResult {
  pooled: TreatmentMeasurement;
  timepoints: Record<TreatmentTimepoint, TreatmentMeasurement>;
}

export interface CrossCohortGene {
  gene: string;
  fdr: number;
  pValue: number;
  deltaBeta: number;
  direction: Direction;
  totalProbes: number;
  nSigProbes: number;
  cohorts: Record<TreatmentCohort, TreatmentCohortResult>;
}

export interface UniqueTreatmentGene {
  gene: string;
  totalProbes: number;
  nSigProbes: number;
  fdr: number;
  deltaBeta: number;
  direction: Direction;
}

export interface TreatmentTimepointData {
  uniqueCohorts: Record<TreatmentCohort, UniqueTreatmentGene[]>;
}

export interface MdmaMasterData {
  crossCohort: CrossCohortGene[];
  timepoints: Record<TreatmentTimepoint, TreatmentTimepointData>;
}

export type SelectedTreatmentResult =
  | { kind: 'pooled-cross-cohort'; result: CrossCohortGene }
  | {
      kind: 'timepoint-cohort-unique';
      timepoint: TreatmentTimepoint;
      cohort: TreatmentCohort;
      result: UniqueTreatmentGene;
    };
