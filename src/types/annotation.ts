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
