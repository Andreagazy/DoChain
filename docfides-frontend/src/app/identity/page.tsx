'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { AlertCircle, ArrowRight, CheckCircle2, FileText, IdCard, Loader2, UploadCloud } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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

const today = new Date().toISOString().slice(0, 10);

const onlyDigits = (value: string) => value.replace(/\D/g, '');
const onlyLettersAndSpaces = (value: string) => value.replace(/[^\p{L}\s]/gu, '');
const onlyNameCharacters = (value: string) => value.replace(/[^\p{L}\s.'-]/gu, '');

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

    const statusVariant = status === 'APPROVED'
        ? 'success'
        : status === 'REJECTED'
            ? 'destructive'
            : status === 'PENDING'
                ? 'warning'
                : 'neutral';
    const formLocked = status === 'PENDING';

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

        if (formLocked) {
            setError('Data identitas sedang menunggu review. Form akan terbuka kembali setelah admin approve atau reject.');
            return;
        }

        if (!form.nik || !form.fullName || !form.birthPlace || !form.birthDate || !form.address) {
            setError('Mohon lengkapi semua field wajib.');
            return;
        }

        if (form.nik.length !== 16) {
            setError('NIK harus berisi tepat 16 digit angka.');
            return;
        }

        if (form.birthDate > today) {
            setError('Tanggal lahir tidak boleh melebihi tanggal hari ini.');
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
            <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9]">
                <div className="flex items-center gap-2 text-slate-600">
                    <Loader2 className="animate-spin" />
                    <span>Memuat data identitas...</span>
                </div>
            </div>
        );
    }

    return (
        <AppShell title="Identity" subtitle="Verifikasi KTP untuk membuka akses sertifikasi dokumen.">
            <div className="space-y-6">
                <section className="rounded-lg border border-blue-100 bg-white p-6 shadow-sm md:p-8">
                        <Badge variant={statusVariant}>{status}</Badge>
                        <h1 className="mt-4 text-2xl font-semibold text-slate-950 md:text-3xl">Verifikasi identitas pemilik akun</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                            Lengkapi data KTP agar fitur sertifikasi dokumen bisa digunakan.
                        </p>
                </section>

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

                {formLocked && (
                    <Alert className="border-amber-200 bg-amber-50 text-amber-800">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Identitas sedang menunggu verifikasi. Form dikunci sementara sampai superadmin atau admin prodi melakukan approve/reject.
                        </AlertDescription>
                    </Alert>
                )}

                <Card className="rounded-lg border-blue-100 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><IdCard className="h-5 w-5" /> Form Data KTP</CardTitle>
                        <CardDescription className="text-slate-600">
                            Isi data sesuai KTP. NIK hanya angka 16 digit, nama dan tempat lahir mengikuti teks pada KTP, lalu unggah foto KTP yang jelas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmitIdentity} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">NIK KTP</label>
                                <p className="text-xs text-slate-500">Masukkan 16 digit angka tanpa spasi atau tanda baca.</p>
                                <Input
                                    placeholder="Contoh: 3504020101990001"
                                    value={form.nik}
                                    onChange={(e) => setForm((prev) => ({ ...prev, nik: onlyDigits(e.target.value).slice(0, 16) }))}
                                    maxLength={16}
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    disabled={formLocked}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">Nama lengkap</label>
                                <p className="text-xs text-slate-500">Isi sesuai nama pada KTP. Angka otomatis diabaikan.</p>
                                <Input
                                    placeholder="Contoh: Andi Saputra"
                                    value={form.fullName}
                                    onChange={(e) => setForm((prev) => ({ ...prev, fullName: onlyNameCharacters(e.target.value) }))}
                                    maxLength={150}
                                    disabled={formLocked}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">Tempat lahir</label>
                                <p className="text-xs text-slate-500">Wajib diisi dengan huruf saja, tanpa angka.</p>
                                <Input
                                    placeholder="Contoh: Malang"
                                    value={form.birthPlace}
                                    onChange={(e) => setForm((prev) => ({ ...prev, birthPlace: onlyLettersAndSpaces(e.target.value) }))}
                                    maxLength={100}
                                    disabled={formLocked}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-700">Tanggal lahir</label>
                                <p className="text-xs text-slate-500">Pilih tanggal lahir sesuai KTP.</p>
                                <Input
                                    type="date"
                                    value={form.birthDate}
                                    max={today}
                                    onChange={(e) => setForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                                    disabled={formLocked}
                                />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-xs font-semibold text-slate-700">Alamat sesuai KTP</label>
                                <p className="text-xs text-slate-500">Tuliskan alamat lengkap sesuai KTP, termasuk RT/RW, kelurahan, kecamatan, dan kota/kabupaten jika ada.</p>
                                <textarea
                                    className="min-h-28 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-xs outline-none focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                                    rows={4}
                                    placeholder="Contoh: Jl. Mawar No. 10, RT 01/RW 02, Lowokwaru, Malang"
                                    value={form.address}
                                    maxLength={500}
                                    onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value.slice(0, 500) }))}
                                    disabled={formLocked}
                                />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <UploadCloud className="h-4 w-4" />
                                    Upload KTP (jpg/png, max 3MB)
                                </label>
                                <p className="text-xs text-slate-500">Gunakan foto KTP asli yang jelas dan tidak terpotong. Untuk submit pertama kali, file KTP wajib diunggah.</p>
                                <Input
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg"
                                    disabled={formLocked}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] ?? null;
                                        if (file && file.size > 3 * 1024 * 1024) {
                                            setError('Ukuran file KTP maksimal 3MB.');
                                            e.target.value = '';
                                            setKtpFile(null);
                                            return;
                                        }
                                        setError('');
                                        setKtpFile(file);
                                    }}
                                />
                                {profile?.ktpOriginalFileName && (
                                    <p className="text-xs text-slate-500">File tersimpan: {profile.ktpOriginalFileName}</p>
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <Button type="submit" disabled={submitting || formLocked}>
                                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {formLocked ? 'Menunggu Review Admin' : profile?.identityExists ? 'Update & Submit Ulang' : 'Submit Identitas'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card className="rounded-lg border-blue-100 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Lanjutan Sertifikasi</CardTitle>
                        <CardDescription className="text-slate-600">{statusCaption}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button
                            disabled={status !== 'APPROVED'}
                            onClick={() => router.push('/signature-setup?next=/certification')}
                        >
                            Lanjut Setup Tanda Tangan
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                        {status !== 'APPROVED' && (
                            <p className="text-xs text-slate-500">Tombol aktif setelah status identitas APPROVED.</p>
                        )}
                    </CardContent>
                </Card>


            </div>
        </AppShell>
    );
}
