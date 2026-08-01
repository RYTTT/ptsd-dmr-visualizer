import React from 'react';
import { X, Dna, ShieldAlert, Layers, ExternalLink } from 'lucide-react';
import { CrossSubtypeDMR, UniqueDMR } from '../types/dmr';

interface ModalProps {
  gene: string | null;
  onClose: () => void;
  crossData: CrossSubtypeDMR[];
  uniqueDataMap: Record<string, UniqueDMR[]>;
}

export const GeneInspectorModal: React.FC<ModalProps> = ({
  gene,
  onClose,
  crossData,
  uniqueDataMap,
}) => {
  if (!gene) return null;

  const crossItem = crossData.find((d) => d.gene === gene);

  // Check unique subtype occurrences
  const uniqueIn: { subtype: string; item: UniqueDMR }[] = [];
  Object.entries(uniqueDataMap).forEach(([sub, list]) => {
    const found = list.find((d) => d.gene === gene);
    if (found) {
      uniqueIn.push({ subtype: sub, item: found });
    }
  });

  const isPtsd = crossItem?.isPtsd || uniqueIn.some((u) => u.item.isPtsd);
  const chr = crossItem?.chr || uniqueIn[0]?.item.chr || 'N/A';
  const totalProbes = crossItem?.totalProbes || uniqueIn[0]?.item.totalProbes || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Dna className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white tracking-wide">{gene}</h2>
                {isPtsd && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full">
                    <ShieldAlert className="w-3 h-3" />
                    PTSD Target Gene
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Chromosome: <span className="text-slate-200 font-mono">{chr}</span> | Mapped CpGs: <span className="text-slate-200 font-mono">{totalProbes}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Classification Banner */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-400" />
              DMR Category Classification
            </h4>
            {crossItem ? (
              <div className="text-xs text-slate-300 space-y-1">
                <p className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded font-semibold">
                    Cross-Subtype Shared DMR
                  </span>
                  <span>Significant in {crossItem.nSubtypesSig}/4 Subtypes</span>
                </p>
                <p className="text-slate-400">
                  Combined Cross Fisher FDR: <span className="font-mono text-cyan-400 font-bold">{crossItem.crossFdr < 1e-15 ? '< 1e-15' : crossItem.crossFdr.toExponential(2)}</span>
                </p>
              </div>
            ) : uniqueIn.length > 0 ? (
              <div className="text-xs text-slate-300 space-y-2">
                <p className="text-slate-400">Unique Subtype Specificity:</p>
                <div className="flex flex-wrap gap-2">
                  {uniqueIn.map((u) => (
                    <span
                      key={u.subtype}
                      className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-md font-semibold flex items-center gap-1"
                    >
                      Exclusive to {u.subtype} (FDR: {u.item.fdr < 1e-15 ? '< 1e-15' : u.item.fdr.toExponential(2)})
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No subtype classification found for this gene.</p>
            )}
          </div>

          {/* Subtype Breakdown Table */}
          {crossItem && (
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                Subtype-Specific Top-3 Statistics
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-800/80 text-slate-300 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Subtype</th>
                      <th className="p-3">Top-3 Avg Δβ</th>
                      <th className="p-3">Subtype FDR</th>
                      <th className="p-3">Direction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                    {(['SSS', 'ADS', 'ICF', 'ISS'] as const).map((sub) => {
                      const stat = crossItem.subtypes[sub];
                      return (
                        <tr key={sub} className="hover:bg-slate-800/40">
                          <td className="p-3 font-semibold text-white">{sub}</td>
                          <td className="p-3 font-mono font-medium">
                            <span
                              className={
                                stat.deltaBeta > 0
                                  ? 'text-emerald-400'
                                  : 'text-cyan-400'
                              }
                            >
                              {stat.deltaBeta > 0 ? `+${stat.deltaBeta.toFixed(4)}` : stat.deltaBeta.toFixed(4)}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-300">
                            {stat.fdr < 1e-15 ? '< 1e-15' : stat.fdr.toExponential(2)}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                stat.direction === 'Hypermethylated'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : stat.direction === 'Hypomethylated'
                                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {stat.direction}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* External Links */}
          <div className="border-t border-slate-800 pt-4 flex items-center justify-between text-xs">
            <span className="text-slate-400">External Databases:</span>
            <div className="flex space-x-3">
              <a
                href={`https://www.ncbi.nlm.nih.gov/gene/?term=${gene}`}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline"
              >
                NCBI Gene <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={`https://www.genecards.org/cgi-bin/carddisp.pl?gene=${gene}`}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline"
              >
                GeneCards <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
