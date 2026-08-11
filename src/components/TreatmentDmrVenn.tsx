'use client';

import { useMemo } from 'react';
import { Download } from 'lucide-react';

import { serializeCsv } from '@/lib/scientificData';
import type {
  CptHealthyControlGroup,
  CrossCohortGene,
  TreatmentGeneResult,
  TreatmentTimepoint,
} from '@/types/dmr';

interface TreatmentDmrVennProps {
  metaGenes: CrossCohortGene[];
  referenceGenes: TreatmentGeneResult[];
  timepoint: TreatmentTimepoint;
  group: CptHealthyControlGroup;
  onSelectGene: (gene: string) => void;
}

export function TreatmentDmrVenn({
  metaGenes,
  referenceGenes,
  timepoint,
  group,
  onSelectGene,
}: TreatmentDmrVennProps) {
  const comparison = group === 'Responder' ? 'Responder vs HC' : 'NonResponder vs HC';
  const visit = timepoint === 'Pre' ? 'Baseline (Pre)' : 'Follow-up (FUP2)';
  const overlap = useMemo(() => {
    const metaByGene = new Map(metaGenes.map((result) => [result.gene.toUpperCase(), result]));
    const referenceByGene = new Map(referenceGenes.map((result) => [result.gene.toUpperCase(), result]));
    const shared = [...metaByGene.keys()]
      .filter((gene) => referenceByGene.has(gene))
      .map((gene) => ({ meta: metaByGene.get(gene)!, reference: referenceByGene.get(gene)! }))
      .sort((left, right) => left.meta.gene.localeCompare(right.meta.gene));
    return {
      shared,
      metaOnly: metaGenes.length - shared.length,
      referenceOnly: referenceGenes.length - shared.length,
    };
  }, [metaGenes, referenceGenes]);

  const exportOverlap = () => {
    const rows = overlap.shared.map(({ meta, reference }) => [
      meta.gene,
      meta.pValue,
      meta.fdr,
      meta.deltaBeta,
      meta.direction,
      reference.pValue,
      reference.fdr,
      reference.deltaBeta,
      reference.direction,
      reference.nSigProbes,
      reference.totalProbes,
    ]);
    const csv = serializeCsv([[
      'Gene',
      `${timepoint}_Meta_P`,
      `${timepoint}_Meta_FDR`,
      `${timepoint}_Meta_DeltaBeta`,
      `${timepoint}_Meta_Direction`,
      `CPT_${timepoint}_${group}_vs_HC_Fisher_P`,
      `CPT_${timepoint}_${group}_vs_HC_BH_FDR`,
      `CPT_${timepoint}_${group}_vs_HC_DeltaBeta`,
      `CPT_${timepoint}_${group}_vs_HC_Direction`,
      'CPT_vs_HC_N_Sig_Probes_p05',
      'CPT_vs_HC_Total_Gene_Probes',
    ], ...rows]);
    const link = document.createElement('a');
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = `Treatment_DMR_overlap_${timepoint}_meta_vs_CPT_${group}-vs-HC.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-xs" aria-labelledby="treatment-dmr-overlap-title">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 id="treatment-dmr-overlap-title" className="text-sm font-bold text-slate-950">DMR-set overlap · {visit}</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
            Three-study meta-analysis DMRs compared with CPT {comparison} DMRs at the same visit. Circle areas are schematic, not proportional. Gene overlap does not establish direction agreement, replication, or treatment-related change.
          </p>
        </div>
        <button
          type="button"
          onClick={exportOverlap}
          disabled={overlap.shared.length === 0}
          className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" /> Export overlap CSV
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
        <div className="overflow-x-auto rounded-lg bg-slate-50">
          <svg viewBox="0 0 540 310" className="mx-auto block h-auto min-w-[500px] max-w-2xl" role="img" aria-labelledby="treatment-venn-svg-title treatment-venn-svg-desc">
            <title id="treatment-venn-svg-title">Overlap between three-study meta-analysis and CPT {comparison} DMR genes</title>
            <desc id="treatment-venn-svg-desc">{overlap.metaOnly} genes only in the meta-analysis set, {overlap.shared.length} in both sets, and {overlap.referenceOnly} only in the CPT healthy-control set.</desc>
            <circle cx="205" cy="158" r="126" fill="#475569" fillOpacity="0.24" stroke="#334155" strokeWidth="2" />
            <circle cx="335" cy="158" r="126" fill="#ea580c" fillOpacity="0.24" stroke="#c2410c" strokeWidth="2" />
            <text x="145" y="62" textAnchor="middle" fill="#1e293b" fontSize="13" fontWeight="700">Three-study meta-analysis</text>
            <text x="395" y="62" textAnchor="middle" fill="#9a3412" fontSize="13" fontWeight="700">CPT {comparison}</text>
            <text x="143" y="155" textAnchor="middle" fill="#0f172a" fontSize="30" fontWeight="800">{overlap.metaOnly}</text>
            <text x="143" y="176" textAnchor="middle" fill="#475569" fontSize="11" fontWeight="600">meta only</text>
            <text x="270" y="155" textAnchor="middle" fill="#0f172a" fontSize="32" fontWeight="900">{overlap.shared.length}</text>
            <text x="270" y="177" textAnchor="middle" fill="#334155" fontSize="11" fontWeight="700">both sets</text>
            <text x="397" y="155" textAnchor="middle" fill="#7c2d12" fontSize="30" fontWeight="800">{overlap.referenceOnly}</text>
            <text x="397" y="176" textAnchor="middle" fill="#9a3412" fontSize="11" fontWeight="600">CPT-vs-HC only</text>
            <text x="270" y="292" textAnchor="middle" fill="#64748b" fontSize="11">Exact gene-symbol set intersection · selected DMR registries</text>
          </svg>
        </div>

        <dl className="grid grid-cols-3 gap-2 lg:grid-cols-1">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Meta-analysis set</dt>
            <dd className="mt-1 text-xl font-extrabold text-slate-900">{metaGenes.length}</dd>
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-violet-700">Shared genes</dt>
            <dd className="mt-1 text-xl font-extrabold text-violet-950">{overlap.shared.length}</dd>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-orange-700">CPT-vs-HC set</dt>
            <dd className="mt-1 text-xl font-extrabold text-orange-950">{referenceGenes.length}</dd>
          </div>
        </dl>
      </div>

      <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">
          View shared genes ({overlap.shared.length})
        </summary>
        <div className="flex max-h-52 flex-wrap gap-1.5 overflow-y-auto border-t border-slate-200 p-3">
          {overlap.shared.map(({ meta }) => (
            <button
              type="button"
              key={meta.gene}
              onClick={() => onSelectGene(meta.gene)}
              className="rounded-md border border-violet-200 bg-white px-2 py-1 font-mono text-[11px] font-semibold text-violet-800 transition hover:border-violet-400 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
            >
              {meta.gene}
            </button>
          ))}
          {overlap.shared.length === 0 && <p className="text-xs text-slate-500">No genes overlap under the two active selection rules.</p>}
        </div>
      </details>
    </section>
  );
}
