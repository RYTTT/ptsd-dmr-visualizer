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
  scope: 'pooled-cross-cohort';
  comparison: 'Three-cohort treatment-response probe meta-analysis';
  selectionRule: 'All common three-cohort probe rows for this gene';
  sourceFile: string;
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
