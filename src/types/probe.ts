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

export interface GeneProbeData {
  gene: string;
  chr: string;
  totalProbes: number;
  cpgIslands: CpGIsland[];
  probes: ProbeEntry[];
}

export type ProbeDataMap = Record<string, GeneProbeData>;
