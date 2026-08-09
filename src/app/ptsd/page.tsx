'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Header } from '@/components/Header';
import { MetricsOverview } from '@/components/MetricsOverview';
import { DmrVolcanoPlot } from '@/components/DmrVolcanoPlot';
import { SubtypeComparisonChart } from '@/components/SubtypeComparisonChart';
import { GenomicTrackPlot } from '@/components/GenomicTrackPlot';
import { GeneAnnotationCard } from '@/components/GeneAnnotationCard';
import type { Direction, MasterDMRData, SelectedPtsdResult, SubtypeKey } from '@/types/dmr';
import { SUBTYPE_KEYS } from '@/types/dmr';
import { GeneProbeData } from '@/types/probe';
import { GeneAnnotationMap } from '@/types/annotation';
import {
  getGeneMetadata,
  loadGenesMetadata,
  loadProbeData,
  readJsonResponse,
  SessionExpiredError,
} from '@/lib/commonDatabase';
import {
  deriveCrossSubtypeDirection,
  findPtsdResult,
  serializeCsv,
  validateMasterDMRData,
} from '@/lib/scientificData';
import {
  Search,
  Filter,
  ShieldAlert,
  Download,
  ArrowUpDown,
  CheckCircle2,
  Dna,
  Loader2,
  MapPin,
} from 'lucide-react';
import { KeyResultsPanel, FTC_KEY_GENES, EpicManifestEntry } from '@/components/KeyResultsPanel';
import { PathwayEnrichmentPanel } from '@/components/PathwayEnrichmentPanel';
import { GeneStoryButton } from '@/components/GeneStoryButton';

interface DmrTableRow {
  gene: string;
  chr: string;
  totalProbes: number;
  isPtsd: boolean;
  fdr: number;
  deltaBeta: number;
  direction: Direction;
  negLogFdr: number;
  rawItem: SelectedPtsdResult;
}

type SortField = 'gene' | 'fdr' | 'deltaBeta';
type AnalysisTab = 'cross' | SubtypeKey;

interface LoadError {
  kind: 'session-expired' | 'data';
  message: string;
}

export default function Home() {
  // ---- Data loading state ----
  const [masterData, setMasterData] = useState<MasterDMRData | null>(null);
  const [annotationData, setAnnotationData] = useState<GeneAnnotationMap | null>(null);
  const [loading, setLoading] = useState(true);

  // Per-gene probe data: cached on demand
  const [selectedTrackData, setSelectedTrackData] = useState<GeneProbeData | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  // EPIC manifest for dynamic stats
  const [epicManifest, setEpicManifest] = useState<Record<string, EpicManifestEntry> | undefined>(undefined);

  // Auto-scroll ref
  const trackSectionRef = useRef<HTMLDivElement>(null);

  // ---- UI state ----
  const [activeTab, setActiveTab] = useState<AnalysisTab>('cross');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [ptsdOnly, setPtsdOnly] = useState<boolean>(false);
  const [directionFilter, setDirectionFilter] = useState<string>('All');
  const [selectedGene, setSelectedGene] = useState<string | null>('AHRR');
  const [sortField, setSortField] = useState<SortField>('fdr');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  const [loadError, setLoadError] = useState<LoadError | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/data/dmrData.json').then((response) => readJsonResponse(response, 'Failed to load DMR data')),
      loadGenesMetadata(FTC_KEY_GENES.map(({ gene }) => gene)),
    ]).then(([dmr, metadata]) => {
      setMasterData(validateMasterDMRData(dmr));
      const annotations: GeneAnnotationMap = {};
      const manifest: Record<string, EpicManifestEntry> = {};
      for (const { gene } of FTC_KEY_GENES) {
        const entry = metadata[gene.toUpperCase()];
        if (entry?.annotation) annotations[gene] = entry.annotation;
        if (entry?.manifest) manifest[gene] = entry.manifest;
      }
      setAnnotationData(annotations);
      setEpicManifest(manifest);
      setLoading(false);
    }).catch((error: unknown) => {
      setLoadError({
        kind: error instanceof SessionExpiredError ? 'session-expired' : 'data',
        message: error instanceof Error ? error.message : 'Failed to load data',
      });
      setLoading(false);
    });
  }, []);

  // Fetch probe data on demand. The shared loader deduplicates requests and
  // maintains a bounded LRU; cancellation guards prevent stale selections.
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
    loadProbeData('ptsd', selectedGene)
      .then((data) => { if (!cancelled) setSelectedTrackData(data); })
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



  // ---- Derived metrics ----
  const crossCount = masterData?.crossSubtype.length ?? 0;
  const crossPtsdCount = masterData?.crossSubtype.filter((d) => d.isPtsd).length ?? 0;
  const sssCount = masterData?.uniqueSubtypes.SSS.length ?? 0;
  const sssPtsdCount = masterData?.uniqueSubtypes.SSS.filter((d) => d.isPtsd).length ?? 0;
  const adsCount = masterData?.uniqueSubtypes.ADS.length ?? 0;
  const adsPtsdCount = masterData?.uniqueSubtypes.ADS.filter((d) => d.isPtsd).length ?? 0;
  const icfCount = masterData?.uniqueSubtypes.ICF.length ?? 0;
  const icfPtsdCount = masterData?.uniqueSubtypes.ICF.filter((d) => d.isPtsd).length ?? 0;
  const issCount = masterData?.uniqueSubtypes.ISS.length ?? 0;
  const issPtsdCount = masterData?.uniqueSubtypes.ISS.filter((d) => d.isPtsd).length ?? 0;

  // ---- Available genes for selector (all DMR genes) ----
  const trackGeneList = useMemo(() => {
    if (!masterData) return [];
    const genes = new Set<string>();
    masterData.crossSubtype.forEach((d) => genes.add(d.gene));
    for (const sub of SUBTYPE_KEYS) {
      masterData.uniqueSubtypes[sub].forEach((d) => genes.add(d.gene));
    }
    return Array.from(genes).sort();
  }, [masterData]);

  // ---- Filtered dataset ----
  const filteredData = useMemo(() => {
    if (!masterData) return [];
    let list: DmrTableRow[] = [];
    if (activeTab === 'cross') {
      list = masterData.crossSubtype.map((item) => {
        const subs = item.subtypes;
        const avgDeltaBeta = (subs.SSS.deltaBeta + subs.ADS.deltaBeta + subs.ICF.deltaBeta + subs.ISS.deltaBeta) / 4;
        const dir = deriveCrossSubtypeDirection(subs);
        return {
          gene: item.gene,
          chr: item.chr,
          totalProbes: item.totalProbes,
          isPtsd: item.isPtsd,
          fdr: item.crossFdr,
          deltaBeta: avgDeltaBeta,
          direction: dir,
          negLogFdr: -Math.log10(Math.max(item.crossFdr, 1e-30)),
          rawItem: { kind: 'cross-subtype', result: item },
        };
      });
    } else {
      const uList =
        masterData.uniqueSubtypes[activeTab] ?? [];
      list = uList.map((item) => ({
        gene: item.gene,
        chr: item.chr,
        totalProbes: item.totalProbes,
        isPtsd: item.isPtsd,
        fdr: item.fdr,
        deltaBeta: item.deltaBeta,
        direction: item.direction,
        negLogFdr: -Math.log10(Math.max(item.fdr, 1e-30)),
        rawItem: { kind: 'subtype-unique', subtype: activeTab, result: item },
      }));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (d) => d.gene.toLowerCase().includes(q) || d.chr.toLowerCase().includes(q)
      );
    }
    if (ptsdOnly) list = list.filter((d) => d.isPtsd);
    if (directionFilter !== 'All') list = list.filter((d) => d.direction === directionFilter);

    list.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc
          ? (valA as string).localeCompare(valB as string)
          : (valB as string).localeCompare(valA as string);
      }
      return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
    return list;
  }, [masterData, activeTab, searchQuery, ptsdOnly, directionFilter, sortField, sortAsc]);

  // ---- Selected gene details ----
  const selectedResult = useMemo(() => {
    if (!masterData || !selectedGene) return null;
    return findPtsdResult(masterData, activeTab, selectedGene);
  }, [masterData, activeTab, selectedGene]);

  const selectGeneInAnalysis = (gene: string) => {
    if (!masterData) return;
    if (findPtsdResult(masterData, activeTab, gene)) {
      setSelectedGene(gene);
      return;
    }
    if (findPtsdResult(masterData, 'cross', gene)) {
      setActiveTab('cross');
      setSelectedGene(gene);
      setCurrentPage(1);
      return;
    }
    const subtype = SUBTYPE_KEYS.find((key) => findPtsdResult(masterData, key, gene));
    if (subtype) {
      setActiveTab(subtype);
      setSelectedGene(gene);
      setCurrentPage(1);
    }
  };

  // selectedTrackData is now managed by the fetchProbeData useEffect above

  const selectedAnnotation = useMemo(() => {
    if (!annotationData || !selectedGene) return null;
    return annotationData[selectedGene] ?? null;
  }, [annotationData, selectedGene]);

  // ---- Pagination ----
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage]);

  // ---- CSV Export ----
  const handleExportCSV = () => {
    if (activeTab === 'cross') {
      // Full cross-subtype export with all 4 subtype columns
      const headers = ['Gene', 'Chr', 'DMR_TestedProbes', 'PTSD_Related', 'CrossP', 'CrossFDR',
        'SSS_DeltaBeta', 'SSS_FDR', 'SSS_Direction',
        'ADS_DeltaBeta', 'ADS_FDR', 'ADS_Direction',
        'ICF_DeltaBeta', 'ICF_FDR', 'ICF_Direction',
        'ISS_DeltaBeta', 'ISS_FDR', 'ISS_Direction',
      ];
      const rows = filteredData.map((d) => {
        const item = d.rawItem.kind === 'cross-subtype' ? d.rawItem.result : null;
        const subtypes = item?.subtypes;
        return [
          d.gene, d.chr, d.totalProbes, d.isPtsd ? 'YES' : 'NO', item?.crossP, item?.crossFdr,
          subtypes?.SSS.deltaBeta ?? '', subtypes?.SSS.fdr ?? '', subtypes?.SSS.direction ?? '',
          subtypes?.ADS.deltaBeta ?? '', subtypes?.ADS.fdr ?? '', subtypes?.ADS.direction ?? '',
          subtypes?.ICF.deltaBeta ?? '', subtypes?.ICF.fdr ?? '', subtypes?.ICF.direction ?? '',
          subtypes?.ISS.deltaBeta ?? '', subtypes?.ISS.fdr ?? '', subtypes?.ISS.direction ?? '',
        ];
      });
      const csvContent = `data:text/csv;charset=utf-8,${encodeURIComponent(serializeCsv([headers, ...rows]))}`;
      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute('download', `DMR_CrossSubtype_filtered.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = ['Gene', 'Chr', 'TotalProbes', 'PTSD_Related', 'FDR', 'DeltaBeta', 'Direction'];
      const rows = filteredData.map((d) => [
        d.gene, d.chr, d.totalProbes, d.isPtsd ? 'YES' : 'NO', d.fdr, d.deltaBeta, d.direction,
      ]);
      const csvContent = `data:text/csv;charset=utf-8,${encodeURIComponent(serializeCsv([headers, ...rows]))}`;
      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute('download', `DMR_${activeTab}_Unique_filtered.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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

  if (loading || !masterData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-slate-800 animate-spin" />
          <span className="text-slate-600 text-sm font-medium">Loading academic DMR datasets...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-slate-900 selection:text-white pb-16">
      <Header />

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Metrics Overview Cards */}
        <MetricsOverview
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab !== 'cross' && !SUBTYPE_KEYS.some((key) => key === tab)) return;
            const nextTab = tab as AnalysisTab;
            setActiveTab(nextTab);
            setCurrentPage(1);
            // Auto-select the first gene in the new tab
            if (masterData) {
              if (nextTab === 'cross') {
                const first = masterData.crossSubtype[0]?.gene;
                setSelectedGene(first ?? null);
              } else {
                const uList = masterData.uniqueSubtypes[nextTab];
                const first = uList?.[0]?.gene;
                setSelectedGene(first ?? null);
              }
            }
          }}
          crossCount={crossCount}
          crossPtsdCount={crossPtsdCount}
          sssCount={sssCount}
          sssPtsdCount={sssPtsdCount}
          adsCount={adsCount}
          adsPtsdCount={adsPtsdCount}
          icfCount={icfCount}
          icfPtsdCount={icfPtsdCount}
          issCount={issCount}
          issPtsdCount={issPtsdCount}
        />

        {/* Key Results / Landmark PTSD Genes Panel */}
        <KeyResultsPanel
          projectTitle="FTC PTSD Cohort — Landmark Epigenetic Loci"
          projectDescription="Key candidate genes identified across military & civilian trauma cohorts (Vet 450K & 850K EPIC array manifests). Click any landmark gene card to immediately view its genomic track plot."
          genes={FTC_KEY_GENES}
          selectedGene={selectedGene}
          epicManifest={epicManifest}
          onSelectGene={(gene) => {
            selectGeneInAnalysis(gene);
            // Auto-scroll to genomic track
            setTimeout(() => trackSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
          }}
        />

        {/* Controls & Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              aria-label="Search DMR genes"
              type="text"
              placeholder="Search gene symbol or chromosome (e.g. HTR2A, AHRR, ZBTB16, chr13)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => {
                setPtsdOnly(!ptsdOnly);
                setCurrentPage(1);
              }}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg font-bold border transition ${
                ptsdOnly
                  ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
              <span>PTSD Only</span>
              {ptsdOnly && <CheckCircle2 className="w-3.5 h-3.5 text-amber-700" />}
            </button>

            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                aria-label="Filter by methylation direction"
                value={directionFilter}
                onChange={(e) => {
                  setDirectionFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-slate-800 focus:outline-none cursor-pointer font-bold"
              >
                <option value="All" className="bg-white">All Directions</option>
                <option value="Hypermethylated" className="bg-white">Hypermethylated</option>
                <option value="Hypomethylated" className="bg-white">Hypomethylated</option>
                <option value="Mixed" className="bg-white">Mixed</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition font-semibold shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* ===== OVERVIEW: Volcano + Pathway panels, collapsible above the table ===== */}
        <DmrVolcanoPlot
          data={filteredData}
          onSelectGene={selectGeneInAnalysis}
          selectedGene={selectedGene}
        />
        <div className="mb-6 mt-4">
          <PathwayEnrichmentPanel activeTab={activeTab} onSelectGene={(gene) => { selectGeneInAnalysis(gene); setTimeout(() => trackSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* LEFT COLUMN (4 Cols): DMR Registry Table (Compact, Top-level Gene Selector) */}
          <div className="lg:col-span-4 flex flex-col">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex-1 flex flex-col">
              <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center space-x-2">
                  <Dna className="w-4 h-4 text-slate-700" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    DMR Gene Registry ({filteredData.length} genes)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Page {currentPage} / {totalPages}
                </span>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold uppercase text-[11px]">
                    <tr>
                      <th className="p-0" aria-sort={sortField === 'gene' ? (sortAsc ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="flex w-full items-center space-x-1 p-2.5 text-left hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-900" onClick={() => { setSortField('gene'); setSortAsc(sortField === 'gene' ? !sortAsc : true); }}>
                          <span>Gene</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </button>
                      </th>
                      <th className="p-2.5">Chr</th>
                      <th className="p-0" aria-sort={sortField === 'fdr' ? (sortAsc ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="flex w-full items-center space-x-1 p-2.5 text-left hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-900" onClick={() => { setSortField('fdr'); setSortAsc(sortField === 'fdr' ? !sortAsc : true); }}>
                          <span>{activeTab === 'cross' ? 'Cross FDR' : `${activeTab} FDR`}</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </button>
                      </th>
                      <th className="p-0" aria-sort={sortField === 'deltaBeta' ? (sortAsc ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" className="flex w-full items-center space-x-1 p-2.5 text-left hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-900" onClick={() => { setSortField('deltaBeta'); setSortAsc(sortField === 'deltaBeta' ? !sortAsc : true); }}>
                          <span>Δβ</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </button>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedData.map((row) => {
                      const isSelected = selectedGene === row.gene;
                      return (
                        <tr
                          key={row.gene}
                          aria-selected={isSelected}
                          className={`transition hover:bg-slate-50 ${
                            isSelected ? 'bg-blue-50/90 font-semibold border-l-4 border-slate-900' : ''
                          }`}
                        >
                          <td className="p-0 font-bold text-slate-900">
                            <button type="button" aria-pressed={isSelected} onClick={() => selectGeneInAnalysis(row.gene)} className="flex w-full items-center space-x-1.5 p-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-900">
                              <span>{row.gene}</span>
                            {row.isPtsd && (
                              <span className="px-1 py-0.2 text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded">
                                PTSD
                              </span>
                            )}
                            </button>
                          </td>
                          <td className="p-2.5 font-mono text-slate-500">{row.chr}</td>
                          <td className="p-2.5 font-mono text-slate-900 font-bold">
                            {row.fdr < 1e-15 ? '< 1e-15' : row.fdr.toExponential(2)}
                          </td>
                          <td className="p-2.5 font-mono font-bold">
                            <span className={row.deltaBeta > 0 ? 'text-red-600' : 'text-blue-600'}>
                              {row.deltaBeta > 0 ? `+${row.deltaBeta.toFixed(3)}` : row.deltaBeta.toFixed(3)}
                            </span>
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

              {/* Pagination Footer */}
              <div className="p-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/50 text-xs">
                <span className="text-slate-500 font-medium text-[11px]">
                  {paginatedData.length} / {filteredData.length}
                </span>
                <div className="flex items-center space-x-1.5">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition text-[11px] shadow-xs"
                  >
                    Prev
                  </button>
                  <span className="text-slate-800 font-bold px-1 text-[11px]">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition text-[11px] shadow-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (8 Cols): Dynamic Selected Gene Details (Annotation + Subtype Bar Chart + Genomic Track) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Selected Gene Literature & Biological Annotation Card */}
            {selectedGene && (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <GeneAnnotationCard gene={selectedGene} annotation={selectedAnnotation} project="ptsd" />
                  </div>
                  <div className="self-end sm:self-start">
                    <GeneStoryButton gene={selectedGene} annotation={selectedAnnotation} project="ptsd" epicManifest={epicManifest} result={selectedResult} />
                  </div>
                </div>
              </>
            )}

            {/* Subtype Comparison Bar Chart */}
            <SubtypeComparisonChart geneData={selectedResult} />

            {/* Probe-Level Genomic Track */}
            <div ref={trackSectionRef} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2.5">
                  <MapPin className="w-4 h-4 text-slate-800" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    CpG Locus Map — {selectedGene || 'Select Gene'}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedGene ?? ''}
                    onChange={(e) => {
                      const gene = e.target.value;
                      if (gene) selectGeneInAnalysis(gene);
                      else setSelectedGene(null);
                    }}
                    className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-900"
                  >
                    <option value="" className="bg-white">-- Select Gene --</option>
                    {trackGeneList.map((g) => (
                      <option key={g} value={g} className="bg-white">
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {trackLoading ? (
                <div className="text-center py-8 flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                  <span className="text-slate-400 text-xs">Loading probe data for <strong>{selectedGene}</strong>...</span>
                </div>
              ) : selectedTrackData ? (
                <GenomicTrackPlot geneData={selectedTrackData} />
              ) : selectedGene ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No probe-level track data available for <strong>{selectedGene}</strong>.
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Select a gene from the registry on the left to view its genomic track.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
