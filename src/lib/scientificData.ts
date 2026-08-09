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
  TreatmentMeasurement,
  TreatmentTimepoint,
  UniqueDMR,
  UniqueTreatmentGene,
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

function parseTreatmentMeasurement(value: unknown, path: string): TreatmentMeasurement {
  const item = record(value, path);
  if (item.direction === 'N/A') {
    return { deltaBeta: null, fdr: null, direction: null };
  }
  return {
    deltaBeta: finite(item.deltaBeta, `${path}.deltaBeta`),
    fdr: probability(item.fdr, `${path}.fdr`),
    direction: direction(item.direction, `${path}.direction`),
  };
}

function parseUniqueTreatmentGene(value: unknown, path: string): UniqueTreatmentGene {
  const item = record(value, path);
  const totalProbes = count(item.totalProbes, `${path}.totalProbes`);
  const nSigProbes = count(item.nSigProbes, `${path}.nSigProbes`);
  if (nSigProbes > totalProbes) fail(`${path}.nSigProbes`, 'no greater than totalProbes');
  return {
    gene: string(item.gene, `${path}.gene`),
    totalProbes,
    nSigProbes,
    fdr: probability(item.fdr, `${path}.fdr`),
    deltaBeta: finite(item.deltaBeta, `${path}.deltaBeta`),
    direction: direction(item.direction, `${path}.direction`),
  };
}

function parseCrossCohortGene(value: unknown, path: string): CrossCohortGene {
  const item = record(value, path);
  const totalProbes = count(item.totalProbes, `${path}.totalProbes`);
  const nSigProbes = count(item.nSigProbes, `${path}.nSigProbes`);
  if (nSigProbes > totalProbes) fail(`${path}.nSigProbes`, 'no greater than totalProbes');
  const cohortSource = record(item.cohorts, `${path}.cohorts`);
  const cohorts = Object.fromEntries(TREATMENT_COHORTS.map((cohort) => {
    const cohortItem = record(cohortSource[cohort], `${path}.cohorts.${cohort}`);
    return [cohort, {
      pooled: parseTreatmentMeasurement(cohortItem, `${path}.cohorts.${cohort}.pooled`),
      timepoints: Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => [
        timepoint,
        parseTreatmentMeasurement(cohortItem[timepoint], `${path}.cohorts.${cohort}.${timepoint}`),
      ])) as Record<TreatmentTimepoint, TreatmentMeasurement>,
    }];
  })) as CrossCohortGene['cohorts'];
  return {
    gene: string(item.gene, `${path}.gene`),
    fdr: probability(item.fdr, `${path}.fdr`),
    pValue: probability(item.pValue, `${path}.pValue`),
    deltaBeta: finite(item.deltaBeta, `${path}.deltaBeta`),
    direction: direction(item.direction, `${path}.direction`),
    totalProbes,
    nSigProbes,
    cohorts,
  };
}

/** Validate and normalize treatment master JSON; N/A sentinels become null. */
export function validateMdmaMasterData(value: unknown): MdmaMasterData {
  const source = record(value, 'treatment master data');
  if (!Array.isArray(source.crossCohort)) fail('crossCohort', 'an array');
  const crossCohort = source.crossCohort.map((item, index) => parseCrossCohortGene(item, `crossCohort[${index}]`));
  assertUniqueGenes(crossCohort, 'crossCohort');
  const timepointSource = record(source.timepoints, 'timepoints');
  const timepoints = Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => {
    const timepointItem = record(timepointSource[timepoint], `timepoints.${timepoint}`);
    const uniqueSource = record(timepointItem.uniqueCohorts, `timepoints.${timepoint}.uniqueCohorts`);
    const uniqueCohorts = Object.fromEntries(TREATMENT_COHORTS.map((cohort) => {
      const items = uniqueSource[cohort];
      if (!Array.isArray(items)) fail(`timepoints.${timepoint}.uniqueCohorts.${cohort}`, 'an array');
      const parsed = items.map((item, index) => parseUniqueTreatmentGene(item, `timepoints.${timepoint}.uniqueCohorts.${cohort}[${index}]`));
      assertUniqueGenes(parsed, `timepoints.${timepoint}.uniqueCohorts.${cohort}`);
      return [cohort, parsed];
    })) as Record<TreatmentCohort, UniqueTreatmentGene[]>;
    return [timepoint, { uniqueCohorts }];
  })) as MdmaMasterData['timepoints'];
  return { crossCohort, timepoints };
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
  const result = data.timepoints[timepoint].uniqueCohorts[context].find((item) => item.gene === gene);
  return result
    ? { kind: 'timepoint-cohort-unique', timepoint, cohort: context, result }
    : null;
}

export interface TreatmentViewDescriptor {
  kind: 'pooled-cross-cohort' | 'timepoint-cohort-unique';
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
  const label = timepoint === 'Pre' ? 'Baseline (Pre)' : 'Follow-up (FUP)';
  return {
    kind: 'timepoint-cohort-unique',
    title: `${context}-unique DMR results · ${label}`,
    shortLabel: label,
    csvFilename: `Treatment_DMR_${timepoint}_${context}_unique.csv`,
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
