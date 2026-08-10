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
  assert.equal(baseline.shortLabel, 'Combined result');
  assert.doesNotMatch(baseline.csvFilename, /Pre|FUP|Baseline|Follow/u);

  const cohort = treatmentViewDescriptor('MDMA', 'Pre');
  assert.equal(cohort.kind, 'timepoint-cohort');
  assert.match(cohort.title, /Baseline \(Pre\)/u);
  assert.match(cohort.csvFilename, /Pre_MDMA_screened/u);
});

test('treatment database ships exact current screen counts and complete BDNF context', () => {
  const parsed = validateMdmaMasterData(readJson('../public/data/mdma/dmrData.json'));
  assert.deepEqual({
    Pre: Object.fromEntries(Object.entries(parsed.timepoints.Pre.cohorts).map(([key, rows]) => [key, rows.length])),
    FUP: Object.fromEntries(Object.entries(parsed.timepoints.FUP.cohorts).map(([key, rows]) => [key, rows.length])),
  }, {
    Pre: { MDMA: 693, Ketamine: 404, CPT: 515 },
    FUP: { MDMA: 1064, Ketamine: 661, CPT: 1409 },
  });
  const bdnf = parsed.geneContexts.BDNF;
  assert.equal('Ketamine' in bdnf, false, 'context is organized by timepoint first');
  assert.equal(bdnf.Pre.Ketamine?.totalProbes, 75);
  assert.equal(bdnf.Pre.Ketamine?.nSigProbes, 6);
  assert.equal(bdnf.FUP.Ketamine?.nSigProbes, 4);
  assert.ok(bdnf.Pre.Ketamine?.deltaBeta !== 0);
  assert.ok(bdnf.FUP.Ketamine?.deltaBeta !== 0);
  for (const context of Object.values(parsed.geneContexts)) {
    for (const visit of Object.values(context)) {
      assert.equal(Object.values(visit).some((result) => result === null), false);
    }
  }
});

test('combined treatment genes preserve exact three-study component support', () => {
  const parsed = validateMdmaMasterData(readJson('../public/data/mdma/dmrData.json'));
  assert.deepEqual(Object.fromEntries([1, 2, 3].map((count) => [
    count,
    parsed.crossCohort.filter((gene) => gene.nCohortsNominal === count).length,
  ])), { 1: 85, 2: 859, 3: 895 });
  assert.equal(parsed.crossCohort.filter((gene) => !gene.componentSignsConsistent).length, 1549);
  assert.equal(parsed.crossCohort.filter((gene) => gene.nCohortsNominal === 3 && !gene.componentSignsConsistent).length, 748);
  for (const gene of parsed.crossCohort) {
    for (const component of Object.values(gene.cohortComponents)) {
      assert.ok(Number.isFinite(component.deltaBeta));
      assert.ok(Number.isFinite(component.pValue));
    }
  }
});

test('cross-subtype direction treats each stored Mixed classification as authoritative', () => {
  const stat = (direction: SubtypeStat['direction']): SubtypeStat => ({
    deltaBeta: direction === 'Hypomethylated' ? -0.1 : 0.1,
    pValue: 0.001,
    fdr: 0.01,
    direction,
    nSigProbes: 3,
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

test('subtype-selected results preserve all four observed subtype statistics without a fabricated cross statistic', () => {
  const data = validateMasterDMRData(readJson('../public/data/dmrData.json'));
  const unique = data.uniqueSubtypes.SSS[0];
  const selected = findPtsdResult(data, 'SSS', unique.gene);
  assert.equal(selected?.kind, 'subtype-unique');
  if (selected?.kind !== 'subtype-unique') assert.fail('Expected subtype-unique result');
  assert.equal(selected.subtype, 'SSS');
  assert.equal(selected.result.fdr, unique.fdr);
  assert.equal('crossFdr' in selected.result, false);
  assert.deepEqual(Object.keys(selected.result.subtypes).sort(), ['ADS', 'ICF', 'ISS', 'SSS']);
  assert.equal(selected.result.subtypes.SSS.pValue, selected.result.pValue);
  assert.equal(selected.result.subtypes.SSS.fdr, selected.result.fdr);
  for (const subtype of Object.values(selected.result.subtypes)) {
    assert.ok(Number.isFinite(subtype.pValue));
    assert.ok(Number.isFinite(subtype.fdr));
    assert.ok(Number.isFinite(subtype.deltaBeta));
  }
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

  const treatmentProbe = readJson('../public/data/mdma/treatment-probes/pooled/BDNF.json') as Record<string, unknown>;
  assert.equal(isGeneProbeData(treatmentProbe, 'BDNF'), true);
  assert.deepEqual(treatmentProbe.probeDataset, {
    scope: 'pooled-cross-cohort',
    comparison: 'Three-cohort treatment-response probe meta-analysis',
    selectionRule: 'All common three-cohort probe rows for this gene',
    sourceFile: 'Common_Probes_3Cohorts_Full_Statistics.csv',
  });
  assert.ok((treatmentProbe.probes as unknown[]).length > 0);
  assert.ok((treatmentProbe.probes as unknown[]).length <= (treatmentProbe.totalProbes as number));
});
