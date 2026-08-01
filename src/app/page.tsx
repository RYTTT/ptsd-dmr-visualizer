'use client';

import React, { useState, useMemo } from 'react';
import { Header } from '@/components/Header';
import { MetricsOverview } from '@/components/MetricsOverview';
import { DmrVolcanoPlot } from '@/components/DmrVolcanoPlot';
import { SubtypeComparisonChart } from '@/components/SubtypeComparisonChart';
import { GeneInspectorModal } from '@/components/GeneInspectorModal';
import dmrDataRaw from '@/data/dmrData.json';
import { MasterDMRData, CrossSubtypeDMR } from '@/types/dmr';
import {
  Search,
  Filter,
  ShieldAlert,
  Download,
  ArrowUpDown,
  CheckCircle2,
  Dna,
} from 'lucide-react';

const masterData = dmrDataRaw as MasterDMRData;

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>('cross');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [ptsdOnly, setPtsdOnly] = useState<boolean>(false);
  const [directionFilter, setDirectionFilter] = useState<string>('All');
  const [selectedGene, setSelectedGene] = useState<string | null>('HTR2A');
  const [sortField, setSortField] = useState<string>('fdr');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Counts for summary metrics
  const crossCount = masterData.crossSubtype.length;
  const crossPtsdCount = masterData.crossSubtype.filter((d) => d.isPtsd).length;

  const sssCount = masterData.uniqueSubtypes.SSS.length;
  const sssPtsdCount = masterData.uniqueSubtypes.SSS.filter((d) => d.isPtsd).length;

  const adsCount = masterData.uniqueSubtypes.ADS.length;
  const adsPtsdCount = masterData.uniqueSubtypes.ADS.filter((d) => d.isPtsd).length;

  const icfCount = masterData.uniqueSubtypes.ICF.length;
  const icfPtsdCount = masterData.uniqueSubtypes.ICF.filter((d) => d.isPtsd).length;

  const issCount = masterData.uniqueSubtypes.ISS.length;
  const issPtsdCount = masterData.uniqueSubtypes.ISS.filter((d) => d.isPtsd).length;

  // Filtered dataset according to tab, search, ptsd toggle, direction
  const filteredData = useMemo(() => {
    let list: any[] = [];
    if (activeTab === 'cross') {
      list = masterData.crossSubtype.map((item) => ({
        gene: item.gene,
        chr: item.chr,
        totalProbes: item.totalProbes,
        isPtsd: item.isPtsd,
        fdr: item.crossFdr,
        deltaBeta: item.subtypes.SSS.deltaBeta, // Representative SSS deltaBeta
        direction: item.subtypes.SSS.direction,
        negLogFdr: -Math.log10(Math.max(item.crossFdr, 1e-30)),
        rawItem: item,
      }));
    } else {
      const uList = masterData.uniqueSubtypes[activeTab as keyof typeof masterData.uniqueSubtypes] || [];
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

    // Apply Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (d) => d.gene.toLowerCase().includes(q) || d.chr.toLowerCase().includes(q)
      );
    }

    // Apply PTSD filter
    if (ptsdOnly) {
      list = list.filter((d) => d.isPtsd);
    }

    // Apply Direction filter
    if (directionFilter !== 'All') {
      list = list.filter((d) => d.direction === directionFilter);
    }

    // Apply Sort
    list.sort((a, b) => {
      let valA = a[sortField as keyof typeof a];
      let valB = b[sortField as keyof typeof b];
      if (typeof valA === 'string') {
        return sortAsc ? (valA as string).localeCompare(valB as string) : (valB as string).localeCompare(valA as string);
      }
      return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });

    return list;
  }, [activeTab, searchQuery, ptsdOnly, directionFilter, sortField, sortAsc]);

  // Selected gene for comparison chart
  const selectedCrossItem = useMemo(() => {
    if (!selectedGene) return masterData.crossSubtype[0] || null;
    const found = masterData.crossSubtype.find((d) => d.gene === selectedGene);
    if (found) return found;
    // Fallback if gene is not in cross dataset
    return masterData.crossSubtype[0] || null;
  }, [selectedGene]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Gene', 'Chr', 'TotalProbes', 'PTSD_Related', 'FDR', 'DeltaBeta', 'Direction'];
    const rows = filteredData.map((d) => [
      d.gene,
      d.chr,
      d.totalProbes,
      d.isPtsd ? 'YES' : 'NO',
      d.fdr,
      d.deltaBeta,
      d.direction,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DMR_List_${activeTab}_filtered.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-white pb-12">
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
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 mb-6 backdrop-blur-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by gene symbol or chromosome (e.g. HTR2A, AHRR, ZBTB16, chr13)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
            />
          </div>

          {/* Filter Toggles & Dropdowns */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* PTSD Toggle Button */}
            <button
              onClick={() => {
                setPtsdOnly(!ptsdOnly);
                setCurrentPage(1);
              }}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg font-semibold border transition ${
                ptsdOnly
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 shadow-lg shadow-amber-400/10'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>PTSD Targets Only</span>
              {ptsdOnly && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
            </button>

            {/* Direction Filter */}
            <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Direction:</span>
              <select
                value={directionFilter}
                onChange={(e) => {
                  setDirectionFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-white focus:outline-none cursor-pointer font-medium"
              >
                <option value="All" className="bg-slate-900">All Directions</option>
                <option value="Hypermethylated" className="bg-slate-900">Hypermethylated</option>
                <option value="Hypomethylated" className="bg-slate-900">Hypomethylated</option>
                <option value="Mixed" className="bg-slate-900">Mixed</option>
              </select>
            </div>

            {/* Export Button */}
            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <DmrVolcanoPlot
            data={filteredData}
            onSelectGene={(g) => setSelectedGene(g)}
            selectedGene={selectedGene}
          />

          <SubtypeComparisonChart geneData={selectedCrossItem} />
        </div>

        {/* Data Table Container */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Dna className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">
                DMR Results Registry ({filteredData.length} genes found)
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Showing page {currentPage} of {totalPages}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-800 font-semibold uppercase tracking-wider">
                <tr>
                  <th
                    className="p-3.5 cursor-pointer hover:text-white"
                    onClick={() => {
                      setSortField('gene');
                      setSortAsc(!sortAsc);
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Gene</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th className="p-3.5">Chr</th>
                  <th className="p-3.5">Total CpGs</th>
                  <th
                    className="p-3.5 cursor-pointer hover:text-white"
                    onClick={() => {
                      setSortField('fdr');
                      setSortAsc(!sortAsc);
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>FDR P-Value</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th
                    className="p-3.5 cursor-pointer hover:text-white"
                    onClick={() => {
                      setSortField('deltaBeta');
                      setSortAsc(!sortAsc);
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Top-3 Avg Δβ</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                  <th className="p-3.5">Methylation State</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {paginatedData.map((row) => {
                  const isSelected = selectedGene === row.gene;
                  return (
                    <tr
                      key={row.gene}
                      onClick={() => setSelectedGene(row.gene)}
                      className={`cursor-pointer transition hover:bg-slate-800/50 ${
                        isSelected ? 'bg-cyan-500/10 border-l-2 border-cyan-400' : ''
                      }`}
                    >
                      <td className="p-3.5 font-bold text-white flex items-center space-x-2">
                        <span>{row.gene}</span>
                        {row.isPtsd && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded">
                            PTSD Target
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 font-mono text-slate-300">{row.chr}</td>

                      <td className="p-3.5 text-slate-300">{row.totalProbes}</td>

                      <td className="p-3.5 font-mono text-cyan-400 font-semibold">
                        {row.fdr < 1e-15 ? '< 1e-15' : row.fdr.toExponential(2)}
                      </td>

                      <td className="p-3.5 font-mono font-medium">
                        <span
                          className={
                            row.deltaBeta > 0
                              ? 'text-emerald-400'
                              : 'text-cyan-400'
                          }
                        >
                          {row.deltaBeta > 0 ? `+${row.deltaBeta.toFixed(4)}` : row.deltaBeta.toFixed(4)}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            row.direction === 'Hypermethylated'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : row.direction === 'Hypomethylated'
                              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {row.direction}
                        </span>
                      </td>

                      <td className="p-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGene(row.gene);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/80 text-xs">
            <span className="text-slate-400">
              Showing {paginatedData.length} of {filteredData.length} records
            </span>

            <div className="flex items-center space-x-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition"
              >
                Previous
              </button>
              <span className="text-slate-300 font-semibold px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Gene Inspector Drawer / Modal */}
      <GeneInspectorModal
        gene={selectedGene}
        onClose={() => setSelectedGene(null)}
        crossData={masterData.crossSubtype}
        uniqueDataMap={masterData.uniqueSubtypes}
      />
    </div>
  );
}
