'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Search, ShieldCheck, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AdminPagination } from '@/components/common/admin-pagination';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getIdentityKtpFile, getUser, listAdminIdentities, reviewAdminIdentity } from '@/lib/auth-service';
import { normalizeErrorMessage } from '@/lib/certification-flow';
import type { AdminIdentitiesResponse, IdentityStatus } from '@/types/auth';

type AdminIdentity = AdminIdentitiesResponse['identities'][number];
type ReviewDialogState = {
    identity: AdminIdentity;
    status: 'APPROVED' | 'REJECTED';
} | null;
type KtpDialogState = {
    identity: AdminIdentity;
    url: string;
} | null;
type ReReviewDialogState = AdminIdentity | null;

const identityStatuses: Array<IdentityStatus | 'ALL'> = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];
const pageSize = 8;

export default function AdminIdentitiesPage() {
    const router = useRouter();
    const currentUser = useMemo(() => getUser(), []);
    const [identities, setIdentities] = useState<AdminIdentity[]>([]);
    const [loading, setLoading] = useState(true);
    const [reviewingUserId, setReviewingUserId] = useState('');
    const [viewingKtpUserId, setViewingKtpUserId] = useState('');
    const [filter, setFilter] = useState<IdentityStatus | 'ALL'>('ALL');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [reviewDialog, setReviewDialog] = useState<ReviewDialogState>(null);
    const [reReviewDialog, setReReviewDialog] = useState<ReReviewDialogState>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [ktpDialog, setKtpDialog] = useState<KtpDialogState>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const filteredIdentities = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return identities.filter((identity) => {
            const matchesStatus = filter === 'ALL' || identity.status === filter;
            const matchesQuery = !normalizedQuery
                || identity.fullName.toLowerCase().includes(normalizedQuery)
                || identity.nik.toLowerCase().includes(normalizedQuery)
                || identity.user.email.toLowerCase().includes(normalizedQuery);
            return matchesStatus && matchesQuery;
        });
    }, [filter, identities, query]);
    const totalPages = Math.max(1, Math.ceil(filteredIdentities.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginatedIdentities = filteredIdentities.slice((safePage - 1) * pageSize, safePage * pageSize);

    useEffect(() => {
        setPage(1);
    }, [filter, query]);

    const refreshData = async () => {
        const response = await listAdminIdentities();
        setIdentities(response.identities);
    };

    useEffect(() => {
        async function loadData() {
            if (currentUser?.role !== 'SUPERADMIN' && currentUser?.role !== 'ADMIN_PRODI') {
                router.push('/dashboard');
                return;
            }

            try {
                await refreshData();
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }

        void loadData();
    }, [currentUser?.role, router]);

    useEffect(() => {
        return () => {
            if (ktpDialog?.url) {
                URL.revokeObjectURL(ktpDialog.url);
            }
        };
    }, [ktpDialog?.url]);

    const openReviewDialog = (identity: AdminIdentity, status: 'APPROVED' | 'REJECTED') => {
        setRejectReason('');
        setReviewDialog({ identity, status });
    };

    const closeKtpDialog = () => {
        if (ktpDialog?.url) {
            URL.revokeObjectURL(ktpDialog.url);
        }
        setKtpDialog(null);
    };

    const handleReview = async () => {
        if (!reviewDialog) {
            return;
        }

        const { identity, status } = reviewDialog;
        setError('');
        setSuccess('');
        setReviewingUserId(identity.userId);
        try {
            const result = await reviewAdminIdentity(identity.userId, {
                status,
                ...(status === 'REJECTED' && {
                    rejectionReason: rejectReason.trim() || 'Data identitas tidak valid',
                }),
            });
            setSuccess(result.message);
            setReviewDialog(null);
            setRejectReason('');
            await refreshData();
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setReviewingUserId('');
        }
    };

    const handleOpenKtp = async (identity: AdminIdentity) => {
        setError('');
        setViewingKtpUserId(identity.userId);
        try {
            const file = await getIdentityKtpFile(identity.userId);
            const url = URL.createObjectURL(file);
            if (ktpDialog?.url) {
                URL.revokeObjectURL(ktpDialog.url);
            }
            setKtpDialog({ identity, url });
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setViewingKtpUserId('');
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memuat data identitas...
            </div>
        );
    }

    return (
        <AppShell
            title="Verifikasi Identitas"
            subtitle={currentUser?.role === 'ADMIN_PRODI' ? 'Approve atau reject identitas anggota dalam prodi Anda.' : 'Superadmin dapat approve atau reject identitas semua user.'}
        >
            <div className="space-y-5">
                {error ? (
                    <Alert className="border-red-200 bg-red-50 text-red-800">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                {success ? (
                    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>{success}</AlertDescription>
                    </Alert>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                    {identityStatuses.map((status) => {
                        const count = status === 'ALL' ? identities.length : identities.filter((item) => item.status === status).length;
                        const borderColors: Record<string, string> = {
                            ALL: 'border-t-slate-400',
                            PENDING: 'border-t-indigo-500 shadow-indigo-500/5',
                            APPROVED: 'border-t-emerald-500 shadow-emerald-500/5',
                            REJECTED: 'border-t-red-500 shadow-red-500/5',
                        };
                        const textColors: Record<string, string> = {
                            ALL: 'text-slate-700',
                            PENDING: 'text-indigo-600',
                            APPROVED: 'text-emerald-600',
                            REJECTED: 'text-red-600',
                        };
                        return (
                            <Card key={status} className={`overflow-hidden rounded-2xl border border-slate-200/60 border-t-4 ${borderColors[status]} bg-white/70 backdrop-blur-md shadow-lg shadow-slate-100/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}>
                                <CardContent className="pt-6">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{status === 'ALL' ? 'Total Ajuan' : status}</p>
                                    <p className={`mt-2 text-3xl font-extrabold tracking-tight ${textColors[status]}`}>
                                        {count}
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                <Card className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur-md shadow-lg shadow-slate-100/50">
                    <CardHeader className="border-b border-slate-100/60 pb-5">
                        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                            <ShieldCheck className="h-5.5 w-5.5 text-indigo-500" />
                            Data Identitas
                        </CardTitle>
                        <CardDescription className="text-slate-500 text-xs">Filter status, cek KTP, lalu beri keputusan verifikasi.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-0 p-0">
                        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100/60">
                            <div className="flex flex-wrap gap-1.5">
                                {identityStatuses.map((status) => (
                                    <Button
                                        key={status}
                                        variant={filter === status ? 'default' : 'outline'}
                                        className={`h-8 px-4 rounded-lg text-xs font-semibold ${filter === status 
                                            ? 'bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/10' 
                                            : 'border-slate-200/80 bg-white/80 hover:bg-slate-50'
                                        }`}
                                        onClick={() => setFilter(status)}
                                    >
                                        {status}
                                    </Button>
                                ))}
                            </div>
                            <div className="relative w-full lg:w-80">
                                <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, NIK, email..." className="pl-10 h-9 rounded-lg border-slate-200/80 bg-white/80 focus:bg-white text-xs" />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1050px] text-left text-sm">
                                <thead className="border-b border-slate-200/60 bg-slate-50/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    <tr>
                                        <th className="px-6 py-3.5 font-bold">Identitas</th>
                                        <th className="px-6 py-3.5 font-bold">User</th>
                                        <th className="px-6 py-3.5 font-bold">Tempat, Tanggal Lahir</th>
                                        <th className="px-6 py-3.5 font-bold">Status</th>
                                        <th className="px-6 py-3.5 text-right font-bold">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100/60">
                                    {paginatedIdentities.length === 0 ? (
                                        <tr>
                                            <td className="px-6 py-8 text-center text-slate-400 font-medium" colSpan={5}>Tidak ada identitas pada filter ini.</td>
                                        </tr>
                                    ) : paginatedIdentities.map((identity) => (
                                        <tr key={identity.userId} className="group hover:bg-slate-50/50 transition-all duration-200">
                                            <td className="px-6 py-4">
                                                <p className="font-semibold text-slate-900 group-hover:text-indigo-950 transition-colors">{identity.fullName}</p>
                                                <p className="mt-1 font-mono text-[10px] text-slate-400 uppercase tracking-wider">NIK {identity.nik}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-slate-700 text-xs">{identity.user.displayName ?? '-'}</p>
                                                <p className="mt-0.5 text-[10px] text-slate-400">{identity.user.email}</p>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 text-xs font-medium">{identity.birthPlace ?? '-'}, {new Date(identity.birthDate).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant={identity.status === 'APPROVED' ? 'success' : identity.status === 'REJECTED' ? 'destructive' : 'warning'}>{identity.status}</Badge>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-end gap-1.5">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 rounded-lg border-slate-200/80 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50/50 hover:text-indigo-600 hover:border-indigo-200/60 shadow-xs transition-all"
                                                        onClick={() => void handleOpenKtp(identity)}
                                                        disabled={viewingKtpUserId === identity.userId || !identity.ktpStoragePath}
                                                    >
                                                        {viewingKtpUserId === identity.userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                                        {identity.ktpStoragePath ? 'KTP' : 'Tanpa KTP'}
                                                    </Button>
                                                    {identity.status === 'PENDING' ? (
                                                        <>
                                                            <Button size="sm" onClick={() => openReviewDialog(identity, 'APPROVED')} disabled={reviewingUserId === identity.userId} className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 transition-all gap-1">
                                                                {reviewingUserId === identity.userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                                                Approve
                                                            </Button>
                                                            <Button size="sm" variant="destructive" onClick={() => openReviewDialog(identity, 'REJECTED')} disabled={reviewingUserId === identity.userId} className="h-8 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/10 hover:shadow-red-600/20 transition-all gap-1">
                                                                {reviewingUserId === identity.userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                                                Reject
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setReReviewDialog(identity)}
                                                            disabled={reviewingUserId === identity.userId}
                                                            className="h-8 rounded-lg border-indigo-200 bg-indigo-50 px-3.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800"
                                                        >
                                                            <RotateCcw className="h-3.5 w-3.5" />
                                                            Review Ulang
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <AdminPagination page={safePage} pageSize={pageSize} totalItems={filteredIdentities.length} onPageChange={setPage} />
                    </CardContent>
                </Card>

                <Dialog open={Boolean(ktpDialog)} onOpenChange={(open) => !open && closeKtpDialog()}>
                    <DialogContent className="max-h-[88vh] max-w-[min(92vw,760px)] overflow-hidden rounded-2xl p-0">
                        <DialogHeader className="border-b border-slate-200 px-5 py-4">
                            <DialogTitle>Preview KTP</DialogTitle>
                            <DialogDescription>
                                {ktpDialog?.identity.fullName ?? '-'} | NIK {ktpDialog?.identity.nik ?? '-'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="max-h-[68vh] overflow-auto bg-slate-950 p-4">
                            {ktpDialog?.url ? (
                                <img
                                    src={ktpDialog.url}
                                    alt={`KTP ${ktpDialog.identity.fullName}`}
                                    className="mx-auto max-h-[64vh] w-auto max-w-full rounded-lg bg-white object-contain"
                                />
                            ) : null}
                        </div>
                        <DialogFooter className="border-t border-slate-200 px-5 py-4">
                            <Button variant="outline" className="border-slate-300" onClick={closeKtpDialog}>
                                Tutup
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={Boolean(reReviewDialog)} onOpenChange={(open) => !open && setReReviewDialog(null)}>
                    <DialogContent className="w-[min(92vw,520px)] rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>Review Ulang Identitas</DialogTitle>
                            <DialogDescription>
                                Gunakan aksi ini bila keputusan sebelumnya keliru atau data perlu dievaluasi kembali.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-semibold text-slate-900">{reReviewDialog?.fullName ?? '-'}</p>
                                    <p className="mt-1 text-xs text-slate-600">NIK {reReviewDialog?.nik ?? '-'}</p>
                                    <p className="mt-1 text-xs text-slate-500">{reReviewDialog?.user.email ?? '-'}</p>
                                </div>
                                {reReviewDialog ? (
                                    <Badge variant={reReviewDialog.status === 'APPROVED' ? 'success' : 'destructive'}>
                                        {reReviewDialog.status}
                                    </Badge>
                                ) : null}
                            </div>
                            <p className="text-xs leading-relaxed text-slate-500">
                                Tombol approve/reject langsung disembunyikan karena identitas ini sudah memiliki keputusan final. Pilih perubahan status hanya jika hasil review sebelumnya memang perlu dikoreksi.
                            </p>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" className="border-slate-300" onClick={() => setReReviewDialog(null)}>
                                Batal
                            </Button>
                            {reReviewDialog?.status === 'REJECTED' ? (
                                <Button
                                    onClick={() => {
                                        openReviewDialog(reReviewDialog, 'APPROVED');
                                        setReReviewDialog(null);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-500"
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Ubah ke Approve
                                </Button>
                            ) : null}
                            {reReviewDialog?.status === 'APPROVED' ? (
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        openReviewDialog(reReviewDialog, 'REJECTED');
                                        setReReviewDialog(null);
                                    }}
                                >
                                    <XCircle className="h-4 w-4" />
                                    Ubah ke Reject
                                </Button>
                            ) : null}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={Boolean(reviewDialog)} onOpenChange={(open) => !open && setReviewDialog(null)}>
                    <DialogContent className="w-[min(92vw,560px)] rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>
                                {reviewDialog?.status === 'APPROVED' ? 'Konfirmasi Approve Identitas' : 'Konfirmasi Reject Identitas'}
                            </DialogTitle>
                            <DialogDescription>
                                {reviewDialog?.status === 'APPROVED'
                                    ? 'Pastikan data dan foto KTP sudah sesuai sebelum menyetujui identitas ini.'
                                    : 'Tuliskan alasan penolakan agar user memahami data apa yang perlu diperbaiki.'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                            <p className="font-semibold text-slate-900">{reviewDialog?.identity.fullName ?? '-'}</p>
                            <p className="mt-1 text-xs text-slate-600">NIK {reviewDialog?.identity.nik ?? '-'}</p>
                            <p className="mt-1 text-xs text-slate-500">{reviewDialog?.identity.user.email ?? '-'}</p>
                        </div>

                        {reviewDialog?.status === 'REJECTED' ? (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Alasan penolakan</label>
                                <textarea
                                    value={rejectReason}
                                    onChange={(event) => setRejectReason(event.target.value)}
                                    placeholder="Contoh: Foto KTP kurang jelas atau NIK tidak sesuai."
                                    className="min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                />
                            </div>
                        ) : null}

                        <DialogFooter>
                            <Button variant="outline" className="border-slate-300" onClick={() => setReviewDialog(null)}>
                                Tidak
                            </Button>
                            <Button
                                variant={reviewDialog?.status === 'REJECTED' ? 'destructive' : 'default'}
                                onClick={() => void handleReview()}
                                disabled={Boolean(reviewDialog && reviewingUserId === reviewDialog.identity.userId) || (reviewDialog?.status === 'REJECTED' && rejectReason.trim().length < 5)}
                            >
                                {reviewDialog && reviewingUserId === reviewDialog.identity.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Ya, {reviewDialog?.status === 'APPROVED' ? 'Approve' : 'Reject'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppShell>
    );
}
