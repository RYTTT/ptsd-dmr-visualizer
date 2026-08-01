export interface SubtypeStat {
  deltaBeta: number;
  fdr: number;
  direction: string;
}

export interface CrossSubtypeDMR {
  gene: string;
  chr: string;
  totalProbes: number;
  isPtsd: boolean;
  crossP: number;
  crossFdr: number;
  nSubtypesSig: number;
  subtypes: {
    SSS: SubtypeStat;
    ADS: SubtypeStat;
    ICF: SubtypeStat;
    ISS: SubtypeStat;
  };
}

export interface UniqueDMR {
  gene: string;
  chr: string;
  totalProbes: number;
  isPtsd: boolean;
  fdr: number;
  deltaBeta: number;
  direction: string;
}

export interface MasterDMRData {
  crossSubtype: CrossSubtypeDMR[];
  uniqueSubtypes: {
    SSS: UniqueDMR[];
    ADS: UniqueDMR[];
    ICF: UniqueDMR[];
    ISS: UniqueDMR[];
  };
  ptsdGenesList: string[];
}
