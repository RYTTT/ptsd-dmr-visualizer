'use client';

import React from 'react';
import Link from 'next/link';
import { Dna, FlaskConical, ArrowRight, LogOut, Shield, TrendingDown, Users, Database, Microscope } from 'lucide-react';

const PORTAL_STATS = [
  { value: '4,569', label: 'PTSD DMR result rows', icon: Database },
  { value: '168K+', label: 'Gene–probe assignments', icon: Microscope },
  { value: '4', label: 'PTSD subtypes', icon: Users },
  { value: '2', label: 'Analysis atlases', icon: Dna },
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
    subtitle: 'Four-subtype comparison',
    description:
      'Explore genes with adjusted evidence shared across at least 3 of 4 PTSD subtypes, or adjusted evidence confined to one subtype. Each subtype analysis first combines probe evidence across three cohorts.',
    keyFinding: 'Shared means supported after adjustment in at least 3 subtypes; it does not mean identical effect direction or magnitude.',
    stats: [
      { label: 'Shared across ≥3 subtypes', value: '1,119' },
      { label: 'Selected by one subtype', value: '3,450' },
      { label: 'Subtypes', value: '4' },
      { label: 'Result rows', value: '4,569' },
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
    subtitle: 'MDMA, ketamine, and CPT response analysis',
    description:
      'Compare CD4+ T-cell methylation results for responders and non-responders across three trauma treatment cohorts. Review inverse-probability-weighted analyses at baseline and follow-up.',
    keyFinding: 'Treatment and visit estimates can differ; inspect each study before interpreting apparent temporal change.',
    stats: [
      { label: 'Combined-result genes', value: '1,839' },
      { label: 'Modalities', value: '3' },
      { label: 'Assessments', value: '2' },
      { label: 'Cell type', value: 'CD4+' },
    ],
  },
];

export default function ProjectSelector() {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-white">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 shadow-md shadow-blue-950">
              <Dna className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-tight text-white sm:text-base">FTC Epigenomics Research Portal</div>
              <div className="text-[11px] font-semibold text-amber-300">Restricted · Pre-publication</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            type="button"
            aria-label="Sign out"
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-red-900 hover:bg-red-950/40 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16">

        {/* Hero */}
        <div className="mb-12 text-center sm:mb-14">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-700/60 bg-blue-900/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-200">
            <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
            DMR discovery and treatment response
          </div>
          <h1 className="mb-4 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            Explore multi-cohort<br className="hidden sm:block" />{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              epigenomic results
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-300">
            Review differentially methylated regions, gene-level evidence, and probe-level context across PTSD subtype and trauma treatment analyses.
          </p>
        </div>

        {/* Portal Stats Ticker */}
        <dl aria-label="Portal data summary" className="mb-12 grid grid-cols-2 gap-3 sm:mb-14 sm:grid-cols-4">
          {PORTAL_STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
                <Icon className="mx-auto mb-2 h-5 w-5 text-blue-400" aria-hidden="true" />
                <dt className="text-xs font-medium text-slate-400">{stat.label}</dt>
                <dd className="mt-0.5 text-2xl font-extrabold tracking-tight text-white">{stat.value}</dd>
              </div>
            );
          })}
        </dl>

        <div className="mb-5">
          <h2 className="text-lg font-bold text-white">Choose an analysis</h2>
          <p className="mt-1 text-sm text-slate-400">Each atlas has independent filters, figures, tables, and downloadable results.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {projects.map((project) => {
            const Icon = project.icon;
            return (
              <Link
                key={project.id}
                href={project.href}
                aria-describedby={`${project.id}-description ${project.id}-finding`}
                className={`group block bg-gradient-to-br ${project.accentColor} border ${project.borderColor} ${project.hoverBorder} rounded-2xl p-5 shadow-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl sm:p-7`}
              >
                {/* Icon + Title */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-11 h-11 rounded-xl ${project.iconBg} ${project.iconColor} flex items-center justify-center shadow-sm`}>
                      <Icon className="h-5.5 w-5.5" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white group-hover:text-white transition leading-tight">
                        {project.title}
                      </h2>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5">{project.subtitle}</p>
                    </div>
                  </div>
                  <ArrowRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-white" aria-hidden="true" />
                </div>

                {/* Description */}
                <p id={`${project.id}-description`} className="mb-4 text-sm leading-relaxed text-slate-300">
                  {project.description}
                </p>

                {/* Key Finding Callout */}
                <div id={`${project.id}-finding`} className={`text-xs font-semibold px-3 py-2 rounded-lg border ${project.badgeBg} mb-5 flex items-start gap-2`}>
                  <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{project.keyFinding}</span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {project.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="bg-black/20 rounded-lg px-2 py-2.5 text-center border border-white/5"
                    >
                      <div className="text-sm font-bold text-white font-mono">{stat.value}</div>
                      <div className="mt-0.5 text-[11px] font-medium leading-tight text-slate-400">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-1.5 text-sm font-bold text-white">
                  Open atlas <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer Note */}
        <p className="mt-10 border-t border-slate-800 pt-8 text-center text-xs leading-relaxed text-slate-400">
          Restricted pre-publication research data. Do not distribute without principal investigator authorization.<br className="hidden sm:block" />
          Methylation-array results · genome build and manifest versions pending source confirmation
        </p>
      </main>
    </div>
  );
}
