import { GeneAnnotation } from '../types/annotation';

let annotationCache: Record<string, GeneAnnotation> | null = null;
let annotationPromise: Promise<Record<string, GeneAnnotation>> | null = null;

/**
 * Loads the Unified Master Gene Annotation Database (common to all methylation projects).
 * Caches in-memory to prevent duplicate network requests across pages.
 */
export async function loadMasterAnnotations(): Promise<Record<string, GeneAnnotation>> {
  if (annotationCache) return annotationCache;
  if (annotationPromise) return annotationPromise;

  annotationPromise = fetch('/data/common/geneAnnotations.json')
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load common annotations database: ${res.status}`);
      return res.json();
    })
    .then((data) => {
      annotationCache = data;
      return data;
    })
    .catch((err) => {
      console.error('Error fetching master gene annotations:', err);
      annotationPromise = null;
      return {};
    });

  return annotationPromise;
}

/**
 * Retrieves annotation for a specific gene from the common database.
 */
export async function getGeneAnnotation(gene: string): Promise<GeneAnnotation | null> {
  const allAnnotations = await loadMasterAnnotations();
  return allAnnotations[gene] || null;
}
