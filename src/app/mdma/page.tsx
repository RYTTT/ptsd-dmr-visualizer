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
  TreatmentGeneResult,
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
  nominalPStars,
  serializeCsv,
  treatmentViewDescriptor,
  validateMdmaMasterData,
} from '@/lib/scientificData';

import { KeyResultsPanel, MDMA_KEY_GENES, EpicManifestEntry } from '@/components/KeyResultsPanel';
import { GeneStoryButton } from '@/components/GeneStoryButton';

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
  deltaBeta_Pre: number | null;
  deltaBeta_FUP: number | null;
  color: string;
}

interface LoadError {
  kind: 'session-expired' | 'data';
  message: string;
}

// ---- Tab config ----
const COHORT_TABS = [
  { key: 'cross', label: 'Pooled cross-cohort', color: '#0f172a' },
  { key: 'MDMA', label: 'MDMA cohort', color: '#7c3aed' },
  { key: 'Ketamine', label: 'Ketamine cohort', color: '#0891b2' },
  { key: 'CPT', label: 'CPT cohort', color: '#059669' },
] as const;

const COHORT_COLORS: Record<string, string> = { MDMA: '#7c3aed', Ketamine: '#0891b2', CPT: '#059669' };
type AnalysisTab = 'cross' | TreatmentCohort;

function formatProbability(value: number): string {
  return value < 1e-15 ? '< 1e-15' : value.toExponential(2);
}

function significanceLabel(value: number | null | undefined): string {
  if (value == null) return 'unavailable';
  return nominalPStars(value) || 'ns';
}

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
  const [sortField, setSortField] = useState<keyof MdmaTableRow>('pValue');
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
      : data.timepoints[timepoint].cohorts[activeTab];
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
        deltaBeta_Pre: pre?.deltaBeta ?? null,
        deltaBeta_FUP: fup?.deltaBeta ?? null,
        color: COHORT_COLORS[cohort],
      };
    });
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

  // CSV Export
  const handleExportCSV = () => {
    const headers = activeTab === 'cross'
      ? ['Gene', 'CrossP', 'CrossFDR', 'PooledDeltaBeta', 'Direction', 'DMR_TestedProbes', 'SignificantProbes']
      : ['Gene', 'Total_Gene_Probes', 'N_Sig_Probes_p05', 'Gene_Fisher_P', 'Gene_FDR', 'Pattern', 'N_Pos_Probes_Top3', 'Ave_Pos_Beta_Diff_Top3', 'N_Neg_Probes_Top3', 'Ave_Neg_Beta_Diff_Top3', 'Top3_Weighted_Beta_Diff'];
    const rows = filteredData.map((d) => activeTab === 'cross'
      ? [d.gene, d.pValue, d.fdr, d.deltaBeta, d.direction, d.totalProbes, d.nSigProbes]
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
                : (tpd?.cohorts[tab.key]?.length ?? 0);
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setCurrentPage(1);
                    const list = tab.key === 'cross'
                      ? data?.crossCohort ?? []
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

          {activeTab === 'cross' ? (
            <div className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-bold text-slate-700">
              Pooled · not timepoint-specific
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200" aria-label="Analysis timepoint">
              <Clock className="w-3.5 h-3.5 text-slate-400 ml-2" aria-hidden="true" />
              {([['Pre', 'Baseline (Pre)'], ['FUP', activeTab === 'MDMA' ? 'Follow-up (FUP1 / E2)' : 'Follow-up (FUP2)']] as const).map(([tp, label]) => (
                <button
                  type="button"
                  key={tp}
                  aria-pressed={timepoint === tp}
                  onClick={() => {
                    setTimepoint(tp);
                    setCurrentPage(1);
                    const list = data.timepoints[tp].cohorts[activeTab];
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

        <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-950">
          <strong>Pooled cross-cohort</strong> is a meta-analysis and is not a Pre or Follow-up tab. The three cohort tabs are timepoint-specific N8+ registries
          (at least 8 probes with nominal P &lt; 0.05; reported gene FDR &lt; 0.05). Selecting a gene also shows all available TotalProbes8plus context values,
          including cohort/timepoint rows that do not reach N8+.
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
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
            Effect–significance plot — {viewDescriptor.title} — {filteredData.length} DMRs
          </h3>
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
                        <div>Nominal P: <span className="font-mono">{d.pValue < 1e-15 ? '< 1e-15' : d.pValue.toExponential(2)}</span> <strong>{nominalPStars(d.pValue) || 'ns'}</strong></div>
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
                <table className="w-full min-w-[520px] text-xs text-left">
                  <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold uppercase text-[11px]">
                    <tr>
                      {([
                        { f: 'gene', l: 'Gene' },
                        { f: 'pValue', l: activeTab === 'cross' ? 'Cross P' : 'Fisher P' },
                        { f: 'deltaBeta', l: activeTab === 'cross' ? 'Pooled Δβ' : 'Δβ' },
                        { f: 'nSigProbes', l: 'P<.05 / total' },
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
                            <strong aria-label={`${nominalPStars(row.pValue).length || 0} significance stars`}>{nominalPStars(row.pValue) || 'ns'}</strong>
                          </td>
                          <td className="p-2.5 font-mono font-bold">
                            <span className={row.deltaBeta > 0 ? 'text-red-600' : 'text-blue-600'}>
                              {row.deltaBeta > 0 ? `+${row.deltaBeta.toFixed(3)}` : row.deltaBeta.toFixed(3)}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-slate-700">{row.nSigProbes}/{row.totalProbes}</td>
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

            {/* Bar Chart */}
            {selectedGene && selectedGeneBarData && (() => {
              // Force symmetric Y-axis domain
              const allVals = selectedGeneBarData
                .flatMap((d) => [d.deltaBeta_Pre, d.deltaBeta_FUP])
                .filter((value): value is number => value !== null);
              const maxAbs = Math.max(...allVals.map(Math.abs), 0.01);
              const pad = maxAbs * 1.35;
              const yDomain = [-pad, pad];

              // Custom label for Pre bars
              const renderPreLabel = (props: LabelProps) => {
                const { index } = props;
                if (index === undefined || !selectedGeneBarData[index]) return null;
                const x = Number(props.x ?? 0);
                const y = Number(props.y ?? 0);
                const width = Number(props.width ?? 0);
                const entry = selectedGeneBarData[index];
                if (entry.deltaBeta_Pre === null || !entry.pre) return null;
                const sig = significanceLabel(entry.pre.pValue);
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
                if (entry.deltaBeta_FUP === null || !entry.fup) return null;
                const sig = significanceLabel(entry.fup.pValue);
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
                      Six cohort/timepoint context estimates from TotalProbes8plus tables. A value can be shown here even when it is not in the N8+ cohort registry.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 border border-slate-500" />
                      <span className="text-slate-600 font-medium">Baseline (Pre)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-purple-600 border border-purple-700" />
                      <span className="text-slate-600 font-medium">Follow-up (MDMA FUP1/E2; Ketamine/CPT FUP2)</span>
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
                          const d = payload[0].payload as TreatmentBarDatum;
                          const resultCard = (result: TreatmentGeneResult | null, label: string, accent = false) => (
                            <div className={`${accent ? 'bg-purple-50/50 border-purple-200' : 'bg-slate-50 border-slate-200'} p-1.5 rounded border`}>
                              <div className={`text-[10px] font-bold uppercase ${accent ? 'text-purple-700' : 'text-slate-500'}`}>{label}</div>
                              {!result ? (
                                <div className="font-semibold text-slate-500">Unavailable</div>
                              ) : (<>
                                <div>Δβ: <span className="font-mono font-bold">{result.deltaBeta > 0 ? `+${result.deltaBeta.toFixed(4)}` : result.deltaBeta.toFixed(4)}</span></div>
                                <div>Nominal P: <span className="font-mono">{formatProbability(result.pValue)}</span> <strong>{significanceLabel(result.pValue)}</strong></div>
                                <div>Reported FDR: <span className="font-mono">{formatProbability(result.fdr)}</span></div>
                                <div>Significant/total probes: <strong>{result.nSigProbes}/{result.totalProbes}</strong></div>
                                <div className={result.nSigProbes >= 8 ? 'text-emerald-700' : 'text-amber-700'}>{result.nSigProbes >= 8 ? 'Core N8+ row' : 'Context only · below N8'}</div>
                                <div>Pattern: {result.direction}</div>
                                <div>Top-3 +: {result.nPosTop3}, mean {result.avgPosDeltaBeta == null ? '—' : result.avgPosDeltaBeta.toFixed(4)}</div>
                                <div>Top-3 −: {result.nNegTop3}, mean {result.avgNegDeltaBeta == null ? '—' : result.avgNegDeltaBeta.toFixed(4)}</div>
                              </>)}
                            </div>
                          );
                          return (
                            <div className="bg-white border border-slate-300 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[360px]">
                              <div className="font-extrabold text-slate-900 border-b border-slate-100 pb-1">{d.cohort} Cohort</div>
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
                  <span><strong className="text-slate-900">***</strong> nominal P &lt; 0.001</span>
                  <span><strong className="text-slate-900">**</strong> nominal P &lt; 0.01</span>
                  <span><strong className="text-slate-900">*</strong> nominal P &lt; 0.05</span>
                  <span><em className="text-slate-400">ns</em> not significant</span>
                  <span><strong>—</strong> unavailable (not non-significant)</span>
                </div>
                <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">Accessible cohort/timepoint data table</summary>
                  <div className="overflow-x-auto border-t border-slate-200">
                    <table className="w-full min-w-[980px] text-left text-xs">
                      <caption className="sr-only">Observed cohort and timepoint estimates for {selectedGene}</caption>
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Cohort</th>
                          <th className="px-3 py-2">Baseline Δβ</th>
                          <th className="px-3 py-2">Baseline P / FDR</th>
                          <th className="px-3 py-2">Baseline probes / pattern</th>
                          <th className="px-3 py-2">Follow-up Δβ</th>
                          <th className="px-3 py-2">Follow-up P / FDR</th>
                          <th className="px-3 py-2">Follow-up probes / pattern</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedGeneBarData.map((entry) => (
                          <tr key={entry.cohort} className="border-t border-slate-200">
                            <td className="px-3 py-2 font-semibold">{entry.cohort}</td>
                            <td className="px-3 py-2 font-mono">{entry.deltaBeta_Pre == null ? '—' : entry.deltaBeta_Pre.toFixed(4)}</td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono">{entry.pre ? <>P {formatProbability(entry.pre.pValue)} {significanceLabel(entry.pre.pValue)}<br />FDR {formatProbability(entry.pre.fdr)}</> : '—'}</td>
                            <td className="px-3 py-2">{entry.pre ? <>{entry.pre.nSigProbes}/{entry.pre.totalProbes} · {entry.pre.direction}<br /><span className="text-slate-500">+{entry.pre.nPosTop3} / −{entry.pre.nNegTop3}</span></> : 'Unavailable'}</td>
                            <td className="px-3 py-2 font-mono">{entry.deltaBeta_FUP == null ? '—' : entry.deltaBeta_FUP.toFixed(4)}</td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono">{entry.fup ? <>P {formatProbability(entry.fup.pValue)} {significanceLabel(entry.fup.pValue)}<br />FDR {formatProbability(entry.fup.fdr)}</> : '—'}</td>
                            <td className="px-3 py-2">{entry.fup ? <>{entry.fup.nSigProbes}/{entry.fup.totalProbes} · {entry.fup.direction}<br /><span className="text-slate-500">+{entry.fup.nPosTop3} / −{entry.fup.nNegTop3}</span></> : 'Unavailable'}</td>
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
