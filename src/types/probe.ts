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
  scope: 'study-timepoint';
  comparison: 'Responder versus non-responder at Baseline and Follow-up in MDMA, ketamine, and CPT';
  selectionRule: 'Source-exported probes with nominal P < 0.01, restricted to common three-study probes';
  sourceFiles: string[];
}

export interface GeneProbeData {
  gene: string;
  chr: string;
  totalProbes: number;
  cpgIslands: CpGIsland[];
  probes: ProbeEntry[];
  /** Present when probe rows come from a context-specific scientific dataset. */
  probeDataset?: ProbeDatasetMetadata;
}

export type ProbeDataMap = Record<string, GeneProbeData>;
