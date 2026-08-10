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
const SOURCE_FILE = 'Common_Probes_3Cohorts_Full_Statistics.csv';
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
  const sourcePath = path.join(sourceRoot, SOURCE_FILE);
  const master = JSON.parse(await readFile(DMR_DATA_FILE, 'utf8')) as MdmaMasterData;
  const selectedGenes = loadSelectedGenes(master);
  const probesByGene = new Map<string, ProbeEntry[]>();
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
      Meta_logFC: finiteNumber(row, 'Mean_Beta_Diff', source),
      Meta_P: probability(row, 'Meta_P', source),
      Meta_FDR: probability(row, 'Meta_FDR', source),
      CPT_logFC: finiteNumber(row, 'CPT_Beta_Diff', source),
      CPT_P: probability(row, 'CPT_P.Value', source),
      CPT_FDR: probability(row, 'CPT_adj.P.Val', source),
      Ketamine_logFC: finiteNumber(row, 'Ketamine_Beta_Diff', source),
      Ketamine_P: probability(row, 'Ketamine_P.Value', source),
      Ketamine_FDR: probability(row, 'Ketamine_adj.P.Val', source),
      MDMA_logFC: finiteNumber(row, 'MDMA_Beta_Diff', source),
      MDMA_P: probability(row, 'MDMA_P.Value', source),
      MDMA_FDR: probability(row, 'MDMA_adj.P.Val', source),
    };
    const current = probesByGene.get(normalizedGene) ?? [];
    current.push(entry);
    probesByGene.set(normalizedGene, current);
  }

  await rm(OUTPUT_ROOT, { recursive: true, force: true });
  const directory = new URL('pooled/', OUTPUT_ROOT);
  await mkdir(directory, { recursive: true });
  let totalProbeRows = 0;
  for (const [normalizedGene, selected] of selectedGenes) {
    const probes = probesByGene.get(normalizedGene);
    const chr = chromosomeByGene.get(normalizedGene);
    if (!probes || !chr) throw new Error(`${SOURCE_FILE}: selected gene ${selected.gene} has no common-probe rows`);
    probes.sort((left, right) => left.pos - right.pos || left.probe.localeCompare(right.probe));
    if (probes.length > selected.totalProbes) {
      throw new Error(`${SOURCE_FILE}: ${selected.gene} has ${probes.length} common-probe rows but only ${selected.totalProbes} mapped probes in the gene result`);
    }
    const shard: GeneProbeData = {
      gene: selected.gene,
      chr,
      totalProbes: selected.totalProbes,
      cpgIslands: [],
      probes,
      probeDataset: {
        scope: 'pooled-cross-cohort',
        comparison: 'Three-cohort treatment-response probe meta-analysis',
        selectionRule: 'All common three-cohort probe rows for this gene',
        sourceFile: SOURCE_FILE,
      },
    };
    totalProbeRows += probes.length;
    await writeFile(new URL(`${selected.gene}.json`, directory), JSON.stringify(shard));
  }
  await writeFile(new URL('index.json', OUTPUT_ROOT), JSON.stringify({
    version: 'treatment_common_probe_full_statistics_v1',
    source: SOURCE_FILE,
    selectedGenes: selectedGenes.size,
    totalProbeRows,
  }));
  console.log(JSON.stringify({ output: OUTPUT_ROOT.pathname, selectedGenes: selectedGenes.size, totalProbeRows }, null, 2));
}

await main();
