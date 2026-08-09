import type { GeneMetadata } from '@/types/annotation';
import type { GeneProbeData, ProbeEntry } from '@/types/probe';

type Project = 'ptsd' | 'mdma';

const GENE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const EMPTY_METADATA: GeneMetadata = { annotation: null, manifest: null, crossProject: null };
const metadataCache = new Map<string, GeneMetadata>();
const metadataRequests = new Map<string, Promise<GeneMetadata>>();

const probeCache = new Map<string, GeneProbeData | null>();
const probeRequests = new Map<string, Promise<GeneProbeData | null>>();
const PROBE_CACHE_LIMIT = 100;

export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Sign in again to continue.');
    this.name = 'SessionExpiredError';
  }
}

function normalizeGene(gene: string): string {
  const trimmed = gene.trim();
  if (!GENE_PATTERN.test(trimmed)) throw new Error(`Invalid gene symbol: ${gene}`);
  return trimmed.toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGeneMetadata(value: unknown): value is GeneMetadata {
  return isRecord(value) && 'annotation' in value && 'manifest' in value && 'crossProject' in value;
}

function isLoginResponse(response: Response): boolean {
  if (response.status === 401) return true;
  if (!response.redirected) return false;
  try {
    return new URL(response.url).pathname === '/login';
  } catch {
    return false;
  }
}

export async function readJsonResponse(response: Response, label: string): Promise<unknown> {
  if (isLoginResponse(response)) throw new SessionExpiredError();
  if (!response.ok) throw new Error(`${label} (${response.status})`);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`${label}: expected JSON but received ${contentType || 'an unknown content type'}`);
  }
  return response.json() as Promise<unknown>;
}

async function requestMetadataBatch(genes: readonly string[]): Promise<Record<string, GeneMetadata>> {
  const response = await fetch(`/api/data/genes?genes=${encodeURIComponent(genes.join(','))}`, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });
  const payload = await readJsonResponse(response, 'Failed to load gene metadata');
  if (!isRecord(payload) || !isRecord(payload.genes)) {
    throw new Error('Gene metadata response has an invalid shape');
  }

  const result: Record<string, GeneMetadata> = {};
  for (const gene of genes) {
    const value = payload.genes[gene];
    if (!isGeneMetadata(value)) throw new Error(`Invalid metadata returned for ${gene}`);
    result[gene] = value;
  }
  return result;
}

/**
 * Loads compact metadata DTOs with per-gene promise deduplication. The server
 * keeps the large JSON maps in memory, while the browser receives only the
 * requested records.
 */
export async function loadGenesMetadata(genes: readonly string[]): Promise<Record<string, GeneMetadata>> {
  const normalizedGenes = [...new Set(genes.map(normalizeGene))];
  const missing = normalizedGenes.filter(
    (gene) => !metadataCache.has(gene) && !metadataRequests.has(gene),
  );

  for (let offset = 0; offset < missing.length; offset += 25) {
    const batch = missing.slice(offset, offset + 25);
    const batchRequest = requestMetadataBatch(batch);
    for (const gene of batch) {
      const request = batchRequest
        .then((metadata) => {
          const value = metadata[gene] ?? EMPTY_METADATA;
          metadataCache.set(gene, value);
          return value;
        })
        .finally(() => metadataRequests.delete(gene));
      metadataRequests.set(gene, request);
    }
  }

  const entries = await Promise.all(
    normalizedGenes.map(async (gene) => [
      gene,
      metadataCache.get(gene) ?? await metadataRequests.get(gene)!,
    ] as const),
  );
  return Object.fromEntries(entries);
}

export async function getGeneMetadata(gene: string): Promise<GeneMetadata> {
  const normalized = normalizeGene(gene);
  const result = await loadGenesMetadata([normalized]);
  return result[normalized] ?? EMPTY_METADATA;
}

export async function getGeneAnnotation(gene: string) {
  return (await getGeneMetadata(gene)).annotation;
}

function isProbeEntry(value: unknown): value is ProbeEntry {
  if (!isRecord(value)) return false;
  if (
    typeof value.probe !== 'string' ||
    !Number.isFinite(value.pos) ||
    typeof value.feature !== 'string' ||
    typeof value.cpgIsland !== 'string'
  ) return false;
  if (!Number.isSafeInteger(value.pos) || (value.pos as number) <= 0) return false;
  if (!Object.values(value).every(
    (entry) => entry === null || typeof entry === 'string' || (typeof entry === 'number' && Number.isFinite(entry)),
  )) return false;

  const analysisKeys = Object.keys(value).filter((key) => key.endsWith('_P'));
  if (analysisKeys.length === 0) return false;
  return analysisKeys.every((pKey) => {
    const prefix = pKey.slice(0, -2);
    const fdrKey = `${prefix}_FDR`;
    const effectKey = `${prefix}_logFC`;
    if (!(fdrKey in value) || !(effectKey in value)) return false;
    const p = value[pKey];
    const fdr = value[fdrKey];
    const effect = value[effectKey];
    return (
      (p === null || (typeof p === 'number' && p >= 0 && p <= 1)) &&
      (fdr === null || (typeof fdr === 'number' && fdr >= 0 && fdr <= 1)) &&
      (effect === null || typeof effect === 'number')
    );
  });
}

export function isGeneProbeData(value: unknown, requestedGene: string): value is GeneProbeData {
  if (
    !isRecord(value) ||
    typeof value.gene !== 'string' ||
    value.gene.toUpperCase() !== requestedGene.toUpperCase() ||
    typeof value.chr !== 'string' ||
    value.chr.trim() === '' ||
    !Number.isSafeInteger(value.totalProbes) ||
    (value.totalProbes as number) < 0 ||
    !Array.isArray(value.probes) ||
    value.probes.length !== value.totalProbes ||
    !value.probes.every(isProbeEntry) ||
    !Array.isArray(value.cpgIslands)
  ) return false;

  const probeIds = new Set<string>();
  for (const probe of value.probes as ProbeEntry[]) {
    if (probeIds.has(probe.probe)) return false;
    probeIds.add(probe.probe);
  }

  for (const island of value.cpgIslands) {
    if (
      !isRecord(island) ||
      typeof island.name !== 'string' ||
      !Number.isSafeInteger(island.start) ||
      !Number.isSafeInteger(island.end) ||
      (island.start as number) <= 0 ||
      (island.end as number) < (island.start as number)
    ) return false;
  }
  return true;
}

function setProbeCache(key: string, value: GeneProbeData | null) {
  if (probeCache.has(key)) probeCache.delete(key);
  probeCache.set(key, value);
  if (probeCache.size > PROBE_CACHE_LIMIT) {
    const oldest = probeCache.keys().next().value as string | undefined;
    if (oldest) probeCache.delete(oldest);
  }
}

/** Loads one probe shard with bounded LRU caching and concurrent request deduplication. */
export async function loadProbeData(project: Project, gene: string): Promise<GeneProbeData | null> {
  const trimmedGene = gene.trim();
  const normalizedGene = normalizeGene(trimmedGene);
  const key = `${project}:${normalizedGene}`;
  if (probeCache.has(key)) {
    const cached = probeCache.get(key) ?? null;
    setProbeCache(key, cached);
    return cached;
  }
  const pending = probeRequests.get(key);
  if (pending) return pending;

  const directory = project === 'mdma' ? '/data/mdma/probes' : '/data/probes';
  const request = fetch(`${directory}/${encodeURIComponent(trimmedGene)}.json`, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  })
    .then(async (response) => {
      if (response.status === 404) return null;
      const value = await readJsonResponse(response, 'Failed to load probe data');
      if (!isGeneProbeData(value, trimmedGene)) throw new Error(`Invalid probe data returned for ${trimmedGene}`);
      return value;
    })
    .then((value) => {
      setProbeCache(key, value);
      return value;
    })
    .finally(() => probeRequests.delete(key));

  probeRequests.set(key, request);
  return request;
}
