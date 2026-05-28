'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    AlertCircle,
    ArrowRight,
    Building2,
    FileText,
    Loader2,
    ShieldAlert,
    ShieldCheck,
    Users,
    XCircle,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { getAdminOverview, getUser } from '@/lib/auth-service';
import { normalizeErrorMessage } from '@/lib/certification-flow';
import type { AdminOverviewResponse } from '@/types/auth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: string): string {
    const s = status.toUpperCase();
    if (s === 'FULLY_SIGNED' || s === 'CERTIFIED') return 'bg-emerald-100 text-emerald-700';
    if (s === 'REVOKED') return 'bg-red-100 text-red-700';
    if (s === 'DECLINED' || s === 'CANCELLED') return 'bg-orange-100 text-orange-700';
    if (s === 'PENDING_SIGNATURES' || s === 'PENDING') return 'bg-amber-100 text-amber-700';
    if (s === 'DRAFT') return 'bg-slate-100 text-slate-600';
    return 'bg-blue-100 text-blue-700';
}

function roleColor(role: string): string {
    const map: Record<string, string> = {
        SUPERADMIN: 'bg-purple-100 text-purple-700',
        JURUSAN: 'bg-blue-100 text-blue-700',
        PRODI: 'bg-cyan-100 text-cyan-700',
        ADMIN_PRODI: 'bg-indigo-100 text-indigo-700',
        PEGAWAI: 'bg-teal-100 text-teal-700',
        MAHASISWA: 'bg-green-100 text-green-700',
    };
    return map[role] ?? 'bg-slate-100 text-slate-600';
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface StatPillProps {
    label: string;
    value: number;
    sub?: string;
    icon: React.ElementType;
    iconColor: string;
    iconBg: string;
}

function StatPill({ label, value, sub, icon: Icon, iconColor, iconBg }: StatPillProps) {
    return (
        <div className="flex flex-1 items-center justify-between rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                <p className="mt-1.5 text-3xl font-bold text-slate-800">{value.toLocaleString('id-ID')}</p>
                {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
            </div>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
                <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
        </div>
    );
}

interface QuickCardProps {
    href: string;
    title: string;
    desc: string;
    icon: React.ElementType;
    accentBg: string;
    accentText: string;
    badge?: number;
}

function QuickCard({ href, title, desc, icon: Icon, accentBg, accentText, badge }: QuickCardProps) {
    return (
        <Link
            href={href}
            className="group flex min-h-36 flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
        >
            <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentBg}`}>
                    <Icon className={`h-5 w-5 ${accentText}`} />
                </div>
                {badge !== undefined && badge > 0 && (
                    <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                        {badge}
                    </span>
                )}
            </div>

            <div className="mt-4 flex flex-1 flex-col justify-between">
                <div>
                    <p className="font-semibold text-slate-800">{title}</p>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{desc}</p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-blue-600 transition-colors group-hover:text-blue-700">
                    Buka
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
            </div>
        </Link>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
    const router = useRouter();
    const currentUser = useMemo(() => getUser(), []);
    const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function loadData() {
            if (currentUser?.role !== 'SUPERADMIN') {
                router.push('/dashboard');
                return;
            }

            try {
                setOverview(await getAdminOverview());
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }

        void loadData();
    }, [currentUser?.role, router]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <span>Memuat panel kendali…</span>
            </div>
        );
    }

    const docs = overview?.documents;
    const users = overview?.users;
    const identitiesPending = overview?.identities.pending ?? 0;

    return (
        <AppShell title="Admin Overview" subtitle="Ringkasan kendali sistem untuk superadmin.">
            <div className="space-y-6">

                {/* ── Error banner ── */}
                {error ? (
                    <Alert className="border-red-200 bg-red-50 text-red-800">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                {/* ── Dark hero header ── */}
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-7 py-6 text-slate-800 shadow-sm">
                    <div className="mb-5 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium text-blue-700">Superadmin</p>
                            <h1 className="mt-0.5 text-xl font-bold text-slate-800">Kontrol Panel Sistem</h1>
                            <p className="mt-1 text-sm text-slate-600">
                                Ringkasan real-time infrastruktur sertifikasi dokumen DoChain
                            </p>
                        </div>
                        <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white sm:flex">
                            <ShieldCheck className="h-7 w-7 text-blue-600" />
                        </div>
                    </div>

                    {/* Stat pills */}
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatPill
                            label="Total Pengguna"
                            value={users?.total ?? 0}
                            sub={`${users?.active ?? 0} aktif`}
                            icon={Users}
                            iconBg="bg-blue-50"
                            iconColor="text-blue-600"
                        />
                        <StatPill
                            label="Identitas Pending"
                            value={identitiesPending}
                            sub={identitiesPending > 0 ? 'Perlu ditinjau segera' : 'Semua terverifikasi'}
                            icon={ShieldAlert}
                            iconBg={identitiesPending > 0 ? 'bg-amber-50' : 'bg-slate-50'}
                            iconColor={identitiesPending > 0 ? 'text-amber-600' : 'text-slate-500'}
                        />
                        <StatPill
                            label="Total Dokumen"
                            value={docs?.total ?? 0}
                            sub={`${docs?.fullySigned ?? 0} tersertifikasi`}
                            icon={FileText}
                            iconBg="bg-emerald-50"
                            iconColor="text-emerald-600"
                        />
                        <StatPill
                            label="Ditolak / Revoked"
                            value={(docs?.revoked ?? 0) + (docs?.declinedSigners ?? 0)}
                            sub={`${docs?.revoked ?? 0} revoked · ${docs?.declinedSigners ?? 0} ditolak signer`}
                            icon={XCircle}
                            iconBg="bg-red-50"
                            iconColor="text-red-600"
                        />
                    </div>
                </div>

                {/* ── Quick access cards ── */}
                <div>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                        Akses Cepat
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <QuickCard
                            href="/admin/users"
                            title="Kelola Pengguna"
                            desc="Buat akun, ubah role, dan atur status pengguna."
                            icon={Users}
                            accentBg="bg-blue-50"
                            accentText="text-blue-600"
                        />
                        <QuickCard
                            href="/admin/identities"
                            title="Verifikasi Identitas"
                            desc="Approve atau reject pengajuan identitas pengguna."
                            icon={ShieldCheck}
                            accentBg="bg-amber-50"
                            accentText="text-amber-600"
                            badge={identitiesPending}
                        />
                        <QuickCard
                            href="/admin/academic-units"
                            title="Unit Akademik"
                            desc="Kelola data jurusan dan program studi."
                            icon={Building2}
                            accentBg="bg-emerald-50"
                            accentText="text-emerald-600"
                        />
                        <QuickCard
                            href="/admin/documents"
                            title="Monitoring Dokumen"
                            desc="Audit status, signer, hash, IPFS, dan penolakan."
                            icon={FileText}
                            accentBg="bg-blue-50"
                            accentText="text-blue-600"
                        />
                    </div>
                </div>

                {/* ── Two-column bottom section ── */}
                <div className="grid gap-4 lg:grid-cols-2">

                    {/* Document status breakdown */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="mb-4 font-semibold text-slate-800">Status Dokumen</h2>
                        {docs?.byStatus && docs.byStatus.length > 0 ? (
                            <ul className="divide-y divide-slate-100">
                                {docs.byStatus.map((item) => (
                                    <li
                                        key={item.status}
                                        className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                                    >
                                        <span className="text-sm text-slate-700">
                                            {item.status.replace(/_/g, ' ')}
                                        </span>
                                        <span
                                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(item.status)}`}
                                        >
                                            {item.count}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-slate-400">Belum ada data dokumen.</p>
                        )}
                    </div>

                    {/* Role distribution */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="mb-4 font-semibold text-slate-800">Distribusi Role Pengguna</h2>
                        {users?.byRole && users.byRole.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {users.byRole.map((item) => (
                                    <span
                                        key={item.role}
                                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${roleColor(item.role)}`}
                                    >
                                        {item.role}
                                        <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-xs font-bold">
                                            {item.count}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-400">Belum ada data pengguna.</p>
                        )}
                    </div>

                </div>
            </div>
        </AppShell>
    );
}
