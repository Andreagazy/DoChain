'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import {
  Loader2, AlertCircle, Eye, EyeOff, ShieldCheck, Mail, Lock,
} from 'lucide-react';
import { getDefaultHomePath, getProfile, getToken, login, logout, saveAuthData } from '@/lib/auth-service';
import { normalizeErrorMessage } from '@/lib/certification-flow';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function redirectIfLoggedIn() {
      const token = getToken();
      if (!token) {
        setCheckingSession(false);
        return;
      }

      try {
        const profile = await getProfile();
        if (cancelled) return;

        saveAuthData(token, profile);
        router.replace(getDefaultHomePath(profile));
      } catch {
        if (!cancelled) {
          logout();
          setCheckingSession(false);
        }
      }
    }

    void redirectIfLoggedIn();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError('Email dan password tidak boleh kosong');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Format email tidak valid');
      return;
    }

    setLoading(true);
    try {
      const response = await login({ email: normalizedEmail, password });
      saveAuthData(response.access_token, response.user);
      router.push(getDefaultHomePath(response.user));
    } catch (err: unknown) {
      setError(normalizeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-blue-50 px-4 py-12"
        style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 50%, #e0e7ff 100%)' }}
      >
        <div className="flex items-center gap-2 rounded-2xl border border-blue-100 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          Memeriksa sesi login...
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-blue-50 px-4 py-12"
      style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 50%, #e0e7ff 100%)' }}
    >
      {/* Blob decorations */}
      <div className="pointer-events-none fixed -top-24 -left-24 h-72 w-72 rounded-full bg-blue-300/40 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-24 -right-24 h-72 w-72 rounded-full bg-blue-400/30 blur-3xl" />

      {/* Card container */}
      <div className="relative z-10 w-full max-w-[800px] overflow-hidden rounded-3xl bg-white shadow-2xl shadow-blue-200/60 flex min-h-[480px]">

        {/* ── Left: Info Panel ── */}
        <div className="hidden lg:flex lg:w-[45%] flex-col justify-between bg-blue-600 p-10 text-white">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
              <img src="/image/docchain-logo.png" alt="DOCChain" className="h-6.5 w-6.5 object-contain" />
            </div>
            <span className="text-sm font-bold">DOCChain</span>
          </div>

          {/* Headline */}
          <div>
            <h1 className="text-2xl font-extrabold leading-snug">
              Sertifikasi dokumen resmi berbasis blockchain.
            </h1>
            <p className="mt-3 text-sm text-blue-100 leading-relaxed">
              Platform terpercaya untuk menandatangani dan memverifikasi dokumen akademik menggunakan Hyperledger Besu & IPFS.
            </p>
          </div>

          {/* Footer */}
          <p className="text-xs text-blue-300">© 2026 DOCChain</p>
        </div>

        {/* ── Right: Form Panel ── */}
        <div className="flex flex-1 flex-col items-center justify-center px-8 py-10">

          {/* Logo (mobile + desktop) */}
          <div className="mb-5 flex h-14 w-14 items-center justify-center">
            <img src="/image/docchain-logo.png" alt="DOCChain" className="h-14 w-14 object-contain" />
          </div>

          <h2 className="mb-6 text-xl font-bold text-gray-900">Selamat Datang!</h2>

          {/* Form */}
          <form onSubmit={handleSubmit} className="w-full space-y-3">
            {/* Error */}
            {error && (
              <div className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <p className="text-sm font-semibold leading-5 text-red-700">{error}</p>
              </div>
            )}

            {/* Email */}
            <div className="relative">
              <Input
                id="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="h-12 rounded-xl border-gray-200 bg-gray-50 pl-4 pr-10 text-sm focus:border-blue-500 focus:bg-white focus:ring-0"
              />
              <Mail className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>

            {/* Password */}
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="h-12 rounded-xl border-gray-200 bg-gray-50 pl-4 pr-10 text-sm focus:border-blue-500 focus:bg-white focus:ring-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="h-3.5 w-3.5 rounded border-gray-300 accent-blue-600" />
                <span className="text-xs text-gray-500">Ingat saya</span>
              </label>
              <span className="text-xs font-medium text-blue-600 cursor-pointer hover:text-blue-700">
                Lupa password?
              </span>
            </div>

            {/* Login button */}
            <button
              type="submit"
              id="login-btn"
              disabled={loading || !email || !password}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memverifikasi...</>
              ) : (
                <><Lock className="mr-2 h-4 w-4" /> Masuk ke DOCChain</>
              )}
            </button>

            <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div>
                <p className="text-xs font-semibold text-slate-800">Belum memiliki akun?</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Pembuatan akun dilakukan oleh admin prodi atau superadmin. Silakan hubungi admin sesuai program studi Anda.
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
