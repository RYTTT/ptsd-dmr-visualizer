import type { TreatmentTimepoint } from './dmr';

export interface ProbeEntry {
  probe: string;
  pos: number;
  feature: string;
  cpgIsland: string;
  // Dynamic subtype fields — accessed via bracket notation
  [key: string]: string | number | null;
}

export type ProbeStatisticSuffix = 'logFC' | 'P' | 'FDR';

export interface CpGIsland {
  name: string;
  start: number;
  end: number;
}

export interface ProbeDatasetMetadata {
  scope: 'treatment-study-timepoint-with-cpt-reference';
  comparison: 'Responder versus non-responder across three studies, plus CPT healthy-control references, at Baseline and Follow-up';
  selectionRule: 'All ten sources contain unfiltered all-probe statistics; panels are restricted to common three-study probes';
  sourceFiles: string[];
  coverageByAnalysis: Record<string, 'all-probes' | 'nominal-p-lt-0.01'>;
}

export type TreatmentProbeView = 'three-cohort' | 'cpt-healthy-control';

export interface GeneProbeData {
  gene: string;
  chr: string;
  totalProbes: number;
  cpgIslands: CpGIsland[];
  probes: ProbeEntry[];
  /** Probe IDs selected by the supplied same-visit cross-study meta-analysis. */
  metaSelectedTop3?: Partial<Record<TreatmentTimepoint, string[]>>;
  /** Present when probe rows come from a context-specific scientific dataset. */
  probeDataset?: ProbeDatasetMetadata;
}

export type ProbeDataMap = Record<string, GeneProbeData>;
