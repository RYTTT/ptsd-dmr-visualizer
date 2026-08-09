export interface GeneReference {
  citation: string;
  pmid: string;
  url: string;
}

export interface GeneAnnotation {
  fullName: string;
  category: string;
  summary: string;
  psychDisorders: string[];
  references: GeneReference[];
}

export type GeneAnnotationMap = Record<string, GeneAnnotation>;

export interface EpicManifestEntry {
  chr: string;
  totalProbes: number;
  probesWithStats: number;
  features: string[];
  nCpgIslands: number;
  cpgIslands: string[];
}

export interface CrossProjectStat {
  type: string;
  fdr: number;
  direction: string;
  deltaBeta?: number;
}

export interface CrossProjectInfo {
  ptsd: CrossProjectStat;
  mdma: CrossProjectStat;
}

/** Minimal per-gene DTO returned by the server-side data access layer. */
export interface GeneMetadata {
  annotation: GeneAnnotation | null;
  manifest: EpicManifestEntry | null;
  crossProject: CrossProjectInfo | null;
}
