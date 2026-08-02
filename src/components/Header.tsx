'use client';

import React from 'react';
import Link from 'next/link';
import { Dna, ShieldAlert, Sparkles, ArrowLeft, LogOut } from 'lucide-react';

export const Header: React.FC = () => {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mr-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Projects
          </Link>
          <div className="w-px h-6 bg-slate-200" />
          <div className="p-2.5 rounded-xl bg-slate-900 text-white shadow-sm">
            <Dna className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                PTSD Epigenetic DMR Portal
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                Nature Meta Standards
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Cross-Cohort Meta-Analysis of Common & Subtype-Unique Differentially Methylated Regions
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-medium">4 Cohorts (Vet, Cohen, FCC, SuperHealthy)</span>
          </div>
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span className="font-medium">PTSD Target Engine</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
