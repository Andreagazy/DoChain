'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldCheck, UserRoundCog } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-blue-50 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-blue-100 bg-white p-7 shadow-lg shadow-blue-100/60 sm:p-9">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
          <img
            src="/image/docchain-logo.png"
            alt="DOCChain"
            className="h-11 w-11 object-contain"
          />
          <div>
            <p className="text-lg font-bold text-slate-950">DOCChain</p>
            <p className="text-xs font-medium text-slate-500">
              Sistem Sertifikasi Dokumen Digital
            </p>
          </div>
        </div>

        <div className="py-7 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <UserRoundCog className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-950">
            Pembuatan Akun Melalui Admin
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
            Pendaftaran mandiri sudah tidak tersedia. Akun mahasiswa, dosen,
            dosen, dan pejabat struktural dibuat oleh admin prodi atau
            superadmin.
          </p>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Hubungi admin program studi
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Siapkan data akademik seperti nama lengkap, email aktif, NIM
                atau NIP/NIDN, serta program studi agar akun dapat dibuat dengan
                data yang benar.
              </p>
            </div>
          </div>
        </div>

        <Button asChild className="mt-6 h-11 w-full rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700">
          <Link href="/login">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Login
          </Link>
        </Button>
      </section>
    </main>
  );
}
