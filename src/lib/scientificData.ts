import type {
  CrossCohortGene,
  CrossSubtypeDMR,
  Direction,
  MasterDMRData,
  MdmaMasterData,
  SelectedPtsdResult,
  SelectedTreatmentResult,
  SubtypeKey,
  SubtypeStat,
  TreatmentCohort,
  TreatmentGeneContext,
  TreatmentGeneResult,
  TreatmentTimepoint,
  UniqueDMR,
} from '../types/dmr.ts';
import {
  SUBTYPE_KEYS,
  TREATMENT_COHORTS,
  TREATMENT_TIMEPOINTS,
} from '../types/dmr.ts';

type UnknownRecord = Record<string, unknown>;

export class ScientificDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScientificDataError';
  }
}

function fail(path: string, expectation: string): never {
  throw new ScientificDataError(`${path} must be ${expectation}`);
}

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(path, 'an object');
  }
  return value as UnknownRecord;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') return fail(path, 'a non-empty string');
  return value;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail(path, 'a finite number');
  return value;
}

function probability(value: unknown, path: string): number {
  const result = finite(value, path);
  if (result < 0 || result > 1) return fail(path, 'between 0 and 1');
  return result;
}

function count(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return fail(path, 'a non-negative safe integer');
  }
  return value as number;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') return fail(path, 'a boolean');
  return value;
}

function direction(value: unknown, path: string): Direction {
  if (value !== 'Hypermethylated' && value !== 'Hypomethylated' && value !== 'Mixed') {
    return fail(path, 'Hypermethylated, Hypomethylated, or Mixed');
  }
  return value;
}

function optionalFinite(value: unknown, path: string): number | null | undefined {
  if (value === undefined || value === null) return value;
  return finite(value, path);
}

function optionalCount(value: unknown, path: string): number | undefined {
  if (value === undefined) return undefined;
  return count(value, path);
}

function assertUniqueGenes<T extends { gene: string }>(items: readonly T[], path: string): void {
  const genes = new Set<string>();
  for (const item of items) {
    const normalized = item.gene.toUpperCase();
    if (genes.has(normalized)) fail(path, `free of duplicate gene ${item.gene}`);
    genes.add(normalized);
  }
}

function parseSubtypeStat(value: unknown, path: string): SubtypeStat {
  const item = record(value, path);
  const nPosTop3 = optionalCount(item.nPosTop3, `${path}.nPosTop3`);
  const nNegTop3 = optionalCount(item.nNegTop3, `${path}.nNegTop3`);
  if ((nPosTop3 ?? 0) + (nNegTop3 ?? 0) > 3) {
    fail(path, 'consistent with a maximum of three summarized probes');
  }
  return {
    deltaBeta: finite(item.deltaBeta, `${path}.deltaBeta`),
    fdr: probability(item.fdr, `${path}.fdr`),
    direction: direction(item.direction, `${path}.direction`),
    avgPosLogFC: optionalFinite(item.avgPosLogFC, `${path}.avgPosLogFC`),
    avgNegLogFC: optionalFinite(item.avgNegLogFC, `${path}.avgNegLogFC`),
    ...(nPosTop3 === undefined ? {} : { nPosTop3 }),
    ...(nNegTop3 === undefined ? {} : { nNegTop3 }),
  };
}

function parseCrossSubtype(value: unknown, path: string): CrossSubtypeDMR {
  const item = record(value, path);
  const subtypeSource = record(item.subtypes, `${path}.subtypes`);
  const subtypes = Object.fromEntries(
    SUBTYPE_KEYS.map((key) => [key, parseSubtypeStat(subtypeSource[key], `${path}.subtypes.${key}`)]),
  ) as CrossSubtypeDMR['subtypes'];
  const nSubtypesSig = count(item.nSubtypesSig, `${path}.nSubtypesSig`);
  if (nSubtypesSig > SUBTYPE_KEYS.length) fail(`${path}.nSubtypesSig`, 'at most 4');
  return {
    gene: string(item.gene, `${path}.gene`),
    chr: string(item.chr, `${path}.chr`),
    totalProbes: count(item.totalProbes, `${path}.totalProbes`),
    isPtsd: boolean(item.isPtsd, `${path}.isPtsd`),
    crossP: probability(item.crossP, `${path}.crossP`),
    crossFdr: probability(item.crossFdr, `${path}.crossFdr`),
    nSubtypesSig,
    subtypes,
  };
}

function parseUniqueDmr(value: unknown, path: string): UniqueDMR {
  const item = record(value, path);
  const nPosTop3 = optionalCount(item.nPosTop3, `${path}.nPosTop3`);
  const nNegTop3 = optionalCount(item.nNegTop3, `${path}.nNegTop3`);
  if ((nPosTop3 ?? 0) + (nNegTop3 ?? 0) > 3) {
    fail(path, 'consistent with a maximum of three summarized probes');
  }
  return {
    gene: string(item.gene, `${path}.gene`),
    chr: string(item.chr, `${path}.chr`),
    totalProbes: count(item.totalProbes, `${path}.totalProbes`),
    isPtsd: boolean(item.isPtsd, `${path}.isPtsd`),
    fdr: probability(item.fdr, `${path}.fdr`),
    deltaBeta: finite(item.deltaBeta, `${path}.deltaBeta`),
    direction: direction(item.direction, `${path}.direction`),
    avgPosLogFC: optionalFinite(item.avgPosLogFC, `${path}.avgPosLogFC`),
    avgNegLogFC: optionalFinite(item.avgNegLogFC, `${path}.avgNegLogFC`),
    ...(nPosTop3 === undefined ? {} : { nPosTop3 }),
    ...(nNegTop3 === undefined ? {} : { nNegTop3 }),
  };
}

/** Validate untrusted PTSD master JSON before any page-level transformation. */
export function validateMasterDMRData(value: unknown): MasterDMRData {
  const source = record(value, 'PTSD master data');
  if (!Array.isArray(source.crossSubtype)) fail('crossSubtype', 'an array');
  const crossSubtype = source.crossSubtype.map((item, index) => parseCrossSubtype(item, `crossSubtype[${index}]`));
  assertUniqueGenes(crossSubtype, 'crossSubtype');

  const uniqueSource = record(source.uniqueSubtypes, 'uniqueSubtypes');
  const uniqueSubtypes = Object.fromEntries(SUBTYPE_KEYS.map((key) => {
    const items = uniqueSource[key];
    if (!Array.isArray(items)) fail(`uniqueSubtypes.${key}`, 'an array');
    const parsed = items.map((item, index) => parseUniqueDmr(item, `uniqueSubtypes.${key}[${index}]`));
    assertUniqueGenes(parsed, `uniqueSubtypes.${key}`);
    return [key, parsed];
  })) as MasterDMRData['uniqueSubtypes'];

  if (!Array.isArray(source.ptsdGenesList)) fail('ptsdGenesList', 'an array');
  const ptsdGenesList = source.ptsdGenesList.map((item, index) => string(item, `ptsdGenesList[${index}]`));
  return { crossSubtype, uniqueSubtypes, ptsdGenesList };
}

function parseTreatmentGeneResult(value: unknown, path: string): TreatmentGeneResult {
  const item = record(value, path);
  const totalProbes = count(item.totalProbes, `${path}.totalProbes`);
  const nSigProbes = count(item.nSigProbes, `${path}.nSigProbes`);
  const nPosTop3 = count(item.nPosTop3, `${path}.nPosTop3`);
  const nNegTop3 = count(item.nNegTop3, `${path}.nNegTop3`);
  const avgPosDeltaBeta = optionalFinite(item.avgPosDeltaBeta, `${path}.avgPosDeltaBeta`) ?? null;
  const avgNegDeltaBeta = optionalFinite(item.avgNegDeltaBeta, `${path}.avgNegDeltaBeta`) ?? null;
  const deltaBeta = finite(item.deltaBeta, `${path}.deltaBeta`);
  if (totalProbes < 8) fail(`${path}.totalProbes`, 'at least 8');
  if (nSigProbes > totalProbes) fail(`${path}.nSigProbes`, 'no greater than totalProbes');
  if (nPosTop3 + nNegTop3 < 1 || nPosTop3 + nNegTop3 > 3) fail(path, 'consistent with one to three summarized probes');
  if ((nPosTop3 === 0) !== (avgPosDeltaBeta === null)) fail(`${path}.avgPosDeltaBeta`, 'present exactly when nPosTop3 is positive');
  if ((nNegTop3 === 0) !== (avgNegDeltaBeta === null)) fail(`${path}.avgNegDeltaBeta`, 'present exactly when nNegTop3 is positive');
  const expectedDeltaBeta = (
    nPosTop3 * (avgPosDeltaBeta ?? 0) + nNegTop3 * (avgNegDeltaBeta ?? 0)
  ) / (nPosTop3 + nNegTop3);
  if (Math.abs(deltaBeta - expectedDeltaBeta) > 1e-12) fail(`${path}.deltaBeta`, 'the count-weighted positive/negative Top-3 mean');
  return {
    gene: string(item.gene, `${path}.gene`),
    totalProbes,
    nSigProbes,
    pValue: probability(item.pValue, `${path}.pValue`),
    fdr: probability(item.fdr, `${path}.fdr`),
    deltaBeta,
    direction: direction(item.direction, `${path}.direction`),
    nPosTop3,
    avgPosDeltaBeta,
    nNegTop3,
    avgNegDeltaBeta,
  };
}

function parseCrossCohortGene(value: unknown, path: string): CrossCohortGene {
  const item = record(value, path);
  const totalProbes = count(item.totalProbes, `${path}.totalProbes`);
  const nSigProbes = count(item.nSigProbes, `${path}.nSigProbes`);
  if (nSigProbes > totalProbes) fail(`${path}.nSigProbes`, 'no greater than totalProbes');
  return {
    gene: string(item.gene, `${path}.gene`),
    fdr: probability(item.fdr, `${path}.fdr`),
    pValue: probability(item.pValue, `${path}.pValue`),
    deltaBeta: finite(item.deltaBeta, `${path}.deltaBeta`),
    direction: direction(item.direction, `${path}.direction`),
    totalProbes,
    nSigProbes,
  };
}

/** Validate treatment meta-analysis, cohort/timepoint selections, and context rows. */
export function validateMdmaMasterData(value: unknown): MdmaMasterData {
  const source = record(value, 'treatment master data');
  const metadataSource = record(source.metadata, 'metadata');
  const parseSourceMatrix = (value: unknown, path: string) => {
    const timepointSource = record(value, path);
    return Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => {
      const cohortSource = record(timepointSource[timepoint], `${path}.${timepoint}`);
      return [timepoint, Object.fromEntries(TREATMENT_COHORTS.map((cohort) => [
        cohort,
        string(cohortSource[cohort], `${path}.${timepoint}.${cohort}`),
      ]))];
    })) as MdmaMasterData['metadata']['cohortSources'];
  };
  const generatedAt = string(metadataSource.generatedAt, 'metadata.generatedAt');
  if (Number.isNaN(Date.parse(generatedAt))) fail('metadata.generatedAt', 'an ISO-compatible date-time');
  const metadata = {
    version: string(metadataSource.version, 'metadata.version'),
    generatedAt,
    selectionRule: string(metadataSource.selectionRule, 'metadata.selectionRule'),
    coverageRule: string(metadataSource.coverageRule, 'metadata.coverageRule'),
    pooledSource: string(metadataSource.pooledSource, 'metadata.pooledSource'),
    cohortSources: parseSourceMatrix(metadataSource.cohortSources, 'metadata.cohortSources'),
    coverageSources: parseSourceMatrix(metadataSource.coverageSources, 'metadata.coverageSources'),
  };
  if (!Array.isArray(source.crossCohort)) fail('crossCohort', 'an array');
  const crossCohort = source.crossCohort.map((item, index) => parseCrossCohortGene(item, `crossCohort[${index}]`));
  assertUniqueGenes(crossCohort, 'crossCohort');
  const timepointSource = record(source.timepoints, 'timepoints');
  const timepoints = Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => {
    const timepointItem = record(timepointSource[timepoint], `timepoints.${timepoint}`);
    const cohortSource = record(timepointItem.cohorts, `timepoints.${timepoint}.cohorts`);
    const cohorts = Object.fromEntries(TREATMENT_COHORTS.map((cohort) => {
      const items = cohortSource[cohort];
      if (!Array.isArray(items)) fail(`timepoints.${timepoint}.cohorts.${cohort}`, 'an array');
      const parsed = items.map((item, index) => parseTreatmentGeneResult(item, `timepoints.${timepoint}.cohorts.${cohort}[${index}]`));
      assertUniqueGenes(parsed, `timepoints.${timepoint}.cohorts.${cohort}`);
      for (const result of parsed) {
        if (result.nSigProbes < 8) fail(`timepoints.${timepoint}.cohorts.${cohort}.${result.gene}.nSigProbes`, 'at least 8 for an N8+ registry row');
        if (result.fdr >= 0.05) fail(`timepoints.${timepoint}.cohorts.${cohort}.${result.gene}.fdr`, 'below 0.05 for an N8+ registry row');
      }
      return [cohort, parsed];
    })) as Record<TreatmentCohort, TreatmentGeneResult[]>;
    return [timepoint, { cohorts }];
  })) as MdmaMasterData['timepoints'];

  const contextSource = record(source.geneContexts, 'geneContexts');
  const geneContexts = Object.fromEntries(Object.entries(contextSource).map(([gene, rawContext]) => {
    const contextItem = record(rawContext, `geneContexts.${gene}`);
    const parsedContext = Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => {
      const rawTimepoint = record(contextItem[timepoint], `geneContexts.${gene}.${timepoint}`);
      const parsedTimepoint = Object.fromEntries(TREATMENT_COHORTS.map((cohort) => {
        const rawResult = rawTimepoint[cohort];
        const result = rawResult === null ? null : parseTreatmentGeneResult(rawResult, `geneContexts.${gene}.${timepoint}.${cohort}`);
        if (result && result.gene.toUpperCase() !== gene.toUpperCase()) fail(`geneContexts.${gene}.${timepoint}.${cohort}.gene`, `equal to ${gene}`);
        return [cohort, result];
      })) as TreatmentGeneContext[TreatmentTimepoint];
      return [timepoint, parsedTimepoint];
    })) as TreatmentGeneContext;
    return [gene, parsedContext];
  })) as MdmaMasterData['geneContexts'];
  return { metadata, crossCohort, timepoints, geneContexts };
}

/**
 * A cross-subtype direction is concordant only when every stored subtype
 * classification is concordant and identical. Any stored Mixed classification,
 * or a mixture of Hyper/Hypo classifications, yields Mixed.
 */
export function deriveCrossSubtypeDirection(subtypes: Record<SubtypeKey, SubtypeStat>): Direction {
  const directions = SUBTYPE_KEYS.map((key) => subtypes[key].direction);
  if (directions.some((item) => item === 'Mixed')) return 'Mixed';
  return directions.every((item) => item === directions[0]) ? directions[0] : 'Mixed';
}

export function findPtsdResult(
  data: MasterDMRData,
  context: 'cross' | SubtypeKey,
  gene: string,
): SelectedPtsdResult | null {
  if (context === 'cross') {
    const result = data.crossSubtype.find((item) => item.gene === gene);
    return result ? { kind: 'cross-subtype', result } : null;
  }
  const result = data.uniqueSubtypes[context].find((item) => item.gene === gene);
  return result ? { kind: 'subtype-unique', subtype: context, result } : null;
}

export function findTreatmentResult(
  data: MdmaMasterData,
  context: 'cross' | TreatmentCohort,
  timepoint: TreatmentTimepoint,
  gene: string,
): SelectedTreatmentResult | null {
  if (context === 'cross') {
    const result = data.crossCohort.find((item) => item.gene === gene);
    return result ? { kind: 'pooled-cross-cohort', result } : null;
  }
  const result = data.timepoints[timepoint].cohorts[context].find((item) => item.gene === gene);
  return result
    ? { kind: 'timepoint-cohort', timepoint, cohort: context, result }
    : null;
}

export interface TreatmentViewDescriptor {
  kind: 'pooled-cross-cohort' | 'timepoint-cohort';
  title: string;
  shortLabel: string;
  csvFilename: string;
}

export function treatmentViewDescriptor(
  context: 'cross' | TreatmentCohort,
  timepoint: TreatmentTimepoint,
): TreatmentViewDescriptor {
  if (context === 'cross') {
    return {
      kind: 'pooled-cross-cohort',
      title: 'Pooled cross-cohort DMR results',
      shortLabel: 'Pooled · not timepoint-specific',
      csvFilename: 'Treatment_DMR_pooled_cross-cohort.csv',
    };
  }
  const label = timepoint === 'Pre'
    ? 'Baseline (Pre)'
    : context === 'MDMA'
      ? 'Follow-up (FUP1 / E2)'
      : 'Follow-up (FUP2)';
  return {
    kind: 'timepoint-cohort',
    title: `${context} cohort DMR results · ${label}`,
    shortLabel: label,
    csvFilename: `Treatment_DMR_${timepoint}_${context}_N8plus.csv`,
  };
}

export type CsvValue = string | number | boolean | null | undefined;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  const result = String(value);
  return /[",\r\n]/u.test(result) ? `"${result.replaceAll('"', '""')}"` : result;
}

export function serializeCsv(rows: readonly (readonly CsvValue[])[]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export type NominalPStars = '' | '*' | '**' | '***';

/** Display-only nominal-P tiers. FDR values must never be passed here. */
export function nominalPStars(pValue: number | null | undefined): NominalPStars {
  if (pValue == null || !Number.isFinite(pValue) || pValue < 0 || pValue >= 0.05) return '';
  if (pValue < 0.001) return '***';
  if (pValue < 0.01) return '**';
  return '*';
}
