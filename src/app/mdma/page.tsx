'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import {
  Search, Filter, Download, ArrowUpDown, Dna, Loader2,
  FlaskConical, ArrowLeft, LogOut, ChevronLeft, ChevronRight, MapPin, BookOpen,
} from 'lucide-react';
import { GenomicTrackPlot } from '@/components/GenomicTrackPlot';
import { GeneAnnotationCard } from '@/components/GeneAnnotationCard';
import { GeneProbeData } from '@/types/probe';
import { GeneAnnotationMap } from '@/types/annotation';

// ---- Types ----
interface CohortStat {
  deltaBeta: number;
  pValue: number;
  fdr: number;
  direction: string;
}

interface MetaDMR {
  gene: string;
  totalProbes: number;
  nSigProbes: number;
  fdr: number;
  pValue: number;
  deltaBeta: number;
  direction: string;
  cohorts?: Record<string, CohortStat>;
}

interface CohortDMR {
  gene: string;
  totalProbes: number;
  nSigProbes: number;
  fdr: number;
  pValue: number;
  deltaBeta: number;
  direction: string;
}

interface MdmaMasterData {
  metaAnalysis: MetaDMR[];
  cohorts: {
    MDMA: CohortDMR[];
    Ketamine: CohortDMR[];
    CPT: CohortDMR[];
  };
  cohortLabels: Record<string, string>;
}

// ---- Tab config ----
const TABS = [
  { key: 'meta', label: 'Meta-Analysis', color: '#0f172a' },
  { key: 'MDMA', label: 'MDMA-AT', color: '#7c3aed' },
  { key: 'Ketamine', label: 'Ketamine', color: '#0891b2' },
  { key: 'CPT', label: 'CPT', color: '#059669' },
] as const;

const COHORT_COLORS: Record<string, string> = { MDMA: '#7c3aed', Ketamine: '#0891b2', CPT: '#059669' };

export default function MdmaPage() {
  const [data, setData] = useState<MdmaMasterData | null>(null);
  const [annotationData, setAnnotationData] = useState<GeneAnnotationMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('meta');
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState('All');
  const [selectedGene, setSelectedGene] = useState<string | null>(null);
  const [sortField, setSortField] = useState('fdr');
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Probe data (on-demand)
  const [selectedTrackData, setSelectedTrackData] = useState<GeneProbeData | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const probeCache = useRef<Record<string, GeneProbeData | null>>({});

  // Load master data + annotations
  useEffect(() => {
    Promise.all([
      fetch('/data/mdma/dmrData.json').then((r) => r.json()),
      fetch('/data/mdma/geneAnnotations.json').then((r) => r.json()).catch(() => null),
    ]).then(([d, annot]) => {
      setData(d as MdmaMasterData);
      setAnnotationData(annot as GeneAnnotationMap);
      setLoading(false);
      if ((d as MdmaMasterData).metaAnalysis.length > 0) {
        setSelectedGene((d as MdmaMasterData).metaAnalysis[0].gene);
      }
    });
  }, []);

  // Fetch probe data on demand
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
        probeCache.current[gene] = pd;
        setSelectedTrackData(pd);
      } else {
        probeCache.current[gene] = null;
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

  // ---- Filtered dataset ----
  const filteredData = useMemo(() => {
    if (!data) return [];
    let list: any[] = activeTab === 'meta'
      ? data.metaAnalysis
      : data.cohorts[activeTab as keyof typeof data.cohorts] || [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((d: any) => d.gene.toLowerCase().includes(q));
    }
    if (directionFilter !== 'All') {
      list = list.filter((d: any) => d.direction === directionFilter);
    }

    const sorted = [...list].sort((a: any, b: any) => {
      const va = a[sortField as keyof typeof a];
      const vb = b[sortField as keyof typeof b];
      if (typeof va === 'string') return sortAsc ? (va as string).localeCompare(vb as string) : (vb as string).localeCompare(va as string);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return sorted;
  }, [data, activeTab, searchQuery, directionFilter, sortField, sortAsc]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ---- Bar chart data ----
  const selectedGeneBarData = useMemo(() => {
    if (!data || !selectedGene) return null;

    // Check if the gene is a meta gene with per-cohort data
    const metaItem = data.metaAnalysis.find((d) => d.gene === selectedGene);
    if (metaItem?.cohorts) {
      return (['MDMA', 'Ketamine', 'CPT'] as const).map((c) => ({
        cohort: c,
        deltaBeta: metaItem.cohorts![c]?.deltaBeta || 0,
        fdr: metaItem.cohorts![c]?.fdr || 1,
        direction: metaItem.cohorts![c]?.direction || 'N/A',
        color: COHORT_COLORS[c],
      }));
    }

    // Fallback: look up in cohort lists
    return (['MDMA', 'Ketamine', 'CPT'] as const).map((c) => {
      const item = data.cohorts[c].find((d) => d.gene === selectedGene);
      return {
        cohort: c,
        deltaBeta: item?.deltaBeta || 0,
        fdr: item?.fdr || 1,
        direction: item?.direction || 'N/A',
        color: COHORT_COLORS[c],
      };
    });
  }, [data, selectedGene]);

  // ---- Annotation ----
  const selectedAnnotation = useMemo(() => {
    if (!annotationData || !selectedGene) return null;
    return annotationData[selectedGene] || null;
  }, [annotationData, selectedGene]);

  // ---- Volcano data ----
  const volcanoData = useMemo(() => {
    return filteredData.map((d: any) => ({
      gene: d.gene,
      deltaBeta: d.deltaBeta,
      negLogP: -Math.log10(Math.max(d.fdr, 1e-30)),
      direction: d.direction,
    }));
  }, [filteredData]);

  // ---- CSV Export ----
  const handleExportCSV = () => {
    const headers = ['Gene', 'TotalProbes', 'N_Sig_Probes', 'FDR', 'DeltaBeta', 'Direction'];
    const rows = filteredData.map((d: any) => [d.gene, d.totalProbes, d.nSigProbes, d.fdr, d.deltaBeta, d.direction]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `MDMA_DMR_${activeTab}_filtered.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

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

  const activeTabConfig = TABS.find((t) => t.key === activeTab)!;

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
        {/* Tab Bar */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const count = tab.key === 'meta' ? data.metaAnalysis.length : data.cohorts[tab.key as keyof typeof data.cohorts]?.length || 0;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setCurrentPage(1);
                  const list = tab.key === 'meta' ? data.metaAnalysis : data.cohorts[tab.key as keyof typeof data.cohorts] || [];
                  if (list.length > 0) setSelectedGene(list[0].gene);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border transition whitespace-nowrap ${
                  activeTab === tab.key ? 'bg-white border-slate-300 text-slate-900 shadow-xs' : 'bg-slate-100 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tab.color }} />
                {tab.label}
                <span className="text-[10px] text-slate-400 font-mono">{count}</span>
              </button>
            );
          })}
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
                <option value="Mixed">Mixed</option>
              </select>
            </div>
            <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition font-semibold shadow-xs">
              <Download className="w-3.5 h-3.5" />Export CSV
            </button>
          </div>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
          {/* LEFT: Registry Table */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex-1 flex flex-col">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <Dna className="w-4 h-4 text-slate-700" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">DMR Gene Registry ({filteredData.length} genes)</h3>
                </div>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold uppercase text-[11px]">
                    <tr>
                      {[{f:'gene',l:'Gene'},{f:'fdr',l:'FDR'},{f:'deltaBeta',l:'Δβ'}].map(({f,l}) => (
                        <th key={f} className="p-2.5 cursor-pointer hover:text-slate-900" onClick={() => { setSortField(f); setSortAsc(sortField === f ? !sortAsc : true); }}>
                          <div className="flex items-center gap-1"><span>{l}</span><ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                        </th>
                      ))}
                      <th className="p-2.5">Dir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedData.map((row: any) => {
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
                            }`}>{row.direction === 'Hypermethylated' ? 'Hyper' : row.direction === 'Hypomethylated' ? 'Hypo' : 'Mix'}</span>
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

          {/* RIGHT: Details */}
          <div className="lg:col-span-7 space-y-5">
            {/* Gene Annotation Card */}
            {selectedGene && (
              <GeneAnnotationCard gene={selectedGene} annotation={selectedAnnotation} />
            )}

            {/* Cohort Comparison Bar Chart */}
            {selectedGene && selectedGeneBarData && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selectedGene}</h3>
                    <p className="text-xs text-slate-500">Cross-Cohort Effect Size (Δβ) — Responder vs. Control/NonResponder</p>
                  </div>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedGeneBarData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="cohort" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => v.toFixed(3)}
                        label={{ value: 'Mean Δβ (Top 3)', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 11 }} />
                      <Tooltip content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-white border border-slate-300 p-2.5 rounded shadow-lg text-xs space-y-1">
                              <div className="font-bold text-slate-900">{d.cohort}</div>
                              <div className="flex justify-between gap-4"><span className="text-slate-500">Δβ:</span><span className="font-mono font-bold">{d.deltaBeta > 0 ? `+${d.deltaBeta.toFixed(4)}` : d.deltaBeta.toFixed(4)}</span></div>
                              <div className="flex justify-between gap-4"><span className="text-slate-500">FDR:</span><span className="font-mono">{d.fdr < 1e-15 ? '< 1e-15' : d.fdr.toExponential(2)}</span></div>
                              <div className="flex justify-between gap-4"><span className="text-slate-500">Direction:</span><span>{d.direction}</span></div>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.2} />
                      <Bar dataKey="deltaBeta" radius={[4, 4, 0, 0]}>
                        {selectedGeneBarData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Probe-Level Genomic Track */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center space-x-2.5 mb-3">
                <MapPin className="w-4 h-4 text-slate-800" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Probe-Level Genomic Track</h3>
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

        {/* Volcano Plot */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs mb-6">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
            Volcano Plot — {activeTabConfig.label} ({filteredData.length} DMRs)
          </h3>
          <div className="h-[400px] w-full">
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
                        <div className="font-bold text-slate-900">{d.gene}</div>
                        <div>Δβ: <span className="font-mono">{d.deltaBeta.toFixed(4)}</span></div>
                        <div>-log₁₀FDR: <span className="font-mono">{d.negLogP.toFixed(2)}</span></div>
                      </div>
                    );
                  }
                  return null;
                }} />
                <ReferenceLine y={-Math.log10(0.05)} stroke="#ef4444" strokeDasharray="5 3" label={{ value: 'FDR=0.05', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                <Scatter data={volcanoData} onClick={(d: any) => { if (d?.gene) setSelectedGene(d.gene); }} cursor="pointer">
                  {volcanoData.map((entry, idx) => (
                    <Cell key={`vc-${idx}`}
                      fill={entry.gene === selectedGene ? '#f59e0b' : entry.direction === 'Hypermethylated' ? '#dc2626' : entry.direction === 'Hypomethylated' ? '#2563eb' : '#d97706'}
                      opacity={entry.gene === selectedGene ? 1 : 0.6} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
}
