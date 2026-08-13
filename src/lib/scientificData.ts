import type {
  CrossCohortGene,
  CrossSubtypeDMR,
  CptHealthyControlGroup,
  Direction,
  MasterDMRData,
  MdmaMasterData,
  SelectedPtsdResult,
  SelectedTreatmentResult,
  SubtypeKey,
  SubtypeStat,
  TreatmentCohort,
  TreatmentComponentStat,
  TreatmentGeneContext,
  TreatmentGeneResult,
  TreatmentTimepoint,
  UniqueDMR,
} from '../types/dmr.ts';
import {
  CPT_HC_GROUPS,
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
    pValue: probability(item.pValue, `${path}.pValue`),
    deltaBeta: finite(item.deltaBeta, `${path}.deltaBeta`),
    fdr: probability(item.fdr, `${path}.fdr`),
    direction: direction(item.direction, `${path}.direction`),
    nSigProbes: count(item.nSigProbes, `${path}.nSigProbes`),
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
  if (nSubtypesSig !== SUBTYPE_KEYS.filter((key) => subtypes[key].fdr < 0.05).length) {
    fail(`${path}.nSubtypesSig`, 'equal to the number of subtype FDR values below 0.05');
  }
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
  const subtypeSource = record(item.subtypes, `${path}.subtypes`);
  const subtypes = Object.fromEntries(
    SUBTYPE_KEYS.map((key) => [key, parseSubtypeStat(subtypeSource[key], `${path}.subtypes.${key}`)]),
  ) as UniqueDMR['subtypes'];
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
    pValue: probability(item.pValue, `${path}.pValue`),
    fdr: probability(item.fdr, `${path}.fdr`),
    deltaBeta: finite(item.deltaBeta, `${path}.deltaBeta`),
    direction: direction(item.direction, `${path}.direction`),
    nSigProbes: count(item.nSigProbes, `${path}.nSigProbes`),
    subtypes,
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
    for (const result of parsed) {
      if (result.subtypes[key].fdr >= 0.05) fail(`uniqueSubtypes.${key}.${result.gene}`, `selected ${key} FDR below 0.05`);
      if (SUBTYPE_KEYS.some((comparison) => comparison !== key && result.subtypes[comparison].fdr < 0.05)) {
        fail(`uniqueSubtypes.${key}.${result.gene}`, `only ${key} subtype FDR below 0.05`);
      }
    }
    return [key, parsed];
  })) as MasterDMRData['uniqueSubtypes'];

  if (!Array.isArray(source.ptsdGenesList)) fail('ptsdGenesList', 'an array');
  const ptsdGenesList = source.ptsdGenesList.map((item, index) => string(item, `ptsdGenesList[${index}]`));
  return { crossSubtype, uniqueSubtypes, ptsdGenesList };
}

function parseTreatmentGeneResult(value: unknown, path: string, minimumProbes = 1): TreatmentGeneResult {
  const item = record(value, path);
  const totalProbes = count(item.totalProbes, `${path}.totalProbes`);
  const nSigProbes = count(item.nSigProbes, `${path}.nSigProbes`);
  const nPosTop3 = count(item.nPosTop3, `${path}.nPosTop3`);
  const nNegTop3 = count(item.nNegTop3, `${path}.nNegTop3`);
  const avgPosDeltaBeta = optionalFinite(item.avgPosDeltaBeta, `${path}.avgPosDeltaBeta`) ?? null;
  const avgNegDeltaBeta = optionalFinite(item.avgNegDeltaBeta, `${path}.avgNegDeltaBeta`) ?? null;
  const deltaBeta = finite(item.deltaBeta, `${path}.deltaBeta`);
  if (totalProbes < minimumProbes) fail(`${path}.totalProbes`, `at least ${minimumProbes}`);
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
  const cohortPSource = record(item.cohortPValues, `${path}.cohortPValues`);
  const cohortPValues = Object.fromEntries(TREATMENT_COHORTS.map((cohort) => [
    cohort,
    probability(cohortPSource[cohort], `${path}.cohortPValues.${cohort}`),
  ])) as CrossCohortGene['cohortPValues'];
  const componentSource = record(item.cohortComponents, `${path}.cohortComponents`);
  const cohortComponents = Object.fromEntries(TREATMENT_COHORTS.map((cohort) => {
    const componentPath = `${path}.cohortComponents.${cohort}`;
    const component = record(componentSource[cohort], componentPath);
    const nPosTop3 = count(component.nPosTop3, `${componentPath}.nPosTop3`);
    const nNegTop3 = count(component.nNegTop3, `${componentPath}.nNegTop3`);
    const avgPosDeltaBeta = optionalFinite(component.avgPosDeltaBeta, `${componentPath}.avgPosDeltaBeta`) ?? null;
    const avgNegDeltaBeta = optionalFinite(component.avgNegDeltaBeta, `${componentPath}.avgNegDeltaBeta`) ?? null;
    if (nPosTop3 + nNegTop3 < 1 || nPosTop3 + nNegTop3 > 3) fail(componentPath, 'consistent with one to three summarized probes');
    if ((nPosTop3 === 0) !== (avgPosDeltaBeta === null)) fail(`${componentPath}.avgPosDeltaBeta`, 'present exactly when nPosTop3 is positive');
    if ((nNegTop3 === 0) !== (avgNegDeltaBeta === null)) fail(`${componentPath}.avgNegDeltaBeta`, 'present exactly when nNegTop3 is positive');
    const deltaBeta = finite(component.deltaBeta, `${componentPath}.deltaBeta`);
    const expectedDeltaBeta = (nPosTop3 * (avgPosDeltaBeta ?? 0) + nNegTop3 * (avgNegDeltaBeta ?? 0)) / (nPosTop3 + nNegTop3);
    if (Math.abs(deltaBeta - expectedDeltaBeta) > 1e-12) fail(`${componentPath}.deltaBeta`, 'the count-weighted positive/negative Top-3 mean');
    const parsed: TreatmentComponentStat = {
      pValue: probability(component.pValue, `${componentPath}.pValue`),
      deltaBeta,
      direction: direction(component.direction, `${componentPath}.direction`),
      nPosTop3,
      avgPosDeltaBeta,
      nNegTop3,
      avgNegDeltaBeta,
    };
    if (parsed.pValue !== cohortPValues[cohort]) fail(`${componentPath}.pValue`, `equal to cohortPValues.${cohort}`);
    return [cohort, parsed];
  })) as CrossCohortGene['cohortComponents'];
  const nCohortsNominal = count(item.nCohortsNominal, `${path}.nCohortsNominal`);
  if (nCohortsNominal > TREATMENT_COHORTS.length) fail(`${path}.nCohortsNominal`, 'at most 3');
  if (nCohortsNominal !== TREATMENT_COHORTS.filter((cohort) => cohortPValues[cohort] < 0.05).length) {
    fail(`${path}.nCohortsNominal`, 'equal to the number of cohort P values below 0.05');
  }
  const componentSignsConsistent = boolean(item.componentSignsConsistent, `${path}.componentSignsConsistent`);
  const componentSigns = TREATMENT_COHORTS.map((cohort) => Math.sign(cohortComponents[cohort].deltaBeta));
  if (componentSignsConsistent !== componentSigns.every((sign) => sign !== 0 && sign === componentSigns[0])) {
    fail(`${path}.componentSignsConsistent`, 'equal to the observed component mean-sign consistency');
  }
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
    cohortPValues,
    cohortComponents,
    nCohortsNominal,
    componentSignsConsistent,
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
    contextRule: string(metadataSource.contextRule, 'metadata.contextRule'),
    metaSources: Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => {
      const timepointSource = record(record(metadataSource.metaSources, 'metadata.metaSources')[timepoint], `metadata.metaSources.${timepoint}`);
      return [timepoint, {
        selected: string(timepointSource.selected, `metadata.metaSources.${timepoint}.selected`),
        full: string(timepointSource.full, `metadata.metaSources.${timepoint}.full`),
      }];
    })) as MdmaMasterData['metadata']['metaSources'],
    cptHealthyControlSources: Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => {
      const timepointSource = record(record(metadataSource.cptHealthyControlSources, 'metadata.cptHealthyControlSources')[timepoint], `metadata.cptHealthyControlSources.${timepoint}`);
      return [timepoint, Object.fromEntries(CPT_HC_GROUPS.map((group) => [
        group,
        string(timepointSource[group], `metadata.cptHealthyControlSources.${timepoint}.${group}`),
      ]))];
    })) as MdmaMasterData['metadata']['cptHealthyControlSources'],
    cohortSources: parseSourceMatrix(metadataSource.cohortSources, 'metadata.cohortSources'),
    contextSources: parseSourceMatrix(metadataSource.contextSources, 'metadata.contextSources'),
  };
  const metaSource = record(source.metaAnalyses, 'metaAnalyses');
  const metaAnalyses = Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => {
    const items = metaSource[timepoint];
    if (!Array.isArray(items)) fail(`metaAnalyses.${timepoint}`, 'an array');
    const parsed = items.map((item, index) => parseCrossCohortGene(item, `metaAnalyses.${timepoint}[${index}]`));
    assertUniqueGenes(parsed, `metaAnalyses.${timepoint}`);
    for (const result of parsed) {
      if (result.pValue >= 5e-6) fail(`metaAnalyses.${timepoint}.${result.gene}.pValue`, 'below 5e-6 for a selected meta-analysis row');
      if (result.nSigProbes < 8) fail(`metaAnalyses.${timepoint}.${result.gene}.nSigProbes`, 'at least 8 for a selected meta-analysis row');
    }
    return [timepoint, parsed];
  })) as MdmaMasterData['metaAnalyses'];
  const cptHealthyControlSource = record(source.cptHealthyControl, 'cptHealthyControl');
  const cptHealthyControl = Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => {
    const timepointItem = record(cptHealthyControlSource[timepoint], `cptHealthyControl.${timepoint}`);
    const groupSource = record(timepointItem.groups, `cptHealthyControl.${timepoint}.groups`);
    const groups = Object.fromEntries(CPT_HC_GROUPS.map((group) => {
      const items = groupSource[group];
      if (!Array.isArray(items)) fail(`cptHealthyControl.${timepoint}.groups.${group}`, 'an array');
      const parsed = items.map((item, index) => parseTreatmentGeneResult(item, `cptHealthyControl.${timepoint}.groups.${group}[${index}]`, 8));
      assertUniqueGenes(parsed, `cptHealthyControl.${timepoint}.groups.${group}`);
      for (const result of parsed) {
        if (result.pValue >= 5e-6) fail(`cptHealthyControl.${timepoint}.${group}.${result.gene}.pValue`, 'below 5e-6');
        if (result.nSigProbes < 8) fail(`cptHealthyControl.${timepoint}.${group}.${result.gene}.nSigProbes`, 'at least 8');
      }
      return [group, parsed];
    })) as MdmaMasterData['cptHealthyControl'][TreatmentTimepoint]['groups'];
    return [timepoint, { groups }];
  })) as MdmaMasterData['cptHealthyControl'];
  const timepointSource = record(source.timepoints, 'timepoints');
  const timepoints = Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => {
    const timepointItem = record(timepointSource[timepoint], `timepoints.${timepoint}`);
    const cohortSource = record(timepointItem.cohorts, `timepoints.${timepoint}.cohorts`);
    const cohorts = Object.fromEntries(TREATMENT_COHORTS.map((cohort) => {
      const items = cohortSource[cohort];
      if (!Array.isArray(items)) fail(`timepoints.${timepoint}.cohorts.${cohort}`, 'an array');
      const parsed = items.map((item, index) => parseTreatmentGeneResult(item, `timepoints.${timepoint}.cohorts.${cohort}[${index}]`, 8));
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
  return { metadata, metaAnalyses, cptHealthyControl, timepoints, geneContexts };
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
  context: 'cross' | 'CPT-HC' | TreatmentCohort,
  timepoint: TreatmentTimepoint,
  gene: string,
  cptHealthyControlGroup: CptHealthyControlGroup = 'Responder',
): SelectedTreatmentResult | null {
  if (context === 'cross') {
    const result = data.metaAnalyses[timepoint].find((item) => item.gene === gene);
    return result ? { kind: 'timepoint-meta-analysis', timepoint, result } : null;
  }
  if (context === 'CPT-HC') {
    const result = data.cptHealthyControl[timepoint].groups[cptHealthyControlGroup].find((item) => item.gene === gene);
    return result ? { kind: 'cpt-healthy-control', timepoint, group: cptHealthyControlGroup, result } : null;
  }
  const result = data.timepoints[timepoint].cohorts[context].find((item) => item.gene === gene);
  return result
    ? { kind: 'timepoint-cohort', timepoint, cohort: context, result }
    : null;
}

export interface TreatmentViewDescriptor {
  kind: 'timepoint-meta-analysis' | 'timepoint-cohort' | 'cpt-healthy-control';
  title: string;
  shortLabel: string;
  csvFilename: string;
}

export function treatmentViewDescriptor(
  context: 'cross' | 'CPT-HC' | TreatmentCohort,
  timepoint: TreatmentTimepoint,
  cptHealthyControlGroup: CptHealthyControlGroup = 'Responder',
): TreatmentViewDescriptor {
  if (context === 'cross') {
    const label = timepoint === 'Pre' ? 'Baseline (Pre)' : 'Follow-up (Post)';
    return {
      kind: 'timepoint-meta-analysis',
      title: `Three-study meta-analysis · ${label}`,
      shortLabel: label,
      csvFilename: `Treatment_DMR_${timepoint}_three-study-meta-analysis.csv`,
    };
  }
  if (context === 'CPT-HC') {
    const visit = timepoint === 'Pre' ? 'Baseline (Pre)' : 'Follow-up (FUP2)';
    const groupLabel = cptHealthyControlGroup === 'Responder' ? 'Responder vs HC' : 'NonResponder vs HC';
    return {
      kind: 'cpt-healthy-control',
      title: `CPT ${groupLabel} · ${visit}`,
      shortLabel: groupLabel,
      csvFilename: `Treatment_DMR_CPT_${timepoint}_${cptHealthyControlGroup}-vs-HC.csv`,
    };
  }
  const label = timepoint === 'Pre'
    ? 'Baseline (Pre)'
    : context === 'MDMA'
      ? 'Follow-up (FUP1 / E2)'
      : 'Follow-up (FUP2)';
  return {
    kind: 'timepoint-cohort',
    title: `${context} · ${label}`,
    shortLabel: label,
    csvFilename: `Treatment_DMR_${timepoint}_${context}_screened.csv`,
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

/**
 * Returns the largest nominal P among displayed results passing an FDR cutoff.
 * This lets a nominal-P volcano axis show the observed adjusted-significance
 * boundary without incorrectly treating the FDR cutoff itself as a P value.
 */
export function displayedFdrNominalPBoundary(
  results: readonly { pValue: number | null | undefined; fdr: number | null | undefined }[],
  cutoff = 0.05,
): number | null {
  const passingPValues = results.flatMap(({ pValue, fdr }) => (
    pValue != null &&
    fdr != null &&
    Number.isFinite(pValue) &&
    Number.isFinite(fdr) &&
    pValue >= 0 &&
    pValue <= 1 &&
    fdr >= 0 &&
    fdr < cutoff
      ? [pValue]
      : []
  ));
  return passingPValues.length > 0 ? Math.max(...passingPValues) : null;
}
