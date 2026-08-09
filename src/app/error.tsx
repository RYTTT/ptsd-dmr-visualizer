'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-700">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-slate-950">This view could not be loaded</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          The portal encountered an unexpected error. Your source data has not been changed.
        </p>
        {error.digest && <p className="mt-3 font-mono text-xs text-slate-400">Reference: {error.digest}</p>}
        <button type="button" onClick={reset} className="mx-auto mt-6 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    </main>
  );
}
