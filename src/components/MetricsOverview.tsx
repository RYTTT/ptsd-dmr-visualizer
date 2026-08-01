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
      title: 'Cross-Subtype Common',
      count: crossCount,
      ptsdCount: crossPtsdCount,
      icon: Layers,
      accentColor: 'border-blue-600 text-blue-700 bg-blue-50',
      badgeBg: 'bg-blue-100 text-blue-800',
      description: 'Shared DMRs (sig in ≥3 subtypes)',
    },
    {
      id: 'SSS',
      title: 'SSS Unique',
      count: sssCount,
      ptsdCount: sssPtsdCount,
      icon: Flame,
      accentColor: 'border-rose-600 text-rose-700 bg-rose-50',
      badgeBg: 'bg-rose-100 text-rose-800',
      description: 'Severe Stress Subtype exclusive',
    },
    {
      id: 'ADS',
      title: 'ADS Unique',
      count: adsCount,
      ptsdCount: adsPtsdCount,
      icon: Droplets,
      accentColor: 'border-sky-600 text-sky-700 bg-sky-50',
      badgeBg: 'bg-sky-100 text-sky-800',
      description: 'Affective/Depressive exclusive',
    },
    {
      id: 'ICF',
      title: 'ICF Unique',
      count: icfCount,
      ptsdCount: icfPtsdCount,
      icon: Brain,
      accentColor: 'border-purple-600 text-purple-700 bg-purple-50',
      badgeBg: 'bg-purple-100 text-purple-800',
      description: 'Cognitive Function exclusive',
    },
    {
      id: 'ISS',
      title: 'ISS Unique',
      count: issCount,
      ptsdCount: issPtsdCount,
      icon: Zap,
      accentColor: 'border-emerald-600 text-emerald-700 bg-emerald-50',
      badgeBg: 'bg-emerald-100 text-emerald-800',
      description: 'Intermediate Stress exclusive',
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
              <span className="text-xs text-slate-500 font-medium">DMRs</span>
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Target className="w-3 h-3 text-amber-600" />
                PTSD Genes
              </span>
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                {card.ptsdCount}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
