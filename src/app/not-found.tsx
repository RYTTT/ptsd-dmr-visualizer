import Link from 'next/link';
import { ArrowLeft, FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <FileQuestion className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Page not found</p>
        <h1 className="mt-2 text-xl font-bold text-slate-950">This analysis view is unavailable</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Check the address or return to the project list to choose an available atlas.
        </p>
        <Link href="/" className="mx-auto mt-6 flex min-h-11 w-fit items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to projects
        </Link>
      </div>
    </main>
  );
}
