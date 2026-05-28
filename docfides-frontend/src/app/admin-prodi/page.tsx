'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText, ShieldCheck, Clock, CheckCircle2, XCircle,
  Users, AlertTriangle, TrendingUp, ArrowRight, Loader2,
  FileSignature, UserCheck, FileClock, FileX2, PenSquare, FolderOpen,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { getUser } from '@/lib/auth-service';
import api from '@/lib/axios';

/* ─── Types ─────────────────────────────────────────── */

type DocStatus = {
  status: string;
  _count: { id: number };
};

type PendingIdentity = {
  userId: string;
  fullName: string;
  updatedAt: string;
};

type AdminProdiStats = {
  totalDocuments: number;
  pendingDocuments: number;
  fullySignedDocuments: number;
  partialDocuments: number;
  revokedDocuments: number;
  pendingIdentities: number;
  totalUsers: number;
  docByStatus: DocStatus[];
  recentPendingIdentities: PendingIdentity[];
};

/* ─── Sub-components ─────────────────────────────────── */

function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  bg,
  text,
}: {
  label: string;
  value: number | string;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <p className={`mt-1.5 text-3xl font-bold ${text}`}>{value}</p>
          {sublabel && <p className="mt-1 text-xs text-gray-400">{sublabel}</p>}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  iconBg,
  label,
  desc,
  badge,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  label: string;
  desc: string;
  badge?: number;
}) {
  return (
    <Link href={href} className="group flex min-h-24 items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-800">{label}</p>
          {badge !== undefined && badge > 0 && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-gray-400">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
    </Link>
  );
}

/* ─── Page ───────────────────────────────────────────── */

export default function AdminProdiDashboardPage() {
  const router = useRouter();
  const currentUser = useMemo(() => getUser(), []);
  const [stats, setStats] = useState<AdminProdiStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.role !== 'ADMIN_PRODI') {
      router.replace('/dashboard');
      return;
    }

    async function loadStats() {
      try {
        // Fetch data from available endpoints
        const [docsRes, identitiesRes, usersRes] = await Promise.allSettled([
          api.get('/admin/documents?limit=200'),
          api.get('/admin/identities?status=PENDING&limit=10'),
          api.get('/admin/users?limit=1'),
        ]);

        let totalDocuments = 0;
        let pendingDocuments = 0;
        let fullySignedDocuments = 0;
        let partialDocuments = 0;
        let revokedDocuments = 0;
        const docByStatus: DocStatus[] = [];

        if (docsRes.status === 'fulfilled') {
          const docs = (docsRes.value.data as { documents: Array<{ status: string }> }).documents ?? [];
          totalDocuments = docs.length;

          const statusMap: Record<string, number> = {};
          for (const d of docs) {
            const s = d.status;
            statusMap[s] = (statusMap[s] ?? 0) + 1;
          }

          for (const [status, count] of Object.entries(statusMap)) {
            docByStatus.push({ status, _count: { id: count } });
          }

          pendingDocuments = (statusMap['PENDING_SIGNATURES'] ?? 0) + (statusMap['PARTIALLY_SIGNED'] ?? 0);
          fullySignedDocuments = statusMap['FULLY_SIGNED'] ?? 0;
          partialDocuments = statusMap['PARTIALLY_SIGNED'] ?? 0;
          revokedDocuments = statusMap['REVOKED'] ?? 0;
        }

        let pendingIdentities = 0;
        const recentPendingIdentities: PendingIdentity[] = [];

        if (identitiesRes.status === 'fulfilled') {
          const identities = (identitiesRes.value.data as {
            identities: Array<{ userId: string; fullName: string; updatedAt: string; status?: string }>;
          }).identities ?? [];
          const pendingOnly = identities.filter((identity) => !identity.status || identity.status === 'PENDING');
          pendingIdentities = pendingOnly.length;
          recentPendingIdentities.push(
            ...pendingOnly.slice(0, 5).map((i) => ({
              userId: i.userId,
              fullName: i.fullName,
              updatedAt: i.updatedAt,
            })),
          );
        }

        let totalUsers = 0;
        if (usersRes.status === 'fulfilled') {
          totalUsers = ((usersRes.value.data as { users: unknown[] }).users ?? []).length;
        }

        setStats({
          totalDocuments,
          pendingDocuments,
          fullySignedDocuments,
          partialDocuments,
          revokedDocuments,
          pendingIdentities,
          totalUsers,
          docByStatus,
          recentPendingIdentities,
        });
      } catch {
        // silently fail — show zeros
        setStats({
          totalDocuments: 0, pendingDocuments: 0, fullySignedDocuments: 0,
          partialDocuments: 0, revokedDocuments: 0, pendingIdentities: 0,
          totalUsers: 0, docByStatus: [], recentPendingIdentities: [],
        });
      } finally {
        setLoading(false);
      }
    }

    void loadStats();
  }, [currentUser?.role, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
        <span className="text-sm text-gray-600">Memuat dashboard...</span>
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    FULLY_SIGNED: { label: 'Terselesaikan', color: 'bg-emerald-100 text-emerald-700' },
    PENDING_SIGNATURES: { label: 'Menunggu', color: 'bg-amber-100 text-amber-700' },
    PARTIALLY_SIGNED: { label: 'Sebagian', color: 'bg-blue-100 text-blue-700' },
    REVOKED: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700' },
    DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  };

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'Selamat Pagi' : greetingHour < 17 ? 'Selamat Siang' : 'Selamat Sore';

  return (
    <AppShell title="Dashboard Admin Prodi" subtitle="Ringkasan administrasi program studi Anda.">
      <div className="space-y-6">

        {/* ── Welcome Banner ── */}
        <section className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50 px-7 py-6 text-slate-800 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-700">{greeting}, {currentUser?.displayName ?? 'Admin'}</p>
            <h1 className="mt-0.5 text-xl font-bold text-slate-800">
              Panel Administrasi Program Studi
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Pantau dokumen, verifikasi identitas, kelola anggota prodi, dan jalankan sertifikasi.
            </p>
          </div>
          <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white sm:flex">
            <TrendingUp className="h-7 w-7 text-blue-600" />
          </div>
        </section>

        {/* ── Stat Cards ── */}
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label="Total Dokumen"
            value={stats?.totalDocuments ?? 0}
            sublabel="Semua dokumen terdaftar"
            icon={FileText}
            bg="bg-blue-50 text-blue-600"
            text="text-blue-700"
          />
          <StatCard
            label="Perlu Tanda Tangan"
            value={stats?.pendingDocuments ?? 0}
            sublabel="Menunggu penyelesaian"
            icon={FileClock}
            bg={stats?.pendingDocuments ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'}
            text={stats?.pendingDocuments ? 'text-amber-600' : 'text-slate-600'}
          />
          <StatCard
            label="Selesai Sertifikasi"
            value={stats?.fullySignedDocuments ?? 0}
            sublabel="Fully signed & certified"
            icon={CheckCircle2}
            bg="bg-emerald-50 text-emerald-600"
            text="text-emerald-700"
          />
          <StatCard
            label="Identitas Pending"
            value={stats?.pendingIdentities ?? 0}
            sublabel="Perlu diverifikasi"
            icon={UserCheck}
            bg={stats?.pendingIdentities ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}
            text={stats?.pendingIdentities ? 'text-red-600' : 'text-slate-600'}
          />
        </section>

        {/* ── Main Content: Quick Actions + Status Breakdown ── */}
        <section className="grid gap-6 xl:grid-cols-[1fr_320px]">

          {/* Left: Quick Actions */}
          <div>
            <h2 className="text-sm font-bold text-gray-700">Aksi Cepat</h2>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <QuickAction
                href="/certification/upload"
                icon={PenSquare}
                iconBg="bg-indigo-50 text-indigo-600"
                label="Mulai Sertifikasi"
                desc="Upload dokumen, pilih signer, atur QR, lalu mulai proses"
              />
              <QuickAction
                href="/documents"
                icon={FolderOpen}
                iconBg="bg-cyan-50 text-cyan-600"
                label="Dokumen Saya"
                desc="Lihat dokumen yang Anda upload untuk sertifikasi"
              />
              <QuickAction
                href="/signature-setup"
                icon={FileSignature}
                iconBg="bg-blue-50 text-blue-600"
                label="Setup Tanda Tangan"
                desc="Atur file tanda tangan sebelum melakukan sign"
              />
              <QuickAction
                href="/admin/identities"
                icon={UserCheck}
                iconBg="bg-amber-50 text-amber-600"
                label="Verifikasi Identitas"
                desc="Review dan setujui pengajuan KTP/identitas anggota"
                badge={stats?.pendingIdentities}
              />
              <QuickAction
                href="/admin/documents"
                icon={FileClock}
                iconBg="bg-blue-50 text-blue-600"
                label="Dokumen Menunggu"
                desc="Pantau dokumen yang belum selesai ditandatangani"
                badge={stats?.pendingDocuments}
              />
              <QuickAction
                href="/admin/documents"
                icon={FileSignature}
                iconBg="bg-emerald-50 text-emerald-600"
                label="Monitoring Sertifikasi"
                desc="Lihat semua dokumen dan status penandatanganannya"
              />
              <QuickAction
                href="/admin/users"
                icon={Users}
                iconBg="bg-violet-50 text-violet-600"
                label="Kelola Anggota"
                desc="Lihat dan kelola akun mahasiswa dan dosen prodi"
              />
              <QuickAction
                href="/admin/identities"
                icon={ShieldCheck}
                iconBg="bg-slate-50 text-slate-600"
                label="Riwayat Verifikasi"
                desc="Lihat semua identitas yang sudah diverifikasi"
              />
            </div>
          </div>

          {/* Right: Status Breakdown */}
          <div className="space-y-4">
            {/* Doc by status */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-gray-700">Status Dokumen</h3>
              {stats?.docByStatus.length ? (
                <div className="space-y-2">
                  {stats.docByStatus.map((item) => {
                    const cfg = statusConfig[item.status] ?? { label: item.status, color: 'bg-gray-100 text-gray-600' };
                    const pct = stats.totalDocuments > 0
                      ? Math.round((item._count.id / stats.totalDocuments) * 100)
                      : 0;
                    return (
                      <div key={item.status} className="flex items-center gap-3">
                        <span className={`min-w-[110px] rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <div className="flex-1 rounded-full bg-gray-100 h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.status === 'FULLY_SIGNED' ? 'bg-emerald-500' : item.status === 'REVOKED' ? 'bg-red-400' : 'bg-amber-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-700 w-6 text-right">{item._count.id}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">Belum ada data dokumen</p>
              )}
            </div>

            {/* Pending identities list */}
            {(stats?.recentPendingIdentities.length ?? 0) > 0 && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-amber-800">Perlu Verifikasi</h3>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <div className="space-y-2">
                  {stats?.recentPendingIdentities.map((id) => (
                    <div key={id.userId} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">
                          {id.fullName?.[0] ?? '?'}
                        </div>
                        <p className="text-xs font-semibold text-gray-800 truncate max-w-[130px]">{id.fullName}</p>
                      </div>
                      <Link
                        href="/admin/identities"
                        className="text-[10px] font-semibold text-blue-600 hover:underline"
                      >
                        Review →
                      </Link>
                    </div>
                  ))}
                </div>
                <Link
                  href="/admin/identities"
                  className="mt-3 flex w-full items-center justify-center rounded-xl border border-amber-200 bg-amber-50 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                >
                  Lihat Semua
                </Link>
              </div>
            )}

            {/* Summary badges */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-gray-700">Ringkasan</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Selesai', value: stats?.fullySignedDocuments ?? 0, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
                  { label: 'Pending', value: stats?.pendingDocuments ?? 0, icon: Clock, color: 'text-amber-600 bg-amber-50' },
                  { label: 'Dibatalkan', value: stats?.revokedDocuments ?? 0, icon: FileX2, color: 'text-red-600 bg-red-50' },
                  { label: 'ID Pending', value: stats?.pendingIdentities ?? 0, icon: XCircle, color: 'text-red-600 bg-red-50' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${color.split(' ')[1]}`}>
                    <Icon className={`h-3.5 w-3.5 ${color.split(' ')[0]}`} />
                    <div>
                      <p className={`text-sm font-bold ${color.split(' ')[0]}`}>{value}</p>
                      <p className="text-[10px] text-gray-500">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
