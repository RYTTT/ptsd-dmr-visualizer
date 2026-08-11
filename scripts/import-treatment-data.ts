import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';

import type {
  CrossCohortGene,
  CptHealthyControlGroup,
  Direction,
  MdmaMasterData,
  TreatmentCohort,
  TreatmentGeneContext,
  TreatmentGeneResult,
  TreatmentComponentStat,
  TreatmentTimepoint,
} from '../src/types/dmr.ts';
import { CPT_HC_GROUPS, TREATMENT_COHORTS, TREATMENT_TIMEPOINTS } from '../src/types/dmr.ts';

type CsvRow = Record<string, string>;

const DEFAULT_SOURCE_ROOT = '/Users/ruotingyang/Documents/manuscripts/MDMA_antigravity/result/IPW_DMP_Analysis_2026_v2_CD4T_arrayWeights';
const OUTPUT_FILE = new URL('../public/data/mdma/dmrData.json', import.meta.url);
const metaSources: Record<TreatmentTimepoint, { selected: string; full: string }> = {
  Pre: {
    selected: 'Meta_Analysis_Pre_Gene_Level_DMRs_Top3_1000Genes_Primary.csv',
    full: 'Meta_Analysis_Pre_Gene_Level_DMRs_Top3_FULL.csv',
  },
  FUP: {
    selected: 'Meta_Analysis_Post_Gene_Level_DMRs_Top3_1000Genes_Primary.csv',
    full: 'Meta_Analysis_Post_Gene_Level_DMRs_Top3_FULL.csv',
  },
};
const expectedMetaCounts: Record<TreatmentTimepoint, { selected: number; full: number }> = {
  Pre: { selected: 347, full: 24_084 },
  FUP: { selected: 1_115, full: 24_084 },
};
const cptHealthyControlSources: Record<TreatmentTimepoint, Record<CptHealthyControlGroup, string>> = {
  Pre: {
    Responder: 'CPT/CPT_Pre_Responder_vs_HC_DMPs_AllProbes.csv',
    NonResponder: 'CPT/CPT_Pre_NonResponder_vs_HC_DMPs_AllProbes.csv',
  },
  FUP: {
    Responder: 'CPT/CPT_FUP2_Responder_vs_HC_DMPs_AllProbes.csv',
    NonResponder: 'CPT/CPT_FUP2_NonResponder_vs_HC_DMPs_AllProbes.csv',
  },
};
const expectedCptHealthyControlCounts: Record<TreatmentTimepoint, Record<CptHealthyControlGroup, number>> = {
  Pre: { Responder: 44, NonResponder: 23 },
  FUP: { Responder: 172, NonResponder: 335 },
};
const EXPECTED_CPT_HC_PROBE_ROWS = 602_313;

const cohortSources: Record<TreatmentTimepoint, Record<TreatmentCohort, string>> = {
  Pre: {
    MDMA: 'MDMA/MDMA_Pre_Responder_vs_NonResponder_Gene_DMRs_N8plus.csv',
    Ketamine: 'Ketamine/Ketamine_Pre_Responder_vs_NonResponder_Gene_DMRs_N8plus.csv',
    CPT: 'CPT/CPT_Pre_Responder_vs_NonResponder_Gene_DMRs_N8plus.csv',
  },
  FUP: {
    MDMA: 'MDMA/MDMA_FUP1_Responder_vs_NonResponder_Gene_DMRs_N8plus.csv',
    Ketamine: 'Ketamine/Ketamine_FUP2_Responder_vs_NonResponder_Gene_DMRs_N8plus.csv',
    CPT: 'CPT/CPT_FUP2_Responder_vs_NonResponder_Gene_DMRs_N8plus.csv',
  },
};

const contextSources: Record<TreatmentTimepoint, Record<TreatmentCohort, string>> = {
  Pre: {
    MDMA: 'MDMA/MDMA_Pre_Responder_vs_NonResponder_Gene_DMRs_AllGenes.csv',
    Ketamine: 'Ketamine/Ketamine_Pre_Responder_vs_NonResponder_Gene_DMRs_AllGenes.csv',
    CPT: 'CPT/CPT_Pre_Responder_vs_NonResponder_Gene_DMRs_AllGenes.csv',
  },
  FUP: {
    MDMA: 'MDMA/MDMA_FUP1_Responder_vs_NonResponder_Gene_DMRs_AllGenes.csv',
    Ketamine: 'Ketamine/Ketamine_FUP2_Responder_vs_NonResponder_Gene_DMRs_AllGenes.csv',
    CPT: 'CPT/CPT_FUP2_Responder_vs_NonResponder_Gene_DMRs_AllGenes.csv',
  },
};

const expectedSelectedCounts: Record<TreatmentTimepoint, Record<TreatmentCohort, number>> = {
  Pre: { MDMA: 693, Ketamine: 404, CPT: 515 },
  FUP: { MDMA: 1064, Ketamine: 661, CPT: 1409 },
};
const expectedContextCounts: Record<TreatmentCohort, number> = {
  MDMA: 24084,
  Ketamine: 24084,
  CPT: 24084,
};

const requiredGeneColumns = [
  'Gene',
  'Total_Gene_Probes',
  'N_Sig_Probes_p05',
  'Gene_Fisher_P',
  'Gene_FDR',
  'Pattern',
  'N_Pos_Probes_Top3',
  'Ave_Pos_Beta_Diff_Top3',
  'N_Neg_Probes_Top3',
  'Ave_Neg_Beta_Diff_Top3',
] as const;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/u, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error('CSV ends inside a quoted field');
  if (field !== '' || row.length > 0) {
    row.push(field.replace(/\r$/u, ''));
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value !== ''));
}

async function csvRows(file: string): Promise<CsvRow[]> {
  const matrix = parseCsv(await readFile(file, 'utf8'));
  const headers = matrix.shift();
  if (!headers) throw new Error(`${file}: missing header row`);
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicates.length) throw new Error(`${file}: duplicate headers ${duplicates.join(', ')}`);
  return matrix.map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(`${file}:${rowIndex + 2}: expected ${headers.length} columns, found ${values.length}`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function parseCsvLine(text: string): string[] {
  const row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error('CSV row ends inside a quoted field');
  row.push(field.replace(/\r$/u, ''));
  return row;
}

function required(row: CsvRow, key: string, source: string): string {
  const value = row[key]?.trim();
  if (!value) throw new Error(`${source}: ${key} is required`);
  return value;
}

function numberValue(row: CsvRow, key: string, source: string): number {
  const value = Number(required(row, key, source));
  if (!Number.isFinite(value)) throw new Error(`${source}: ${key} must be finite`);
  return value;
}

function optionalNumber(row: CsvRow, key: string, source: string): number | null {
  const raw = row[key]?.trim();
  if (!raw || raw.toUpperCase() === 'NA' || raw.toUpperCase() === 'NAN') return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${source}: ${key} must be finite or blank`);
  return value;
}

function integerValue(row: CsvRow, key: string, source: string): number {
  const value = numberValue(row, key, source);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${source}: ${key} must be a non-negative integer`);
  return value;
}

function patternDirection(pattern: string, source: string): Direction {
  if (pattern === 'Hypermethylated (+)') return 'Hypermethylated';
  if (pattern === 'Hypomethylated (-)') return 'Hypomethylated';
  if (pattern === 'Mixed (+/-)') return 'Mixed';
  throw new Error(`${source}: unsupported Pattern ${pattern}`);
}

function weightedTop3Mean(
  nPositive: number,
  positiveMean: number | null,
  nNegative: number,
  negativeMean: number | null,
  source: string,
): number {
  const count = nPositive + nNegative;
  if (count < 1 || count > 3) throw new Error(`${source}: top-three direction counts must total 1–3`);
  if (nPositive > 0 && positiveMean == null) throw new Error(`${source}: positive mean missing for positive probes`);
  if (nNegative > 0 && negativeMean == null) throw new Error(`${source}: negative mean missing for negative probes`);
  return (nPositive * (positiveMean ?? 0) + nNegative * (negativeMean ?? 0)) / count;
}

interface CptHealthyControlAccumulator {
  gene: string;
  totalProbes: number;
  nSigProbes: number;
  topProbes: Array<{ pValue: number; deltaBeta: number }>;
}

function fisherProbability(pValues: readonly number[], source: string): number {
  if (pValues.length < 1 || pValues.length > 3) throw new Error(`${source}: Fisher combination requires one to three P values`);
  if (pValues.some((value) => value <= 0 || value > 1)) throw new Error(`${source}: Fisher P values must be in (0,1]`);
  const lambda = -pValues.reduce((sum, value) => sum + Math.log(value), 0);
  let series = 1;
  let term = 1;
  for (let order = 1; order < pValues.length; order += 1) {
    term *= lambda / order;
    series += term;
  }
  return Math.max(Number.MIN_VALUE, Math.min(1, Math.exp(-lambda) * series));
}

function applyBenjaminiHochberg<T extends { pValue: number; fdr: number }>(results: T[]): void {
  const ranked = [...results].sort((left, right) => left.pValue - right.pValue);
  let runningMinimum = 1;
  for (let index = ranked.length - 1; index >= 0; index -= 1) {
    runningMinimum = Math.min(runningMinimum, ranked[index].pValue * ranked.length / (index + 1));
    ranked[index].fdr = Math.min(1, runningMinimum);
  }
}

async function deriveCptHealthyControlResults(file: string): Promise<{ fullCount: number; selected: TreatmentGeneResult[] }> {
  const input = createReadStream(file);
  const lines = createInterface({ input, crlfDelay: Infinity });
  const accumulators = new Map<string, CptHealthyControlAccumulator>();
  let headers: string[] | null = null;
  let rowNumber = 0;
  for await (const line of lines) {
    rowNumber += 1;
    const values = parseCsvLine(line);
    if (!headers) {
      headers = values;
      for (const column of ['Gene_Symbol', 'P.Value', 'Beta_Diff']) {
        if (!headers.includes(column)) throw new Error(`${file}: missing column ${column}`);
      }
      continue;
    }
    if (values.length !== headers.length) throw new Error(`${file}:${rowNumber}: expected ${headers.length} columns, found ${values.length}`);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    const source = `${file}:${rowNumber}`;
    const pValue = numberValue(row, 'P.Value', source);
    const deltaBeta = numberValue(row, 'Beta_Diff', source);
    if (pValue <= 0 || pValue > 1) throw new Error(`${source}: P.Value must be in (0,1]`);
    const gene = row.Gene_Symbol?.trim();
    if (!gene) continue;
    const key = gene.toUpperCase();
    const accumulator = accumulators.get(key) ?? { gene, totalProbes: 0, nSigProbes: 0, topProbes: [] };
    accumulator.totalProbes += 1;
    if (pValue < 0.05) accumulator.nSigProbes += 1;
    accumulator.topProbes.push({ pValue, deltaBeta });
    accumulator.topProbes.sort((left, right) => left.pValue - right.pValue);
    if (accumulator.topProbes.length > 3) accumulator.topProbes.pop();
    accumulators.set(key, accumulator);
  }
  if (rowNumber - 1 !== EXPECTED_CPT_HC_PROBE_ROWS) {
    throw new Error(`${file}: expected ${EXPECTED_CPT_HC_PROBE_ROWS} probe rows, found ${rowNumber - 1}`);
  }
  const summaries = [...accumulators.values()].map((accumulator) => ({
    accumulator,
    pValue: fisherProbability(accumulator.topProbes.map((probe) => probe.pValue), `${file}:${accumulator.gene}`),
    fdr: 1,
  }));
  applyBenjaminiHochberg(summaries);
  const selected = summaries
    .filter(({ accumulator, pValue }) => pValue < 5e-6 && accumulator.nSigProbes >= 8)
    .map(({ accumulator, pValue, fdr }) => {
    const positive = accumulator.topProbes.filter((probe) => probe.deltaBeta > 0);
    const negative = accumulator.topProbes.filter((probe) => probe.deltaBeta < 0);
    if (positive.length + negative.length < 1) throw new Error(`${file}:${accumulator.gene}: selected result has all-zero Top-3 effects`);
    const avgPosDeltaBeta = positive.length > 0
      ? positive.reduce((sum, probe) => sum + probe.deltaBeta, 0) / positive.length
      : null;
    const avgNegDeltaBeta = negative.length > 0
      ? negative.reduce((sum, probe) => sum + probe.deltaBeta, 0) / negative.length
      : null;
    const source = `${file}:${accumulator.gene}`;
    const result: TreatmentGeneResult = {
      gene: accumulator.gene,
      totalProbes: accumulator.totalProbes,
      nSigProbes: accumulator.nSigProbes,
      pValue,
      fdr,
      deltaBeta: weightedTop3Mean(positive.length, avgPosDeltaBeta, negative.length, avgNegDeltaBeta, source),
      direction: positive.length > 0 && negative.length > 0
        ? 'Mixed'
        : positive.length > 0 ? 'Hypermethylated' : 'Hypomethylated',
      nPosTop3: positive.length,
      avgPosDeltaBeta,
      nNegTop3: negative.length,
      avgNegDeltaBeta,
    };
    return result;
  });
  return { fullCount: summaries.length, selected };
}

function treatmentResult(row: CsvRow, source: string, minimumProbes = 1): TreatmentGeneResult {
  for (const column of requiredGeneColumns) {
    if (!(column in row)) throw new Error(`${source}: missing column ${column}`);
  }
  const gene = required(row, 'Gene', source);
  const totalProbes = integerValue(row, 'Total_Gene_Probes', source);
  const nSigProbes = integerValue(row, 'N_Sig_Probes_p05', source);
  const pValue = numberValue(row, 'Gene_Fisher_P', source);
  const fdr = numberValue(row, 'Gene_FDR', source);
  const nPosTop3 = integerValue(row, 'N_Pos_Probes_Top3', source);
  const avgPosDeltaBeta = optionalNumber(row, 'Ave_Pos_Beta_Diff_Top3', source);
  const nNegTop3 = integerValue(row, 'N_Neg_Probes_Top3', source);
  const avgNegDeltaBeta = optionalNumber(row, 'Ave_Neg_Beta_Diff_Top3', source);
  if (totalProbes < minimumProbes) throw new Error(`${source}: Total_Gene_Probes must be at least ${minimumProbes}`);
  if (nSigProbes > totalProbes) throw new Error(`${source}: significant probes exceed total probes`);
  if (pValue < 0 || pValue > 1 || fdr < 0 || fdr > 1) throw new Error(`${source}: P/FDR outside [0,1]`);
  return {
    gene,
    totalProbes,
    nSigProbes,
    pValue,
    fdr,
    deltaBeta: weightedTop3Mean(nPosTop3, avgPosDeltaBeta, nNegTop3, avgNegDeltaBeta, source),
    direction: patternDirection(required(row, 'Pattern', source), source),
    nPosTop3,
    avgPosDeltaBeta,
    nNegTop3,
    avgNegDeltaBeta,
  };
}

function metaAnalysisResult(row: CsvRow, source: string): CrossCohortGene {
  const directionValue = patternDirection(required(row, 'Meta_Pattern', source), source);
  const cohortComponents = Object.fromEntries(TREATMENT_COHORTS.map((cohort) => {
    const nPosTop3 = integerValue(row, `${cohort}_N_Hyper`, source);
    const avgPosDeltaBeta = optionalNumber(row, `${cohort}_Ave_Hyper_Beta`, source);
    const nNegTop3 = integerValue(row, `${cohort}_N_Hypo`, source);
    const avgNegDeltaBeta = optionalNumber(row, `${cohort}_Ave_Hypo_Beta`, source);
    const component: TreatmentComponentStat = {
      pValue: numberValue(row, `${cohort}_P_Top3`, source),
      deltaBeta: weightedTop3Mean(nPosTop3, avgPosDeltaBeta, nNegTop3, avgNegDeltaBeta, source),
      direction: nPosTop3 > 0 && nNegTop3 > 0 ? 'Mixed' : nPosTop3 > 0 ? 'Hypermethylated' : 'Hypomethylated',
      nPosTop3,
      avgPosDeltaBeta,
      nNegTop3,
      avgNegDeltaBeta,
    };
    return [cohort, component];
  })) as CrossCohortGene['cohortComponents'];
  const cohortPValues = Object.fromEntries(TREATMENT_COHORTS.map((cohort) => [cohort, cohortComponents[cohort].pValue])) as CrossCohortGene['cohortPValues'];
  const componentSigns = TREATMENT_COHORTS.map((cohort) => Math.sign(cohortComponents[cohort].deltaBeta));
  const metaNPosTop3 = integerValue(row, 'Meta_N_Hyper', source);
  const metaAvgPosDeltaBeta = optionalNumber(row, 'Meta_Ave_Hyper_Beta', source);
  const metaNNegTop3 = integerValue(row, 'Meta_N_Hypo', source);
  const metaAvgNegDeltaBeta = optionalNumber(row, 'Meta_Ave_Hypo_Beta', source);
  return {
    gene: required(row, 'Gene', source),
    fdr: numberValue(row, 'Gene_Meta_FDR_Top3', source),
    pValue: numberValue(row, 'Gene_Meta_P_Top3', source),
    deltaBeta: weightedTop3Mean(metaNPosTop3, metaAvgPosDeltaBeta, metaNNegTop3, metaAvgNegDeltaBeta, source),
    direction: directionValue,
    totalProbes: integerValue(row, 'Total_Gene_Probes', source),
    nSigProbes: integerValue(row, 'N_Sig_Probes_p05', source),
    cohortPValues,
    cohortComponents,
    nCohortsNominal: TREATMENT_COHORTS.filter((cohort) => cohortPValues[cohort] < 0.05).length,
    componentSignsConsistent: componentSigns.every((sign) => sign !== 0 && sign === componentSigns[0]),
  };
}

function indexByGene(items: TreatmentGeneResult[], source: string): Map<string, TreatmentGeneResult> {
  const result = new Map<string, TreatmentGeneResult>();
  for (const item of items) {
    const key = item.gene.toUpperCase();
    if (result.has(key)) throw new Error(`${source}: duplicate gene ${item.gene}`);
    result.set(key, item);
  }
  return result;
}

function indexCsvByGene(items: CsvRow[], source: string): Map<string, CsvRow> {
  const result = new Map<string, CsvRow>();
  for (const [index, item] of items.entries()) {
    const gene = required(item, 'Gene', `${source}:${index + 2}`);
    const key = gene.toUpperCase();
    if (result.has(key)) throw new Error(`${source}: duplicate gene ${gene}`);
    result.set(key, item);
  }
  return result;
}

function sameTreatmentResult(left: TreatmentGeneResult, right: TreatmentGeneResult): boolean {
  const close = (a: number | null, b: number | null) => {
    if (a === null || b === null) return a === b;
    return Math.abs(a - b) <= Math.max(1e-12, Math.abs(a) * 1e-10, Math.abs(b) * 1e-10);
  };
  return left.gene.toUpperCase() === right.gene.toUpperCase()
    && left.totalProbes === right.totalProbes
    && left.nSigProbes === right.nSigProbes
    && left.direction === right.direction
    && left.nPosTop3 === right.nPosTop3
    && left.nNegTop3 === right.nNegTop3
    && close(left.pValue, right.pValue)
    && close(left.fdr, right.fdr)
    && close(left.deltaBeta, right.deltaBeta)
    && close(left.avgPosDeltaBeta, right.avgPosDeltaBeta)
    && close(left.avgNegDeltaBeta, right.avgNegDeltaBeta);
}

function comparablePayload(value: MdmaMasterData): string {
  return JSON.stringify({
    ...value,
    metadata: { ...value.metadata, generatedAt: '' },
  });
}

async function stableGeneratedAt(output: MdmaMasterData): Promise<string> {
  try {
    const previous = JSON.parse(await readFile(OUTPUT_FILE, 'utf8')) as MdmaMasterData;
    if (comparablePayload(previous) === comparablePayload(output)) {
      return previous.metadata.generatedAt;
    }
  } catch {
    // A missing or malformed prior artifact must not prevent a clean rebuild.
  }
  return output.metadata.generatedAt;
}

async function main() {
  const sourceRoot = path.resolve(process.argv[2] ?? DEFAULT_SOURCE_ROOT);
  const selected = {} as Record<TreatmentTimepoint, Record<TreatmentCohort, TreatmentGeneResult[]>>;
  const coverageIndexes = {} as Record<TreatmentTimepoint, Record<TreatmentCohort, Map<string, CsvRow>>>;

  for (const timepoint of TREATMENT_TIMEPOINTS) {
    selected[timepoint] = {} as Record<TreatmentCohort, TreatmentGeneResult[]>;
    coverageIndexes[timepoint] = {} as Record<TreatmentCohort, Map<string, CsvRow>>;
    for (const cohort of TREATMENT_COHORTS) {
      const selectedFile = path.join(sourceRoot, cohortSources[timepoint][cohort]);
      const coverageFile = path.join(sourceRoot, contextSources[timepoint][cohort]);
      const selectedRows = await csvRows(selectedFile);
      const coverageRows = await csvRows(coverageFile);
      if (selectedRows.length !== expectedSelectedCounts[timepoint][cohort]) {
        throw new Error(`${selectedFile}: expected ${expectedSelectedCounts[timepoint][cohort]} rows, found ${selectedRows.length}`);
      }
      if (coverageRows.length !== expectedContextCounts[cohort]) {
        throw new Error(`${coverageFile}: expected ${expectedContextCounts[cohort]} rows, found ${coverageRows.length}`);
      }
      const selectedResults = selectedRows.map((row, index) => treatmentResult(row, `${selectedFile}:${index + 2}`, 8));
      const selectedIndex = indexByGene(selectedResults, selectedFile);
      const coverageIndex = indexCsvByGene(coverageRows, coverageFile);
      for (const [gene, result] of selectedIndex) {
        if (result.nSigProbes < 8) throw new Error(`${selectedFile}: ${gene} has fewer than 8 significant probes`);
        if (result.fdr >= 0.05) throw new Error(`${selectedFile}: ${gene} has Gene_FDR >= 0.05`);
        const coverageRow = coverageIndex.get(gene);
        const coverageResult = coverageRow ? treatmentResult(coverageRow, `${coverageFile}:${gene}`, 1) : null;
        if (!coverageResult || !sameTreatmentResult(result, coverageResult)) {
          throw new Error(`${selectedFile}: ${gene} does not exactly match its coverage-table record`);
        }
      }
      selected[timepoint][cohort] = selectedResults;
      coverageIndexes[timepoint][cohort] = coverageIndex;
    }
  }

  const metaAnalyses = {} as Record<TreatmentTimepoint, CrossCohortGene[]>;
  for (const timepoint of TREATMENT_TIMEPOINTS) {
    const { selected: selectedSource, full: fullSource } = metaSources[timepoint];
    const selectedRows = await csvRows(path.join(sourceRoot, selectedSource));
    const fullRows = await csvRows(path.join(sourceRoot, fullSource));
    if (selectedRows.length !== expectedMetaCounts[timepoint].selected) {
      throw new Error(`${selectedSource}: expected ${expectedMetaCounts[timepoint].selected} rows, found ${selectedRows.length}`);
    }
    if (fullRows.length !== expectedMetaCounts[timepoint].full) {
      throw new Error(`${fullSource}: expected ${expectedMetaCounts[timepoint].full} rows, found ${fullRows.length}`);
    }
    const fullIndex = indexCsvByGene(fullRows, fullSource);
    metaAnalyses[timepoint] = selectedRows.map((row, index) => {
      const source = `${selectedSource}:${index + 2}`;
      const gene = required(row, 'Gene', source);
      const fullRow = fullIndex.get(gene.toUpperCase());
      if (!fullRow) throw new Error(`${fullSource}: missing selected gene ${gene}`);
      if (JSON.stringify(row) !== JSON.stringify(fullRow)) {
        throw new Error(`${selectedSource}: ${gene} does not exactly match the full-table record`);
      }
      const result = metaAnalysisResult(row, source);
      if (result.pValue >= 5e-6 || result.nSigProbes < 8) {
        throw new Error(`${source}: selected meta-analysis row fails P < 5e-6 and N_Sig_Probes_p05 >= 8`);
      }
      return result;
    });
  }
  const cptHealthyControl = {} as MdmaMasterData['cptHealthyControl'];
  for (const timepoint of TREATMENT_TIMEPOINTS) {
    const groups = {} as Record<CptHealthyControlGroup, TreatmentGeneResult[]>;
    for (const group of CPT_HC_GROUPS) {
      const source = cptHealthyControlSources[timepoint][group];
      const derived = await deriveCptHealthyControlResults(path.join(sourceRoot, source));
      if (derived.fullCount !== 24_085) throw new Error(`${source}: expected 24,085 annotated genes, found ${derived.fullCount}`);
      groups[group] = derived.selected
        .sort((left, right) => left.pValue - right.pValue || left.gene.localeCompare(right.gene));
      if (groups[group].length !== expectedCptHealthyControlCounts[timepoint][group]) {
        throw new Error(`${source}: expected ${expectedCptHealthyControlCounts[timepoint][group]} selected genes, found ${groups[group].length}`);
      }
    }
    cptHealthyControl[timepoint] = { groups };
  }
  const metaGenes = new Set(TREATMENT_TIMEPOINTS.flatMap((timepoint) => metaAnalyses[timepoint].map((item) => item.gene.toUpperCase())));
  const contextGenes = new Map<string, string>();
  for (const timepoint of TREATMENT_TIMEPOINTS) {
    for (const item of metaAnalyses[timepoint]) contextGenes.set(item.gene.toUpperCase(), item.gene);
    for (const group of CPT_HC_GROUPS) {
      for (const item of cptHealthyControl[timepoint].groups[group]) contextGenes.set(item.gene.toUpperCase(), item.gene);
    }
  }
  for (const timepoint of TREATMENT_TIMEPOINTS) {
    for (const cohort of TREATMENT_COHORTS) {
      for (const item of selected[timepoint][cohort]) contextGenes.set(item.gene.toUpperCase(), item.gene);
    }
  }

  const geneContexts: Record<string, TreatmentGeneContext> = {};
  for (const [normalizedGene, gene] of [...contextGenes].sort((left, right) => left[0].localeCompare(right[0]))) {
    geneContexts[gene] = Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => [
      timepoint,
      Object.fromEntries(TREATMENT_COHORTS.map((cohort) => [
        cohort,
        (() => {
          const row = coverageIndexes[timepoint][cohort].get(normalizedGene);
          return row ? treatmentResult(row, `${contextSources[timepoint][cohort]}:${gene}`, 1) : null;
        })(),
      ])),
    ])) as TreatmentGeneContext;
  }

  const output: MdmaMasterData = {
    metadata: {
      version: 'IPW_DMP_Analysis_2026_v2_CD4T_arrayWeights',
      generatedAt: new Date().toISOString(),
      selectionRule: 'N_Sig_Probes_p05 >= 8 and Gene_FDR < 0.05',
      contextRule: 'All gene-level rows available for the responder versus non-responder comparison',
      metaSources,
      cptHealthyControlSources,
      cohortSources,
      contextSources,
    },
    metaAnalyses,
    cptHealthyControl,
    timepoints: Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => [
      timepoint,
      { cohorts: selected[timepoint] },
    ])) as MdmaMasterData['timepoints'],
    geneContexts,
  };

  output.metadata.generatedAt = await stableGeneratedAt(output);
  await writeFile(OUTPUT_FILE, JSON.stringify(output));
  const summary = Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => [
    timepoint,
    Object.fromEntries(TREATMENT_COHORTS.map((cohort) => [cohort, selected[timepoint][cohort].length])),
  ]));
  console.log(JSON.stringify({
    output: OUTPUT_FILE.pathname,
    meta: Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => [timepoint, metaAnalyses[timepoint].length])),
    cptHealthyControl: Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => [timepoint, Object.fromEntries(CPT_HC_GROUPS.map((group) => [group, cptHealthyControl[timepoint].groups[group].length]))])),
    contextGenes: geneContexts ? Object.keys(geneContexts).length : metaGenes.size,
    cohorts: summary,
  }, null, 2));
}

await main();
