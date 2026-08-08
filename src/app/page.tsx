'use client';

import React from 'react';
import Link from 'next/link';
import { Dna, FlaskConical, ArrowRight, LogOut, Shield, TrendingDown, Users, Database, Microscope } from 'lucide-react';

const PORTAL_STATS = [
  { value: '4,569', label: 'DMR Gene Loci', icon: Database },
  { value: '168K+', label: 'CpG Sites Analyzed', icon: Microscope },
  { value: '4', label: 'Independent Cohorts', icon: Users },
  { value: '850K', label: 'EPIC Array Probes', icon: Dna },
];

const projects = [
  {
    id: 'ptsd',
    href: '/ptsd',
    icon: Shield,
    iconBg: 'bg-blue-900',
    iconColor: 'text-blue-300',
    accentColor: 'from-blue-950 to-slate-900',
    borderColor: 'border-blue-800/60',
    hoverBorder: 'hover:border-blue-600',
    badgeBg: 'bg-blue-800/60 text-blue-300 border-blue-700/40',
    title: 'PTSD Subtype DMR Atlas',
    subtitle: 'FTC Methylation — 4-Cohort Meta-Analysis',
    description:
      'The largest cross-cohort epigenetic atlas of PTSD subtypes. Identifies 1,119 common and 3,450 subtype-exclusive differentially methylated regions across SSS, ADS, ICF, and ISS phenotypes using Fisher meta-analysis across Vet, Cohen, FCC, and SuperHealthy cohorts.',
    keyFinding: 'AHRR, FKBP5, NR3C1 show consistent hypomethylation across all 4 subtypes',
    stats: [
      { label: 'Common DMRs', value: '1,119' },
      { label: 'SSS Unique', value: '1,478' },
      { label: 'ADS Unique', value: '604' },
      { label: 'Total Genes', value: '4,569' },
    ],
  },
  {
    id: 'mdma',
    href: '/mdma',
    icon: FlaskConical,
    iconBg: 'bg-emerald-900',
    iconColor: 'text-emerald-300',
    accentColor: 'from-emerald-950 to-slate-900',
    borderColor: 'border-emerald-800/60',
    hoverBorder: 'hover:border-emerald-600',
    badgeBg: 'bg-emerald-800/60 text-emerald-300 border-emerald-700/40',
    title: 'Treatment Response DMR Atlas',
    subtitle: 'MDMA / Ketamine / CPT — IPW DMP Analysis',
    description:
      'First-of-kind comparative epigenetic atlas of trauma therapy responders vs. non-responders in CD4+ T cells. IPW-adjusted differential methylation across three distinct treatment modalities reveals convergent remethylation signatures — including reversal of PTSD-associated loci.',
    keyFinding: '867 genes overlap with PTSD Atlas — AHRR remethylated post-MDMA therapy',
    stats: [
      { label: 'Meta DMRs', value: '1,839' },
      { label: 'MDMA', value: '456' },
      { label: 'Ketamine', value: '134' },
      { label: 'CPT', value: '250' },
    ],
  },
];

export default function ProjectSelector() {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      {/* Minimal Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-900">
              <Dna className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold text-white tracking-tight">FTC Epigenomics Research Portal</span>
              <span className="ml-2.5 text-[10px] font-bold text-blue-400 border border-blue-700/50 bg-blue-900/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Pre-Publication</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-950/40 border border-slate-700 rounded-lg transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-16 pb-20">

        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-900/40 border border-blue-700/50 text-blue-300 text-xs font-bold uppercase tracking-wider mb-5">
            <TrendingDown className="w-3.5 h-3.5" />
            4-Cohort Meta-Analysis · PTSD & Trauma Therapy
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
            The Largest Multi-Cohort<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              PTSD Epigenetic Atlas
            </span>
          </h1>
          <p className="text-slate-400 text-base max-w-2xl mx-auto leading-relaxed">
            Probe-level differentially methylated region discovery across PTSD subtypes and trauma therapy cohorts.
            850K EPIC array · CD4+ T cells · IPW-adjusted · Fisher meta-analysis.
          </p>
        </div>

        {/* Portal Stats Ticker */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-14">
          {PORTAL_STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <Icon className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                <div className="text-2xl font-extrabold text-white tracking-tight">{stat.value}</div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Project Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {projects.map((project) => {
            const Icon = project.icon;
            return (
              <Link
                key={project.id}
                href={project.href}
                className={`group block bg-gradient-to-br ${project.accentColor} border ${project.borderColor} ${project.hoverBorder} rounded-2xl p-7 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5`}
              >
                {/* Icon + Title */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-11 h-11 rounded-xl ${project.iconBg} ${project.iconColor} flex items-center justify-center shadow-sm`}>
                      <Icon className="w-5.5 h-5.5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white group-hover:text-white transition leading-tight">
                        {project.title}
                      </h2>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5">{project.subtitle}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all mt-0.5" />
                </div>

                {/* Description */}
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  {project.description}
                </p>

                {/* Key Finding Callout */}
                <div className={`text-[11px] font-semibold px-3 py-2 rounded-lg border ${project.badgeBg} mb-5 flex items-start gap-1.5`}>
                  <span className="mt-0.5">🔬</span>
                  <span>{project.keyFinding}</span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2">
                  {project.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="bg-black/20 rounded-lg px-2 py-2.5 text-center border border-white/5"
                    >
                      <div className="text-sm font-bold text-white font-mono">{stat.value}</div>
                      <div className="text-[9px] text-slate-500 font-medium mt-0.5 leading-tight">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer Note */}
        <p className="text-center text-[11px] text-slate-600 mt-10 border-t border-slate-900 pt-8">
          All data is pre-publication. Do not share without PI authorization. · EPIC 850K Array · hg38 Reference Genome
        </p>
      </main>
    </div>
  );
}
