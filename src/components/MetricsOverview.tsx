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
      color: 'from-cyan-500 to-blue-600',
      borderColor: 'border-cyan-500/30',
      bgGlow: 'bg-cyan-500/10',
      description: 'Shared DMRs (sig in ≥3 subtypes)',
    },
    {
      id: 'SSS',
      title: 'SSS Unique',
      count: sssCount,
      ptsdCount: sssPtsdCount,
      icon: Flame,
      color: 'from-rose-500 to-amber-600',
      borderColor: 'border-rose-500/30',
      bgGlow: 'bg-rose-500/10',
      description: 'Severe Stress Subtype exclusive',
    },
    {
      id: 'ADS',
      title: 'ADS Unique',
      count: adsCount,
      ptsdCount: adsPtsdCount,
      icon: Droplets,
      color: 'from-blue-500 to-indigo-600',
      borderColor: 'border-blue-500/30',
      bgGlow: 'bg-blue-500/10',
      description: 'Affective/Depressive exclusive',
    },
    {
      id: 'ICF',
      title: 'ICF Unique',
      count: icfCount,
      ptsdCount: icfPtsdCount,
      icon: Brain,
      color: 'from-purple-500 to-violet-600',
      borderColor: 'border-purple-500/30',
      bgGlow: 'bg-purple-500/10',
      description: 'Cognitive Function exclusive',
    },
    {
      id: 'ISS',
      title: 'ISS Unique',
      count: issCount,
      ptsdCount: issPtsdCount,
      icon: Zap,
      color: 'from-emerald-500 to-teal-600',
      borderColor: 'border-emerald-500/30',
      bgGlow: 'bg-emerald-500/10',
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
                ? `${card.borderColor} bg-slate-800/90 shadow-lg shadow-black/40 ring-1 ring-white/10`
                : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800/50 hover:border-slate-700/60'
            }`}
          >
            {/* Background Gradient Bar on Active */}
            {isActive && (
              <div
                className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.color}`}
              />
            )}

            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">
                {card.title}
              </span>
              <div
                className={`p-1.5 rounded-lg ${card.bgGlow} text-white`}
              >
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-white tracking-tight">
                {card.count.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400">DMRs</span>
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/80 pt-2">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Target className="w-3 h-3 text-amber-400" />
                PTSD Genes
              </span>
              <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                {card.ptsdCount}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
