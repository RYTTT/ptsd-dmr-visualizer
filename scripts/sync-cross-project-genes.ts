import { readFile, writeFile } from 'node:fs/promises';

type Direction = 'Hypermethylated' | 'Hypomethylated' | 'Mixed';
type Subtype = 'SSS' | 'ADS' | 'ICF' | 'ISS';
type Timepoint = 'Pre' | 'FUP';
type Cohort = 'MDMA' | 'Ketamine' | 'CPT';

interface ResultStat {
  gene: string;
  fdr: number;
  deltaBeta: number;
  direction: Direction;
}

interface PtsdCrossResult {
  gene: string;
  crossFdr: number;
  subtypes: Record<Subtype, { direction: Direction }>;
}

interface PtsdMaster {
  crossSubtype: PtsdCrossResult[];
  uniqueSubtypes: Record<Subtype, ResultStat[]>;
}

interface TreatmentMaster {
  crossCohort: ResultStat[];
  timepoints: Record<Timepoint, { cohorts: Record<Cohort, ResultStat[]> }>;
}

interface CrossProjectStat {
  type: string;
  fdr: number;
  direction: Direction;
  deltaBeta?: number;
}

interface CrossProjectInfo {
  ptsd: CrossProjectStat;
  mdma: CrossProjectStat;
}

type CrossProjectIndex = Record<string, CrossProjectInfo>;

const dataDirectory = new URL('../public/data/', import.meta.url);
const outputUrl = new URL('common/crossProjectGenes.json', dataDirectory);
const subtypes: readonly Subtype[] = ['SSS', 'ADS', 'ICF', 'ISS'];
const timepoints: readonly Timepoint[] = ['Pre', 'FUP'];
const cohorts: readonly Cohort[] = ['MDMA', 'Ketamine', 'CPT'];

async function readJson<T>(url: URL): Promise<T> {
  return JSON.parse(await readFile(url, 'utf8')) as T;
}

function validateStat(stat: ResultStat, path: string): void {
  if (
    typeof stat.gene !== 'string' || stat.gene.length === 0 ||
    !Number.isFinite(stat.fdr) || stat.fdr < 0 || stat.fdr > 1 ||
    !Number.isFinite(stat.deltaBeta) ||
    !['Hypermethylated', 'Hypomethylated', 'Mixed'].includes(stat.direction)
  ) {
    throw new Error(`Invalid result statistic at ${path}`);
  }
}

function setLowestFdr(
  results: Map<string, CrossProjectStat>,
  source: ResultStat,
  type: string,
  includeDeltaBeta: boolean,
): void {
  const current = results.get(source.gene);
  if (current && current.fdr <= source.fdr) return;
  results.set(source.gene, {
    type,
    fdr: source.fdr,
    direction: source.direction,
    ...(includeDeltaBeta ? { deltaBeta: source.deltaBeta } : {}),
  });
}

function crossSubtypeDirection(result: PtsdCrossResult): Direction {
  const directions = subtypes.map((subtype) => result.subtypes[subtype]?.direction);
  if (directions.some((direction) => direction === undefined)) {
    throw new Error(`Missing subtype direction for ${result.gene}`);
  }
  if (directions.some((direction) => direction === 'Mixed')) return 'Mixed';
  return directions.every((direction) => direction === directions[0])
    ? directions[0] as Direction
    : 'Mixed';
}

export function buildCrossProjectIndex(
  ptsd: PtsdMaster,
  treatment: TreatmentMaster,
): CrossProjectIndex {
  const ptsdResults = new Map<string, CrossProjectStat>();
  for (const subtype of subtypes) {
    const results = ptsd.uniqueSubtypes[subtype];
    if (!Array.isArray(results)) throw new Error(`Missing PTSD unique subtype ${subtype}`);
    for (const [index, result] of results.entries()) {
      validateStat(result, `uniqueSubtypes.${subtype}[${index}]`);
      setLowestFdr(ptsdResults, result, `subtype-unique:${subtype}`, false);
    }
  }
  if (!Array.isArray(ptsd.crossSubtype)) throw new Error('Missing PTSD crossSubtype array');
  for (const [index, result] of ptsd.crossSubtype.entries()) {
    if (
      typeof result.gene !== 'string' || result.gene.length === 0 ||
      !Number.isFinite(result.crossFdr) || result.crossFdr < 0 || result.crossFdr > 1
    ) throw new Error(`Invalid PTSD cross result at crossSubtype[${index}]`);
    ptsdResults.set(result.gene, {
      type: 'cross-subtype',
      fdr: result.crossFdr,
      direction: crossSubtypeDirection(result),
    });
  }

  const treatmentResults = new Map<string, CrossProjectStat>();
  for (const timepoint of timepoints) {
    const timepointData = treatment.timepoints[timepoint];
    if (!timepointData) throw new Error(`Missing treatment timepoint ${timepoint}`);
    for (const cohort of cohorts) {
      const results = timepointData.cohorts[cohort];
      if (!Array.isArray(results)) throw new Error(`Missing treatment cohort ${timepoint}.${cohort}`);
      for (const [index, result] of results.entries()) {
        validateStat(result, `timepoints.${timepoint}.cohorts.${cohort}[${index}]`);
        setLowestFdr(
          treatmentResults,
          result,
          `timepoint-cohort:${timepoint}:${cohort}`,
          true,
        );
      }
    }
  }
  if (!Array.isArray(treatment.crossCohort)) throw new Error('Missing treatment crossCohort array');
  for (const [index, result] of treatment.crossCohort.entries()) {
    validateStat(result, `crossCohort[${index}]`);
    treatmentResults.set(result.gene, {
      type: 'pooled-cross-cohort',
      fdr: result.fdr,
      deltaBeta: result.deltaBeta,
      direction: result.direction,
    });
  }

  const overlapGenes = [...ptsdResults.keys()]
    .filter((gene) => treatmentResults.has(gene))
    .sort((left, right) => left.localeCompare(right));
  return Object.fromEntries(overlapGenes.map((gene) => [gene, {
    ptsd: ptsdResults.get(gene)!,
    mdma: treatmentResults.get(gene)!,
  }]));
}

const ptsd = await readJson<PtsdMaster>(new URL('dmrData.json', dataDirectory));
const treatment = await readJson<TreatmentMaster>(new URL('mdma/dmrData.json', dataDirectory));
const expected = buildCrossProjectIndex(ptsd, treatment);
const expectedText = `${JSON.stringify(expected, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const current = await readJson<CrossProjectIndex>(outputUrl);
  if (JSON.stringify(current) !== JSON.stringify(expected)) {
    throw new Error(
      `crossProjectGenes.json is stale: expected ${Object.keys(expected).length} exact overlap records, found ${Object.keys(current).length}`,
    );
  }
  console.log(`Validated ${Object.keys(expected).length} exact PTSD/treatment overlap records.`);
} else {
  await writeFile(outputUrl, expectedText, 'utf8');
  console.log(`Wrote ${Object.keys(expected).length} exact PTSD/treatment overlap records.`);
}
