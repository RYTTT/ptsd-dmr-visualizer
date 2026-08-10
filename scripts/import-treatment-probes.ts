import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';

import type { MdmaMasterData } from '../src/types/dmr.ts';
import type { GeneProbeData, ProbeEntry } from '../src/types/probe.ts';

type CsvRow = Record<string, string>;

interface SelectedGene {
  gene: string;
  totalProbes: number;
}

const DEFAULT_SOURCE_ROOT = '/Users/ruotingyang/Documents/manuscripts/MDMA_antigravity/result/IPW_DMP_Analysis_2026_v2_CD4T_arrayWeights';
const ANNOTATION_SOURCE = 'Common_Probes_3Cohorts_Full_Statistics.csv';
const DMP_SOURCES = [
  { key: 'MDMA_Pre', file: 'MDMA/MDMA_Pre_Responder_vs_NonResponder_DMPs.csv', probeColumn: 'Unnamed: 0', effectColumn: 'Beta_Diff_R_vs_NR' },
  { key: 'MDMA_FUP', file: 'MDMA/MDMA_FUP1_Responder_vs_NonResponder_DMPs.csv', probeColumn: 'Unnamed: 0', effectColumn: 'Beta_Diff_R_vs_NR' },
  { key: 'Ketamine_Pre', file: 'Ketamine/Ketamine_Pre_Responder_vs_NonResponder_DMPs.csv', probeColumn: 'CpG', effectColumn: 'Beta_Diff' },
  { key: 'Ketamine_FUP', file: 'Ketamine/Ketamine_FUP2_Responder_vs_NonResponder_DMPs.csv', probeColumn: 'CpG', effectColumn: 'Beta_Diff' },
  { key: 'CPT_Pre', file: 'CPT/CPT_Pre_Responder_vs_NonResponder_DMPs.csv', probeColumn: 'CpG', effectColumn: 'Beta_Diff' },
  { key: 'CPT_FUP', file: 'CPT/CPT_FUP2_Responder_vs_NonResponder_DMPs.csv', probeColumn: 'CpG', effectColumn: 'Beta_Diff' },
] as const;
const DMR_DATA_FILE = new URL('../public/data/mdma/dmrData.json', import.meta.url);
const OUTPUT_ROOT = new URL('../public/data/mdma/treatment-probes/', import.meta.url);

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

function finiteNumber(row: CsvRow, key: string, source: string): number {
  const value = Number(required(row, key, source));
  if (!Number.isFinite(value)) throw new Error(`${source}: ${key} must be finite`);
  return value;
}

function probability(row: CsvRow, key: string, source: string): number {
  const value = finiteNumber(row, key, source);
  if (value < 0 || value > 1) throw new Error(`${source}: ${key} must be in [0,1]`);
  return value;
}

function loadSelectedGenes(master: MdmaMasterData): Map<string, SelectedGene> {
  const selected = new Map<string, SelectedGene>();
  const add = (gene: string, totalProbes: number) => {
    const normalized = gene.toUpperCase();
    const current = selected.get(normalized);
    if (!current || totalProbes > current.totalProbes) selected.set(normalized, { gene, totalProbes });
  };
  for (const result of master.crossCohort) add(result.gene, result.totalProbes);
  for (const timepoint of ['Pre', 'FUP'] as const) {
    for (const cohort of ['MDMA', 'Ketamine', 'CPT'] as const) {
      for (const result of master.timepoints[timepoint].cohorts[cohort]) add(result.gene, result.totalProbes);
    }
  }
  return selected;
}

async function main() {
  const sourceRoot = path.resolve(process.argv[2] ?? DEFAULT_SOURCE_ROOT);
  const sourcePath = path.join(sourceRoot, ANNOTATION_SOURCE);
  const master = JSON.parse(await readFile(DMR_DATA_FILE, 'utf8')) as MdmaMasterData;
  const selectedGenes = loadSelectedGenes(master);
  const probesByGene = new Map<string, ProbeEntry[]>();
  const probeById = new Map<string, ProbeEntry>();
  const chromosomeByGene = new Map<string, string>();
  const seenProbes = new Set<string>();
  const input = createReadStream(sourcePath);
  const lines = createInterface({ input, crlfDelay: Infinity });
  let headers: string[] | null = null;
  let rowNumber = 0;

  for await (const line of lines) {
    rowNumber += 1;
    const values = parseCsvLine(line);
    if (!headers) {
      headers = values;
      continue;
    }
    if (values.length !== headers.length) {
      throw new Error(`${sourcePath}:${rowNumber}: expected ${headers.length} columns, found ${values.length}`);
    }
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    const gene = row.Gene?.trim();
    if (!gene) continue;
    const normalizedGene = gene.toUpperCase();
    if (!selectedGenes.has(normalizedGene)) continue;
    const source = `${sourcePath}:${rowNumber}`;
    const probe = required(row, 'Probe_ID', source);
    if (seenProbes.has(probe)) throw new Error(`${source}: duplicate probe ${probe}`);
    seenProbes.add(probe);
    const pos = finiteNumber(row, 'Position', source);
    if (!Number.isSafeInteger(pos) || pos <= 0) throw new Error(`${source}: Position must be a positive integer`);
    chromosomeByGene.set(normalizedGene, required(row, 'CHR', source));
    const entry: ProbeEntry = {
      probe,
      pos,
      feature: row.UCSC_RefGene_Group?.trim() || 'Unknown',
      cpgIsland: '',
      relationToIsland: row.Relation_to_Island?.trim() || 'Unknown',
      MDMA_Pre_logFC: null, MDMA_Pre_P: null, MDMA_Pre_FDR: null,
      MDMA_FUP_logFC: null, MDMA_FUP_P: null, MDMA_FUP_FDR: null,
      Ketamine_Pre_logFC: null, Ketamine_Pre_P: null, Ketamine_Pre_FDR: null,
      Ketamine_FUP_logFC: null, Ketamine_FUP_P: null, Ketamine_FUP_FDR: null,
      CPT_Pre_logFC: null, CPT_Pre_P: null, CPT_Pre_FDR: null,
      CPT_FUP_logFC: null, CPT_FUP_P: null, CPT_FUP_FDR: null,
    };
    probeById.set(probe, entry);
    const current = probesByGene.get(normalizedGene) ?? [];
    current.push(entry);
    probesByGene.set(normalizedGene, current);
  }

  const sourceCounts: Record<string, { rows: number; commonRows: number }> = {};
  for (const dmpSource of DMP_SOURCES) {
    const dmpPath = path.join(sourceRoot, dmpSource.file);
    const dmpLines = createInterface({ input: createReadStream(dmpPath), crlfDelay: Infinity });
    let dmpHeaders: string[] | null = null;
    let dmpRowNumber = 0;
    let commonRows = 0;
    const seenInSource = new Set<string>();
    for await (const line of dmpLines) {
      dmpRowNumber += 1;
      const values = parseCsvLine(line);
      if (!dmpHeaders) {
        dmpHeaders = values;
        continue;
      }
      if (values.length !== dmpHeaders.length) {
        throw new Error(`${dmpPath}:${dmpRowNumber}: expected ${dmpHeaders.length} columns, found ${values.length}`);
      }
      const row = Object.fromEntries(dmpHeaders.map((header, index) => [header, values[index]]));
      const source = `${dmpPath}:${dmpRowNumber}`;
      const probe = required(row, dmpSource.probeColumn, source);
      if (seenInSource.has(probe)) throw new Error(`${source}: duplicate probe ${probe}`);
      seenInSource.add(probe);
      const nominalP = probability(row, 'P.Value', source);
      if (nominalP >= 0.01) throw new Error(`${source}: expected the source-exported probe P to be < 0.01`);
      const entry = probeById.get(probe);
      if (!entry) continue;
      entry[`${dmpSource.key}_logFC`] = finiteNumber(row, dmpSource.effectColumn, source);
      entry[`${dmpSource.key}_P`] = nominalP;
      entry[`${dmpSource.key}_FDR`] = probability(row, 'adj.P.Val', source);
      commonRows += 1;
    }
    sourceCounts[dmpSource.key] = { rows: Math.max(0, dmpRowNumber - 1), commonRows };
  }

  await rm(OUTPUT_ROOT, { recursive: true, force: true });
  const directory = new URL('visits/', OUTPUT_ROOT);
  await mkdir(directory, { recursive: true });
  let totalProbeRows = 0;
  for (const [normalizedGene, selected] of selectedGenes) {
    const probes = probesByGene.get(normalizedGene);
    const chr = chromosomeByGene.get(normalizedGene);
    if (!probes || !chr) throw new Error(`${ANNOTATION_SOURCE}: selected gene ${selected.gene} has no common-probe rows`);
    probes.sort((left, right) => left.pos - right.pos || left.probe.localeCompare(right.probe));
    if (probes.length > selected.totalProbes) {
      throw new Error(`${ANNOTATION_SOURCE}: ${selected.gene} has ${probes.length} common-probe rows but only ${selected.totalProbes} mapped probes in the gene result`);
    }
    const shard: GeneProbeData = {
      gene: selected.gene,
      chr,
      totalProbes: selected.totalProbes,
      cpgIslands: [],
      probes,
      probeDataset: {
        scope: 'study-timepoint',
        comparison: 'Responder versus non-responder at Baseline and Follow-up in MDMA, ketamine, and CPT',
        selectionRule: 'Source-exported probes with nominal P < 0.01, restricted to common three-study probes',
        sourceFiles: DMP_SOURCES.map(({ file }) => file),
      },
    };
    totalProbeRows += probes.length;
    await writeFile(new URL(`${selected.gene}.json`, directory), JSON.stringify(shard));
  }
  await writeFile(new URL('index.json', OUTPUT_ROOT), JSON.stringify({
    version: 'treatment_study_timepoint_probes_v1',
    annotationSource: ANNOTATION_SOURCE,
    sources: DMP_SOURCES.map(({ key, file }) => ({ key, file, ...sourceCounts[key] })),
    selectedGenes: selectedGenes.size,
    totalProbeRows,
  }));
  console.log(JSON.stringify({ output: OUTPUT_ROOT.pathname, selectedGenes: selectedGenes.size, totalProbeRows }, null, 2));
}

await main();
