'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import type { LabelProps, ScatterPointItem } from 'recharts';
import {
  Search, Filter, Download, ArrowUpDown, Dna, Loader2,
  FlaskConical, ArrowLeft, LogOut, ChevronLeft, ChevronRight, Clock,
} from 'lucide-react';
import { GeneAnnotationCard } from '@/components/GeneAnnotationCard';
import { GeneAnnotationMap } from '@/types/annotation';
import type {
  CptHealthyControlGroup,
  Direction,
  MdmaMasterData,
  SelectedTreatmentResult,
  TreatmentCohort,
  TreatmentComponentStat,
  TreatmentGeneResult,
  TreatmentTimepoint,
} from '@/types/dmr';
import { CPT_HC_GROUPS, TREATMENT_COHORTS, TREATMENT_TIMEPOINTS } from '@/types/dmr';
import {
  getGeneMetadata,
  loadTreatmentProbeData,
  loadGenesMetadata,
  readJsonResponse,
  SessionExpiredError,
} from '@/lib/commonDatabase';
import type { GeneProbeData, TreatmentProbeView } from '@/types/probe';
import {
  findTreatmentResult,
  nominalPStars,
  serializeCsv,
  treatmentViewDescriptor,
  validateMdmaMasterData,
} from '@/lib/scientificData';

import { KeyResultsPanel, MDMA_KEY_GENES, EpicManifestEntry } from '@/components/KeyResultsPanel';
import { GeneStoryButton } from '@/components/GeneStoryButton';
import { GenomicTrackPlot } from '@/components/GenomicTrackPlot';
import { TreatmentDmrVenn } from '@/components/TreatmentDmrVenn';

interface MdmaTableRow {
  gene: string;
  pValue: number;
  fdr: number;
  deltaBeta: number;
  direction: Direction;
  totalProbes: number;
  nSigProbes: number;
  nPosTop3?: number;
  avgPosDeltaBeta?: number | null;
  nNegTop3?: number;
  avgNegDeltaBeta?: number | null;
  cohortPValues?: Record<TreatmentCohort, number>;
  cohortComponents?: Record<TreatmentCohort, TreatmentComponentStat>;
  nCohortsNominal?: number;
  componentSignsConsistent?: boolean;
}

interface VolcanoPoint {
  gene: string;
  deltaBeta: number;
  direction: Direction;
  pValue: number;
  negLogP: number;
}

interface TreatmentBarDatum {
  cohort: TreatmentCohort;
  pre: TreatmentGeneResult | null;
  fup: TreatmentGeneResult | null;
  prePositive: number | null;
  preNegative: number | null;
  fupPositive: number | null;
  fupNegative: number | null;
}

interface LoadError {
  kind: 'session-expired' | 'data';
  message: string;
}

// ---- Tab config ----
const COHORT_TABS = [
  { key: 'cross', label: 'Three-study meta-analysis', color: '#0f172a' },
  { key: 'MDMA', label: 'MDMA', color: '#7c3aed' },
  { key: 'Ketamine', label: 'Ketamine', color: '#0891b2' },
  { key: 'CPT', label: 'CPT', color: '#059669' },
  { key: 'CPT-HC', label: 'CPT vs healthy controls', color: '#ea580c' },
] as const;

type AnalysisTab = 'cross' | 'CPT-HC' | TreatmentCohort;

function formatProbability(value: number): string {
  return value < 1e-15 ? '< 1e-15' : value.toExponential(2);
}

function significanceLabel(value: number | null | undefined): string {
  if (value == null) return 'not provided';
  return nominalPStars(value) || 'P ≥ 0.05';
}

function cohortSupportLabel(count: number): string {
  return `${count}/3 studies have nominal P < 0.05`;
}

function componentSignLabel(consistent: boolean): string {
  return consistent ? 'Component mean Δβ signs are consistent' : 'Component mean Δβ signs differ';
}

export default function MdmaPage() {
  const [data, setData] = useState<MdmaMasterData | null>(null);
  const [annotationData, setAnnotationData] = useState<GeneAnnotationMap | null>(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [timepoint, setTimepoint] = useState<TreatmentTimepoint>('FUP');
  const [activeTab, setActiveTab] = useState<AnalysisTab>('cross');
  const [cptHealthyControlGroup, setCptHealthyControlGroup] = useState<CptHealthyControlGroup>('Responder');
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState('All');
  const [selectedGene, setSelectedGene] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof MdmaTableRow>('pValue');
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [probeData, setProbeData] = useState<GeneProbeData | null>(null);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeLoadError, setProbeLoadError] = useState<string | null>(null);
  const [treatmentProbeView, setTreatmentProbeView] = useState<TreatmentProbeView>('three-cohort');
  const pageSize = 50;

  const handleTreatmentProbeTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextView: TreatmentProbeView = event.key === 'ArrowLeft' || event.key === 'Home'
      ? 'three-cohort'
      : 'cpt-healthy-control';
    setTreatmentProbeView(nextView);
    const nextId = nextView === 'three-cohort'
      ? 'treatment-probe-tab-three-cohort'
      : 'treatment-probe-tab-cpt-reference';
    window.requestAnimationFrame(() => document.getElementById(nextId)?.focus());
  };

  // EPIC manifest for dynamic stats
  const [epicManifest, setEpicManifest] = useState<Record<string, EpicManifestEntry> | undefined>(undefined);

  // Error state
  const [loadError, setLoadError] = useState<LoadError | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/data/mdma/dmrData.json').then((response) => readJsonResponse(response, 'Failed to load treatment DMR data')),
      loadGenesMetadata(MDMA_KEY_GENES.map(({ gene }) => gene)),
    ]).then(([d, metadata]) => {
      const master = validateMdmaMasterData(d);
      setData(master);
      const annotations: GeneAnnotationMap = {};
      const manifest: Record<string, EpicManifestEntry> = {};
      for (const { gene } of MDMA_KEY_GENES) {
        const entry = metadata[gene.toUpperCase()];
        if (entry?.annotation) annotations[gene] = entry.annotation;
        if (entry?.manifest) manifest[gene] = entry.manifest;
      }
      setAnnotationData(annotations);
      setEpicManifest(manifest);
      setLoading(false);
      const query = new URLSearchParams(window.location.search);
      const requestedGene = query.get('gene')?.trim().toUpperCase();
      const requestedStudy = query.get('study');
      const requestedVisit = query.get('visit');
      const exactStudy = TREATMENT_COHORTS.find((cohort) => cohort === requestedStudy);
      const exactVisit = TREATMENT_TIMEPOINTS.find((visit) => visit === requestedVisit);
      const exactResult = requestedGene && exactStudy && exactVisit
        ? master.timepoints[exactVisit].cohorts[exactStudy].find((item) => item.gene.toUpperCase() === requestedGene)
        : undefined;
      const combined = requestedGene
        ? (exactVisit ? master.metaAnalyses[exactVisit] : master.metaAnalyses.FUP)
            .find((item) => item.gene.toUpperCase() === requestedGene)
        : undefined;
      if (exactResult && exactStudy && exactVisit) {
        setTimepoint(exactVisit);
        setActiveTab(exactStudy);
        setSelectedGene(exactResult.gene);
      } else if (combined) {
        if (exactVisit) setTimepoint(exactVisit);
        setActiveTab('cross');
        setSelectedGene(combined.gene);
      } else if (requestedGene) {
        let selected = false;
        for (const candidateTimepoint of TREATMENT_TIMEPOINTS) {
          for (const cohort of TREATMENT_COHORTS) {
            const result = master.timepoints[candidateTimepoint].cohorts[cohort]
              .find((item) => item.gene.toUpperCase() === requestedGene);
            if (result) {
              setTimepoint(candidateTimepoint);
              setActiveTab(cohort);
              setSelectedGene(result.gene);
              selected = true;
              break;
            }
          }
          if (selected) break;
        }
        if (!selected && master.metaAnalyses.FUP.length > 0) setSelectedGene(master.metaAnalyses.FUP[0].gene);
      } else if (master.metaAnalyses.FUP.length > 0) {
        setSelectedGene(master.metaAnalyses.FUP[0].gene);
      }
    }).catch((error: unknown) => {
      setLoadError({
        kind: error instanceof SessionExpiredError ? 'session-expired' : 'data',
        message: error instanceof Error ? error.message : 'Failed to load data',
      });
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedGene || annotationData?.[selectedGene]) return;
    let cancelled = false;
    getGeneMetadata(selectedGene)
      .then((metadata) => {
        if (cancelled) return;
        if (metadata.annotation) {
          setAnnotationData((current) => ({ ...(current ?? {}), [selectedGene]: metadata.annotation! }));
        }
        if (metadata.manifest) {
          setEpicManifest((current) => ({ ...(current ?? {}), [selectedGene]: metadata.manifest! }));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && error instanceof SessionExpiredError) {
          setLoadError({ kind: 'session-expired', message: error.message });
        }
      });
    return () => { cancelled = true; };
  }, [selectedGene, annotationData]);

  useEffect(() => {
    if (!selectedGene) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setProbeData(null);
      setProbeLoadError(null);
      setProbeLoading(true);
    });
    loadTreatmentProbeData(selectedGene)
      .then((value) => {
        if (cancelled) return;
        setProbeData(value);
        if (!value) setProbeLoadError(`No study/timepoint probe shard was found for ${selectedGene}.`);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof SessionExpiredError) {
          setLoadError({ kind: 'session-expired', message: error.message });
        } else {
          setProbeLoadError(error instanceof Error ? error.message : 'Failed to load treatment probe data');
        }
      })
      .finally(() => {
        if (!cancelled) setProbeLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedGene]);


  // ---- Normalize rows to a common shape ----
  const filteredData = useMemo(() => {
    if (!data) return [];

    let list: MdmaTableRow[] = [];

    if (activeTab === 'cross') {
      list = data.metaAnalyses[timepoint].map((g) => ({
        gene: g.gene, pValue: g.pValue, fdr: g.fdr, deltaBeta: g.deltaBeta, direction: g.direction,
        totalProbes: g.totalProbes, nSigProbes: g.nSigProbes,
        cohortPValues: g.cohortPValues, cohortComponents: g.cohortComponents,
        nCohortsNominal: g.nCohortsNominal, componentSignsConsistent: g.componentSignsConsistent,
      }));
    } else if (activeTab === 'CPT-HC') {
      list = data.cptHealthyControl[timepoint].groups[cptHealthyControlGroup].map((g) => ({
        gene: g.gene, pValue: g.pValue, fdr: g.fdr, deltaBeta: g.deltaBeta, direction: g.direction,
        totalProbes: g.totalProbes, nSigProbes: g.nSigProbes,
        nPosTop3: g.nPosTop3, avgPosDeltaBeta: g.avgPosDeltaBeta,
        nNegTop3: g.nNegTop3, avgNegDeltaBeta: g.avgNegDeltaBeta,
      }));
    } else {
      const tpData = data.timepoints[timepoint];
      list = (tpData.cohorts[activeTab] ?? []).map((g) => ({
        gene: g.gene, pValue: g.pValue, fdr: g.fdr, deltaBeta: g.deltaBeta, direction: g.direction,
        totalProbes: g.totalProbes, nSigProbes: g.nSigProbes,
        nPosTop3: g.nPosTop3, avgPosDeltaBeta: g.avgPosDeltaBeta,
        nNegTop3: g.nNegTop3, avgNegDeltaBeta: g.avgNegDeltaBeta,
      }));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((d) => d.gene.toLowerCase().includes(q));
    }
    if (directionFilter !== 'All') {
      list = list.filter((d) => d.direction === directionFilter);
    }

    return [...list].sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [data, timepoint, activeTab, cptHealthyControlGroup, searchQuery, directionFilter, sortField, sortAsc]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const viewDescriptor = treatmentViewDescriptor(activeTab, timepoint, cptHealthyControlGroup);

  const selectedResult = useMemo<SelectedTreatmentResult | null>(() => {
    if (!data || !selectedGene) return null;
    return findTreatmentResult(data, activeTab, timepoint, selectedGene, cptHealthyControlGroup);
  }, [data, selectedGene, activeTab, timepoint, cptHealthyControlGroup]);

  const selectGeneInAnalysis = (gene: string) => {
    if (!data) return;
    const activeList = activeTab === 'cross'
      ? data.metaAnalyses[timepoint]
      : activeTab === 'CPT-HC'
        ? data.cptHealthyControl[timepoint].groups[cptHealthyControlGroup]
        : data.timepoints[timepoint].cohorts[activeTab];
    if (activeList.some((item) => item.gene === gene)) {
      setSelectedGene(gene);
      return;
    }
    for (const candidateTimepoint of [timepoint, ...TREATMENT_TIMEPOINTS.filter((item) => item !== timepoint)]) {
      if (data.metaAnalyses[candidateTimepoint].some((item) => item.gene === gene)) {
        setTimepoint(candidateTimepoint);
        setActiveTab('cross');
        setSelectedGene(gene);
        setCurrentPage(1);
        return;
      }
    }
    for (const candidateTimepoint of [timepoint, ...TREATMENT_TIMEPOINTS.filter((item) => item !== timepoint)]) {
      for (const group of CPT_HC_GROUPS) {
        if (data.cptHealthyControl[candidateTimepoint].groups[group].some((item) => item.gene === gene)) {
          setTimepoint(candidateTimepoint);
          setCptHealthyControlGroup(group);
          setActiveTab('CPT-HC');
          setSelectedGene(gene);
          setCurrentPage(1);
          return;
        }
      }
    }
    for (const candidateTimepoint of [timepoint, ...TREATMENT_TIMEPOINTS.filter((item) => item !== timepoint)]) {
      const cohort = TREATMENT_COHORTS.find((candidate) =>
        data.timepoints[candidateTimepoint].cohorts[candidate].some((item) => item.gene === gene),
      );
      if (cohort) {
        setTimepoint(candidateTimepoint);
        setActiveTab(cohort);
        setSelectedGene(gene);
        setCurrentPage(1);
        return;
      }
    }
  };

  // ---- Bar chart ----
  const selectedGeneBarData = useMemo<TreatmentBarDatum[] | null>(() => {
    if (!data || !selectedGene) return null;
    const context = data.geneContexts[selectedGene];
    if (!context) return null;
    return TREATMENT_COHORTS.map((cohort) => {
      const pre = context.Pre[cohort];
      const fup = context.FUP[cohort];
      return {
        cohort,
        pre,
        fup,
        prePositive: pre && pre.nPosTop3 > 0 ? pre.avgPosDeltaBeta : null,
        preNegative: pre && pre.nNegTop3 > 0 ? pre.avgNegDeltaBeta : null,
        fupPositive: fup && fup.nPosTop3 > 0 ? fup.avgPosDeltaBeta : null,
        fupNegative: fup && fup.nNegTop3 > 0 ? fup.avgNegDeltaBeta : null,
      };
    }).filter((item) => item.pre !== null || item.fup !== null);
  }, [data, selectedGene]);

  const selectedGeneMissingStudies = useMemo(() => {
    if (!data || !selectedGene) return [];
    const context = data.geneContexts[selectedGene];
    if (!context) return [...TREATMENT_COHORTS];
    return TREATMENT_COHORTS.filter((cohort) => context.Pre[cohort] === null && context.FUP[cohort] === null);
  }, [data, selectedGene]);

  // Annotation
  const selectedAnnotation = useMemo(() => {
    if (!annotationData || !selectedGene) return null;
    return annotationData[selectedGene] ?? null;
  }, [annotationData, selectedGene]);

  // Volcano
  const volcanoData = useMemo(() => {
    return filteredData.map((d) => ({
      gene: d.gene, deltaBeta: d.deltaBeta,
      pValue: d.pValue,
      negLogP: -Math.log10(Math.max(d.pValue, 1e-300)),
      direction: d.direction,
    }));
  }, [filteredData]);
  const concordantVolcanoData = useMemo(() => volcanoData.filter((item) => item.direction !== 'Mixed'), [volcanoData]);
  const mixedVolcanoData = useMemo(() => volcanoData.filter((item) => item.direction === 'Mixed'), [volcanoData]);

  // CSV Export
  const handleExportCSV = () => {
    const metaPrefix = timepoint === 'Pre' ? 'Pre' : 'Post';
    const headers = activeTab === 'cross'
      ? ['Gene', `${metaPrefix}_Meta_P`, `${metaPrefix}_Meta_FDR`, `${metaPrefix}_Meta_DeltaBeta`, 'Direction', 'DMR_TestedProbes', 'SignificantProbes', 'StudiesP05', 'ComponentSignsConsistent',
          'MDMA_P', 'MDMA_DeltaBeta', 'MDMA_Direction', 'Ketamine_P', 'Ketamine_DeltaBeta', 'Ketamine_Direction', 'CPT_P', 'CPT_DeltaBeta', 'CPT_Direction']
      : ['Gene', 'Total_Gene_Probes', 'N_Sig_Probes_p05', 'Gene_Fisher_P', 'Gene_FDR', 'Pattern', 'N_Pos_Probes_Top3', 'Ave_Pos_Beta_Diff_Top3', 'N_Neg_Probes_Top3', 'Ave_Neg_Beta_Diff_Top3', 'Top3_Weighted_Beta_Diff'];
    const rows = filteredData.map((d) => activeTab === 'cross'
      ? [d.gene, d.pValue, d.fdr, d.deltaBeta, d.direction, d.totalProbes, d.nSigProbes, d.nCohortsNominal, d.componentSignsConsistent,
          d.cohortComponents?.MDMA.pValue, d.cohortComponents?.MDMA.deltaBeta, d.cohortComponents?.MDMA.direction,
          d.cohortComponents?.Ketamine.pValue, d.cohortComponents?.Ketamine.deltaBeta, d.cohortComponents?.Ketamine.direction,
          d.cohortComponents?.CPT.pValue, d.cohortComponents?.CPT.deltaBeta, d.cohortComponents?.CPT.direction]
      : [d.gene, d.totalProbes, d.nSigProbes, d.pValue, d.fdr, d.direction, d.nPosTop3, d.avgPosDeltaBeta, d.nNegTop3, d.avgNegDeltaBeta, d.deltaBeta]);
    const csv = `data:text/csv;charset=utf-8,${encodeURIComponent(serializeCsv([headers, ...rows]))}`;
    const link = document.createElement('a');
    link.setAttribute('href', csv);
    link.setAttribute('download', viewDescriptor.csvFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center p-8">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <span className="text-2xl">!</span>
          </div>
          <span className="text-red-700 text-sm font-semibold">
            {loadError.kind === 'session-expired' ? 'Session Expired' : 'Error Loading Data'}
          </span>
          <p className="text-slate-500 text-xs max-w-sm">{loadError.message}</p>
          <button
            onClick={() => {
              if (loadError.kind === 'session-expired') window.location.href = '/login';
              else window.location.reload();
            }}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition"
          >
            {loadError.kind === 'session-expired' ? 'Sign in again' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-slate-800 animate-spin" />
          <span className="text-slate-600 text-sm font-medium">Loading treatment DMR data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-slate-900 selection:text-white pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-xs backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link href="/" aria-label="Return to research projects" className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Projects</span>
            </Link>
            <div className="h-7 w-px shrink-0 bg-slate-200" aria-hidden="true" />
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                <FlaskConical className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold leading-tight tracking-tight text-slate-950 sm:text-base">Treatment Response DMR Atlas</h1>
                <p className="mt-0.5 hidden text-xs font-medium text-slate-600 md:block">MDMA, ketamine, and CPT · IPW-adjusted CD4+ T-cell analysis</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={handleLogout} aria-label="Sign out" className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-700 sm:text-sm">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        {/* Key Results / Landmark Treatment Response Genes Panel */}
        <KeyResultsPanel
          projectTitle="Treatment Studies — Selected DMR Loci"
          projectDescription="Selected loci from responder-versus-non-responder contrasts in MDMA-assisted therapy, ketamine, and CPT studies (IPW-adjusted, CD4+ T-cell methylation-array data). These contrasts do not by themselves establish treatment-induced remethylation."
          genes={MDMA_KEY_GENES}
          selectedGene={selectedGene}
          epicManifest={epicManifest}
          onSelectGene={(gene) => {
            selectGeneInAnalysis(gene);
          }}
        />

        {/* Timepoint Toggle + Cohort Tabs */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {COHORT_TABS.map((tab) => {
              const tpd = data?.timepoints[timepoint];
              const actualCount = tab.key === 'cross'
                ? (data?.metaAnalyses[timepoint].length ?? 0)
                : tab.key === 'CPT-HC'
                  ? (data?.cptHealthyControl[timepoint].groups[cptHealthyControlGroup].length ?? 0)
                  : (tpd?.cohorts[tab.key]?.length ?? 0);
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setCurrentPage(1);
                    setSortField('pValue');
                    setSortAsc(true);
                    const list = tab.key === 'cross'
                      ? data?.metaAnalyses[timepoint] ?? []
                      : tab.key === 'CPT-HC'
                        ? data?.cptHealthyControl[timepoint].groups[cptHealthyControlGroup] ?? []
                        : tpd?.cohorts[tab.key] ?? [];
                    setSelectedGene(list[0]?.gene ?? null);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border transition whitespace-nowrap ${
                    activeTab === tab.key ? 'bg-white border-slate-300 text-slate-900 shadow-xs' : 'bg-slate-100 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tab.color }} />
                  {tab.label}
                  <span className="text-[10px] text-slate-400 font-mono">{actualCount}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {activeTab === 'CPT-HC' && (
              <div className="flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 p-0.5" aria-label="CPT healthy-control comparison group">
                {CPT_HC_GROUPS.map((group) => (
                  <button
                    type="button"
                    key={group}
                    aria-pressed={cptHealthyControlGroup === group}
                    onClick={() => {
                      setCptHealthyControlGroup(group);
                      setCurrentPage(1);
                      setSelectedGene(data.cptHealthyControl[timepoint].groups[group][0]?.gene ?? null);
                    }}
                    className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition ${cptHealthyControlGroup === group ? 'bg-white text-orange-950 shadow-xs' : 'text-orange-700 hover:text-orange-950'}`}
                  >
                    {group === 'Responder' ? 'Responder vs HC' : 'NonResponder vs HC'}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200" aria-label="Analysis timepoint">
              <Clock className="w-3.5 h-3.5 text-slate-400 ml-2" aria-hidden="true" />
              {([['Pre', 'Baseline (Pre)'], ['FUP', activeTab === 'cross' ? 'Follow-up (Post)' : activeTab === 'MDMA' ? 'Follow-up (FUP1 / E2)' : 'Follow-up (FUP2)']] as const).map(([tp, label]) => (
                <button
                  type="button"
                  key={tp}
                  aria-pressed={timepoint === tp}
                  onClick={() => {
                    setTimepoint(tp);
                    setCurrentPage(1);
                    const list = activeTab === 'cross'
                      ? data.metaAnalyses[tp]
                      : activeTab === 'CPT-HC'
                        ? data.cptHealthyControl[tp].groups[cptHealthyControlGroup]
                        : data.timepoints[tp].cohorts[activeTab];
                    setSelectedGene(list[0]?.gene ?? null);
                  }}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition ${
                    timepoint === tp ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <section className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-relaxed text-emerald-950" aria-labelledby="treatment-view-definition">
          <h2 id="treatment-view-definition" className="text-sm font-bold text-emerald-950">What qualifies for this view?</h2>
          {activeTab === 'cross' ? (
            <p className="mt-1"><strong>{timepoint === 'Pre' ? 'Baseline (Pre)' : 'Follow-up (Post)'} three-study meta-analysis:</strong> combines the same-visit responder-versus-non-responder gene results from MDMA, ketamine, and CPT. The selected table requires meta-analysis P &lt; 5×10<sup>−6</sup> and at least 8 probes with nominal P &lt; 0.05. Combined significance does not by itself mean that all three study effects agree.</p>
          ) : activeTab === 'CPT-HC' ? (
            <p className="mt-1"><strong>CPT {timepoint === 'Pre' ? 'Baseline' : 'Follow-up'} · {cptHealthyControlGroup === 'Responder' ? 'Responder vs healthy controls' : 'NonResponder vs healthy controls'}:</strong> the application groups the unfiltered CPT all-probe source by gene, combines the three smallest probe P values with Fisher&apos;s method, and retains genes with Fisher P &lt; 5×10<sup>−6</sup> and at least 8 mapped probes with nominal P &lt; 0.05. Gene FDR is BH-adjusted across all 24,085 annotated genes and is reported but is not an additional selection threshold. Sample sizes: {cptHealthyControlGroup === 'Responder' ? '7 responders' : '6 nonresponders'} vs {timepoint === 'Pre' ? '33' : '22'} healthy controls.</p>
          ) : (
            <p className="mt-1"><strong>{activeTab} {timepoint === 'Pre' ? 'Baseline' : 'Follow-up'} N8+ registry:</strong> each listed gene has at least 8 mapped probes with nominal P &lt; 0.05 and reported gene FDR &lt; 0.05 for this study and visit. This is a responder-versus-non-responder comparison.</p>
          )}
          <details className="mt-2 border-t border-emerald-200 pt-2">
            <summary className="cursor-pointer font-semibold text-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-900">Why Treatment uses N8+ but PTSD subtype does not</summary>
            <p className="mt-2">The full Treatment meta-analysis table has denser gene coverage: the median gene has 13 mapped probes, compared with 3 tested probes in the PTSD subtype analysis. A fixed N8+ rule is therefore meaningful here but would create strong array-coverage bias in PTSD. The two atlases use source-appropriate selection rules and their gene counts should not be compared as if the filters were identical.</p>
          </details>
        </section>

        {activeTab === 'CPT-HC' && (
          <TreatmentDmrVenn
            metaGenes={data.metaAnalyses[timepoint]}
            referenceGenes={data.cptHealthyControl[timepoint].groups[cptHealthyControlGroup]}
            timepoint={timepoint}
            group={cptHealthyControlGroup}
            onSelectGene={selectGeneInAnalysis}
          />
        )}

        {/* Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input type="text" aria-label="Search DMR genes" placeholder="Search gene symbol..." value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition" />
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select aria-label="Filter by methylation direction" value={directionFilter} onChange={(e) => { setDirectionFilter(e.target.value); setCurrentPage(1); }}
                className="bg-transparent text-slate-800 focus:outline-none cursor-pointer font-bold">
                <option value="All">All Directions</option>
                <option value="Hypermethylated">Hyper</option>
                <option value="Hypomethylated">Hypo</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>
            <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition font-semibold shadow-xs">
              <Download className="w-3.5 h-3.5" />Export CSV
            </button>
          </div>
        </div>

        {/* ===== OVERVIEW: Volcano promoted above the table ===== */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs mb-6">
          <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Effect–significance plot — {viewDescriptor.title} — {filteredData.length} genes</h3>
            <div className="flex flex-wrap gap-3 text-[10px] font-semibold text-slate-600"><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-600" />Hyper</span><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blue-600" />Hypo</span><span><span className="mr-1 inline-block h-2.5 w-2.5 rotate-45 bg-amber-600" />Mixed</span></div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart accessibilityLayer margin={{ top: 10, right: 30, bottom: 30, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" dataKey="deltaBeta" name="Δβ" stroke="#64748b" fontSize={11}
                  label={{ value: 'DMR Δβ (methylation proportion)', position: 'insideBottom', offset: -15, fill: '#475569', fontSize: 11 }} />
                <YAxis type="number" dataKey="negLogP" name="-log₁₀(P)" stroke="#64748b" fontSize={11}
                  label={{ value: '-log₁₀(nominal P)', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 11 }} />
                <ZAxis range={[20, 20]} />
                <ReferenceLine y={-Math.log10(0.05)} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'P < 0.05', fill: '#64748b', fontSize: 9 }} />
                <ReferenceLine y={2} stroke="#64748b" strokeDasharray="4 4" label={{ value: 'P < 0.01', fill: '#64748b', fontSize: 9 }} />
                <ReferenceLine y={3} stroke="#475569" strokeDasharray="4 4" label={{ value: 'P < 0.001', fill: '#475569', fontSize: 9 }} />
                <Tooltip content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-slate-300 p-2.5 rounded shadow-lg text-xs space-y-0.5">
                        <div className="font-bold">{d.gene}</div>
                        <div>Δβ: <span className="font-mono">{d.deltaBeta.toFixed(4)}</span></div>
                        <div>Nominal P: <span className="font-mono">{d.pValue < 1e-15 ? '< 1e-15' : d.pValue.toExponential(2)}</span> <strong>{significanceLabel(d.pValue)}</strong></div>
                      </div>
                    );
                  }
                  return null;
                }} />
                <Scatter data={concordantVolcanoData} shape="circle" onClick={(point: ScatterPointItem) => {
                  const datum = point.payload as VolcanoPoint | undefined;
                  if (datum?.gene) setSelectedGene(datum.gene);
                }} cursor="pointer">
                  {concordantVolcanoData.map((entry) => (
                    <Cell key={entry.gene} fill={entry.direction === 'Hypermethylated' ? '#dc2626' : '#2563eb'} stroke={entry.gene === selectedGene ? '#0f172a' : 'none'} strokeWidth={entry.gene === selectedGene ? 2.5 : 0} opacity={entry.gene === selectedGene ? 1 : 0.65} />
                  ))}
                </Scatter>
                <Scatter data={mixedVolcanoData} shape="diamond" onClick={(point: ScatterPointItem) => {
                  const datum = point.payload as VolcanoPoint | undefined;
                  if (datum?.gene) setSelectedGene(datum.gene);
                }} cursor="pointer">
                  {mixedVolcanoData.map((entry) => (
                    <Cell key={entry.gene} fill="#d97706" stroke={entry.gene === selectedGene ? '#0f172a' : 'none'} strokeWidth={entry.gene === selectedGene ? 2.5 : 0} opacity={entry.gene === selectedGene ? 1 : 0.7} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
          {/* LEFT: Registry Table */}
          <div className="lg:col-span-4 flex flex-col">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex-1 flex flex-col">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <Dna className="w-4 h-4 text-slate-700" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {viewDescriptor.title} ({filteredData.length})
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded">
                  {viewDescriptor.shortLabel}
                </span>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full min-w-[520px] text-xs text-left">
                  <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold uppercase text-[11px]">
                    <tr>
                      {([
                        { f: 'gene', l: 'Gene' },
                        { f: 'pValue', l: activeTab === 'cross' ? `${timepoint === 'Pre' ? 'Pre' : 'Post'} meta P` : 'Fisher P' },
                        { f: 'deltaBeta', l: activeTab === 'cross' ? `${timepoint === 'Pre' ? 'Pre' : 'Post'} meta Δβ` : 'Δβ' },
                        { f: (activeTab === 'cross' ? 'nCohortsNominal' : 'nSigProbes') as keyof MdmaTableRow, l: activeTab === 'cross' ? 'Study evidence' : 'P<.05 / total' },
                      ] as const).map(({ f, l }) => (
                        <th key={f} className="p-0" aria-sort={sortField === f ? (sortAsc ? 'ascending' : 'descending') : 'none'}>
                          <button type="button" className="flex w-full items-center gap-1 p-2.5 text-left hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-900" onClick={() => { setSortField(f); setSortAsc(sortField === f ? !sortAsc : true); }}>
                            <span>{l}</span><ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </button>
                        </th>
                      ))}
                      <th className="p-2.5">Dir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedData.map((row) => {
                      const isSelected = selectedGene === row.gene;
                      return (
                        <tr key={row.gene} aria-selected={isSelected}
                          className={`transition hover:bg-slate-50 ${isSelected ? 'bg-blue-50/90 font-semibold border-l-4 border-slate-900' : ''}`}>
                          <td className="p-0 font-bold text-slate-900">
                            <button type="button" aria-pressed={isSelected} onClick={() => selectGeneInAnalysis(row.gene)} className="w-full p-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-900">
                              {row.gene}
                            </button>
                          </td>
                          <td className="whitespace-nowrap p-2.5 font-mono text-slate-900">
                            {row.pValue < 1e-15 ? '< 1e-15' : row.pValue.toExponential(2)}{' '}
                            <strong aria-label={`${nominalPStars(row.pValue).length || 0} significance stars`}>{significanceLabel(row.pValue)}</strong>
                          </td>
                          <td className="p-2.5 font-mono font-bold">
                            <span className={row.deltaBeta > 0 ? 'text-red-600' : 'text-blue-600'}>
                              {row.deltaBeta > 0 ? `+${row.deltaBeta.toFixed(3)}` : row.deltaBeta.toFixed(3)}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-slate-700">
                            {activeTab === 'cross' ? <>{row.nCohortsNominal ?? 0}/3 P&lt;.05<br /><span className="text-[10px] text-slate-500">Δβ signs {row.componentSignsConsistent ? 'same' : 'differ'}</span></> : `${row.nSigProbes}/${row.totalProbes}`}
                          </td>
                          <td className="p-2.5">
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              row.direction === 'Hypermethylated' ? 'bg-red-50 text-red-700' :
                              row.direction === 'Hypomethylated' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                            }`}>{row.direction === 'Hypermethylated' ? 'Hyper' : row.direction === 'Hypomethylated' ? 'Hypo' : 'Mixed'}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {paginatedData.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-sm text-slate-500">
                          No DMR genes match the active analysis and filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/50 text-xs">
                <span className="text-slate-500 font-medium text-[11px]">{paginatedData.length} / {filteredData.length}</span>
                <div className="flex items-center gap-1.5">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 font-medium disabled:opacity-40 hover:bg-slate-50 transition text-[11px] shadow-xs"><ChevronLeft className="w-3 h-3" /></button>
                  <span className="text-slate-800 font-bold px-1 text-[11px]">{currentPage}/{totalPages}</span>
                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 font-medium disabled:opacity-40 hover:bg-slate-50 transition text-[11px] shadow-xs"><ChevronRight className="w-3 h-3" /></button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-8 space-y-5">
            {selectedGene && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <GeneAnnotationCard gene={selectedGene} annotation={selectedAnnotation} project="mdma" />
                </div>
                <div className="self-end sm:self-start">
                  <GeneStoryButton gene={selectedGene} annotation={selectedAnnotation} project="mdma" epicManifest={epicManifest} result={selectedResult} />
                </div>
              </div>
            )}

            {selectedResult?.kind === 'timepoint-meta-analysis' && (
              <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-xs" aria-labelledby="combined-result-title">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h3 id="combined-result-title" className="text-sm font-bold text-slate-900">{selectedResult.timepoint === 'Pre' ? 'Baseline (Pre)' : 'Follow-up (Post)'} three-study meta-analysis — {selectedResult.result.gene}</h3>
                    <p className="mt-1 text-xs text-slate-500">One same-visit meta-analysis across MDMA, ketamine, and CPT responder-versus-non-responder results.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <span className="self-start rounded bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">{cohortSupportLabel(selectedResult.result.nCohortsNominal)}</span>
                    <span className={`self-start rounded border px-2.5 py-1 text-xs font-bold ${selectedResult.result.componentSignsConsistent ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>{componentSignLabel(selectedResult.result.componentSignsConsistent)}</span>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-500">Meta-analysis P</dt><dd className="mt-0.5 font-mono font-bold">{formatProbability(selectedResult.result.pValue)} {significanceLabel(selectedResult.result.pValue)}</dd></div>
                  <div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-500">Meta-analysis FDR</dt><dd className="mt-0.5 font-mono font-bold">{formatProbability(selectedResult.result.fdr)}</dd></div>
                  <div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-500">Meta-analysis Δβ</dt><dd className="mt-0.5 font-mono font-bold">{selectedResult.result.deltaBeta > 0 ? '+' : ''}{selectedResult.result.deltaBeta.toFixed(4)}</dd></div>
                  {TREATMENT_COHORTS.map((cohort) => {
                    const component = selectedResult.result.cohortComponents[cohort];
                    return (
                    <div key={cohort} className="rounded-lg border border-slate-200 bg-white p-2">
                      <dt className="text-slate-500">{cohort} component</dt>
                      <dd className="mt-0.5 font-mono font-bold">P {formatProbability(component.pValue)} {significanceLabel(component.pValue)}</dd>
                      <dd className="mt-0.5 text-[11px] text-slate-700">Δβ <span className="font-mono font-semibold">{component.deltaBeta > 0 ? '+' : ''}{component.deltaBeta.toFixed(4)}</span> · {component.direction}</dd>
                    </div>
                    );
                  })}
                </dl>
              </section>
            )}

            {selectedGene && (
              <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-xs" aria-labelledby="treatment-probe-title">
                <div className="mb-3">
                  <h3 id="treatment-probe-title" className="text-sm font-bold text-slate-900">Treatment probe-level results — {selectedGene}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">Choose the primary three-study treatment view or the independent CPT healthy-control reference. Every panel uses an unfiltered all-probe export; the website applies no P-value filter and retains all probes that map to the selected gene in the common three-study annotation.</p>
                </div>
                <div className="mb-4 inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-1" role="tablist" aria-label="Treatment probe figure view">
                  <button
                    type="button"
                    role="tab"
                    id="treatment-probe-tab-three-cohort"
                    aria-selected={treatmentProbeView === 'three-cohort'}
                    aria-controls="treatment-probe-panel"
                    onClick={() => setTreatmentProbeView('three-cohort')}
                    onKeyDown={handleTreatmentProbeTabKeyDown}
                    tabIndex={treatmentProbeView === 'three-cohort' ? 0 : -1}
                    className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${treatmentProbeView === 'three-cohort' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'}`}
                  >
                    Three-cohort Pre/Post
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="treatment-probe-tab-cpt-reference"
                    aria-selected={treatmentProbeView === 'cpt-healthy-control'}
                    aria-controls="treatment-probe-panel"
                    onClick={() => setTreatmentProbeView('cpt-healthy-control')}
                    onKeyDown={handleTreatmentProbeTabKeyDown}
                    tabIndex={treatmentProbeView === 'cpt-healthy-control' ? 0 : -1}
                    className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${treatmentProbeView === 'cpt-healthy-control' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'}`}
                  >
                    CPT healthy-control reference
                  </button>
                </div>
                {probeLoading && <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading Baseline and Follow-up probe results…</div>}
                {!probeLoading && probeLoadError && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">{probeLoadError} No values were estimated or substituted by this application.</div>}
                {!probeLoading && probeData && (
                  <div
                    id="treatment-probe-panel"
                    role="tabpanel"
                    aria-labelledby={treatmentProbeView === 'three-cohort' ? 'treatment-probe-tab-three-cohort' : 'treatment-probe-tab-cpt-reference'}
                  >
                    <GenomicTrackPlot geneData={probeData} treatmentView={treatmentProbeView} />
                  </div>
                )}
              </section>
            )}

            {/* Bar Chart */}
            {selectedGene && selectedGeneBarData && selectedGeneBarData.length > 0 && (() => {
              // Force symmetric Y-axis domain
              const allVals = selectedGeneBarData
                .flatMap((d) => [d.prePositive, d.preNegative, d.fupPositive, d.fupNegative])
                .filter((value): value is number => value !== null);
              const maxAbs = Math.max(...allVals.map(Math.abs), 0.01);
              const pad = maxAbs * 1.35;
              const yDomain = [-pad, pad];

              const renderVisitLabel = (props: LabelProps, visit: 'pre' | 'fup', sign: 'positive' | 'negative') => {
                const { index } = props;
                if (index === undefined || !selectedGeneBarData[index]) return null;
                const x = Number(props.x ?? 0);
                const y = Number(props.y ?? 0);
                const width = Number(props.width ?? 0);
                const entry = selectedGeneBarData[index];
                const result = visit === 'pre' ? entry.pre : entry.fup;
                if (!result) return null;
                const shouldRender = sign === 'positive' ? result.nPosTop3 > 0 : result.nPosTop3 === 0 && result.nNegTop3 > 0;
                if (!shouldRender) return null;
                const sig = nominalPStars(result.pValue);
                if (!sig) return null;
                const ly = sign === 'positive' ? y - 5 : y + 15;
                return (
                  <text x={x + width / 2} y={ly} textAnchor="middle" fill="#0f172a" fontSize={10} fontWeight={800}>
                    {sig}
                  </text>
                );
              };

              return (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Visit-specific results — {selectedGene}</h3>
                    <p className="text-xs text-slate-500">
                      Each visit group is a responder-versus-non-responder result. Positive and negative Top-3 means are drawn separately when both occur, so Mixed patterns are not collapsed into one net bar. The difference between visits is not itself a tested longitudinal change. These source study results correspond to the same visits used in the separate Baseline and Follow-up meta-analyses.
                    </p>
                    {selectedGeneMissingStudies.length > 0 && <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900">Not shown: {selectedGeneMissingStudies.join(', ')} — this gene was not provided in those source gene-level results.</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px]">
                    <span className="font-semibold text-slate-700"><span className="mr-1 inline-block h-2.5 w-2.5 bg-red-600" />Higher methylation</span>
                    <span className="font-semibold text-slate-700"><span className="mr-1 inline-block h-2.5 w-2.5 bg-blue-600" />Lower methylation</span>
                    <span className="text-slate-600">Lighter: Baseline · darker: Follow-up</span>
                  </div>
                </div>
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart accessibilityLayer data={selectedGeneBarData} margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="cohort" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} domain={yDomain} tickFormatter={(v: number) => v.toFixed(3)}
                        label={{ value: 'Δβ (methylation proportion)', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 11 }} />
                      <Tooltip content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload as TreatmentBarDatum;
                          const resultCard = (result: TreatmentGeneResult | null, label: string, accent = false) => (
                            <div className={`${accent ? 'bg-purple-50/50 border-purple-200' : 'bg-slate-50 border-slate-200'} p-1.5 rounded border`}>
                              <div className={`text-[10px] font-bold uppercase ${accent ? 'text-purple-700' : 'text-slate-500'}`}>{label}</div>
                              {!result ? (
                                <div className="font-semibold text-slate-500">Not provided in the source gene-level results</div>
                              ) : (<>
                                <div>Δβ: <span className="font-mono font-bold">{result.deltaBeta > 0 ? `+${result.deltaBeta.toFixed(4)}` : result.deltaBeta.toFixed(4)}</span></div>
                                <div>Nominal P: <span className="font-mono">{formatProbability(result.pValue)}</span> <strong>{significanceLabel(result.pValue)}</strong></div>
                                <div>Reported FDR: <span className="font-mono">{formatProbability(result.fdr)}</span></div>
                                <div>Significant/total probes: <strong>{result.nSigProbes}/{result.totalProbes}</strong></div>
                                <div className={result.nSigProbes >= 8 ? 'text-emerald-700' : 'text-slate-500'}>{result.nSigProbes >= 8 ? 'Included in the study’s selected list' : 'Raw result; below the study-list cutoff'}</div>
                                <div>Pattern: {result.direction}</div>
                                <div>Top-3 +: {result.nPosTop3}, mean {result.avgPosDeltaBeta == null ? '—' : result.avgPosDeltaBeta.toFixed(4)}</div>
                                <div>Top-3 −: {result.nNegTop3}, mean {result.avgNegDeltaBeta == null ? '—' : result.avgNegDeltaBeta.toFixed(4)}</div>
                              </>)}
                            </div>
                          );
                          return (
                            <div className="bg-white border border-slate-300 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[360px]">
                              <div className="font-extrabold text-slate-900 border-b border-slate-100 pb-1">{d.cohort} study</div>
                              <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                                {resultCard(d.pre, 'Baseline (Pre)')}
                                {resultCard(d.fup, d.cohort === 'MDMA' ? 'Follow-up (FUP1 / E2)' : 'Follow-up (FUP2)', true)}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.2} />
                      <Bar dataKey="prePositive" name="Baseline positive mean" stackId="pre" fill="#dc2626" fillOpacity={0.45} stroke="#991b1b" strokeDasharray="3 2" radius={[4, 4, 0, 0]}>
                        <LabelList content={(props) => renderVisitLabel(props, 'pre', 'positive')} />
                      </Bar>
                      <Bar dataKey="preNegative" name="Baseline negative mean" stackId="pre" fill="#2563eb" fillOpacity={0.45} stroke="#1e40af" strokeDasharray="3 2" radius={[0, 0, 4, 4]}>
                        <LabelList content={(props) => renderVisitLabel(props, 'pre', 'negative')} />
                      </Bar>
                      <Bar dataKey="fupPositive" name="Follow-up positive mean" stackId="fup" fill="#dc2626" fillOpacity={0.9} radius={[4, 4, 0, 0]}>
                        <LabelList content={(props) => renderVisitLabel(props, 'fup', 'positive')} />
                      </Bar>
                      <Bar dataKey="fupNegative" name="Follow-up negative mean" stackId="fup" fill="#2563eb" fillOpacity={0.9} radius={[0, 0, 4, 4]}>
                        <LabelList content={(props) => renderVisitLabel(props, 'fup', 'negative')} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-4 mt-1 text-[10px] text-slate-500 border-t border-slate-100 pt-2">
                  <span className="whitespace-nowrap"><strong className="text-slate-900">***</strong> nominal P &lt; 0.001</span>
                  <span className="whitespace-nowrap"><strong className="text-slate-900">**</strong> nominal P &lt; 0.01</span>
                  <span className="whitespace-nowrap"><strong className="text-slate-900">*</strong> nominal P &lt; 0.05</span>
                  <span className="whitespace-nowrap">No star: nominal P ≥ 0.05</span>
                </div>
                <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">Accessible study/visit data table</summary>
                  <div className="overflow-x-auto border-t border-slate-200">
                    <table className="w-full min-w-[980px] text-left text-xs">
                      <caption className="sr-only">Observed study and visit estimates for {selectedGene}</caption>
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Study</th>
                          <th className="px-3 py-2">Baseline weighted Δβ</th>
                          <th className="px-3 py-2">Baseline P / FDR</th>
                          <th className="px-3 py-2">Baseline probes / pattern</th>
                          <th className="px-3 py-2">Follow-up weighted Δβ</th>
                          <th className="px-3 py-2">Follow-up P / FDR</th>
                          <th className="px-3 py-2">Follow-up probes / pattern</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedGeneBarData.map((entry) => (
                          <tr key={entry.cohort} className="border-t border-slate-200">
                            <td className="px-3 py-2 font-semibold">{entry.cohort}</td>
                            <td className="px-3 py-2 font-mono">{entry.pre == null ? '—' : entry.pre.deltaBeta.toFixed(4)}</td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono">{entry.pre ? <>P {formatProbability(entry.pre.pValue)} {significanceLabel(entry.pre.pValue)}<br />FDR {formatProbability(entry.pre.fdr)}</> : '—'}</td>
                            <td className="px-3 py-2">{entry.pre ? <>{entry.pre.nSigProbes}/{entry.pre.totalProbes} · {entry.pre.direction}<br /><span className="text-slate-500">+{entry.pre.nPosTop3} / −{entry.pre.nNegTop3}</span></> : 'Not provided in source results'}</td>
                            <td className="px-3 py-2 font-mono">{entry.fup == null ? '—' : entry.fup.deltaBeta.toFixed(4)}</td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono">{entry.fup ? <>P {formatProbability(entry.fup.pValue)} {significanceLabel(entry.fup.pValue)}<br />FDR {formatProbability(entry.fup.fdr)}</> : '—'}</td>
                            <td className="px-3 py-2">{entry.fup ? <>{entry.fup.nSigProbes}/{entry.fup.totalProbes} · {entry.fup.direction}<br /><span className="text-slate-500">+{entry.fup.nPosTop3} / −{entry.fup.nNegTop3}</span></> : 'Not provided in source results'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
              );
            })()}

            {selectedGene && selectedGeneBarData?.length === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 shadow-xs">
                <h3 className="font-bold">No visit-specific figure for {selectedGene}</h3>
                <p className="mt-1">This gene was not provided in any of the six source gene-level visit results. No values were estimated or substituted by this application.</p>
              </div>
            )}

          </div>
        </div>

      </main>
    </div>
  );
}
