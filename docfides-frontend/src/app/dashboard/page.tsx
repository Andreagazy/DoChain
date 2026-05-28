'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AxiosError } from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/empty-state';
import { StatCard } from '@/components/common/stat-card';
import { AppShell } from '@/components/layout/app-shell';
import { AlertCircle, ArrowRight, FileCheck2, FileText, Loader2, Mail, ShieldCheck, User as UserIcon } from 'lucide-react';
import api from '@/lib/axios';
import { getIdentityStatus, listMyCertificationDocuments, logout } from '@/lib/auth-service';
import { IdentityStatus, User } from '@/types/auth';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [identityStatus, setIdentityStatus] = useState<IdentityStatus>('NOT_SUBMITTED');
  const [docTotal, setDocTotal] = useState(0);
  const [pendingDocs, setPendingDocs] = useState(0);
  const [signedDocs, setSignedDocs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canReviewIdentity = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN_PRODI';

  useEffect(() => {
    async function loadProfile() {
      try {
        const [res, statusRes] = await Promise.all([
          api.get('/auth/me'),
          getIdentityStatus(),
        ]);

        const profile = res.data as User;
        if (profile.role === 'SUPERADMIN') {
          router.replace('/admin');
          return;
        }
        if (profile.role === 'ADMIN_PRODI') {
          router.replace('/admin-prodi');
          return;
        }

        setUser(profile);
        setIdentityStatus(statusRes.status);


        if (statusRes.status === 'APPROVED') {
          const docsRes = await listMyCertificationDocuments();

          setDocTotal(docsRes.documents.length);
          setPendingDocs(
            docsRes.documents.filter((doc) => {
              const status = doc.status.toLowerCase();
              return status.includes('pending') || status.includes('partially');
            }).length,
          );
          setSignedDocs(
            docsRes.documents.filter((doc) => {
              const status = doc.status.toLowerCase();
              return status.includes('signed') || status.includes('approved');
            }).length,
          );
        } else {
          setDocTotal(0);
          setPendingDocs(0);
          setSignedDocs(0);
        }
      } catch (err) {
        const axiosError = err as AxiosError;
        if (axiosError.response?.status === 401) {
          setError('Sesi login berakhir. Silakan login kembali.');
          logout();
          setTimeout(() => {
            router.push('/login');
          }, 1500);
          return;
        }

        setError('Gagal memuat data dashboard. Silakan coba lagi.');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="animate-spin" />
          <span>Memuat profil...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md border-red-200 bg-white">
          <CardContent className="pt-6">
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AppShell title="Dashboard" subtitle="Ringkasan status akun dan dokumen sertifikasi Anda.">
      <div className="space-y-8">
        
        {/* Formal welcome banner */}
        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <Badge className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 hover:bg-white">
                DoChain Workspace
              </Badge>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-800 md:text-3xl">
                Mulai dan Pantau Sertifikasi Dokumen Anda
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
                Lanjutkan dokumen yang sedang berjalan atau unggah berkas PDF baru untuk mulai disertifikasi menggunakan teknologi tanda tangan digital berbasis blockchain terenkripsi.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3.5 shrink-0">
              <Button asChild className="h-11 rounded-lg bg-blue-600 font-semibold text-white shadow-sm hover:bg-blue-700">
                <Link href="/certification/upload" className="flex items-center gap-2">
                  Mulai Sertifikasi
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" className="h-11 rounded-lg border-blue-200 bg-white font-semibold text-blue-700 hover:bg-blue-50" asChild>
                <Link href="/documents">Buka Dokumen</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Statistics Cards Row */}
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Dokumen"
            value={docTotal}
            description="Semua dokumen terdaftar"
            icon={<FileText className="h-5 w-5" />}
            tone="blue"
          />
          <StatCard
            label="Menunggu Tanda Tangan"
            value={pendingDocs}
            description="Belum selesai ditandatangani"
            icon={<FileCheck2 className="h-5 w-5" />}
            tone="amber"
          />
          <StatCard
            label="Selesai"
            value={signedDocs}
            description="Fully signed & certified"
            icon={<ShieldCheck className="h-5 w-5" />}
            tone="emerald"
          />
          <StatCard
            label="Status Identitas"
            value={identityStatus === 'APPROVED' ? 'TERVERIFIKASI' : identityStatus}
            description="Syarat utama sertifikasi"
            icon={<UserIcon className="h-5 w-5" />}
            tone="slate"
          />
        </section>

        {/* Actions Grid and Profile Summary */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
          
          {/* Main Quick Action Card */}
          <Card className="rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-xs p-2 shadow-sm card-hover-effect">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold text-slate-800">Aksi Utama</CardTitle>
              <CardDescription className="text-xs text-slate-500 font-medium">Pilih langkah cepat yang paling sering Anda butuhkan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3.5">
                <Link href="/certification/upload" className="block">
                  <Button className="w-full h-11 justify-start rounded-xl bg-slate-50 text-indigo-600 border border-slate-200/60 hover:bg-indigo-50/60 hover:text-indigo-700 hover:border-indigo-100 transition-all font-semibold text-sm">
                    <FileText className="h-4.5 w-4.5 mr-2 shrink-0" />
                    Upload dan sertifikasi dokumen baru
                  </Button>
                </Link>
                <Link href="/documents" className="block">
                  <Button variant="outline" className="w-full h-11 justify-start rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all font-semibold text-sm">
                    <FileText className="h-4.5 w-4.5 mr-2 shrink-0" />
                    Lihat semua dokumen saya
                  </Button>
                </Link>
                <Link href={identityStatus === 'APPROVED' ? '/signature-setup?next=/certification' : '/identity'} className="block">
                  <Button variant="outline" className="w-full h-11 justify-start rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all font-semibold text-sm">
                    <FileCheck2 className="h-4.5 w-4.5 mr-2 shrink-0" />
                    {identityStatus === 'APPROVED' ? 'Atur tanda tangan digital' : 'Lengkapi berkas identitas profil'}
                  </Button>
                </Link>
                {canReviewIdentity ? (
                  <Link href="/verifier" className="block">
                    <Button variant="outline" className="w-full h-11 justify-start rounded-xl border-slate-200 bg-white hover:bg-indigo-50/40 hover:text-indigo-600 hover:border-indigo-100 transition-all font-semibold text-sm">
                      <ShieldCheck className="h-4.5 w-4.5 mr-2 shrink-0" />
                      Review dan verifikasi identitas member
                    </Button>
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* Premium Account Details Card */}
          <Card className="rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-xs p-2 shadow-sm card-hover-effect">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold text-slate-800">Akun Pengguna</CardTitle>
              <CardDescription className="text-xs text-slate-500 font-medium">Detail profil aktif Anda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3.5 rounded-xl bg-slate-50/50 border border-slate-100 p-3">
                <Mail className="mt-0.5 h-4.5 w-4.5 text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alamat Email</p>
                  <p className="font-semibold text-slate-800 break-all">{user?.email}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3.5 rounded-xl bg-slate-50/50 border border-slate-100 p-3">
                <UserIcon className="mt-0.5 h-4.5 w-4.5 text-violet-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Peran Pengguna</p>
                  <p className="font-semibold text-slate-800 capitalize">{user?.role}</p>
                </div>
              </div>
              
              {user?.academicProfile ? (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Profil Akademik Kampus</p>
                  <p className="font-bold text-slate-800 text-sm mt-1">
                    {user.academicProfile.positionTitle ?? user.academicProfile.type}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 font-medium">
                    {user.academicProfile.identifier ? `${user.academicProfile.identifier} | ` : ''}
                    {user.academicProfile.unitName}
                  </p>
                  {user.academicProfile.kelas || user.academicProfile.angkatan ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Kelas: {user.academicProfile.kelas ?? '-'} | Angkatan: {user.academicProfile.angkatan ?? '-'}
                    </p>
                  ) : null}
                </div>
              ) : null}
              
              <div className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-white p-3.5 shadow-2xs">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Profil</span>
                <Badge className={identityStatus === 'APPROVED' 
                  ? 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border border-emerald-500/20 font-bold px-2.5 py-0.5 rounded-full text-xs' 
                  : 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border border-amber-500/20 font-bold px-2.5 py-0.5 rounded-full text-xs'
                }>
                  {identityStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        {docTotal === 0 ? (
          <EmptyState
            title="Belum ada dokumen"
            description="Upload PDF pertama Anda untuk memulai proses sertifikasi blockchain."
            action={
              <Link href="/documents/upload">
                <Button className="rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold shadow-md shadow-indigo-600/10">Upload dokumen pertama</Button>
              </Link>
            }
          />
        ) : null}
      </div>
    </AppShell>
  );
}
