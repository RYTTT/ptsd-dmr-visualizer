import React from 'react';
import { Layers, Flame, Droplets, Brain, Zap, Target } from 'lucide-react';

interface MetricsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  crossCount: number;
  crossPtsdCount: number;
  sssCount: number;
  sssPtsdCount: number;
  adsCount: number;
  adsPtsdCount: number;
  icfCount: number;
  icfPtsdCount: number;
  issCount: number;
  issPtsdCount: number;
}

export const MetricsOverview: React.FC<MetricsProps> = ({
  activeTab,
  setActiveTab,
  crossCount,
  crossPtsdCount,
  sssCount,
  sssPtsdCount,
  adsCount,
  adsPtsdCount,
  icfCount,
  icfPtsdCount,
  issCount,
  issPtsdCount,
}) => {
  const cards = [
    {
      id: 'cross',
      title: 'Shared across 3–4 subtypes',
      count: crossCount,
      ptsdCount: crossPtsdCount,
      icon: Layers,
      badgeBg: 'bg-blue-100 text-blue-800',
      description: 'Gene FDR < 0.05 in ≥3 subtypes, plus cross-subtype FDR < 0.05',
    },
    {
      id: 'SSS',
      title: 'SSS-selected',
      count: sssCount,
      ptsdCount: sssPtsdCount,
      icon: Flame,
      badgeBg: 'bg-rose-100 text-rose-800',
      description: 'Only SSS passes the source FDR cutoff',
    },
    {
      id: 'ADS',
      title: 'ADS-selected',
      count: adsCount,
      ptsdCount: adsPtsdCount,
      icon: Droplets,
      badgeBg: 'bg-sky-100 text-sky-800',
      description: 'Only ADS passes the source FDR cutoff',
    },
    {
      id: 'ICF',
      title: 'ICF-selected',
      count: icfCount,
      ptsdCount: icfPtsdCount,
      icon: Brain,
      badgeBg: 'bg-purple-100 text-purple-800',
      description: 'Only ICF passes the source FDR cutoff',
    },
    {
      id: 'ISS',
      title: 'ISS-selected',
      count: issCount,
      ptsdCount: issPtsdCount,
      icon: Zap,
      badgeBg: 'bg-emerald-100 text-emerald-800',
      description: 'Only ISS passes the source FDR cutoff',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeTab === card.id;

        return (
          <button
            key={card.id}
            onClick={() => setActiveTab(card.id)}
            className={`text-left p-4 rounded-xl transition-all duration-200 relative overflow-hidden border ${
              isActive
                ? `bg-white border-slate-900 shadow-md ring-1 ring-slate-900/10`
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
            }`}
            aria-pressed={isActive}
            aria-label={`${card.title}: ${card.count} gene-level DMR summaries, including ${card.ptsdCount} genes on the curated PTSD-related list`}
          >
            {/* Top Indicator Bar */}
            {isActive && <div className="absolute top-0 left-0 right-0 h-1 bg-slate-900" />}

            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-lg ${card.badgeBg}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {card.count.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-medium">DMR genes</span>
            </div>

            <p className="mt-1 min-h-7 text-[10px] leading-snug text-slate-500">{card.description}</p>

            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Target className="w-3 h-3 text-amber-600" />
                PTSD-related list
              </span>
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                {card.ptsdCount} ({card.count > 0 ? ((card.ptsdCount / card.count) * 100).toFixed(1) : '0.0'}%)
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
