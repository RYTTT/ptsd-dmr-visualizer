'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Header } from '@/components/Header';
import { MetricsOverview } from '@/components/MetricsOverview';
import { DmrVolcanoPlot } from '@/components/DmrVolcanoPlot';
import { SubtypeComparisonChart } from '@/components/SubtypeComparisonChart';
import { GenomicTrackPlot } from '@/components/GenomicTrackPlot';
import { GeneAnnotationCard } from '@/components/GeneAnnotationCard';
import { MasterDMRData } from '@/types/dmr';
import { GeneProbeData } from '@/types/probe';
import { GeneAnnotationMap } from '@/types/annotation';
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

export default function Home() {
  // ---- Data loading state ----
  const [masterData, setMasterData] = useState<MasterDMRData | null>(null);
  const [annotationData, setAnnotationData] = useState<GeneAnnotationMap | null>(null);
  const [loading, setLoading] = useState(true);

  // Per-gene probe data: cached on demand
  const [selectedTrackData, setSelectedTrackData] = useState<GeneProbeData | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const probeCache = useRef<Record<string, GeneProbeData | null>>({});
  const probeCacheKeys = useRef<string[]>([]);
  const CACHE_LIMIT = 100;

  // EPIC manifest for dynamic stats
  const [epicManifest, setEpicManifest] = useState<Record<string, EpicManifestEntry> | undefined>(undefined);

  // Auto-scroll ref
  const trackSectionRef = useRef<HTMLDivElement>(null);

  // ---- UI state ----
  const [activeTab, setActiveTab] = useState<string>('cross');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [ptsdOnly, setPtsdOnly] = useState<boolean>(false);
  const [directionFilter, setDirectionFilter] = useState<string>('All');
  const [selectedGene, setSelectedGene] = useState<string | null>('AHRR');
  const [sortField, setSortField] = useState<string>('fdr');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showTrack, setShowTrack] = useState<boolean>(true);
  const pageSize = 50;

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/data/dmrData.json').then((r) => { if (!r.ok) throw new Error('Failed to load DMR data'); return r.json(); }),
      fetch('/data/common/geneAnnotations.json').then((r) => { if (!r.ok) throw new Error('Failed to load annotations'); return r.json(); }),
      fetch('/data/common/epicGeneManifest.json').then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([dmr, annos, manifest]) => {
      setMasterData(dmr as MasterDMRData);
      setAnnotationData(annos as GeneAnnotationMap);
      if (manifest) setEpicManifest(manifest);
      setLoading(false);
    }).catch((err) => {
      setLoadError(err.message || 'Failed to load data');
      setLoading(false);
    });
  }, []);

  // Fetch probe data on demand when selectedGene changes
  const fetchProbeData = useCallback(async (gene: string) => {
    // Check cache first
    if (gene in probeCache.current) {
      setSelectedTrackData(probeCache.current[gene]);
      return;
    }
    setTrackLoading(true);
    setSelectedTrackData(null);
    try {
      const res = await fetch(`/data/probes/${encodeURIComponent(gene)}.json`);
      if (res.ok) {
        const data = await res.json() as GeneProbeData;
        // LRU cache eviction
        if (probeCacheKeys.current.length >= CACHE_LIMIT) {
          const oldest = probeCacheKeys.current.shift()!;
          delete probeCache.current[oldest];
        }
        probeCache.current[gene] = data;
        probeCacheKeys.current.push(gene);
        setSelectedTrackData(data);
      } else {
        probeCache.current[gene] = null;
        probeCacheKeys.current.push(gene);
        setSelectedTrackData(null);
      }
    } catch {
      probeCache.current[gene] = null;
      setSelectedTrackData(null);
    } finally {
      setTrackLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedGene) {
      fetchProbeData(selectedGene);
    } else {
      setSelectedTrackData(null);
    }
  }, [selectedGene, fetchProbeData]);



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
    for (const sub of ['SSS', 'ADS', 'ICF', 'ISS'] as const) {
      masterData.uniqueSubtypes[sub].forEach((d) => genes.add(d.gene));
    }
    return Array.from(genes).sort();
  }, [masterData]);

  // ---- Filtered dataset ----
  const filteredData = useMemo(() => {
    if (!masterData) return [];
    let list: any[] = [];
    if (activeTab === 'cross') {
      list = masterData.crossSubtype.map((item) => ({
        gene: item.gene,
        chr: item.chr,
        totalProbes: item.totalProbes,
        isPtsd: item.isPtsd,
        fdr: item.crossFdr,
        deltaBeta: item.subtypes.SSS.deltaBeta,
        direction: item.subtypes.SSS.direction,
        negLogFdr: -Math.log10(Math.max(item.crossFdr, 1e-30)),
        rawItem: item,
      }));
    } else {
      const uList =
        masterData.uniqueSubtypes[activeTab as keyof typeof masterData.uniqueSubtypes] || [];
      list = uList.map((item) => ({
        gene: item.gene,
        chr: item.chr,
        totalProbes: item.totalProbes,
        isPtsd: item.isPtsd,
        fdr: item.fdr,
        deltaBeta: item.deltaBeta,
        direction: item.direction,
        negLogFdr: -Math.log10(Math.max(item.fdr, 1e-30)),
        rawItem: item,
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
      const valA = a[sortField as keyof typeof a];
      const valB = b[sortField as keyof typeof b];
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
  const selectedCrossItem = useMemo(() => {
    if (!masterData || !selectedGene) return null;
    const found = masterData.crossSubtype.find((d) => d.gene === selectedGene);
    if (found) return found;

    // Search in uniqueSubtypes if not a cross-subtype gene
    for (const sub of ['SSS', 'ADS', 'ICF', 'ISS'] as const) {
      const item = masterData.uniqueSubtypes[sub].find((d) => d.gene === selectedGene);
      if (item) {
        return {
          gene: item.gene,
          chr: item.chr,
          totalProbes: item.totalProbes,
          isPtsd: item.isPtsd,
          crossP: item.fdr,
          crossFdr: item.fdr,
          nSubtypesSig: 1,
          subtypes: {
            SSS: sub === 'SSS' ? { deltaBeta: item.deltaBeta, fdr: item.fdr, direction: item.direction } : { deltaBeta: 0, fdr: 1, direction: 'N/A' },
            ADS: sub === 'ADS' ? { deltaBeta: item.deltaBeta, fdr: item.fdr, direction: item.direction } : { deltaBeta: 0, fdr: 1, direction: 'N/A' },
            ICF: sub === 'ICF' ? { deltaBeta: item.deltaBeta, fdr: item.fdr, direction: item.direction } : { deltaBeta: 0, fdr: 1, direction: 'N/A' },
            ISS: sub === 'ISS' ? { deltaBeta: item.deltaBeta, fdr: item.fdr, direction: item.direction } : { deltaBeta: 0, fdr: 1, direction: 'N/A' },
          },
        };
      }
    }
    return null;
  }, [masterData, selectedGene]);

  // selectedTrackData is now managed by the fetchProbeData useEffect above

  const selectedAnnotation = useMemo(() => {
    if (!annotationData || !selectedGene) return null;
    return annotationData[selectedGene] || null;
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
      const headers = ['Gene', 'Chr', 'TotalProbes', 'PTSD_Related', 'CrossFDR',
        'SSS_DeltaBeta', 'SSS_FDR', 'SSS_Direction',
        'ADS_DeltaBeta', 'ADS_FDR', 'ADS_Direction',
        'ICF_DeltaBeta', 'ICF_FDR', 'ICF_Direction',
        'ISS_DeltaBeta', 'ISS_FDR', 'ISS_Direction',
      ];
      const rows = filteredData.map((d: any) => {
        const item = d.rawItem;
        return [
          d.gene, d.chr, d.totalProbes, d.isPtsd ? 'YES' : 'NO', d.fdr,
          item.subtypes?.SSS?.deltaBeta ?? '', item.subtypes?.SSS?.fdr ?? '', item.subtypes?.SSS?.direction ?? '',
          item.subtypes?.ADS?.deltaBeta ?? '', item.subtypes?.ADS?.fdr ?? '', item.subtypes?.ADS?.direction ?? '',
          item.subtypes?.ICF?.deltaBeta ?? '', item.subtypes?.ICF?.fdr ?? '', item.subtypes?.ICF?.direction ?? '',
          item.subtypes?.ISS?.deltaBeta ?? '', item.subtypes?.ISS?.fdr ?? '', item.subtypes?.ISS?.direction ?? '',
        ];
      });
      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
      const link = document.createElement('a');
      link.setAttribute('href', encodeURI(csvContent));
      link.setAttribute('download', `DMR_CrossSubtype_filtered.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = ['Gene', 'Chr', 'TotalProbes', 'PTSD_Related', 'FDR', 'DeltaBeta', 'Direction'];
      const rows = filteredData.map((d: any) => [
        d.gene, d.chr, d.totalProbes, d.isPtsd ? 'YES' : 'NO', d.fdr, d.deltaBeta, d.direction,
      ]);
      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
      const link = document.createElement('a');
      link.setAttribute('href', encodeURI(csvContent));
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
          <span className="text-red-700 text-sm font-semibold">Error Loading Data</span>
          <p className="text-slate-500 text-xs max-w-sm">{loadError}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition">Retry</button>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Metrics Overview Cards */}
        <MetricsOverview
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setCurrentPage(1);
            // Auto-select the first gene in the new tab
            if (masterData) {
              if (tab === 'cross') {
                const first = masterData.crossSubtype[0]?.gene;
                if (first) setSelectedGene(first);
              } else {
                const uList = masterData.uniqueSubtypes[tab as keyof typeof masterData.uniqueSubtypes];
                const first = uList?.[0]?.gene;
                if (first) setSelectedGene(first);
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
            setSelectedGene(gene);
            setShowTrack(true);
            // Auto-scroll to genomic track
            setTimeout(() => trackSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
          }}
        />

        {/* Controls & Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
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
          onSelectGene={(g) => setSelectedGene(g)}
          selectedGene={selectedGene}
        />
        <div className="mb-6 mt-4">
          <PathwayEnrichmentPanel activeTab={activeTab} onSelectGene={(g) => { setSelectedGene(g); setTimeout(() => trackSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} />
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
                      <th
                        className="p-2.5 cursor-pointer hover:text-slate-900"
                        onClick={() => {
                          setSortField('gene');
                          setSortAsc(sortField === 'gene' ? !sortAsc : true);
                        }}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Gene</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="p-2.5">Chr</th>
                      <th
                        className="p-2.5 cursor-pointer hover:text-slate-900"
                        onClick={() => {
                          setSortField('fdr');
                          setSortAsc(sortField === 'fdr' ? !sortAsc : true);
                        }}
                      >
                        <div className="flex items-center space-x-1">
                          <span>FDR</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        className="p-2.5 cursor-pointer hover:text-slate-900"
                        onClick={() => {
                          setSortField('deltaBeta');
                          setSortAsc(sortField === 'deltaBeta' ? !sortAsc : true);
                        }}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Δβ</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedData.map((row: any) => {
                      const isSelected = selectedGene === row.gene;
                      return (
                        <tr
                          key={row.gene}
                          onClick={() => setSelectedGene(row.gene)}
                          className={`cursor-pointer transition hover:bg-slate-50 ${
                            isSelected ? 'bg-blue-50/90 font-semibold border-l-4 border-slate-900' : ''
                          }`}
                        >
                          <td className="p-2.5 font-bold text-slate-900 flex items-center space-x-1.5">
                            <span>{row.gene}</span>
                            {row.isPtsd && (
                              <span className="px-1 py-0.2 text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded">
                                PTSD
                              </span>
                            )}
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
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <GeneAnnotationCard gene={selectedGene} annotation={selectedAnnotation} project="ptsd" />
                  </div>
                  <GeneStoryButton gene={selectedGene} annotation={selectedAnnotation} project="ptsd" epicManifest={epicManifest} />
                </div>
              </>
            )}

            {/* Subtype Comparison Bar Chart */}
            <SubtypeComparisonChart geneData={selectedCrossItem} />

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
                    value={selectedGene || ''}
                    onChange={(e) => setSelectedGene(e.target.value || null)}
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
