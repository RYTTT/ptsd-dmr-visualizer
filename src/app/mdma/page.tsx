'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import {
  Search, Filter, Download, ArrowUpDown, Dna, Loader2,
  FlaskConical, ArrowLeft, LogOut, ChevronLeft, ChevronRight, MapPin, Clock,
} from 'lucide-react';
import { GenomicTrackPlot } from '@/components/GenomicTrackPlot';
import { GeneAnnotationCard } from '@/components/GeneAnnotationCard';
import { GeneProbeData } from '@/types/probe';
import { GeneAnnotationMap } from '@/types/annotation';

import { KeyResultsPanel, MDMA_KEY_GENES, EpicManifestEntry } from '@/components/KeyResultsPanel';
import { GeneStoryButton } from '@/components/GeneStoryButton';

// ---- Types ----
interface CohortStat {
  deltaBeta: number;
  fdr: number;
  direction: string;
  totalProbes: number;
  nSigProbes: number;
}

interface CrossCohortGene {
  gene: string;
  fdr: number;
  pValue: number;
  deltaBeta: number;
  direction: string;
  totalProbes: number;
  nSigProbes: number;
  cohorts: Record<string, CohortStat>;
}

interface UniqueGene {
  gene: string;
  totalProbes: number;
  nSigProbes: number;
  fdr: number;
  deltaBeta: number;
  direction: string;
}

interface TimepointData {
  uniqueCohorts: Record<string, UniqueGene[]>;
}

interface MdmaMasterData {
  crossCohort: CrossCohortGene[];
  timepoints: { Pre: TimepointData; FUP: TimepointData };
}

// ---- Tab config ----
const COHORT_TABS = [
  { key: 'cross', label: 'Common', color: '#0f172a' },
  { key: 'MDMA', label: 'MDMA-Unique', color: '#7c3aed' },
  { key: 'Ketamine', label: 'Ketamine-Unique', color: '#0891b2' },
  { key: 'CPT', label: 'CPT-Unique', color: '#059669' },
] as const;

const COHORT_COLORS: Record<string, string> = { MDMA: '#7c3aed', Ketamine: '#0891b2', CPT: '#059669' };

export default function MdmaPage() {
  const [data, setData] = useState<MdmaMasterData | null>(null);
  const [annotationData, setAnnotationData] = useState<GeneAnnotationMap | null>(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [timepoint, setTimepoint] = useState<'Pre' | 'FUP'>('FUP');
  const [activeTab, setActiveTab] = useState('cross');
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState('All');
  const [selectedGene, setSelectedGene] = useState<string | null>(null);
  const [sortField, setSortField] = useState('fdr');
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Probe data
  const [selectedTrackData, setSelectedTrackData] = useState<GeneProbeData | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const probeCache = useRef<Record<string, GeneProbeData | null>>({});
  const probeCacheKeys = useRef<string[]>([]);
  const CACHE_LIMIT = 100;

  // EPIC manifest for dynamic stats
  const [epicManifest, setEpicManifest] = useState<Record<string, EpicManifestEntry> | undefined>(undefined);

  // Auto-scroll ref
  const trackSectionRef = useRef<HTMLDivElement>(null);

  // Error state
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/data/mdma/dmrData.json').then((r) => { if (!r.ok) throw new Error('Failed to load treatment DMR data'); return r.json(); }),
      fetch('/data/common/geneAnnotations.json').then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/data/common/epicGeneManifest.json').then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([d, annot, manifest]) => {
      setData(d as MdmaMasterData);
      setAnnotationData(annot as GeneAnnotationMap);
      if (manifest) setEpicManifest(manifest);
      setLoading(false);
      const md = d as MdmaMasterData;
      if (md.crossCohort.length > 0) setSelectedGene(md.crossCohort[0].gene);
    }).catch((err) => {
      setLoadError(err.message || 'Failed to load data');
      setLoading(false);
    });
  }, []);

  const fetchProbeData = useCallback(async (gene: string) => {
    if (probeCache.current[gene] !== undefined) {
      setSelectedTrackData(probeCache.current[gene]);
      return;
    }
    setTrackLoading(true);
    try {
      const res = await fetch(`/data/mdma/probes/${encodeURIComponent(gene)}.json`);
      if (res.ok) {
        const pd = (await res.json()) as GeneProbeData;
        // LRU cache eviction
        if (probeCacheKeys.current.length >= CACHE_LIMIT) {
          const oldest = probeCacheKeys.current.shift()!;
          delete probeCache.current[oldest];
        }
        probeCache.current[gene] = pd;
        probeCacheKeys.current.push(gene);
        setSelectedTrackData(pd);
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
    if (selectedGene) fetchProbeData(selectedGene);
    else setSelectedTrackData(null);
  }, [selectedGene, fetchProbeData]);


  // ---- Normalize rows to a common shape ----
  const filteredData = useMemo(() => {
    if (!data) return [];

    let list: { gene: string; fdr: number; deltaBeta: number; direction: string; totalProbes: number; nSigProbes: number }[] = [];

    if (activeTab === 'cross') {
      list = data.crossCohort.map((g) => ({
        gene: g.gene, fdr: g.fdr, deltaBeta: g.deltaBeta, direction: g.direction,
        totalProbes: g.totalProbes, nSigProbes: g.nSigProbes,
      }));
    } else {
      const tpData = data.timepoints[timepoint];
      list = (tpData.uniqueCohorts[activeTab] || []).map((g) => ({
        gene: g.gene, fdr: g.fdr, deltaBeta: g.deltaBeta, direction: g.direction,
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
      const va = (a as any)[sortField];
      const vb = (b as any)[sortField];
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [data, timepoint, activeTab, searchQuery, directionFilter, sortField, sortAsc]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ---- Bar chart ----
  const selectedGeneBarData = useMemo(() => {
    if (!data || !selectedGene) return null;
    // Find in cross
    const crossItem = data.crossCohort.find((g) => g.gene === selectedGene);
    if (crossItem) {
      return (['MDMA', 'Ketamine', 'CPT'] as const).map((c) => {
        const cohortObj = crossItem.cohorts[c] as any;
        const tpStats = cohortObj?.[timepoint as 'Pre' | 'FUP'] || cohortObj;
        const preStats = cohortObj?.Pre || { deltaBeta: 0, fdr: 1.0, direction: 'N/A' };
        const fupStats = cohortObj?.FUP || { deltaBeta: 0, fdr: 1.0, direction: 'N/A' };
        return {
          cohort: c,
          deltaBeta: tpStats?.deltaBeta || 0,
          fdr: tpStats?.fdr || 1,
          direction: tpStats?.direction || 'N/A',
          deltaBeta_Pre: preStats.deltaBeta || 0,
          fdr_Pre: preStats.fdr || 1,
          direction_Pre: preStats.direction || 'N/A',
          deltaBeta_FUP: fupStats.deltaBeta || 0,
          fdr_FUP: fupStats.fdr || 1,
          direction_FUP: fupStats.direction || 'N/A',
          color: COHORT_COLORS[c],
        };
      });
    }
    // Find in unique cohorts
    for (const c of ['MDMA', 'Ketamine', 'CPT'] as const) {
      const tpd = data.timepoints[timepoint];
      const item = tpd.uniqueCohorts[c]?.find((g) => g.gene === selectedGene);
      if (item) {
        return (['MDMA', 'Ketamine', 'CPT'] as const).map((cc) => ({
          cohort: cc,
          deltaBeta: cc === c ? item.deltaBeta : 0,
          fdr: cc === c ? item.fdr : 1,
          direction: cc === c ? item.direction : 'N/A',
          deltaBeta_Pre: cc === c && timepoint === 'Pre' ? item.deltaBeta : 0,
          fdr_Pre: cc === c && timepoint === 'Pre' ? item.fdr : 1,
          direction_Pre: cc === c && timepoint === 'Pre' ? item.direction : 'N/A',
          deltaBeta_FUP: cc === c && timepoint === 'FUP' ? item.deltaBeta : 0,
          fdr_FUP: cc === c && timepoint === 'FUP' ? item.fdr : 1,
          direction_FUP: cc === c && timepoint === 'FUP' ? item.direction : 'N/A',
          color: COHORT_COLORS[cc],
        }));
      }
    }
    return null;
  }, [data, timepoint, selectedGene]);

  // Annotation
  const selectedAnnotation = useMemo(() => {
    if (!annotationData || !selectedGene) return null;
    return annotationData[selectedGene] || null;
  }, [annotationData, selectedGene]);

  // Volcano
  const volcanoData = useMemo(() => {
    return filteredData.map((d) => ({
      gene: d.gene, deltaBeta: d.deltaBeta,
      negLogP: -Math.log10(Math.max(d.fdr, 1e-30)),
      direction: d.direction,
    }));
  }, [filteredData]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Gene', 'FDR', 'DeltaBeta', 'Direction', 'TotalProbes', 'N_Sig'];
    const rows = filteredData.map((d) => [d.gene, d.fdr, d.deltaBeta, d.direction, d.totalProbes, d.nSigProbes]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `Treatment_DMR_${timepoint}_${activeTab}.csv`);
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
          <span className="text-red-700 text-sm font-semibold">Error Loading Data</span>
          <p className="text-slate-500 text-xs max-w-sm">{loadError}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition">Retry</button>
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
      <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition">
              <ArrowLeft className="w-3.5 h-3.5" />Projects
            </Link>
            <div className="w-px h-6 bg-slate-200" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                <FlaskConical className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-tight">Treatment Response DMR Atlas</h1>
                <p className="text-[10px] text-slate-500 font-medium">MDMA / Ketamine / CPT — IPW CD4+ T Cell Analysis</p>
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        {/* Key Results / Landmark Treatment Response Genes Panel */}
        <KeyResultsPanel
          projectTitle="Treatment Response Cohorts — Key Remethylation Loci"
          projectDescription="Landmark treatment-responsive epigenetic loci identified across MDMA-assisted therapy, Ketamine, and CPT cohorts (IPW-adjusted, CD4+ T cells, 850K EPIC array). Click any landmark gene card to inspect its 3×2 pre/post genomic track plot."
          genes={MDMA_KEY_GENES}
          selectedGene={selectedGene}
          epicManifest={epicManifest}
          onSelectGene={(gene) => {
            setSelectedGene(gene);
            setTimeout(() => trackSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
          }}
        />

        {/* Timepoint Toggle + Cohort Tabs */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {COHORT_TABS.map((tab) => {
              const tpd = data?.timepoints[timepoint];
              const actualCount = tab.key === 'cross'
                ? (data?.crossCohort.length || 0)
                : (tpd?.uniqueCohorts[tab.key]?.length || 0);
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setCurrentPage(1);
                    const list = tab.key === 'cross'
                      ? data?.crossCohort || []
                      : tpd?.uniqueCohorts[tab.key] || [];
                    if (list.length > 0) setSelectedGene(list[0].gene);
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

          {/* Timepoint Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-400 ml-2" />
            {([['Pre', 'Baseline'], ['FUP', 'Follow-Up']] as const).map(([tp, label]) => (
              <button
                key={tp}
                onClick={() => {
                  setTimepoint(tp);
                  setCurrentPage(1);
                  const tpd2 = data!.timepoints[tp];
                  const list = activeTab === 'cross' ? data!.crossCohort : tpd2.uniqueCohorts[activeTab] || [];
                  if (list.length > 0) setSelectedGene(list[0].gene);
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

        {/* Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input type="text" placeholder="Search gene symbol..." value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition" />
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select value={directionFilter} onChange={(e) => { setDirectionFilter(e.target.value); setCurrentPage(1); }}
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
            Volcano Plot — {activeTab === 'cross' ? 'Common' : `${activeTab}-Unique`} ({timepoint === 'Pre' ? 'Baseline' : 'Follow-Up'}) — {filteredData.length} DMRs
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" dataKey="deltaBeta" name="Δβ" stroke="#64748b" fontSize={11}
                  label={{ value: 'Mean Δβ (Effect Size)', position: 'insideBottom', offset: -15, fill: '#475569', fontSize: 11 }} />
                <YAxis type="number" dataKey="negLogP" name="-log₁₀(FDR)" stroke="#64748b" fontSize={11}
                  label={{ value: '-log₁₀(FDR)', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 11 }} />
                <ZAxis range={[20, 20]} />
                <Tooltip content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-slate-300 p-2.5 rounded shadow-lg text-xs space-y-0.5">
                        <div className="font-bold">{d.gene}</div>
                        <div>Δβ: <span className="font-mono">{d.deltaBeta.toFixed(4)}</span></div>
                        <div>-log₁₀FDR: <span className="font-mono">{d.negLogP.toFixed(2)}</span></div>
                      </div>
                    );
                  }
                  return null;
                }} />
                <Scatter data={volcanoData} onClick={(d: any) => { if (d?.gene) setSelectedGene(d.gene); }} cursor="pointer">
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
                    {activeTab === 'cross' ? 'Common' : `${activeTab}-Unique`} DMR Genes ({filteredData.length})
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded">
                  {timepoint === 'Pre' ? 'Baseline' : 'Follow-Up'}
                </span>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold uppercase text-[11px]">
                    <tr>
                      {[
                        { f: 'gene', l: 'Gene' },
                        { f: activeTab === 'cross' ? 'fdr' : 'fdr', l: activeTab === 'cross' ? 'Cross P' : 'FDR' },
                        { f: 'deltaBeta', l: 'Δβ' },
                      ].map(({ f, l }) => (
                        <th key={f} className="p-2.5 cursor-pointer hover:text-slate-900" onClick={() => { setSortField(f); setSortAsc(sortField === f ? !sortAsc : true); }}>
                          <div className="flex items-center gap-1"><span>{l}</span><ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                        </th>
                      ))}
                      <th className="p-2.5">Dir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedData.map((row) => {
                      const isSelected = selectedGene === row.gene;
                      return (
                        <tr key={row.gene} onClick={() => setSelectedGene(row.gene)}
                          className={`cursor-pointer transition hover:bg-slate-50 ${isSelected ? 'bg-blue-50/90 font-semibold border-l-4 border-slate-900' : ''}`}>
                          <td className="p-2.5 font-bold text-slate-900">{row.gene}</td>
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
                            }`}>{row.direction === 'Hypermethylated' ? 'Hyper' : 'Hypo'}</span>
                          </td>
                        </tr>
                      );
                    })}
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
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <GeneAnnotationCard gene={selectedGene} annotation={selectedAnnotation} project="mdma" />
                </div>
                <GeneStoryButton gene={selectedGene} annotation={selectedAnnotation} project="mdma" epicManifest={epicManifest} />
              </div>
            )}

            {/* Bar Chart */}
            {selectedGene && selectedGeneBarData && (() => {
              // Force symmetric Y-axis domain
              const allVals = selectedGeneBarData.flatMap((d) => [d.deltaBeta_Pre, d.deltaBeta_FUP]);
              const maxAbs = Math.max(...allVals.map(Math.abs), 0.01);
              const pad = maxAbs * 1.35;
              const yDomain = [-pad, pad];

              const sigStars = (fdr: number) => {
                if (fdr < 0.001) return '***';
                if (fdr < 0.01) return '**';
                if (fdr < 0.05) return '*';
                return 'ns';
              };

              // Custom label for Pre bars
              const renderPreLabel = (props: any) => {
                const { x, y, width, index } = props;
                if (index === undefined || !selectedGeneBarData[index]) return null;
                const entry = selectedGeneBarData[index];
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
              const renderFupLabel = (props: any) => {
                const { x, y, width, index } = props;
                if (index === undefined || !selectedGeneBarData[index]) return null;
                const entry = selectedGeneBarData[index];
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
                    <p className="text-xs text-slate-500">Cross-Cohort Effect Size (Δβ) — Baseline vs Follow-Up</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 border border-slate-500" />
                      <span className="text-slate-600 font-medium">Baseline (Pre)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-purple-600 border border-purple-700" />
                      <span className="text-slate-600 font-medium">Follow-Up (Post)</span>
                    </div>
                  </div>
                </div>
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedGeneBarData} margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="cohort" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} domain={yDomain} tickFormatter={(v: number) => v.toFixed(3)}
                        label={{ value: 'Mean Δβ (Top 3)', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 11 }} />
                      <Tooltip content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-white border border-slate-300 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[200px]">
                              <div className="font-extrabold text-slate-900 border-b border-slate-100 pb-1">{d.cohort} Cohort</div>
                              <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                                <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                                  <div className="text-[10px] text-slate-400 font-bold uppercase">Baseline (Pre)</div>
                                  <div>Δβ: <span className="font-mono font-bold">{d.deltaBeta_Pre > 0 ? `+${d.deltaBeta_Pre.toFixed(4)}` : d.deltaBeta_Pre.toFixed(4)}</span></div>
                                  <div>FDR: <span className="font-mono">{d.fdr_Pre < 1e-15 ? '< 1e-15' : d.fdr_Pre.toExponential(2)}</span> <strong>{sigStars(d.fdr_Pre)}</strong></div>
                                </div>
                                <div className="bg-purple-50/50 p-1.5 rounded border border-purple-200">
                                  <div className="text-[10px] text-purple-700 font-bold uppercase">Follow-Up (Post)</div>
                                  <div>Δβ: <span className="font-mono font-bold text-purple-900">{d.deltaBeta_FUP > 0 ? `+${d.deltaBeta_FUP.toFixed(4)}` : d.deltaBeta_FUP.toFixed(4)}</span></div>
                                  <div>FDR: <span className="font-mono">{d.fdr_FUP < 1e-15 ? '< 1e-15' : d.fdr_FUP.toExponential(2)}</span> <strong>{sigStars(d.fdr_FUP)}</strong></div>
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
                      <Bar dataKey="deltaBeta_FUP" name="Follow-Up (Post)" radius={[4, 4, 0, 0]}>
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
                </div>
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
