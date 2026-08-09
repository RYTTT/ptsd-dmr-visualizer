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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-xs backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            aria-label="Return to research projects"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Projects</span>
          </Link>
          <div className="h-7 w-px shrink-0 bg-slate-200" aria-hidden="true" />
          <div className="shrink-0 rounded-xl bg-slate-900 p-2.5 text-white shadow-sm">
            <Dna className="h-5 w-5 text-cyan-400" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-base font-bold tracking-tight text-slate-950 sm:text-lg">
                PTSD Subtype DMR Atlas
              </h1>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                Pre-publication
              </span>
            </div>
            <p className="mt-0.5 hidden text-xs text-slate-600 sm:block">
              Common and subtype-specific differentially methylated regions across four cohorts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs lg:justify-end">
          <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 xl:flex">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
            <span className="font-medium">4 cohorts</span>
          </div>
          <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 sm:flex">
            <ShieldAlert className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
            <span className="font-medium">PTSD-focused analysis</span>
          </div>
          <button
            onClick={handleLogout}
            className="ml-auto flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-2 font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-700 lg:ml-0"
            type="button"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
};
