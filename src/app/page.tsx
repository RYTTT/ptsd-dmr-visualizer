'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Header } from '@/components/Header';
import { MetricsOverview } from '@/components/MetricsOverview';
import { DmrVolcanoPlot } from '@/components/DmrVolcanoPlot';
import { SubtypeComparisonChart } from '@/components/SubtypeComparisonChart';
import { GenomicTrackPlot } from '@/components/GenomicTrackPlot';
import { GeneAnnotationCard } from '@/components/GeneAnnotationCard';
import { MasterDMRData } from '@/types/dmr';
import { ProbeDataMap } from '@/types/probe';
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
  BookOpen,
} from 'lucide-react';

export default function Home() {
  // ---- Data loading state ----
  const [masterData, setMasterData] = useState<MasterDMRData | null>(null);
  const [probeData, setProbeData] = useState<ProbeDataMap | null>(null);
  const [annotationData, setAnnotationData] = useState<GeneAnnotationMap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/data/dmrData.json').then((r) => r.json()),
      fetch('/data/probeData.json').then((r) => r.json()),
      fetch('/data/geneAnnotations.json').then((r) => r.json()),
    ]).then(([dmr, probes, annos]) => {
      setMasterData(dmr as MasterDMRData);
      setProbeData(probes as ProbeDataMap);
      setAnnotationData(annos as GeneAnnotationMap);
      setLoading(false);
    });
  }, []);

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
  const pageSize = 15;

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

  // ---- Available genes for selector ----
  const trackGeneList = useMemo(() => {
    if (!probeData) return [];
    return Object.keys(probeData).sort();
  }, [probeData]);

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
    if (!masterData) return null;
    if (!selectedGene) return masterData.crossSubtype[0] || null;
    return masterData.crossSubtype.find((d) => d.gene === selectedGene) || null;
  }, [masterData, selectedGene]);

  const selectedTrackData = useMemo(() => {
    if (!probeData || !selectedGene) return null;
    return probeData[selectedGene] || null;
  }, [probeData, selectedGene]);

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
    const headers = ['Gene', 'Chr', 'TotalProbes', 'PTSD_Related', 'FDR', 'DeltaBeta', 'Direction'];
    const rows = filteredData.map((d: any) => [
      d.gene, d.chr, d.totalProbes, d.isPtsd ? 'YES' : 'NO', d.fdr, d.deltaBeta, d.direction,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `DMR_List_${activeTab}_filtered.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

        {/* ===== MAIN SIDE-BY-SIDE SPLIT LAYOUT ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* LEFT COLUMN (5 Cols): DMR Registry Table (Compact, Top-level Gene Selector) */}
          <div className="lg:col-span-5 flex flex-col">
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

          {/* RIGHT COLUMN (7 Cols): Dynamic Selected Gene Details (Annotation + Subtype Bar Chart + Genomic Track) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Selected Gene Literature & Biological Annotation Card */}
            {selectedGene && (
              <GeneAnnotationCard gene={selectedGene} annotation={selectedAnnotation} />
            )}

            {/* Subtype Comparison Bar Chart */}
            <SubtypeComparisonChart geneData={selectedCrossItem} />

            {/* Probe-Level Genomic Track */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2.5">
                  <MapPin className="w-4 h-4 text-slate-800" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Probe-Level Genomic Track (Nature Standard)
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

              {selectedTrackData ? (
                <GenomicTrackPlot geneData={selectedTrackData} />
              ) : selectedGene ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No probe-level track data loaded for <strong>{selectedGene}</strong>.
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Select a gene from the registry on the left to view its genomic track.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== BOTTOM SECTION: Full Volcano Effect Size Overview ===== */}
        <div className="mb-6">
          <DmrVolcanoPlot
            data={filteredData}
            onSelectGene={(g) => setSelectedGene(g)}
            selectedGene={selectedGene}
          />
        </div>
      </main>
    </div>
  );
}
