import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { isGeneProbeData } from '../src/lib/commonDatabase.ts';
import {
  csvCell,
  deriveCrossSubtypeDirection,
  findPtsdResult,
  findTreatmentResult,
  nominalPStars,
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

  const cohort = treatmentViewDescriptor('MDMA', 'Pre');
  assert.equal(cohort.kind, 'timepoint-cohort');
  assert.match(cohort.title, /Baseline \(Pre\)/u);
  assert.match(cohort.csvFilename, /Pre_MDMA_N8plus/u);
});

test('treatment database ships exact N8+ registry counts and complete BDNF Ketamine context', () => {
  const parsed = validateMdmaMasterData(readJson('../public/data/mdma/dmrData.json'));
  assert.deepEqual({
    Pre: Object.fromEntries(Object.entries(parsed.timepoints.Pre.cohorts).map(([key, rows]) => [key, rows.length])),
    FUP: Object.fromEntries(Object.entries(parsed.timepoints.FUP.cohorts).map(([key, rows]) => [key, rows.length])),
  }, {
    Pre: { MDMA: 827, Ketamine: 475, CPT: 515 },
    FUP: { MDMA: 1274, Ketamine: 878, CPT: 1410 },
  });
  const bdnf = parsed.geneContexts.BDNF;
  assert.equal('Ketamine' in bdnf, false, 'context is organized by timepoint first');
  assert.equal(bdnf.Pre.Ketamine?.totalProbes, 88);
  assert.equal(bdnf.Pre.Ketamine?.nSigProbes, 6);
  assert.equal(bdnf.FUP.Ketamine?.nSigProbes, 5);
  assert.ok(bdnf.Pre.Ketamine?.deltaBeta !== 0);
  assert.ok(bdnf.FUP.Ketamine?.deltaBeta !== 0);
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

test('treatment selection preserves pooled versus timepoint/cohort statistic scope', () => {
  const data = validateMdmaMasterData(readJson('../public/data/mdma/dmrData.json'));
  const pooled = findTreatmentResult(data, 'cross', 'Pre', data.crossCohort[0].gene);
  assert.equal(pooled?.kind, 'pooled-cross-cohort');

  const cohort = data.timepoints.FUP.cohorts.Ketamine[0];
  const selected = findTreatmentResult(data, 'Ketamine', 'FUP', cohort.gene);
  assert.equal(selected?.kind, 'timepoint-cohort');
  if (selected?.kind !== 'timepoint-cohort') assert.fail('Expected timepoint/cohort result');
  assert.equal(selected.timepoint, 'FUP');
  assert.equal(selected.cohort, 'Ketamine');
  assert.equal(selected.result.pValue, cohort.pValue);
});

test('CSV serialization preserves zero, leaves missing blank, and quotes unsafe text', () => {
  assert.equal(csvCell(0), '0');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell('gene,alias'), '"gene,alias"');
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(serializeCsv([['Gene', 'Value'], ['A,1', null], ['B', 0]]), 'Gene,Value\r\n"A,1",\r\nB,0');
});

test('nominal P stars use strict requested thresholds and never label missing values', () => {
  assert.equal(nominalPStars(null), '');
  assert.equal(nominalPStars(0.05), '');
  assert.equal(nominalPStars(0.049), '*');
  assert.equal(nominalPStars(0.01), '*');
  assert.equal(nominalPStars(0.009), '**');
  assert.equal(nominalPStars(0.001), '**');
  assert.equal(nominalPStars(0.0009), '***');
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
