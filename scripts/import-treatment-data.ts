import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  CrossCohortGene,
  Direction,
  MdmaMasterData,
  TreatmentCohort,
  TreatmentGeneContext,
  TreatmentGeneResult,
  TreatmentTimepoint,
} from '../src/types/dmr.ts';
import { TREATMENT_COHORTS, TREATMENT_TIMEPOINTS } from '../src/types/dmr.ts';

type CsvRow = Record<string, string>;

const DEFAULT_SOURCE_ROOT = '/Users/ruotingyang/Documents/manuscripts/MDMA_antigravity/result/IPW_DMP_Analysis_2026_v2_CD4T_arrayWeights';
const OUTPUT_FILE = new URL('../public/data/mdma/dmrData.json', import.meta.url);
const POOLED_SOURCE = 'Meta_Analysis_Gene_Level_DMRs_Top3_Primary_Strict.csv';

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

const coverageSources: Record<TreatmentTimepoint, Record<TreatmentCohort, string>> = {
  Pre: {
    MDMA: 'MDMA/MDMA_Pre_Responder_vs_NonResponder_Gene_DMRs_TotalProbes8plus.csv',
    Ketamine: 'Ketamine/Ketamine_Pre_Responder_vs_NonResponder_Gene_DMRs_TotalProbes8plus.csv',
    CPT: 'CPT/CPT_Pre_Responder_vs_NonResponder_Gene_DMRs_TotalProbes8plus.csv',
  },
  FUP: {
    MDMA: 'MDMA/MDMA_FUP1_Responder_vs_NonResponder_Gene_DMRs_TotalProbes8plus.csv',
    Ketamine: 'Ketamine/Ketamine_FUP2_Responder_vs_NonResponder_Gene_DMRs_TotalProbes8plus.csv',
    CPT: 'CPT/CPT_FUP2_Responder_vs_NonResponder_Gene_DMRs_TotalProbes8plus.csv',
  },
};

const expectedSelectedCounts: Record<TreatmentTimepoint, Record<TreatmentCohort, number>> = {
  Pre: { MDMA: 827, Ketamine: 475, CPT: 515 },
  FUP: { MDMA: 1274, Ketamine: 878, CPT: 1410 },
};
const expectedCoverageCounts: Record<TreatmentCohort, number> = {
  MDMA: 17307,
  Ketamine: 18032,
  CPT: 16423,
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

function treatmentResult(row: CsvRow, source: string): TreatmentGeneResult {
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
  if (totalProbes < 8) throw new Error(`${source}: Total_Gene_Probes must be at least 8`);
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

function pooledResult(row: CsvRow, source: string): CrossCohortGene {
  const directionValue = required(row, 'Direction', source);
  if (directionValue !== 'Hypermethylated' && directionValue !== 'Hypomethylated' && directionValue !== 'Mixed') {
    throw new Error(`${source}: unsupported Direction ${directionValue}`);
  }
  return {
    gene: required(row, 'Gene', source),
    fdr: numberValue(row, 'Gene_Meta_FDR_Top3', source),
    pValue: numberValue(row, 'Gene_Meta_P_Top3', source),
    deltaBeta: numberValue(row, 'Mean_Beta_Diff_Top3', source),
    direction: directionValue,
    totalProbes: integerValue(row, 'Total_Gene_Probes', source),
    nSigProbes: integerValue(row, 'N_Sig_Probes_p05', source),
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

function sameTreatmentResult(left: TreatmentGeneResult, right: TreatmentGeneResult): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function main() {
  const sourceRoot = path.resolve(process.argv[2] ?? DEFAULT_SOURCE_ROOT);
  const selected = {} as Record<TreatmentTimepoint, Record<TreatmentCohort, TreatmentGeneResult[]>>;
  const coverageIndexes = {} as Record<TreatmentTimepoint, Record<TreatmentCohort, Map<string, TreatmentGeneResult>>>;

  for (const timepoint of TREATMENT_TIMEPOINTS) {
    selected[timepoint] = {} as Record<TreatmentCohort, TreatmentGeneResult[]>;
    coverageIndexes[timepoint] = {} as Record<TreatmentCohort, Map<string, TreatmentGeneResult>>;
    for (const cohort of TREATMENT_COHORTS) {
      const selectedFile = path.join(sourceRoot, cohortSources[timepoint][cohort]);
      const coverageFile = path.join(sourceRoot, coverageSources[timepoint][cohort]);
      const selectedRows = await csvRows(selectedFile);
      const coverageRows = await csvRows(coverageFile);
      if (selectedRows.length !== expectedSelectedCounts[timepoint][cohort]) {
        throw new Error(`${selectedFile}: expected ${expectedSelectedCounts[timepoint][cohort]} rows, found ${selectedRows.length}`);
      }
      if (coverageRows.length !== expectedCoverageCounts[cohort]) {
        throw new Error(`${coverageFile}: expected ${expectedCoverageCounts[cohort]} rows, found ${coverageRows.length}`);
      }
      const selectedResults = selectedRows.map((row, index) => treatmentResult(row, `${selectedFile}:${index + 2}`));
      const coverageResults = coverageRows.map((row, index) => treatmentResult(row, `${coverageFile}:${index + 2}`));
      const selectedIndex = indexByGene(selectedResults, selectedFile);
      const coverageIndex = indexByGene(coverageResults, coverageFile);
      for (const [gene, result] of selectedIndex) {
        if (result.nSigProbes < 8) throw new Error(`${selectedFile}: ${gene} has fewer than 8 significant probes`);
        if (result.fdr >= 0.05) throw new Error(`${selectedFile}: ${gene} has Gene_FDR >= 0.05`);
        const coverageResult = coverageIndex.get(gene);
        if (!coverageResult || !sameTreatmentResult(result, coverageResult)) {
          throw new Error(`${selectedFile}: ${gene} does not exactly match its coverage-table record`);
        }
      }
      selected[timepoint][cohort] = selectedResults;
      coverageIndexes[timepoint][cohort] = coverageIndex;
    }
  }

  const pooledRows = await csvRows(path.join(sourceRoot, POOLED_SOURCE));
  const crossCohort = pooledRows.map((row, index) => pooledResult(row, `${POOLED_SOURCE}:${index + 2}`));
  const pooledGenes = new Set(crossCohort.map((item) => item.gene.toUpperCase()));
  const contextGenes = new Map<string, string>();
  for (const item of crossCohort) contextGenes.set(item.gene.toUpperCase(), item.gene);
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
        coverageIndexes[timepoint][cohort].get(normalizedGene) ?? null,
      ])),
    ])) as TreatmentGeneContext;
  }

  const output: MdmaMasterData = {
    metadata: {
      version: 'IPW_DMP_Analysis_2026_v2_CD4T_arrayWeights',
      generatedAt: new Date().toISOString(),
      selectionRule: 'N_Sig_Probes_p05 >= 8 and Gene_FDR < 0.05',
      coverageRule: 'Total_Gene_Probes >= 8',
      pooledSource: POOLED_SOURCE,
      cohortSources,
      coverageSources,
    },
    crossCohort,
    timepoints: Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => [
      timepoint,
      { cohorts: selected[timepoint] },
    ])) as MdmaMasterData['timepoints'],
    geneContexts,
  };

  await writeFile(OUTPUT_FILE, JSON.stringify(output));
  const summary = Object.fromEntries(TREATMENT_TIMEPOINTS.map((timepoint) => [
    timepoint,
    Object.fromEntries(TREATMENT_COHORTS.map((cohort) => [cohort, selected[timepoint][cohort].length])),
  ]));
  console.log(JSON.stringify({ output: OUTPUT_FILE.pathname, pooled: crossCohort.length, contextGenes: geneContexts ? Object.keys(geneContexts).length : pooledGenes.size, cohorts: summary }, null, 2));
}

await main();
