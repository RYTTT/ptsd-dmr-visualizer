export interface ProbeEntry {
  probe: string;
  pos: number;
  feature: string;
  cpgIsland: string;
  SSS_logFC: number | null;
  SSS_P: number | null;
  SSS_FDR: number | null;
  ADS_logFC: number | null;
  ADS_P: number | null;
  ADS_FDR: number | null;
  ICF_logFC: number | null;
  ICF_P: number | null;
  ICF_FDR: number | null;
  ISS_logFC: number | null;
  ISS_P: number | null;
  ISS_FDR: number | null;
}

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
