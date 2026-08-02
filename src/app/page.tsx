'use client';

import React from 'react';
import Link from 'next/link';
import { Dna, FlaskConical, ArrowRight, LogOut, Shield } from 'lucide-react';

const projects = [
  {
    id: 'ptsd',
    href: '/ptsd',
    icon: Shield,
    title: 'PTSD Subtype DMR Atlas',
    subtitle: 'FTC Methylation — 4-Cohort Meta-Analysis',
    description:
      'Cross-subtype (Common) and subtype-unique differentially methylated regions across SSS, ADS, ICF, and ISS PTSD subtypes. 4,569 DMR genes with probe-level genomic tracks.',
    stats: [
      { label: 'Common DMRs', value: '1,119' },
      { label: 'SSS Unique', value: '1,478' },
      { label: 'ADS Unique', value: '604' },
      { label: 'Total Genes', value: '4,569' },
    ],
    color: 'bg-blue-600',
    borderColor: 'border-blue-200',
    hoverColor: 'hover:border-blue-400',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    id: 'mdma',
    href: '/mdma',
    icon: FlaskConical,
    title: 'Treatment Response DMR Atlas',
    subtitle: 'MDMA / Ketamine / CPT — IPW DMP Analysis',
    description:
      'Differentially methylated regions from three treatment cohorts (MDMA-AT, Ketamine, CPT) comparing responders vs. non-responders in CD4+ T cells with inverse probability weighting.',
    stats: [
      { label: 'Meta DMRs', value: '1,839' },
      { label: 'MDMA', value: '456' },
      { label: 'Ketamine', value: '134' },
      { label: 'CPT', value: '250' },
    ],
    color: 'bg-emerald-600',
    borderColor: 'border-emerald-200',
    hoverColor: 'hover:border-emerald-400',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
];

export default function ProjectSelector() {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-slate-900 selection:text-white">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
              <Dna className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Epigenomics Research Portal
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                DMR Visualization & Analysis Platform
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-lg transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Select a Research Project
          </h2>
          <p className="text-sm text-slate-500 mt-2 max-w-xl mx-auto">
            Choose a project below to explore differentially methylated regions, gene-level annotations, and interactive genomic visualizations.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={project.href}
              className={`group block bg-white border ${project.borderColor} ${project.hoverColor} rounded-2xl p-6 shadow-xs hover:shadow-md transition-all duration-200`}
            >
              {/* Icon + Title */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl ${project.iconBg} ${project.iconColor} flex items-center justify-center`}
                  >
                    <project.icon className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-slate-700 transition">
                      {project.title}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                      {project.subtitle}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
              </div>

              {/* Description */}
              <p className="text-xs text-slate-600 leading-relaxed mb-5">
                {project.description}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2">
                {project.stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-slate-50 rounded-lg px-2.5 py-2 text-center"
                  >
                    <div className="text-sm font-bold text-slate-900 font-mono">
                      {stat.value}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-10">
          All data is pre-publication. Do not share without PI authorization.
        </p>
      </main>
    </div>
  );
}
