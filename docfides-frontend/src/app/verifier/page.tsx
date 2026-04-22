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
    getUser,
    listPendingIdentities,
    logout,
    reviewIdentity,
} from '@/lib/auth-service';
import type { PendingIdentityItem } from '@/types/auth';

type ApiError = {
    message?: string | string[];
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function VerifierPage() {
    const router = useRouter();
    const [items, setItems] = useState<PendingIdentityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submittingUserId, setSubmittingUserId] = useState<string | null>(null);
    const [reasons, setReasons] = useState<Record<string, string>>({});
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const canAccess = useMemo(() => {
        const user = getUser();
        return user?.role === 'VERIFIER' || user?.role === 'ADMIN';
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

    if (!canAccess) {
        return null;
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-slate-100 text-slate-900">
            <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-semibold">Verifier Review Identitas</h1>
                        <p className="text-slate-600 text-sm mt-1">Review data KTP yang berstatus PENDING untuk membuka gate sertifikasi user.</p>
                    </div>
                    <Button variant="outline" className="border-slate-300" onClick={() => router.push('/dashboard')}>
                        Kembali ke Dashboard
                    </Button>
                </div>

                {error && (
                    <Alert className="border-red-200 bg-red-50 text-red-800">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {success && (
                    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>{success}</AlertDescription>
                    </Alert>
                )}

                <Card className="border-slate-200 bg-white/90 shadow-sm">
                    <CardHeader>
                        <CardTitle>Daftar Pending ({items.length})</CardTitle>
                        <CardDescription className="text-slate-600">
                            Endpoint backend: GET /identity/pending dan PATCH /identity/:userId/review.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="py-10 flex items-center justify-center text-slate-600 gap-2">
                                <Loader2 className="animate-spin" />
                                <span>Memuat data pending...</span>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="py-10 text-center text-slate-600">Tidak ada data PENDING saat ini.</div>
                        ) : (
                            <div className="space-y-4">
                                {items.map((item) => (
                                    <div key={item.userId} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                            <p><span className="text-slate-500">User ID:</span> {item.userId}</p>
                                            <p><span className="text-slate-500">NIK:</span> {item.nik}</p>
                                            <p><span className="text-slate-500">Nama:</span> {item.fullName}</p>
                                            <p><span className="text-slate-500">Tanggal Lahir:</span> {new Date(item.birthDate).toLocaleDateString()}</p>
                                            <p><span className="text-slate-500">Updated:</span> {new Date(item.updatedAt).toLocaleString()}</p>
                                        </div>

                                        <div className="mt-4 flex flex-col md:flex-row gap-3">
                                            <a
                                                href={`${apiBaseUrl}/identity/${item.userId}/ktp`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
                                            >
                                                Lihat KTP
                                            </a>
                                            <Input
                                                placeholder="Alasan reject (opsional)"
                                                value={reasons[item.userId] ?? ''}
                                                onChange={(e) => setReasons((prev) => ({ ...prev, [item.userId]: e.target.value }))}
                                            />
                                            <Button
                                                disabled={submittingUserId === item.userId}
                                                onClick={() => void handleReview(item.userId, 'APPROVED')}
                                            >
                                                {submittingUserId === item.userId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                Approve
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                disabled={submittingUserId === item.userId}
                                                onClick={() => void handleReview(item.userId, 'REJECTED')}
                                            >
                                                {submittingUserId === item.userId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
