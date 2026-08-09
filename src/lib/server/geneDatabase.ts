import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CrossProjectInfo,
  CrossProjectStat,
  EpicManifestEntry,
  GeneAnnotation,
  GeneMetadata,
  GeneReference,
} from '@/types/annotation';

type UnknownMap = Record<string, unknown>;

interface GeneStore {
  annotations: UnknownMap;
  manifest: UnknownMap;
  crossProject: UnknownMap;
  annotationKeys: Map<string, string>;
  manifestKeys: Map<string, string>;
  crossProjectKeys: Map<string, string>;
}

const dataDirectory = path.join(process.cwd(), 'public', 'data', 'common');
const globalStore = globalThis as typeof globalThis & {
  __ptsdGeneStorePromise?: Promise<GeneStore>;
};

function isRecord(value: unknown): value is UnknownMap {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? [...value]
    : null;
}

async function readObject(filename: string): Promise<UnknownMap> {
  const contents = await readFile(path.join(dataDirectory, filename), 'utf8');
  const parsed: unknown = JSON.parse(contents);
  if (!isRecord(parsed)) throw new Error(`${filename} must contain a JSON object`);
  return parsed;
}

function buildCaseInsensitiveIndex(data: UnknownMap): Map<string, string> {
  const index = new Map<string, string>();
  for (const key of Object.keys(data)) {
    const normalized = key.toUpperCase();
    const existing = index.get(normalized);
    if (existing && existing !== key) {
      throw new Error(`Ambiguous gene symbols in metadata: ${existing}, ${key}`);
    }
    index.set(normalized, key);
  }
  return index;
}

async function createStore(): Promise<GeneStore> {
  const [annotations, manifest, crossProject] = await Promise.all([
    readObject('geneAnnotations.json'),
    readObject('epicGeneManifest.json'),
    readObject('crossProjectGenes.json'),
  ]);
  return {
    annotations,
    manifest,
    crossProject,
    annotationKeys: buildCaseInsensitiveIndex(annotations),
    manifestKeys: buildCaseInsensitiveIndex(manifest),
    crossProjectKeys: buildCaseInsensitiveIndex(crossProject),
  };
}

async function getStore(): Promise<GeneStore> {
  if (!globalStore.__ptsdGeneStorePromise) {
    globalStore.__ptsdGeneStorePromise = createStore().catch((error) => {
      delete globalStore.__ptsdGeneStorePromise;
      throw error;
    });
  }
  return globalStore.__ptsdGeneStorePromise;
}

function getIndexedValue(data: UnknownMap, index: Map<string, string>, gene: string): unknown {
  const key = index.get(gene.toUpperCase());
  return key ? data[key] : undefined;
}

function sanitizeReference(value: unknown): GeneReference | null {
  if (!isRecord(value)) return null;
  return typeof value.citation === 'string' && typeof value.pmid === 'string' && typeof value.url === 'string'
    ? { citation: value.citation, pmid: value.pmid, url: value.url }
    : null;
}

function sanitizeAnnotation(value: unknown): GeneAnnotation | null {
  if (!isRecord(value)) return null;
  const disorders = stringArray(value.psychDisorders);
  if (
    typeof value.fullName !== 'string' ||
    typeof value.category !== 'string' ||
    typeof value.summary !== 'string' ||
    !disorders ||
    !Array.isArray(value.references)
  ) return null;

  return {
    fullName: value.fullName,
    category: value.category,
    summary: value.summary,
    psychDisorders: disorders,
    references: value.references.map(sanitizeReference).filter((entry): entry is GeneReference => entry !== null),
  };
}

function sanitizeManifest(value: unknown): EpicManifestEntry | null {
  if (!isRecord(value)) return null;
  const features = stringArray(value.features);
  const cpgIslands = stringArray(value.cpgIslands);
  if (
    typeof value.chr !== 'string' ||
    !Number.isSafeInteger(value.totalProbes) ||
    !Number.isSafeInteger(value.probesWithStats) ||
    !Number.isSafeInteger(value.nCpgIslands) ||
    !features ||
    !cpgIslands
  ) return null;
  return {
    chr: value.chr,
    totalProbes: value.totalProbes as number,
    probesWithStats: value.probesWithStats as number,
    features,
    nCpgIslands: value.nCpgIslands as number,
    cpgIslands,
  };
}

function sanitizeCrossStat(value: unknown): CrossProjectStat | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.type !== 'string' ||
    typeof value.direction !== 'string' ||
    !isFiniteNumber(value.fdr) ||
    value.fdr < 0 ||
    value.fdr > 1 ||
    (value.deltaBeta !== undefined && !isFiniteNumber(value.deltaBeta))
  ) return null;
  return {
    type: value.type,
    fdr: value.fdr,
    direction: value.direction,
    ...(value.deltaBeta === undefined ? {} : { deltaBeta: value.deltaBeta as number }),
  };
}

function sanitizeCrossProject(value: unknown): CrossProjectInfo | null {
  if (!isRecord(value)) return null;
  const ptsd = sanitizeCrossStat(value.ptsd);
  const mdma = sanitizeCrossStat(value.mdma);
  return ptsd && mdma ? { ptsd, mdma } : null;
}

/** Returns only the safe fields needed by the browser for one gene. */
export async function getGeneMetadata(gene: string): Promise<GeneMetadata> {
  const store = await getStore();
  return {
    annotation: sanitizeAnnotation(getIndexedValue(store.annotations, store.annotationKeys, gene)),
    manifest: sanitizeManifest(getIndexedValue(store.manifest, store.manifestKeys, gene)),
    crossProject: sanitizeCrossProject(getIndexedValue(store.crossProject, store.crossProjectKeys, gene)),
  };
}

export async function getGenesMetadata(genes: readonly string[]): Promise<Record<string, GeneMetadata>> {
  const entries = await Promise.all(
    genes.map(async (gene) => [gene.toUpperCase(), await getGeneMetadata(gene)] as const),
  );
  return Object.fromEntries(entries);
}
