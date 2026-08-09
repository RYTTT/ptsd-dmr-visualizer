import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { isGeneProbeData } from '../src/lib/commonDatabase.ts';
import {
  csvCell,
  deriveCrossSubtypeDirection,
  findPtsdResult,
  findTreatmentResult,
  serializeCsv,
  treatmentViewDescriptor,
  validateMasterDMRData,
  validateMdmaMasterData,
} from '../src/lib/scientificData.ts';
import type { SubtypeStat } from '../src/types/dmr.ts';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as unknown;
}

test('pooled treatment results never inherit a timepoint label or filename', () => {
  const baseline = treatmentViewDescriptor('cross', 'Pre');
  const followUp = treatmentViewDescriptor('cross', 'FUP');
  assert.deepEqual(baseline, followUp);
  assert.equal(baseline.kind, 'pooled-cross-cohort');
  assert.match(baseline.shortLabel, /not timepoint-specific/u);
  assert.doesNotMatch(baseline.csvFilename, /Pre|FUP|Baseline|Follow/u);

  const unique = treatmentViewDescriptor('MDMA', 'Pre');
  assert.equal(unique.kind, 'timepoint-cohort-unique');
  assert.match(unique.title, /Baseline \(Pre\)/u);
  assert.match(unique.csvFilename, /Pre_MDMA_unique/u);
});

test('treatment validation converts only explicit N/A sentinels to missing values', () => {
  const raw = readJson('../public/data/mdma/dmrData.json') as Record<string, unknown>;
  const crossCohort = raw.crossCohort as Record<string, unknown>[];
  const first = crossCohort[0];
  const cohorts = first.cohorts as Record<string, Record<string, unknown>>;

  cohorts.MDMA.Pre = { deltaBeta: 0, fdr: 0, direction: 'Hypermethylated' };
  cohorts.MDMA.FUP = { deltaBeta: 0, fdr: 1, direction: 'N/A' };
  const parsed = validateMdmaMasterData(raw);

  assert.equal(parsed.crossCohort[0].cohorts.MDMA.timepoints.Pre.deltaBeta, 0);
  assert.equal(parsed.crossCohort[0].cohorts.MDMA.timepoints.Pre.fdr, 0);
  assert.deepEqual(parsed.crossCohort[0].cohorts.MDMA.timepoints.FUP, {
    deltaBeta: null,
    fdr: null,
    direction: null,
  });
});

test('cross-subtype direction treats each stored Mixed classification as authoritative', () => {
  const stat = (direction: SubtypeStat['direction']): SubtypeStat => ({
    deltaBeta: direction === 'Hypomethylated' ? -0.1 : 0.1,
    fdr: 0.01,
    direction,
  });
  assert.equal(deriveCrossSubtypeDirection({
    SSS: stat('Hypermethylated'),
    ADS: stat('Hypermethylated'),
    ICF: { ...stat('Mixed'), deltaBeta: 0.2 },
    ISS: stat('Hypermethylated'),
  }), 'Mixed');
  assert.equal(deriveCrossSubtypeDirection({
    SSS: stat('Hypermethylated'), ADS: stat('Hypermethylated'),
    ICF: stat('Hypermethylated'), ISS: stat('Hypermethylated'),
  }), 'Hypermethylated');
  assert.equal(deriveCrossSubtypeDirection({
    SSS: stat('Hypermethylated'), ADS: stat('Hypomethylated'),
    ICF: stat('Hypermethylated'), ISS: stat('Hypermethylated'),
  }), 'Mixed');
});

test('subtype-unique selections remain subtype-specific and have no fabricated cross statistic', () => {
  const data = validateMasterDMRData(readJson('../public/data/dmrData.json'));
  const unique = data.uniqueSubtypes.SSS[0];
  const selected = findPtsdResult(data, 'SSS', unique.gene);
  assert.equal(selected?.kind, 'subtype-unique');
  if (selected?.kind !== 'subtype-unique') assert.fail('Expected subtype-unique result');
  assert.equal(selected.subtype, 'SSS');
  assert.equal(selected.result.fdr, unique.fdr);
  assert.equal('crossFdr' in selected.result, false);
  assert.equal('subtypes' in selected.result, false);
});

test('treatment selection preserves pooled versus timepoint/cohort-unique statistic scope', () => {
  const data = validateMdmaMasterData(readJson('../public/data/mdma/dmrData.json'));
  const pooled = findTreatmentResult(data, 'cross', 'Pre', data.crossCohort[0].gene);
  assert.equal(pooled?.kind, 'pooled-cross-cohort');

  const unique = data.timepoints.FUP.uniqueCohorts.Ketamine[0];
  const selected = findTreatmentResult(data, 'Ketamine', 'FUP', unique.gene);
  assert.equal(selected?.kind, 'timepoint-cohort-unique');
  if (selected?.kind !== 'timepoint-cohort-unique') assert.fail('Expected cohort-unique result');
  assert.equal(selected.timepoint, 'FUP');
  assert.equal(selected.cohort, 'Ketamine');
  assert.equal('pValue' in selected.result, false);
});

test('CSV serialization preserves zero, leaves missing blank, and quotes unsafe text', () => {
  assert.equal(csvCell(0), '0');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell('gene,alias'), '"gene,alias"');
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(serializeCsv([['Gene', 'Value'], ['A,1', null], ['B', 0]]), 'Gene,Value\r\n"A,1",\r\nB,0');
});

test('master and probe runtime validators accept shipped data and reject identity/count mismatches', () => {
  const ptsd = validateMasterDMRData(readJson('../public/data/dmrData.json'));
  const treatment = validateMdmaMasterData(readJson('../public/data/mdma/dmrData.json'));
  assert.ok(ptsd.crossSubtype.length > 0);
  assert.ok(treatment.crossCohort.length > 0);

  const probe = readJson('../public/data/probes/AHRR.json') as Record<string, unknown>;
  assert.equal(isGeneProbeData(probe, 'AHRR'), true);
  assert.equal(isGeneProbeData(probe, 'NOT_AHRR'), false);
  const wrongCount = { ...probe, totalProbes: (probe.totalProbes as number) + 1 };
  assert.equal(isGeneProbeData(wrongCount, 'AHRR'), false);
});
