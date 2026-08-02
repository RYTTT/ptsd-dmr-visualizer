'use client';

import React, { useState } from 'react';
import { Loader2, Lock, Dna } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.href = '/';
      } else {
        const data = await res.json();
        setError(data.error || 'Authentication failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900 text-white mb-4 shadow-lg">
            <Dna className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Epigenomics Research Portal
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Differentially Methylated Region Visualizer
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Authorized Access Only
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider"
              >
                Access Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter research portal password"
                autoFocus
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-xs text-red-700 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-slate-900 text-white rounded-lg px-4 py-3 text-sm font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Access Portal'
              )}
            </button>
          </form>

          <p className="text-[11px] text-slate-400 text-center mt-5 leading-relaxed">
            This portal contains unpublished research data.<br />
            Contact the PI for access credentials.
          </p>
        </div>
      </div>
    </div>
  );
}
