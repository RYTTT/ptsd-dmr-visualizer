import { Dna, LoaderCircle } from 'lucide-react';

export default function Loading() {
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-slate-50 px-4" aria-busy="true">
      <div className="flex max-w-sm flex-col items-center text-center" role="status">
        <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
          <Dna className="h-7 w-7" aria-hidden="true" />
          <LoaderCircle className="absolute -inset-2 h-[4.5rem] w-[4.5rem] animate-spin text-blue-600" aria-hidden="true" />
        </div>
        <p className="text-sm font-bold text-slate-900">Loading research portal</p>
        <p className="mt-1 text-xs text-slate-500">Preparing the requested analysis…</p>
      </div>
    </main>
  );
}
