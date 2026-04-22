'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { AlertCircle, CheckCircle2, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    getIdentityProfile,
    getIdentityStatus,
    logout,
    submitIdentity,
} from '@/lib/auth-service';
import type { IdentityProfileResponse, IdentityStatus, SubmitIdentityDto } from '@/types/auth';

type ApiError = {
    message?: string | string[];
};

export default function IdentityPage() {
    const router = useRouter();
    const [profile, setProfile] = useState<IdentityProfileResponse | null>(null);
    const [status, setStatus] = useState<IdentityStatus>('NOT_SUBMITTED');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [ktpFile, setKtpFile] = useState<File | null>(null);

    const [form, setForm] = useState<SubmitIdentityDto>({
        nik: '',
        fullName: '',
        birthPlace: '',
        birthDate: '',
        address: '',
    });

    const statusCaption = useMemo(() => {
        switch (status) {
            case 'NOT_SUBMITTED':
                return 'Identitas belum disubmit. Sertifikasi dokumen masih terkunci.';
            case 'PENDING':
                return 'Data identitas sudah masuk dan sedang direview verifier.';
            case 'APPROVED':
                return 'Identitas sudah disetujui. Lanjutkan ke setup tanda tangan sebelum sertifikasi dokumen.';
            case 'REJECTED':
                return 'Identitas ditolak. Silakan perbarui data dan submit ulang.';
            default:
                return '';
        }
    }, [status]);

    useEffect(() => {
        async function loadData() {
            try {
                const [identityProfile, identityStatus] = await Promise.all([
                    getIdentityProfile(),
                    getIdentityStatus(),
                ]);
                setProfile(identityProfile);
                setStatus(identityStatus.status);

                if (identityProfile.identityExists) {
                    setForm({
                        nik: identityProfile.nik ?? '',
                        fullName: identityProfile.fullName ?? '',
                        birthPlace: identityProfile.birthPlace ?? '',
                        birthDate: identityProfile.birthDate
                            ? new Date(identityProfile.birthDate).toISOString().slice(0, 10)
                            : '',
                        address: identityProfile.address ?? '',
                    });
                }
            } catch {
                logout();
                router.push('/login');
            } finally {
                setLoading(false);
            }
        }

        void loadData();
    }, [router]);

    const normalizeErrorMessage = (err: unknown): string => {
        const axiosError = err as AxiosError<ApiError>;
        const responseMessage = axiosError.response?.data?.message;
        return Array.isArray(responseMessage)
            ? responseMessage.join(', ')
            : responseMessage ?? axiosError.message ?? 'Terjadi kesalahan';
    };

    const handleSubmitIdentity = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        if (!form.nik || !form.fullName || !form.birthDate || !form.address) {
            setError('Mohon lengkapi semua field wajib.');
            return;
        }

        if (!profile?.identityExists && !ktpFile) {
            setError('Upload file KTP wajib untuk submit pertama kali.');
            return;
        }

        setSubmitting(true);
        try {
            const result = await submitIdentity(form, ktpFile ?? undefined);
            setSuccess(result.message);
            const [identityProfile, identityStatus] = await Promise.all([
                getIdentityProfile(),
                getIdentityStatus(),
            ]);
            setProfile(identityProfile);
            setStatus(identityStatus.status);
            setKtpFile(null);

            if (identityStatus.status === 'APPROVED') {
                router.push('/signature-setup?next=/certification');
            }
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
                <div className="flex items-center gap-2 text-slate-600">
                    <Loader2 className="animate-spin" />
                    <span>Memuat data identitas...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-slate-100 text-slate-900">
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-semibold">Verifikasi Identitas</h1>
                        <p className="text-slate-600 text-sm mt-1">Lengkapi data KTP agar fitur sertifikasi dokumen terbuka.</p>
                    </div>
                    <Button variant="outline" className="border-slate-300" onClick={() => router.push('/dashboard')}>
                        Kembali ke Dashboard
                    </Button>
                </div>

                {/* <Card className="border-slate-200 bg-white/90 shadow-sm">
                    <CardHeader>
                        <CardTitle>Status Verifikasi</CardTitle>
                        <CardDescription className="text-slate-600">Status ini dipakai untuk gate akses endpoint sertifikasi.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="inline-flex px-3 py-1 rounded-full text-xs font-semibold tracking-wide border border-slate-200">
                            <span className={`px-2 py-1 rounded ${statusColorMap[status]}`}>{status}</span>
                        </div>
                        <p className="text-sm text-slate-700">{statusCaption}</p>
                        {profile?.ktpUploadedAt && (
                            <p className="text-xs text-slate-500">
                                Metadata KTP: {profile.ktpOriginalFileName ?? '-'} ({profile.ktpMimeType ?? '-'})
                            </p>
                        )}
                    </CardContent>
                </Card> */}

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
                        <CardTitle>Form Data KTP</CardTitle>
                        <CardDescription className="text-slate-600">Untuk status REJECTED, perbaiki data lalu submit ulang.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmitIdentity} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                placeholder="NIK (16 digit)"
                                value={form.nik}
                                onChange={(e) => setForm((prev) => ({ ...prev, nik: e.target.value }))}
                                maxLength={16}
                            />
                            <Input
                                placeholder="Nama lengkap"
                                value={form.fullName}
                                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                            />
                            <Input
                                placeholder="Tempat lahir (opsional)"
                                value={form.birthPlace ?? ''}
                                onChange={(e) => setForm((prev) => ({ ...prev, birthPlace: e.target.value }))}
                            />
                            <Input
                                type="date"
                                value={form.birthDate}
                                onChange={(e) => setForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                            />
                            <textarea
                                className="md:col-span-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                rows={4}
                                placeholder="Alamat sesuai KTP"
                                value={form.address}
                                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                            />
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-sm text-slate-700">Upload KTP (jpg/png, max 3MB)</label>
                                <Input
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg"
                                    onChange={(e) => setKtpFile(e.target.files?.[0] ?? null)}
                                />
                                {profile?.ktpOriginalFileName && (
                                    <p className="text-xs text-slate-500">File tersimpan: {profile.ktpOriginalFileName}</p>
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <Button type="submit" disabled={submitting}>
                                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {profile?.identityExists ? 'Update & Submit Ulang' : 'Submit Identitas'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white/90 shadow-sm">
                    <CardHeader>
                        <CardTitle>Lanjutan Sertifikasi</CardTitle>
                        <CardDescription className="text-slate-600">{statusCaption}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button
                            disabled={status !== 'APPROVED'}
                            onClick={() => router.push('/signature-setup?next=/certification')}
                        >
                            Lanjut Setup Tanda Tangan
                        </Button>
                        {status !== 'APPROVED' && (
                            <p className="text-xs text-slate-500">Tombol aktif setelah status identitas APPROVED.</p>
                        )}
                    </CardContent>
                </Card>


            </div>
        </div>
    );
}
