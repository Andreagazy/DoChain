'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AxiosError } from 'axios';
import { AlertCircle, CheckCircle2, Loader2, PenLine } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getIdentityStatus, getSignatureStatus, uploadSignatureImage } from '@/lib/auth-service';

type ApiError = {
    message?: string | string[];
};

const PREFERRED_SIGNATURE_MODE_KEY = 'preferredSignatureMode';

function normalizeErrorMessage(err: unknown): string {
    const axiosError = err as AxiosError<ApiError>;
    const message = axiosError.response?.data?.message;
    return Array.isArray(message)
        ? message.join(', ')
        : message ?? axiosError.message ?? 'Terjadi kesalahan';
}

function SignatureSetupContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [identityApproved, setIdentityApproved] = useState(false);
    const [mode, setMode] = useState<'invisible' | 'visible'>('invisible');
    const [signatureFile, setSignatureFile] = useState<File | null>(null);
    const [hasSignature, setHasSignature] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        async function loadStatus() {
            try {
                const [identityStatus, signatureStatus] = await Promise.all([
                    getIdentityStatus(),
                    getSignatureStatus(),
                ]);

                setIdentityApproved(identityStatus.status === 'APPROVED');
                setHasSignature(signatureStatus.hasSignature);

                if (typeof window !== 'undefined') {
                    const storedMode = localStorage.getItem(PREFERRED_SIGNATURE_MODE_KEY);
                    if (storedMode === 'visible' || storedMode === 'invisible') {
                        setMode(storedMode);
                    }
                }
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }

        void loadStatus();
    }, []);

    const nextPath = useMemo(() => searchParams.get('next') ?? '/certification', [searchParams]);

    const handleSave = async () => {
        setError('');
        setSuccess('');

        if (!identityApproved) {
            setError('Identitas harus APPROVED sebelum setup tanda tangan.');
            return;
        }

        if (mode === 'visible' && !hasSignature && !signatureFile) {
            setError('Untuk mode visible, upload gambar tanda tangan terlebih dahulu.');
            return;
        }

        setSaving(true);
        try {
            if (mode === 'visible' && signatureFile) {
                await uploadSignatureImage(signatureFile);
                setHasSignature(true);
            }

            if (typeof window !== 'undefined') {
                localStorage.setItem(PREFERRED_SIGNATURE_MODE_KEY, mode);
            }

            setSuccess('Setup tanda tangan berhasil disimpan.');
            router.push(nextPath);
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
                <div className="flex items-center gap-2 text-slate-600">
                    <Loader2 className="animate-spin" />
                    <span>Memuat setup tanda tangan...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-slate-100 text-slate-900">
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold">Setup Tanda Tangan</h1>
                        <p className="text-sm text-slate-600 mt-1">Pilih mode default sebelum masuk ke proses sertifikasi dokumen.</p>
                    </div>
                    <Button variant="outline" className="border-slate-300" onClick={() => router.push('/dashboard')}>
                        Dashboard
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

                {!identityApproved && (
                    <Card className="border-amber-200 bg-amber-50">
                        <CardHeader>
                            <CardTitle className="text-amber-900">Identitas Belum APPROVED</CardTitle>
                            <CardDescription className="text-amber-800">
                                Anda perlu menyelesaikan verifikasi identitas terlebih dahulu.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => router.push('/identity')}>Ke Verifikasi Identitas</Button>
                        </CardContent>
                    </Card>
                )}

                <Card className="border-slate-200 bg-white/90 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><PenLine className="h-5 w-5" /> Pilihan Mode</CardTitle>
                        <CardDescription>
                            Invisible: langsung sign tanpa gambar. Visible: wajib punya gambar tanda tangan.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setMode('invisible')}
                                className={`rounded-lg border px-4 py-3 text-left ${mode === 'invisible' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}
                            >
                                <p className="font-semibold text-slate-900">Invisible Signature</p>
                                <p className="text-xs text-slate-600 mt-1">Tidak perlu upload gambar tanda tangan.</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('visible')}
                                className={`rounded-lg border px-4 py-3 text-left ${mode === 'visible' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}
                            >
                                <p className="font-semibold text-slate-900">Visible Signature</p>
                                <p className="text-xs text-slate-600 mt-1">Gunakan gambar tanda tangan di PDF.</p>
                            </button>
                        </div>

                        {mode === 'visible' && (
                            <div className="space-y-2">
                                <label className="text-sm text-slate-700">Upload tanda tangan (png/jpg)</label>
                                <Input
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg"
                                    onChange={(event) => setSignatureFile(event.target.files?.[0] ?? null)}
                                />
                                {hasSignature && !signatureFile && (
                                    <p className="text-xs text-emerald-700">Tanda tangan tersimpan sudah ada, Anda bisa langsung lanjut.</p>
                                )}
                            </div>
                        )}

                        <Button disabled={saving || !identityApproved} onClick={handleSave}>
                            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Simpan & Lanjutkan
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function SignatureSetupPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-slate-100" />}>
            <SignatureSetupContent />
        </Suspense>
    );
}
