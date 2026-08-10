import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  CrossSubtypeDMR,
  Direction,
  MasterDMRData,
  SubtypeKey,
  SubtypeStat,
  UniqueDMR,
} from '../src/types/dmr.ts';
import { SUBTYPE_KEYS } from '../src/types/dmr.ts';

type CsvRow = Record<string, string>;

const DEFAULT_SOURCE_ROOT = '/Users/ruotingyang/Documents/manuscripts/FTC_Methylation/result_10pct_na_meta';
const OUTPUT_FILE = new URL('../public/data/dmrData.json', import.meta.url);
const CROSS_SOURCE = 'Cross_Subtype_Top3_Fisher_DMRs.csv';
const uniqueSources: Record<SubtypeKey, string> = Object.fromEntries(
  SUBTYPE_KEYS.map((subtype) => [subtype, `${subtype}_Unique_Top3_Fisher_DMRs.csv`]),
) as Record<SubtypeKey, string>;
const fullSources: Record<SubtypeKey, string> = Object.fromEntries(
  SUBTYPE_KEYS.map((subtype) => [subtype, `${subtype}_Top3_Fisher_DMR_Full_List.csv`]),
) as Record<SubtypeKey, string>;
const expectedCounts = { cross: 1119, SSS: 1478, ADS: 604, ICF: 655, ISS: 713 } as const;

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
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/u, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += character;
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
  if (!headers) throw new Error(`${file}: missing headers`);
  return matrix.map((values, rowIndex) => {
    if (values.length !== headers.length) throw new Error(`${file}:${rowIndex + 2}: inconsistent column count`);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function required(row: CsvRow, key: string, source: string): string {
  const value = row[key]?.trim();
  if (!value) throw new Error(`${source}: ${key} is required`);
  return value;
}

function finite(row: CsvRow, key: string, source: string): number {
  const value = Number(required(row, key, source));
  if (!Number.isFinite(value)) throw new Error(`${source}: ${key} must be finite`);
  return value;
}

function probability(row: CsvRow, key: string, source: string): number {
  const value = finite(row, key, source);
  if (value < 0 || value > 1) throw new Error(`${source}: ${key} must be within [0,1]`);
  return value;
}

function count(row: CsvRow, key: string, source: string): number {
  const value = finite(row, key, source);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${source}: ${key} must be a non-negative integer`);
  return value;
}

function direction(value: string, source: string): Direction {
  if (value === 'Hypermethylated' || value === 'Hypomethylated' || value === 'Mixed') return value;
  throw new Error(`${source}: unsupported direction ${value}`);
}

function splitTopEffects(row: CsvRow, source: string) {
  const effects = required(row, 'Top_LogFCs', source).split(';').map(Number);
  if (effects.some((value) => !Number.isFinite(value)) || effects.length < 1 || effects.length > 3) {
    throw new Error(`${source}: Top_LogFCs must contain one to three finite values`);
  }
  const positive = effects.filter((value) => value > 0);
  const negative = effects.filter((value) => value < 0);
  const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return {
    avgPosLogFC: mean(positive),
    avgNegLogFC: mean(negative),
    nPosTop3: positive.length,
    nNegTop3: negative.length,
  };
}

function parseFullStat(row: CsvRow, subtype: SubtypeKey, source: string): SubtypeStat {
  return {
    pValue: probability(row, 'P_Top3', source),
    fdr: probability(row, 'FDR_Top3', source),
    deltaBeta: finite(row, 'Delta_Beta_Top3', source),
    direction: direction(required(row, 'Direction', source), source),
    nSigProbes: count(row, 'N_Sig_Probes_05', source),
    ...splitTopEffects(row, `${source}:${subtype}`),
  };
}

function indexRows(rows: CsvRow[], source: string): Map<string, CsvRow> {
  const index = new Map<string, CsvRow>();
  for (const [rowIndex, row] of rows.entries()) {
    const gene = required(row, 'Gene', `${source}:${rowIndex + 2}`);
    const key = gene.toUpperCase();
    if (index.has(key)) throw new Error(`${source}: duplicate gene ${gene}`);
    index.set(key, row);
  }
  return index;
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= Math.max(1e-12, Math.abs(left) * 1e-10, Math.abs(right) * 1e-10);
}

function assertSummaryMatches(row: CsvRow, subtype: SubtypeKey, stat: SubtypeStat, source: string) {
  const comparisons = [
    [`${subtype}_P_Top3`, stat.pValue],
    [`${subtype}_FDR_Top3`, stat.fdr],
    [`${subtype}_Delta_Beta_Top3`, stat.deltaBeta],
  ] as const;
  for (const [key, value] of comparisons) {
    if (!nearlyEqual(finite(row, key, source), value)) throw new Error(`${source}: ${key} disagrees with the full-list row`);
  }
  if (required(row, `${subtype}_Direction`, source) !== stat.direction) throw new Error(`${source}: ${subtype}_Direction disagrees with the full-list row`);
  if (count(row, `${subtype}_N_Sig_Probes_05`, source) !== stat.nSigProbes) throw new Error(`${source}: ${subtype}_N_Sig_Probes_05 disagrees with the full-list row`);
}

async function main() {
  const sourceRoot = path.resolve(process.argv[2] ?? DEFAULT_SOURCE_ROOT);
  const existing = JSON.parse(await readFile(OUTPUT_FILE, 'utf8')) as { ptsdGenesList?: unknown };
  if (!Array.isArray(existing.ptsdGenesList) || existing.ptsdGenesList.some((item) => typeof item !== 'string')) {
    throw new Error('Existing master data must supply the curated ptsdGenesList');
  }
  const ptsdGenesList = existing.ptsdGenesList as string[];
  const fullIndexes = {} as Record<SubtypeKey, Map<string, CsvRow>>;
  for (const subtype of SUBTYPE_KEYS) {
    const file = path.join(sourceRoot, fullSources[subtype]);
    const rows = await csvRows(file);
    if (rows.length !== 25_770) throw new Error(`${file}: expected 25770 rows, found ${rows.length}`);
    fullIndexes[subtype] = indexRows(rows, file);
  }

  const subtypesForGene = (gene: string, sourceRow: CsvRow, source: string) => Object.fromEntries(
    SUBTYPE_KEYS.map((subtype) => {
      const fullRow = fullIndexes[subtype].get(gene.toUpperCase());
      if (!fullRow) throw new Error(`${source}: ${gene} missing from ${fullSources[subtype]}`);
      const stat = parseFullStat(fullRow, subtype, `${fullSources[subtype]}:${gene}`);
      assertSummaryMatches(sourceRow, subtype, stat, source);
      return [subtype, stat];
    }),
  ) as Record<SubtypeKey, SubtypeStat>;

  const crossFile = path.join(sourceRoot, CROSS_SOURCE);
  const crossRows = await csvRows(crossFile);
  if (crossRows.length !== expectedCounts.cross) throw new Error(`${crossFile}: expected ${expectedCounts.cross} rows`);
  const crossSubtype: CrossSubtypeDMR[] = crossRows.map((row, index) => {
    const source = `${crossFile}:${index + 2}`;
    const gene = required(row, 'Gene', source);
    const nSubtypesSig = count(row, 'N_Subtypes_Sig', source);
    if (nSubtypesSig < 3 || nSubtypesSig > 4) throw new Error(`${source}: cross-subtype row must have 3–4 significant subtypes`);
    return {
      gene,
      chr: required(row, 'Chr', source),
      totalProbes: count(row, 'Total_Probes', source),
      isPtsd: row.PTSD_Related?.trim() === 'YES',
      crossP: probability(row, 'Cross_P', source),
      crossFdr: probability(row, 'Cross_FDR', source),
      nSubtypesSig,
      subtypes: subtypesForGene(gene, row, source),
    };
  });

  const uniqueSubtypes = {} as Record<SubtypeKey, UniqueDMR[]>;
  for (const selectedSubtype of SUBTYPE_KEYS) {
    const file = path.join(sourceRoot, uniqueSources[selectedSubtype]);
    const rows = await csvRows(file);
    if (rows.length !== expectedCounts[selectedSubtype]) throw new Error(`${file}: expected ${expectedCounts[selectedSubtype]} rows`);
    uniqueSubtypes[selectedSubtype] = rows.map((row, index) => {
      const source = `${file}:${index + 2}`;
      const gene = required(row, 'Gene', source);
      if (count(row, 'N_Subtypes_Sig', source) !== 1) throw new Error(`${source}: subtype-only row must have exactly one significant subtype`);
      const subtypes = subtypesForGene(gene, row, source);
      const selected = subtypes[selectedSubtype];
      if (selected.fdr >= 0.05) throw new Error(`${source}: selected subtype FDR must be below 0.05`);
      for (const subtype of SUBTYPE_KEYS) {
        if (subtype !== selectedSubtype && subtypes[subtype].fdr < 0.05) throw new Error(`${source}: non-selected subtype FDR must not be below 0.05`);
      }
      return {
        gene,
        chr: required(row, 'Chr', source),
        totalProbes: count(row, 'Total_Probes', source),
        isPtsd: row.PTSD_Related?.trim() === 'YES',
        pValue: selected.pValue,
        fdr: selected.fdr,
        deltaBeta: selected.deltaBeta,
        direction: selected.direction,
        nSigProbes: selected.nSigProbes,
        subtypes,
        avgPosLogFC: selected.avgPosLogFC,
        avgNegLogFC: selected.avgNegLogFC,
        nPosTop3: selected.nPosTop3,
        nNegTop3: selected.nNegTop3,
      };
    });
  }

  const output: MasterDMRData = { crossSubtype, uniqueSubtypes, ptsdGenesList };
  await writeFile(OUTPUT_FILE, JSON.stringify(output));
  console.log(JSON.stringify({ output: OUTPUT_FILE.pathname, cross: crossSubtype.length, subtypeOnly: Object.fromEntries(SUBTYPE_KEYS.map((key) => [key, uniqueSubtypes[key].length])) }, null, 2));
}

await main();
