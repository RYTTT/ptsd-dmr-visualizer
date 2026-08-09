'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import type { LabelProps, ScatterPointItem } from 'recharts';
import {
  Search, Filter, Download, ArrowUpDown, Dna, Loader2,
  FlaskConical, ArrowLeft, LogOut, ChevronLeft, ChevronRight, MapPin, Clock,
} from 'lucide-react';
import { GenomicTrackPlot } from '@/components/GenomicTrackPlot';
import { GeneAnnotationCard } from '@/components/GeneAnnotationCard';
import type { GeneProbeData } from '@/types/probe';
import { GeneAnnotationMap } from '@/types/annotation';
import type {
  Direction,
  MdmaMasterData,
  SelectedTreatmentResult,
  TreatmentCohort,
  TreatmentTimepoint,
} from '@/types/dmr';
import { TREATMENT_COHORTS, TREATMENT_TIMEPOINTS } from '@/types/dmr';
import {
  getGeneMetadata,
  loadGenesMetadata,
  loadProbeData,
  readJsonResponse,
  SessionExpiredError,
} from '@/lib/commonDatabase';
import {
  findTreatmentResult,
  serializeCsv,
  treatmentViewDescriptor,
  validateMdmaMasterData,
} from '@/lib/scientificData';

import { KeyResultsPanel, MDMA_KEY_GENES, EpicManifestEntry } from '@/components/KeyResultsPanel';
import { GeneStoryButton } from '@/components/GeneStoryButton';

interface MdmaTableRow {
  gene: string;
  pValue: number | null;
  fdr: number;
  deltaBeta: number;
  direction: Direction;
  totalProbes: number;
  nSigProbes: number;
}

interface VolcanoPoint {
  gene: string;
  deltaBeta: number;
  direction: Direction;
  negLogFdr: number;
}

interface TreatmentBarDatum {
  cohort: TreatmentCohort;
  deltaBeta_Pre: number | null;
  fdr_Pre: number | null;
  direction_Pre: Direction | null;
  deltaBeta_FUP: number | null;
  fdr_FUP: number | null;
  direction_FUP: Direction | null;
  color: string;
}

interface LoadError {
  kind: 'session-expired' | 'data';
  message: string;
}

// ---- Tab config ----
const COHORT_TABS = [
  { key: 'cross', label: 'Pooled cross-cohort', color: '#0f172a' },
  { key: 'MDMA', label: 'MDMA-Unique', color: '#7c3aed' },
  { key: 'Ketamine', label: 'Ketamine-Unique', color: '#0891b2' },
  { key: 'CPT', label: 'CPT-Unique', color: '#059669' },
] as const;

const COHORT_COLORS: Record<string, string> = { MDMA: '#7c3aed', Ketamine: '#0891b2', CPT: '#059669' };
type AnalysisTab = 'cross' | TreatmentCohort;

export default function MdmaPage() {
  const [data, setData] = useState<MdmaMasterData | null>(null);
  const [annotationData, setAnnotationData] = useState<GeneAnnotationMap | null>(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [timepoint, setTimepoint] = useState<TreatmentTimepoint>('FUP');
  const [activeTab, setActiveTab] = useState<AnalysisTab>('cross');
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState('All');
  const [selectedGene, setSelectedGene] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof MdmaTableRow>('fdr');
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Probe data
  const [selectedTrackData, setSelectedTrackData] = useState<GeneProbeData | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  // EPIC manifest for dynamic stats
  const [epicManifest, setEpicManifest] = useState<Record<string, EpicManifestEntry> | undefined>(undefined);

  // Auto-scroll ref
  const trackSectionRef = useRef<HTMLDivElement>(null);

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
      if (master.crossCohort.length > 0) setSelectedGene(master.crossCohort[0].gene);
    }).catch((error: unknown) => {
      setLoadError({
        kind: error instanceof SessionExpiredError ? 'session-expired' : 'data',
        message: error instanceof Error ? error.message : 'Failed to load data',
      });
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedGene) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setTrackLoading(true);
        setSelectedTrackData(null);
      }
    });
    loadProbeData('mdma', selectedGene)
      .then((probeData) => { if (!cancelled) setSelectedTrackData(probeData); })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof SessionExpiredError) {
          setLoadError({ kind: 'session-expired', message: error.message });
        } else {
          setSelectedTrackData(null);
        }
      })
      .finally(() => { if (!cancelled) setTrackLoading(false); });
    return () => { cancelled = true; };
  }, [selectedGene]);

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


  // ---- Normalize rows to a common shape ----
  const filteredData = useMemo(() => {
    if (!data) return [];

    let list: MdmaTableRow[] = [];

    if (activeTab === 'cross') {
      list = data.crossCohort.map((g) => ({
        gene: g.gene, pValue: g.pValue, fdr: g.fdr, deltaBeta: g.deltaBeta, direction: g.direction,
        totalProbes: g.totalProbes, nSigProbes: g.nSigProbes,
      }));
    } else {
      const tpData = data.timepoints[timepoint];
      list = (tpData.uniqueCohorts[activeTab] ?? []).map((g) => ({
        gene: g.gene, pValue: null, fdr: g.fdr, deltaBeta: g.deltaBeta, direction: g.direction,
        totalProbes: g.totalProbes, nSigProbes: g.nSigProbes,
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
  }, [data, timepoint, activeTab, searchQuery, directionFilter, sortField, sortAsc]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const viewDescriptor = treatmentViewDescriptor(activeTab, timepoint);

  const selectedResult = useMemo<SelectedTreatmentResult | null>(() => {
    if (!data || !selectedGene) return null;
    return findTreatmentResult(data, activeTab, timepoint, selectedGene);
  }, [data, selectedGene, activeTab, timepoint]);

  const selectGeneInAnalysis = (gene: string) => {
    if (!data) return;
    const activeList = activeTab === 'cross'
      ? data.crossCohort
      : data.timepoints[timepoint].uniqueCohorts[activeTab];
    if (activeList.some((item) => item.gene === gene)) {
      setSelectedGene(gene);
      return;
    }
    if (data.crossCohort.some((item) => item.gene === gene)) {
      setActiveTab('cross');
      setSelectedGene(gene);
      setCurrentPage(1);
      return;
    }
    for (const candidateTimepoint of [timepoint, ...TREATMENT_TIMEPOINTS.filter((item) => item !== timepoint)]) {
      const cohort = TREATMENT_COHORTS.find((candidate) =>
        data.timepoints[candidateTimepoint].uniqueCohorts[candidate].some((item) => item.gene === gene),
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
    if (!selectedResult) return null;
    if (selectedResult.kind === 'pooled-cross-cohort') {
      return TREATMENT_COHORTS.map((cohort) => {
        const measurements = selectedResult.result.cohorts[cohort].timepoints;
        return {
          cohort,
          deltaBeta_Pre: measurements.Pre.deltaBeta,
          fdr_Pre: measurements.Pre.fdr,
          direction_Pre: measurements.Pre.direction,
          deltaBeta_FUP: measurements.FUP.deltaBeta,
          fdr_FUP: measurements.FUP.fdr,
          direction_FUP: measurements.FUP.direction,
          color: COHORT_COLORS[cohort],
        };
      });
    }
    return [{
      cohort: selectedResult.cohort,
      deltaBeta_Pre: selectedResult.timepoint === 'Pre' ? selectedResult.result.deltaBeta : null,
      fdr_Pre: selectedResult.timepoint === 'Pre' ? selectedResult.result.fdr : null,
      direction_Pre: selectedResult.timepoint === 'Pre' ? selectedResult.result.direction : null,
      deltaBeta_FUP: selectedResult.timepoint === 'FUP' ? selectedResult.result.deltaBeta : null,
      fdr_FUP: selectedResult.timepoint === 'FUP' ? selectedResult.result.fdr : null,
      direction_FUP: selectedResult.timepoint === 'FUP' ? selectedResult.result.direction : null,
      color: COHORT_COLORS[selectedResult.cohort],
    }];
  }, [selectedResult]);

  // Annotation
  const selectedAnnotation = useMemo(() => {
    if (!annotationData || !selectedGene) return null;
    return annotationData[selectedGene] ?? null;
  }, [annotationData, selectedGene]);

  // Volcano
  const volcanoData = useMemo(() => {
    return filteredData.map((d) => ({
      gene: d.gene, deltaBeta: d.deltaBeta,
      negLogFdr: -Math.log10(Math.max(d.fdr, 1e-30)),
      direction: d.direction,
    }));
  }, [filteredData]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = activeTab === 'cross'
      ? ['Gene', 'CrossP', 'CrossFDR', 'PooledDeltaBeta', 'Direction', 'DMR_TestedProbes', 'SignificantProbes']
      : ['Gene', 'FDR', 'DeltaBeta', 'Direction', 'DMR_TestedProbes', 'SignificantProbes'];
    const rows = filteredData.map((d) => activeTab === 'cross'
      ? [d.gene, d.pValue, d.fdr, d.deltaBeta, d.direction, d.totalProbes, d.nSigProbes]
      : [d.gene, d.fdr, d.deltaBeta, d.direction, d.totalProbes, d.nSigProbes]);
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
                <h1 className="truncate text-sm font-bold leading-tight tracking-tight text-slate-950 sm:text-base">Treatment Cohort DMR Atlas</h1>
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
          projectTitle="Treatment Cohorts — Selected DMR Loci"
          projectDescription="Selected loci from responder/comparison contrasts in MDMA-assisted therapy, ketamine, and CPT cohorts (IPW-adjusted, CD4+ T cells, 850K EPIC array). These contrasts do not by themselves establish treatment-induced remethylation."
          genes={MDMA_KEY_GENES}
          selectedGene={selectedGene}
          epicManifest={epicManifest}
          onSelectGene={(gene) => {
            selectGeneInAnalysis(gene);
            setTimeout(() => trackSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
          }}
        />

        {/* Timepoint Toggle + Cohort Tabs */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {COHORT_TABS.map((tab) => {
              const tpd = data?.timepoints[timepoint];
              const actualCount = tab.key === 'cross'
                ? (data?.crossCohort.length ?? 0)
                : (tpd?.uniqueCohorts[tab.key]?.length ?? 0);
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setCurrentPage(1);
                    const list = tab.key === 'cross'
                      ? data?.crossCohort ?? []
                      : tpd?.uniqueCohorts[tab.key] ?? [];
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

          {activeTab === 'cross' ? (
            <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-bold text-slate-700">
              Pooled · not timepoint-specific
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200" aria-label="Analysis timepoint">
              <Clock className="w-3.5 h-3.5 text-slate-400 ml-2" aria-hidden="true" />
              {([['Pre', 'Baseline (Pre)'], ['FUP', 'Follow-up (FUP)']] as const).map(([tp, label]) => (
                <button
                  type="button"
                  key={tp}
                  aria-pressed={timepoint === tp}
                  onClick={() => {
                    setTimepoint(tp);
                    setCurrentPage(1);
                    const list = data.timepoints[tp].uniqueCohorts[activeTab];
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
          )}
        </div>

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
              </select>
            </div>
            <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition font-semibold shadow-xs">
              <Download className="w-3.5 h-3.5" />Export CSV
            </button>
          </div>
        </div>

        {/* ===== OVERVIEW: Volcano promoted above the table ===== */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs mb-6">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
            Effect–significance plot — {viewDescriptor.title} — {filteredData.length} DMRs
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart accessibilityLayer margin={{ top: 10, right: 30, bottom: 30, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" dataKey="deltaBeta" name="Δβ" stroke="#64748b" fontSize={11}
                  label={{ value: 'DMR Δβ (methylation proportion)', position: 'insideBottom', offset: -15, fill: '#475569', fontSize: 11 }} />
                <YAxis type="number" dataKey="negLogFdr" name="-log₁₀(FDR)" stroke="#64748b" fontSize={11}
                  label={{ value: '-log₁₀(FDR)', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 11 }} />
                <ZAxis range={[20, 20]} />
                <Tooltip content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-slate-300 p-2.5 rounded shadow-lg text-xs space-y-0.5">
                        <div className="font-bold">{d.gene}</div>
                        <div>Δβ: <span className="font-mono">{d.deltaBeta.toFixed(4)}</span></div>
                        <div>-log₁₀FDR: <span className="font-mono">{d.negLogFdr.toFixed(2)}</span></div>
                      </div>
                    );
                  }
                  return null;
                }} />
                <Scatter data={volcanoData} onClick={(point: ScatterPointItem) => {
                  const datum = point.payload as VolcanoPoint | undefined;
                  if (datum?.gene) setSelectedGene(datum.gene);
                }} cursor="pointer">
                  {volcanoData.map((entry, idx) => (
                    <Cell key={idx}
                      fill={entry.gene === selectedGene ? '#f59e0b' : entry.direction === 'Hypermethylated' ? '#dc2626' : '#2563eb'}
                      opacity={entry.gene === selectedGene ? 1 : 0.6} />
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
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold uppercase text-[11px]">
                    <tr>
                      {([
                        { f: 'gene', l: 'Gene' },
                        { f: 'fdr', l: activeTab === 'cross' ? 'Cross FDR' : 'FDR' },
                        { f: 'deltaBeta', l: activeTab === 'cross' ? 'Pooled Δβ' : 'Δβ' },
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
                          <td className="p-2.5 font-mono text-slate-900">{row.fdr < 1e-15 ? '< 1e-15' : row.fdr.toExponential(2)}</td>
                          <td className="p-2.5 font-mono font-bold">
                            <span className={row.deltaBeta > 0 ? 'text-red-600' : 'text-blue-600'}>
                              {row.deltaBeta > 0 ? `+${row.deltaBeta.toFixed(3)}` : row.deltaBeta.toFixed(3)}
                            </span>
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
                        <td colSpan={4} className="p-8 text-center text-sm text-slate-500">
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

            {/* Bar Chart */}
            {selectedGene && selectedGeneBarData && (() => {
              // Force symmetric Y-axis domain
              const allVals = selectedGeneBarData
                .flatMap((d) => [d.deltaBeta_Pre, d.deltaBeta_FUP])
                .filter((value): value is number => value !== null);
              const maxAbs = Math.max(...allVals.map(Math.abs), 0.01);
              const pad = maxAbs * 1.35;
              const yDomain = [-pad, pad];

              const sigStars = (fdr: number | null) => {
                if (fdr === null) return 'unavailable';
                if (fdr < 0.001) return '***';
                if (fdr < 0.01) return '**';
                if (fdr < 0.05) return '*';
                return 'ns';
              };

              // Custom label for Pre bars
              const renderPreLabel = (props: LabelProps) => {
                const { index } = props;
                if (index === undefined || !selectedGeneBarData[index]) return null;
                const x = Number(props.x ?? 0);
                const y = Number(props.y ?? 0);
                const width = Number(props.width ?? 0);
                const entry = selectedGeneBarData[index];
                if (entry.deltaBeta_Pre === null || entry.fdr_Pre === null) return null;
                const sig = sigStars(entry.fdr_Pre);
                const isPos = entry.deltaBeta_Pre >= 0;
                const ly = isPos ? y - 5 : y + 15;
                return (
                  <text x={x + width / 2} y={ly} textAnchor="middle" fill={sig === 'ns' ? '#94a3b8' : '#475569'} fontSize={sig === 'ns' ? 8 : 10} fontWeight={sig === 'ns' ? 400 : 700} fontStyle={sig === 'ns' ? 'italic' : 'normal'}>
                    {sig}
                  </text>
                );
              };

              // Custom label for FUP bars
              const renderFupLabel = (props: LabelProps) => {
                const { index } = props;
                if (index === undefined || !selectedGeneBarData[index]) return null;
                const x = Number(props.x ?? 0);
                const y = Number(props.y ?? 0);
                const width = Number(props.width ?? 0);
                const entry = selectedGeneBarData[index];
                if (entry.deltaBeta_FUP === null || entry.fdr_FUP === null) return null;
                const sig = sigStars(entry.fdr_FUP);
                const isPos = entry.deltaBeta_FUP >= 0;
                const ly = isPos ? y - 5 : y + 15;
                return (
                  <text x={x + width / 2} y={ly} textAnchor="middle" fill={sig === 'ns' ? '#94a3b8' : '#7c3aed'} fontSize={sig === 'ns' ? 8 : 10} fontWeight={sig === 'ns' ? 400 : 700} fontStyle={sig === 'ns' ? 'italic' : 'normal'}>
                    {sig}
                  </text>
                );
              };

              return (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selectedGene}</h3>
                    <p className="text-xs text-slate-500">
                      {selectedResult?.kind === 'pooled-cross-cohort'
                        ? 'Available cohort/timepoint estimates for a gene selected from the pooled cross-cohort result set'
                        : `${viewDescriptor.title}; unavailable comparison cells are omitted`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 border border-slate-500" />
                      <span className="text-slate-600 font-medium">Baseline (Pre)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-purple-600 border border-purple-700" />
                      <span className="text-slate-600 font-medium">Follow-up (FUP)</span>
                    </div>
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
                          const d = payload[0].payload;
                          return (
                            <div className="bg-white border border-slate-300 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[200px]">
                              <div className="font-extrabold text-slate-900 border-b border-slate-100 pb-1">{d.cohort} Cohort</div>
                              <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                                <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                                  <div className="text-[10px] text-slate-400 font-bold uppercase">Baseline (Pre)</div>
                                  {d.deltaBeta_Pre === null || d.fdr_Pre === null ? (
                                    <div className="font-semibold text-slate-500">Unavailable</div>
                                  ) : (<>
                                    <div>Δβ: <span className="font-mono font-bold">{d.deltaBeta_Pre > 0 ? `+${d.deltaBeta_Pre.toFixed(4)}` : d.deltaBeta_Pre.toFixed(4)}</span></div>
                                    <div>FDR: <span className="font-mono">{d.fdr_Pre < 1e-15 ? '< 1e-15' : d.fdr_Pre.toExponential(2)}</span> <strong>{sigStars(d.fdr_Pre)}</strong></div>
                                  </>)}
                                </div>
                                <div className="bg-purple-50/50 p-1.5 rounded border border-purple-200">
                                  <div className="text-[10px] text-purple-700 font-bold uppercase">Follow-up (FUP)</div>
                                  {d.deltaBeta_FUP === null || d.fdr_FUP === null ? (
                                    <div className="font-semibold text-slate-500">Unavailable</div>
                                  ) : (<>
                                    <div>Δβ: <span className="font-mono font-bold text-purple-900">{d.deltaBeta_FUP > 0 ? `+${d.deltaBeta_FUP.toFixed(4)}` : d.deltaBeta_FUP.toFixed(4)}</span></div>
                                    <div>FDR: <span className="font-mono">{d.fdr_FUP < 1e-15 ? '< 1e-15' : d.fdr_FUP.toExponential(2)}</span> <strong>{sigStars(d.fdr_FUP)}</strong></div>
                                  </>)}
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.2} />
                      <Bar dataKey="deltaBeta_Pre" name="Baseline (Pre)" fill="#94a3b8" radius={[4, 4, 0, 0]}>
                        <LabelList content={renderPreLabel} />
                      </Bar>
                      <Bar dataKey="deltaBeta_FUP" name="Follow-up (FUP)" radius={[4, 4, 0, 0]}>
                        {selectedGeneBarData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                        <LabelList content={renderFupLabel} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-4 mt-1 text-[10px] text-slate-500 border-t border-slate-100 pt-2">
                  <span><strong className="text-slate-900">***</strong> FDR &lt; 0.001</span>
                  <span><strong className="text-slate-900">**</strong> FDR &lt; 0.01</span>
                  <span><strong className="text-slate-900">*</strong> FDR &lt; 0.05</span>
                  <span><em className="text-slate-400">ns</em> not significant</span>
                  <span><strong>—</strong> unavailable (not non-significant)</span>
                </div>
                <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">Accessible cohort/timepoint data table</summary>
                  <div className="overflow-x-auto border-t border-slate-200">
                    <table className="w-full min-w-[720px] text-left text-xs">
                      <caption className="sr-only">Observed cohort and timepoint estimates for {selectedGene}</caption>
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Cohort</th>
                          <th className="px-3 py-2">Baseline Δβ</th>
                          <th className="px-3 py-2">Baseline direction</th>
                          <th className="px-3 py-2">Baseline FDR</th>
                          <th className="px-3 py-2">Follow-up Δβ</th>
                          <th className="px-3 py-2">Follow-up direction</th>
                          <th className="px-3 py-2">Follow-up FDR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedGeneBarData.map((entry) => (
                          <tr key={entry.cohort} className="border-t border-slate-200">
                            <td className="px-3 py-2 font-semibold">{entry.cohort}</td>
                            <td className="px-3 py-2 font-mono">{entry.deltaBeta_Pre == null ? '—' : entry.deltaBeta_Pre.toFixed(4)}</td>
                            <td className="px-3 py-2">{entry.direction_Pre ?? 'Unavailable'}</td>
                            <td className="px-3 py-2 font-mono">{entry.fdr_Pre == null ? '—' : entry.fdr_Pre < 1e-15 ? '< 1e-15' : entry.fdr_Pre.toExponential(2)}</td>
                            <td className="px-3 py-2 font-mono">{entry.deltaBeta_FUP == null ? '—' : entry.deltaBeta_FUP.toFixed(4)}</td>
                            <td className="px-3 py-2">{entry.direction_FUP ?? 'Unavailable'}</td>
                            <td className="px-3 py-2 font-mono">{entry.fdr_FUP == null ? '—' : entry.fdr_FUP < 1e-15 ? '< 1e-15' : entry.fdr_FUP.toExponential(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
              );
            })()}

            {/* Probe Track */}
            <div ref={trackSectionRef} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center space-x-2.5 mb-3">
                <MapPin className="w-4 h-4 text-slate-800" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">CpG Locus Map — {selectedGene || 'Select Gene'}</h3>
              </div>
              {trackLoading ? (
                <div className="text-center py-8 flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                  <span className="text-slate-400 text-xs">Loading probe data for <strong>{selectedGene}</strong>...</span>
                </div>
              ) : selectedTrackData ? (
                <GenomicTrackPlot geneData={selectedTrackData} />
              ) : selectedGene ? (
                <div className="text-center py-8 text-slate-400 text-xs">No probe-level track data available for <strong>{selectedGene}</strong>.</div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">Select a gene from the registry to view its genomic track.</div>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
