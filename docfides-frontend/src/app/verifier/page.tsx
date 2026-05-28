'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    getIdentityKtpFile,
    getUser,
    listPendingIdentities,
    logout,
    reviewIdentity,
} from '@/lib/auth-service';
import type { PendingIdentityItem } from '@/types/auth';

type ApiError = {
    message?: string | string[];
};

export default function VerifierPage() {
    const router = useRouter();
    const [items, setItems] = useState<PendingIdentityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submittingUserId, setSubmittingUserId] = useState<string | null>(null);
    const [viewingKtpUserId, setViewingKtpUserId] = useState('');
    const [reasons, setReasons] = useState<Record<string, string>>({});
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const canAccess = useMemo(() => {
        const user = getUser();
        return user?.role === 'SUPERADMIN' || user?.role === 'ADMIN_PRODI';
    }, []);

    const normalizeErrorMessage = (err: unknown): string => {
        const axiosError = err as AxiosError<ApiError>;
        const responseMessage = axiosError.response?.data?.message;
        return Array.isArray(responseMessage)
            ? responseMessage.join(', ')
            : responseMessage ?? axiosError.message ?? 'Terjadi kesalahan';
    };

    const refreshData = async () => {
        const pending = await listPendingIdentities();
        setItems(pending);
    };

    useEffect(() => {
        async function loadData() {
            if (!canAccess) {
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
    }, [canAccess, router]);

    const handleReview = async (userId: string, status: 'APPROVED' | 'REJECTED') => {
        setError('');
        setSuccess('');
        setSubmittingUserId(userId);

        try {
            const payload = status === 'REJECTED'
                ? { status, rejectionReason: reasons[userId]?.trim() || 'Tidak memenuhi validasi internal' }
                : { status };

            const result = await reviewIdentity(userId, payload);
            setSuccess(result.message);
            await refreshData();
        } catch (err) {
            setError(normalizeErrorMessage(err));
            if ((err as AxiosError).response?.status === 401) {
                logout();
                router.push('/login');
            }
        } finally {
            setSubmittingUserId(null);
        }
    };

    const handleOpenKtp = async (userId: string) => {
        setError('');
        setViewingKtpUserId(userId);
        try {
            const file = await getIdentityKtpFile(userId);
            const url = URL.createObjectURL(file);
            window.open(url, '_blank', 'noopener,noreferrer');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (err) {
            setError(normalizeErrorMessage(err));
            if ((err as AxiosError).response?.status === 401) {
                logout();
                router.push('/login');
            }
        } finally {
            setViewingKtpUserId('');
        }
    };

    if (!canAccess) {
        return null;
    }

    return (
        <div className="relative min-h-screen bg-slate-50/50 text-slate-900 overflow-hidden pb-12">
            {/* Subtle Decorative Background Blobs */}
            <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl animate-pulse" />
            <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl animate-pulse" />

            <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/50 pb-5">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 bg-clip-text text-transparent">Review Identitas</h1>
                        <p className="text-slate-500 text-xs mt-1">Superadmin dan Admin Prodi dapat review data KTP berstatus PENDING untuk membuka gate sertifikasi user.</p>
                    </div>
                    <Button variant="outline" className="h-9 rounded-lg border-slate-200 bg-white/80 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-all" onClick={() => router.push('/dashboard')}>
                        Kembali ke Dashboard
                    </Button>
                </div>

                {error && (
                    <Alert className="border-red-200 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm text-red-800">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
                    </Alert>
                )}

                {success && (
                    <Alert className="border-emerald-200 bg-emerald-50/80 backdrop-blur-sm rounded-xl shadow-sm text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <AlertDescription className="text-xs font-medium">{success}</AlertDescription>
                    </Alert>
                )}

                <Card className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur-md shadow-xl shadow-slate-100/50">
                    <CardHeader className="border-b border-slate-100/60 pb-5">
                        <CardTitle className="text-xl font-bold text-slate-900">Daftar Pending ({items.length})</CardTitle>
                        <CardDescription className="text-slate-500 text-xs">
                            Endpoint backend: GET /identity/pending dan PATCH /identity/:userId/review.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {loading ? (
                            <div className="py-12 flex items-center justify-center text-slate-500 gap-2">
                                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                                <span className="text-xs font-semibold">Memuat data pending...</span>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-xs font-medium">Tidak ada data PENDING saat ini.</div>
                        ) : (
                            <div className="space-y-4">
                                {items.map((item) => (
                                    <div key={item.userId} className="rounded-xl border border-slate-200/60 bg-white/40 p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:bg-white/60">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                                            <p className="flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">User ID:</span> <span className="font-mono bg-slate-100 px-2 py-0.5 rounded-md text-[10px]">{item.userId}</span></p>
                                            <p className="flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">NIK:</span> <span className="font-mono bg-slate-100 px-2 py-0.5 rounded-md text-[10px]">{item.nik}</span></p>
                                            <p className="flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nama Lengkap:</span> <span className="text-slate-900">{item.fullName}</span></p>
                                            <p className="flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tanggal Lahir:</span> <span className="text-slate-900">{new Date(item.birthDate).toLocaleDateString('id-ID', { dateStyle: 'long' })}</span></p>
                                            <p className="flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Terakhir Update:</span> <span className="text-slate-500">{new Date(item.updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span></p>
                                        </div>

                                        <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
                                            <Button
                                                variant="outline"
                                                disabled={viewingKtpUserId === item.userId}
                                                onClick={() => void handleOpenKtp(item.userId)}
                                                className="h-9 rounded-lg border-slate-200/80 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-indigo-50/50 hover:text-indigo-600 hover:border-indigo-200/60 shadow-xs transition-all shrink-0"
                                            >
                                                {viewingKtpUserId === item.userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                                Lihat KTP
                                            </Button>
                                            <Input
                                                placeholder="Alasan reject (opsional)"
                                                value={reasons[item.userId] ?? ''}
                                                onChange={(e) => setReasons((prev) => ({ ...prev, [item.userId]: e.target.value }))}
                                                className="h-9 rounded-lg border-slate-200/80 bg-white/50 focus:bg-white text-xs"
                                            />
                                            <Button
                                                disabled={submittingUserId === item.userId}
                                                onClick={() => void handleReview(item.userId, 'APPROVED')}
                                                className="h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 transition-all shrink-0 gap-1"
                                            >
                                                {submittingUserId === item.userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                                Approve
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                disabled={submittingUserId === item.userId}
                                                onClick={() => void handleReview(item.userId, 'REJECTED')}
                                                className="h-9 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-600/10 hover:shadow-red-600/20 transition-all shrink-0 gap-1"
                                            >
                                                {submittingUserId === item.userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                                Reject
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
