'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AxiosError } from 'axios';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  FolderOpen,
  Loader2,
  PenSquare,
  ShieldCheck,
  UploadCloud,
  User as UserIcon,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppShell } from '@/components/layout/app-shell';
import { StatCard } from '@/components/common/stat-card';
import api from '@/lib/axios';
import {
  getIdentityStatus,
  listAssignedCertificationDocuments,
  listMyCertificationDocuments,
  logout,
} from '@/lib/auth-service';
import { AssignedDocumentItem, IdentityStatus, OwnedDocumentItem, User } from '@/types/auth';

const identityStatusLabels: Record<IdentityStatus, string> = {
  NOT_SUBMITTED: 'Belum Mengajukan',
  PENDING: 'Menunggu Verifikasi',
  APPROVED: 'Terverifikasi',
  REJECTED: 'Ditolak',
};

const documentStatusLabels: Record<string, string> = {
  UPLOADED: 'Baru Diupload',
  DRAFT: 'Draft',
  PENDING_SIGNATURE: 'Menunggu Tanda Tangan',
  PENDING_SIGNATURES: 'Menunggu Tanda Tangan',
  PARTIALLY_SIGNED: 'Sebagian Ditandatangani',
  FULLY_SIGNED: 'Final',
  REJECTED: 'Ditolak',
  REVOKED: 'Dicabut',
};

const signerStatusLabels: Record<string, string> = {
  PENDING: 'Menunggu Tanda Tangan',
  SIGNED: 'Sudah Ditandatangani',
  REJECTED: 'Ditolak',
};

const getIdentityStatusLabel = (status: IdentityStatus) =>
  identityStatusLabels[status] ?? 'Belum Diketahui';

const getDocumentStatusLabel = (status: string) =>
  documentStatusLabels[status] ?? status.replaceAll('_', ' ');

const getSignerStatusLabel = (status: string) =>
  signerStatusLabels[status] ?? status.replaceAll('_', ' ');

const getIdentityStatusBadgeClass = (status: IdentityStatus) => {
  if (status === 'APPROVED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'REJECTED') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (status === 'PENDING') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const getDocumentStatusBadgeClass = (status: string) => {
  if (status === 'FULLY_SIGNED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'REJECTED' || status === 'REVOKED') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'PENDING_SIGNATURE' || status === 'PARTIALLY_SIGNED') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-blue-200 bg-blue-50 text-blue-700';
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [identityStatus, setIdentityStatus] = useState<IdentityStatus>('NOT_SUBMITTED');
  const [ownedDocuments, setOwnedDocuments] = useState<OwnedDocumentItem[]>([]);
  const [assignedDocuments, setAssignedDocuments] = useState<AssignedDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [profileRes, statusRes] = await Promise.all([
          api.get<User>('/auth/me'),
          getIdentityStatus(),
        ]);

        const profile = profileRes.data;
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
          const [ownedRes, assignedRes] = await Promise.all([
            listMyCertificationDocuments(),
            listAssignedCertificationDocuments(),
          ]);
          setOwnedDocuments(ownedRes.documents);
          setAssignedDocuments(assignedRes.assignments);
        } else {
          setOwnedDocuments([]);
          setAssignedDocuments([]);
        }
      } catch (err) {
        const axiosError = err as AxiosError;
        if (axiosError.response?.status === 401) {
          setError('Sesi login berakhir. Silakan login kembali.');
          logout();
          setTimeout(() => router.push('/login'), 1500);
          return;
        }

        setError('Gagal memuat data dashboard. Silakan coba lagi.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  const userName = user?.identity?.fullName ?? user?.displayName ?? user?.email ?? 'Pengguna';
  const roleLabel = user?.role ? user.role.replaceAll('_', ' ') : '-';

  const pendingOwnedDocuments = ownedDocuments.filter((doc) =>
    ['PENDING_SIGNATURE', 'PARTIALLY_SIGNED'].includes(doc.status),
  );
  const finalDocuments = ownedDocuments.filter((doc) => doc.status === 'FULLY_SIGNED');
  const rejectedDocuments = ownedDocuments.filter((doc) =>
    ['REJECTED', 'REVOKED'].includes(doc.status),
  );
  const pendingAssignments = assignedDocuments.filter(
    (item) =>
      item.signerStatus === 'PENDING' &&
      !['REJECTED', 'REVOKED'].includes(item.document.status),
  );

  const recentDocuments = useMemo(
    () =>
      [...ownedDocuments]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5),
    [ownedDocuments],
  );

  const priorityTasks = [
    identityStatus !== 'APPROVED'
      ? {
          title: 'Lengkapi verifikasi identitas KTP',
          description: 'Sertifikasi dokumen baru dapat dilakukan setelah identitas disetujui.',
          href: '/profile#identitas-ktp',
          label: 'Buka Profil',
          tone: 'amber',
        }
      : null,
    pendingAssignments.length > 0
      ? {
          title: `${pendingAssignments.length} dokumen menunggu tanda tangan Anda`,
          description: 'Periksa dokumen, lalu tanda tangani jika data sudah benar.',
          href: '/certification/assigned',
          label: 'Lihat Tugas',
          tone: 'blue',
        }
      : null,
    rejectedDocuments.length > 0
      ? {
          title: `${rejectedDocuments.length} dokumen perlu perhatian`,
          description: 'Lihat alasan penolakan atau pencabutan pada detail dokumen.',
          href: '/documents',
          label: 'Cek Dokumen',
          tone: 'red',
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string;
    description: string;
    href: string;
    label: string;
    tone: 'amber' | 'blue' | 'red';
  }>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-50">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <span>Memuat dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-50 p-4">
        <Card className="w-full max-w-md border-red-200 bg-white">
          <CardContent className="pt-6">
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AppShell title="Dashboard" subtitle="Ringkasan tugas dan status sertifikasi dokumen Anda.">
      <div className="space-y-6">
        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-sm">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-blue-700">DOCChain Workspace</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  Selamat datang, {userName}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-700 hover:bg-white">
                    {roleLabel}
                  </Badge>
                  <Badge
                    className={`rounded-full px-3 py-1 text-xs font-bold hover:bg-inherit ${getIdentityStatusBadgeClass(identityStatus)}`}
                  >
                    Identitas: {getIdentityStatusLabel(identityStatus)}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700">
                <Link href={identityStatus === 'APPROVED' ? '/documents' : '/profile#identitas-ktp'}>
                  {identityStatus === 'APPROVED' ? 'Upload Dokumen' : 'Lengkapi Identitas'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl border-blue-200 bg-white font-semibold text-blue-700 hover:bg-blue-50">
                <Link href="/profile">Buka Profil</Link>
              </Button>
            </div>
          </div>
        </section>

        {identityStatus !== 'APPROVED' ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Verifikasi identitas KTP diperlukan sebelum sertifikasi dokumen. Isi data KTP, unggah foto KTP yang jelas, lalu tunggu persetujuan admin.
              </span>
              <Button asChild className="w-fit shrink-0 bg-amber-600 text-white hover:bg-amber-700">
                <Link href="/profile#identitas-ktp">Verifikasi di Profil</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Dokumen Saya"
            value={ownedDocuments.length}
            description="Semua dokumen yang Anda upload"
            icon={<FolderOpen className="h-5 w-5" />}
            tone="blue"
          />
          <StatCard
            label="Menunggu TTD"
            value={pendingOwnedDocuments.length + pendingAssignments.length}
            description="Dokumen yang masih berjalan"
            icon={<Clock3 className="h-5 w-5" />}
            tone="amber"
          />
          <StatCard
            label="Final"
            value={finalDocuments.length}
            description="Sudah selesai dan tercatat"
            icon={<ShieldCheck className="h-5 w-5" />}
            tone="emerald"
          />
          <StatCard
            label="Perlu Perhatian"
            value={rejectedDocuments.length}
            description="Ditolak atau dicabut"
            icon={<AlertCircle className="h-5 w-5" />}
            tone="slate"
          />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_1.4fr]">
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-900">Aksi Cepat</CardTitle>
              <CardDescription>Langkah utama yang paling sering digunakan.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Button asChild className="h-12 justify-start rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700">
                <Link href={identityStatus === 'APPROVED' ? '/documents' : '/profile#identitas-ktp'}>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Upload Dokumen
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 justify-start rounded-xl border-slate-200 bg-white font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                <Link href="/documents">
                  <FileText className="mr-2 h-4 w-4" />
                  Lihat Dokumen
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 justify-start rounded-xl border-slate-200 bg-white font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                <Link href={identityStatus === 'APPROVED' ? '/signature-setup?next=/certification' : '/profile#identitas-ktp'}>
                  <PenSquare className="mr-2 h-4 w-4" />
                  Atur Tanda Tangan
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 justify-start rounded-xl border-slate-200 bg-white font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                <Link href="/verify-document">
                  <FileCheck2 className="mr-2 h-4 w-4" />
                  Verifikasi File
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-900">Tugas Saya</CardTitle>
              <CardDescription>Prioritas yang perlu Anda periksa terlebih dahulu.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {priorityTasks.length > 0 ? (
                priorityTasks.map((task) => (
                  <div
                    key={task.title}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={
                          task.tone === 'amber'
                            ? 'rounded-xl bg-amber-100 p-2 text-amber-700'
                            : task.tone === 'red'
                              ? 'rounded-xl bg-red-100 p-2 text-red-700'
                              : 'rounded-xl bg-blue-100 p-2 text-blue-700'
                        }
                      >
                        <ClipboardList className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{task.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{task.description}</p>
                      </div>
                    </div>
                    <Button asChild variant="outline" className="w-fit rounded-xl bg-white font-semibold">
                      <Link href={task.href}>{task.label}</Link>
                    </Button>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="font-bold text-emerald-900">Tidak ada tugas mendesak</p>
                      <p className="mt-1 text-sm text-emerald-800">
                        Semua alur utama sudah aman. Anda dapat upload dokumen baru atau memeriksa riwayat dokumen.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.8fr]">
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-slate-900">Dokumen Terbaru</CardTitle>
                <CardDescription>Ringkasan 5 dokumen terakhir yang Anda upload.</CardDescription>
              </div>
              <Button asChild variant="outline" className="w-fit rounded-xl bg-white font-semibold">
                <Link href="/documents">Lihat Semua</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentDocuments.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-bold">Dokumen</th>
                        <th className="px-4 py-3 font-bold">Status</th>
                        <th className="px-4 py-3 font-bold">Update</th>
                        <th className="px-4 py-3 text-right font-bold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentDocuments.map((doc) => (
                        <tr key={doc.id} className="bg-white">
                          <td className="max-w-[240px] px-4 py-3">
                            <p className="truncate font-semibold text-slate-900">
                              {doc.originalFileName ?? doc.finalFileName ?? 'Dokumen PDF'}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {doc.signatureCount ?? 0}/{doc.requiredSignerCount} tanda tangan
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getDocumentStatusBadgeClass(doc.status)}`}
                            >
                              {getDocumentStatusLabel(doc.status)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(doc.updatedAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <Button asChild size="sm" variant="outline" className="rounded-lg bg-white font-semibold">
                              <Link href={`/documents/${doc.id}`}>Detail</Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <FileText className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-3 font-bold text-slate-900">Belum ada dokumen</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Upload PDF pertama Anda untuk memulai sertifikasi.
                  </p>
                  <Button asChild className="mt-4 rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700">
                    <Link href={identityStatus === 'APPROVED' ? '/documents' : '/profile#identitas-ktp'}>
                      Mulai Sekarang
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-slate-900">Profil Aktif</CardTitle>
              <CardDescription>Data ringkas untuk identifikasi akun.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Nama</p>
                <p className="mt-1 font-bold text-slate-900">{userName}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Email</p>
                <p className="mt-1 break-all font-semibold text-slate-800">{user?.email}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Profil Akademik</p>
                {user?.academicProfile ? (
                  <div className="mt-1 space-y-1 text-sm text-slate-700">
                    <p className="font-bold text-slate-900">
                      {user.academicProfile.positionTitle ?? user.academicProfile.type}
                    </p>
                    <p>{user.academicProfile.unitName ?? '-'}</p>
                    {user.academicProfile.identifier ? <p>{user.academicProfile.identifier}</p> : null}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">Belum ada profil akademik.</p>
                )}
              </div>
              <Button asChild variant="outline" className="w-full rounded-xl bg-white font-semibold">
                <Link href="/profile">
                  <UserIcon className="mr-2 h-4 w-4" />
                  Kelola Profil
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
