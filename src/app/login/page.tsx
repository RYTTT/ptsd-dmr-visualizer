'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, LockKeyhole, Dna, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (res.ok) {
        window.location.href = '/';
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'The username or password was not accepted.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="main-content" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(5,150,105,0.14),_transparent_36%)]" aria-hidden="true" />
      <div className="relative w-full max-w-md">
        {/* Logo / Branding */}
        <div className="mb-7 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-600 text-white shadow-2xl shadow-blue-950">
            <Dna className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            FTC Epigenomics Research Portal
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Secure access to pre-publication PTSD and trauma treatment methylation results
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Sign in to continue
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">Use the credentials provided by the research team.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                spellCheck={false}
                autoFocus
                required
                disabled={loading}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:cursor-wait disabled:opacity-70 sm:text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 py-3 pl-4 pr-12 text-base text-slate-900 transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:cursor-wait disabled:opacity-70 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <div id="login-error" role="alert" aria-live="polite" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              aria-busy={loading}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="mt-6 flex items-start gap-2 border-t border-slate-100 pt-5 text-xs leading-relaxed text-slate-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <p>This system contains restricted, unpublished research data. Contact the principal investigator if you need access.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
