import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { isGeneProbeData } from '../src/lib/commonDatabase.ts';
import {
  csvCell,
  deriveCrossSubtypeDirection,
  displayedFdrNominalPBoundary,
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

test('FDR boundary uses the largest nominal P among adjusted-significant displayed results', () => {
  assert.equal(displayedFdrNominalPBoundary([
    { pValue: 0.0002, fdr: 0.01 },
    { pValue: 0.002, fdr: 0.049 },
    { pValue: 0.003, fdr: 0.05 },
    { pValue: 0.0001, fdr: 0.2 },
  ]), 0.002);
  assert.equal(displayedFdrNominalPBoundary([{ pValue: 0.001, fdr: 0.05 }]), null);
  assert.equal(displayedFdrNominalPBoundary([{ pValue: null, fdr: 0.01 }]), null);
});

test('treatment meta-analysis labels and exports preserve the selected timepoint', () => {
  const baseline = treatmentViewDescriptor('cross', 'Pre');
  const followUp = treatmentViewDescriptor('cross', 'FUP');
  assert.notDeepEqual(baseline, followUp);
  assert.equal(baseline.kind, 'timepoint-meta-analysis');
  assert.match(baseline.title, /Baseline \(Pre\)/u);
  assert.match(followUp.title, /Follow-up \(Post\)/u);
  assert.match(baseline.csvFilename, /Pre_three-study-meta-analysis/u);
  assert.match(followUp.csvFilename, /FUP_three-study-meta-analysis/u);

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

test('CPT healthy-control DMR registries preserve comparison, visit, and strict selection scope', () => {
  const parsed = validateMdmaMasterData(readJson('../public/data/mdma/dmrData.json'));
  assert.deepEqual(Object.fromEntries((['Pre', 'FUP'] as const).map((timepoint) => [
    timepoint,
    Object.fromEntries((['Responder', 'NonResponder'] as const).map((group) => [
      group,
      parsed.cptHealthyControl[timepoint].groups[group].length,
    ])),
  ])), {
    Pre: { Responder: 44, NonResponder: 23 },
    FUP: { Responder: 172, NonResponder: 335 },
  });
  for (const timepoint of ['Pre', 'FUP'] as const) {
    for (const group of ['Responder', 'NonResponder'] as const) {
      for (const result of parsed.cptHealthyControl[timepoint].groups[group]) {
        assert.ok(result.pValue < 5e-6);
        assert.ok(result.nSigProbes >= 8);
      }
    }
  }
  assert.deepEqual(Object.fromEntries((['Pre', 'FUP'] as const).map((timepoint) => {
    const metaGenes = new Set(parsed.metaAnalyses[timepoint].map((result) => result.gene.toUpperCase()));
    return [timepoint, Object.fromEntries((['Responder', 'NonResponder'] as const).map((group) => [
      group,
      parsed.cptHealthyControl[timepoint].groups[group]
        .filter((result) => metaGenes.has(result.gene.toUpperCase())).length,
    ]))];
  })), {
    Pre: { Responder: 27, NonResponder: 15 },
    FUP: { Responder: 129, NonResponder: 201 },
  });
  const result = parsed.cptHealthyControl.FUP.groups.NonResponder[0];
  const selected = findTreatmentResult(parsed, 'CPT-HC', 'FUP', result.gene, 'NonResponder');
  assert.equal(selected?.kind, 'cpt-healthy-control');
  if (selected?.kind !== 'cpt-healthy-control') assert.fail('Expected CPT healthy-control result');
  assert.equal(selected.timepoint, 'FUP');
  assert.equal(selected.group, 'NonResponder');
  assert.match(treatmentViewDescriptor('CPT-HC', 'FUP', 'NonResponder').title, /CPT NonResponder vs HC · Follow-up \(FUP2\)/u);
});

test('Pre and Follow-up treatment meta-analyses preserve exact three-study component support', () => {
  const parsed = validateMdmaMasterData(readJson('../public/data/mdma/dmrData.json'));
  assert.deepEqual(Object.fromEntries((['Pre', 'FUP'] as const).map((timepoint) => [
    timepoint,
    Object.fromEntries([0, 1, 2, 3].map((count) => [
      count,
      parsed.metaAnalyses[timepoint].filter((gene) => gene.nCohortsNominal === count).length,
    ])),
  ])), {
    Pre: { 0: 0, 1: 14, 2: 167, 3: 166 },
    FUP: { 0: 0, 1: 30, 2: 434, 3: 651 },
  });
  assert.equal(parsed.metaAnalyses.Pre.filter((gene) => !gene.componentSignsConsistent).length, 280);
  assert.equal(parsed.metaAnalyses.FUP.filter((gene) => !gene.componentSignsConsistent).length, 932);
  for (const timepoint of ['Pre', 'FUP'] as const) {
    for (const gene of parsed.metaAnalyses[timepoint]) {
      assert.ok(gene.pValue < 5e-6);
      assert.ok(gene.nSigProbes >= 8);
      for (const component of Object.values(gene.cohortComponents)) {
        assert.ok(Number.isFinite(component.deltaBeta));
        assert.ok(Number.isFinite(component.pValue));
      }
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

test('treatment selection preserves meta-analysis timepoint and cohort statistic scope', () => {
  const data = validateMdmaMasterData(readJson('../public/data/mdma/dmrData.json'));
  const meta = findTreatmentResult(data, 'cross', 'Pre', data.metaAnalyses.Pre[0].gene);
  assert.equal(meta?.kind, 'timepoint-meta-analysis');
  if (meta?.kind !== 'timepoint-meta-analysis') assert.fail('Expected a timepoint meta-analysis result');
  assert.equal(meta.timepoint, 'Pre');

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
  assert.equal(treatment.metaAnalyses.Pre.length, 347);
  assert.equal(treatment.metaAnalyses.FUP.length, 1115);

  const probe = readJson('../public/data/probes/AHRR.json') as Record<string, unknown>;
  assert.equal(isGeneProbeData(probe, 'AHRR'), true);
  assert.equal(isGeneProbeData(probe, 'NOT_AHRR'), false);
  const wrongCount = { ...probe, totalProbes: (probe.totalProbes as number) + 1 };
  assert.equal(isGeneProbeData(wrongCount, 'AHRR'), false);

  const treatmentProbe = readJson('../public/data/mdma/treatment-probes/visits/AHRR.json') as Record<string, unknown>;
  assert.equal(isGeneProbeData(treatmentProbe, 'AHRR'), true);
  assert.deepEqual(treatmentProbe.probeDataset, {
    scope: 'treatment-study-timepoint-with-cpt-reference',
    comparison: 'Responder versus non-responder across three studies, plus CPT healthy-control references, at Baseline and Follow-up',
    selectionRule: 'All ten sources contain unfiltered all-probe statistics; panels are restricted to common three-study probes',
    sourceFiles: [
      'MDMA/MDMA_Pre_Responder_vs_NonResponder_DMPs_AllProbes.csv',
      'MDMA/MDMA_FUP1_Responder_vs_NonResponder_DMPs_AllProbes.csv',
      'Ketamine/Ketamine_Pre_Responder_vs_NonResponder_DMPs_AllProbes.csv',
      'Ketamine/Ketamine_FUP2_Responder_vs_NonResponder_DMPs_AllProbes.csv',
      'CPT/CPT_Pre_Responder_vs_NonResponder_DMPs_AllProbes.csv',
      'CPT/CPT_FUP2_Responder_vs_NonResponder_DMPs_AllProbes.csv',
      'CPT/CPT_Pre_Responder_vs_HC_DMPs_AllProbes.csv',
      'CPT/CPT_FUP2_Responder_vs_HC_DMPs_AllProbes.csv',
      'CPT/CPT_Pre_NonResponder_vs_HC_DMPs_AllProbes.csv',
      'CPT/CPT_FUP2_NonResponder_vs_HC_DMPs_AllProbes.csv',
    ],
    coverageByAnalysis: {
      MDMA_Pre: 'all-probes',
      MDMA_FUP: 'all-probes',
      Ketamine_Pre: 'all-probes',
      Ketamine_FUP: 'all-probes',
      CPT_Pre: 'all-probes',
      CPT_FUP: 'all-probes',
      CPT_RvHC_Pre: 'all-probes',
      CPT_RvHC_FUP: 'all-probes',
      CPT_NRvHC_Pre: 'all-probes',
      CPT_NRvHC_FUP: 'all-probes',
    },
  });
  assert.ok((treatmentProbe.probes as unknown[]).length > 0);
  assert.ok((treatmentProbe.probes as unknown[]).length <= (treatmentProbe.totalProbes as number));
  const probeRows = treatmentProbe.probes as Record<string, unknown>[];
  for (const key of ['MDMA_Pre', 'MDMA_FUP', 'Ketamine_Pre', 'Ketamine_FUP', 'CPT_Pre', 'CPT_FUP', 'CPT_RvHC_Pre', 'CPT_RvHC_FUP', 'CPT_NRvHC_Pre', 'CPT_NRvHC_FUP']) {
    assert.ok(probeRows.every((probeRow) => typeof probeRow[`${key}_P`] === 'number'));
  }
  assert.equal(Array.isArray((treatmentProbe.metaSelectedTop3 as Record<string, unknown>)?.FUP), true);
  assert.equal(((treatmentProbe.metaSelectedTop3 as Record<string, string[]>).FUP).length, 3);

  const treatmentProbeIndex = readJson('../public/data/mdma/treatment-probes/index.json') as {
    version: string;
    sources: { key: string; commonRows: number }[];
  };
  assert.equal(treatmentProbeIndex.version, 'treatment_all_probe_study_timepoint_and_cpt_reference_v7');
  for (const key of ['MDMA_Pre', 'MDMA_FUP', 'Ketamine_Pre', 'Ketamine_FUP', 'CPT_Pre', 'CPT_FUP', 'CPT_RvHC_Pre', 'CPT_RvHC_FUP', 'CPT_NRvHC_Pre', 'CPT_NRvHC_FUP']) {
    assert.equal(treatmentProbeIndex.sources.find((source) => source.key === key)?.commonRows, 147_893);
  }

  const ptprn2Probe = readJson('../public/data/mdma/treatment-probes/visits/PTPRN2.json') as {
    metaSelectedTop3: { FUP: string[] };
    probes: Record<string, string | number | null>[];
  };
  assert.deepEqual(ptprn2Probe.metaSelectedTop3.FUP, ['cg13327129', 'cg19363471', 'cg17500918']);
  const ptprn2PostTop3 = ptprn2Probe.metaSelectedTop3.FUP.map((probeId) => (
    ptprn2Probe.probes.find((probeRow) => probeRow.probe === probeId)?.MDMA_FUP_logFC
  ));
  assert.deepEqual(ptprn2PostTop3, [-0.01275, 0.0264, 0.00637]);
});
