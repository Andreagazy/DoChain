'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Eye, EyeOff, IdCard, Loader2, LockKeyhole, UploadCloud, UserCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    changePassword,
    getIdentityProfile,
    getIdentityStatus,
    getProfile,
    getRegisterOptions,
    getUser,
    requestAcademicProfileChange,
    saveAuthData,
    submitIdentity,
} from '@/lib/auth-service';
import { normalizeErrorMessage } from '@/lib/certification-flow';
import type { IdentityProfileResponse, IdentityStatus, RegisterOptionsResponse, SubmitIdentityDto, User } from '@/types/auth';

const today = new Date().toISOString().slice(0, 10);

const onlyDigits = (value: string) => value.replace(/\D/g, '');
const onlyLettersAndSpaces = (value: string) => value.replace(/[^\p{L}\s]/gu, '');
const onlyNameCharacters = (value: string) => value.replace(/[^\p{L}\s.'-]/gu, '');

const identityStatusLabels: Record<IdentityStatus, string> = {
    NOT_SUBMITTED: 'Belum Mengajukan',
    PENDING: 'Menunggu Verifikasi',
    APPROVED: 'Terverifikasi',
    REJECTED: 'Ditolak',
};

const getIdentityStatusLabel = (status?: IdentityStatus | null) =>
    status ? identityStatusLabels[status] ?? status : 'Belum Mengajukan';

export default function ProfilePage() {
    const router = useRouter();
    const [profile, setProfile] = useState<User | null>(null);
    const [identityProfile, setIdentityProfile] = useState<IdentityProfileResponse | null>(null);
    const [identityStatus, setIdentityStatus] = useState<IdentityStatus>('NOT_SUBMITTED');
    const [prodiOptions, setProdiOptions] = useState<RegisterOptionsResponse['prodi']>([]);
    const [academicForm, setAcademicForm] = useState({
        nim: '',
        prodiId: '',
        angkatan: '',
        kelas: '',
    });
    const [identityForm, setIdentityForm] = useState<SubmitIdentityDto>({
        nik: '',
        fullName: '',
        birthPlace: '',
        birthDate: '',
        address: '',
    });
    const [ktpFile, setKtpFile] = useState<File | null>(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submittingIdentity, setSubmittingIdentity] = useState(false);
    const [submittingAcademic, setSubmittingAcademic] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        async function loadProfile() {
            const storedUser = getUser();
            if (!storedUser) {
                router.replace('/login');
                return;
            }

            try {
                const [response, identity, status, registerOptions] = await Promise.all([
                    getProfile(),
                    getIdentityProfile(),
                    getIdentityStatus(),
                    getRegisterOptions(),
                ]);
                setProfile(response);
                setIdentityProfile(identity);
                setIdentityStatus(status.status);
                setProdiOptions(registerOptions.prodi);
                setAcademicForm({
                    nim: response.pendingAcademicProfileChangeRequest?.nim ?? response.academicProfile?.identifier ?? '',
                    prodiId: response.pendingAcademicProfileChangeRequest?.prodi.id ?? response.academicProfile?.unitId ?? '',
                    angkatan: response.pendingAcademicProfileChangeRequest?.angkatan
                        ? String(response.pendingAcademicProfileChangeRequest.angkatan)
                        : response.academicProfile?.angkatan
                            ? String(response.academicProfile.angkatan)
                            : '',
                    kelas: response.pendingAcademicProfileChangeRequest?.kelas ?? response.academicProfile?.kelas ?? '',
                });
                if (identity.identityExists) {
                    setIdentityForm({
                        nik: identity.pendingChangeRequest?.nik ?? identity.nik ?? '',
                        fullName: identity.pendingChangeRequest?.fullName ?? identity.fullName ?? '',
                        birthPlace: identity.pendingChangeRequest?.birthPlace ?? identity.birthPlace ?? '',
                        birthDate: identity.pendingChangeRequest?.birthDate
                            ? new Date(identity.pendingChangeRequest.birthDate).toISOString().slice(0, 10)
                            : identity.birthDate
                                ? new Date(identity.birthDate).toISOString().slice(0, 10)
                                : '',
                        address: identity.pendingChangeRequest?.address ?? identity.address ?? '',
                    });
                }
                const token = localStorage.getItem('token');
                if (token) {
                    saveAuthData(token, response);
                }
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }

        void loadProfile();
    }, [router]);

    const refreshIdentity = async () => {
        const [identity, status] = await Promise.all([
            getIdentityProfile(),
            getIdentityStatus(),
        ]);
        setIdentityProfile(identity);
        setIdentityStatus(status.status);
        if (identity.identityExists) {
            setIdentityForm({
                nik: identity.pendingChangeRequest?.nik ?? identity.nik ?? '',
                fullName: identity.pendingChangeRequest?.fullName ?? identity.fullName ?? '',
                birthPlace: identity.pendingChangeRequest?.birthPlace ?? identity.birthPlace ?? '',
                birthDate: identity.pendingChangeRequest?.birthDate
                    ? new Date(identity.pendingChangeRequest.birthDate).toISOString().slice(0, 10)
                    : identity.birthDate
                        ? new Date(identity.birthDate).toISOString().slice(0, 10)
                        : '',
                address: identity.pendingChangeRequest?.address ?? identity.address ?? '',
            });
        }
    };

    const handleSubmitIdentity = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        if (identityStatus === 'PENDING' || identityProfile?.pendingChangeRequest) {
            setError('Data identitas sedang menunggu review admin.');
            return;
        }

        if (!identityForm.nik || !identityForm.fullName || !identityForm.birthPlace || !identityForm.birthDate || !identityForm.address) {
            setError('Mohon lengkapi semua field identitas wajib.');
            return;
        }

        if (identityForm.nik.length !== 16) {
            setError('NIK harus berisi tepat 16 digit angka.');
            return;
        }

        if (identityForm.birthDate > today) {
            setError('Tanggal lahir tidak boleh melebihi tanggal hari ini.');
            return;
        }

        if (!identityProfile?.identityExists && !ktpFile) {
            setError('Upload file KTP wajib untuk submit identitas pertama kali.');
            return;
        }

        setSubmittingIdentity(true);
        try {
            const result = await submitIdentity(identityForm, ktpFile ?? undefined);
            setSuccess(result.message);
            setKtpFile(null);
            await refreshIdentity();
            const response = await getProfile();
            setProfile(response);
            const token = localStorage.getItem('token');
            if (token) {
                saveAuthData(token, response);
            }
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setSubmittingIdentity(false);
        }
    };

    const handleSubmitAcademicChange = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        if (profile?.role !== 'MAHASISWA') {
            setError('Pengajuan perubahan profil akademik mandiri hanya tersedia untuk mahasiswa.');
            return;
        }

        if (profile.pendingAcademicProfileChangeRequest) {
            setError('Masih ada request perubahan profil akademik yang menunggu review admin.');
            return;
        }

        if (!academicForm.nim.trim() || !academicForm.prodiId) {
            setError('NIM dan program studi wajib diisi.');
            return;
        }

        const angkatan = academicForm.angkatan ? Number(academicForm.angkatan) : null;
        if (angkatan !== null && (Number.isNaN(angkatan) || angkatan < 1900)) {
            setError('Angkatan tidak valid.');
            return;
        }

        setSubmittingAcademic(true);
        try {
            const result = await requestAcademicProfileChange({
                nim: academicForm.nim.trim(),
                prodiId: academicForm.prodiId,
                angkatan,
                kelas: academicForm.kelas.trim() || null,
            });
            setSuccess(result.message);
            const response = await getProfile();
            setProfile(response);
            setAcademicForm({
                nim: response.pendingAcademicProfileChangeRequest?.nim ?? response.academicProfile?.identifier ?? '',
                prodiId: response.pendingAcademicProfileChangeRequest?.prodi.id ?? response.academicProfile?.unitId ?? '',
                angkatan: response.pendingAcademicProfileChangeRequest?.angkatan
                    ? String(response.pendingAcademicProfileChangeRequest.angkatan)
                    : response.academicProfile?.angkatan
                        ? String(response.academicProfile.angkatan)
                        : '',
                kelas: response.pendingAcademicProfileChangeRequest?.kelas ?? response.academicProfile?.kelas ?? '',
            });
            const token = localStorage.getItem('token');
            if (token) {
                saveAuthData(token, response);
            }
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setSubmittingAcademic(false);
        }
    };

    const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword !== confirmPassword) {
            setError('Password baru dan konfirmasi tidak cocok');
            return;
        }

        setSavingPassword(true);
        try {
            const result = await changePassword({
                currentPassword,
                newPassword,
                confirmPassword,
            });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setSuccess(result.message);
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setSavingPassword(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Memuat profil...
            </div>
        );
    }

    const academicProfile = profile?.academicProfile;
    const profileName = identityProfile?.fullName || profile?.identity?.fullName || profile?.displayName || profile?.email || 'User';
    const initial = profileName.charAt(0).toUpperCase();
    const identityFormLocked = identityStatus === 'PENDING' || Boolean(identityProfile?.pendingChangeRequest);
    const academicFormLocked = submittingAcademic || Boolean(profile?.pendingAcademicProfileChangeRequest);
    const identityButtonLabel = identityFormLocked
        ? 'Menunggu Review Admin'
        : identityStatus === 'APPROVED'
            ? 'Ajukan Perubahan Identitas'
            : identityProfile?.identityExists
                ? 'Update & Submit Ulang'
                : 'Submit Identitas';

    return (
        <AppShell title="Profil Saya" subtitle="Lihat data akun dan ubah password login.">
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

                <section className="rounded-2xl bg-blue-600 px-7 py-6 text-white">
                    <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl font-extrabold">
                            {initial}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm text-blue-100">{profile?.email}</p>
                            <h1 className="mt-0.5 truncate text-2xl font-extrabold">
                                {profileName}
                            </h1>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <Badge className="bg-white/15 text-white hover:bg-white/20">{profile?.role?.replace(/_/g, ' ')}</Badge>
                                <Badge className="bg-white/15 text-white hover:bg-white/20">
                                    Identitas: {getIdentityStatusLabel(identityStatus)}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
                    <div className="space-y-5">
                        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <UserCircle className="h-5 w-5 text-blue-600" />
                                    Informasi Akun
                                </CardTitle>
                                <CardDescription>Data utama akun yang digunakan untuk login dan identifikasi role.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3 sm:grid-cols-2">
                                <InfoItem label="Email" value={profile?.email ?? '-'} />
                                <InfoItem label="Role" value={profile?.role?.replace(/_/g, ' ') ?? '-'} />
                                <InfoItem label="Nama KTP" value={identityProfile?.fullName ?? profile?.identity?.fullName ?? '-'} />
                                <InfoItem label="Status Identitas" value={getIdentityStatusLabel(identityStatus)} />
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                            <CardHeader>
                                <CardTitle>Profil Akademik</CardTitle>
                                <CardDescription>Data akademik atau pegawai yang melekat pada akun.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                {academicProfile ? (
                                    <>
                                        <InfoItem label="Tipe" value={academicProfile.type === 'STUDENT' ? 'Mahasiswa' : 'Pegawai'} />
                                        <InfoItem label="Identitas Kampus" value={academicProfile.identifier ?? '-'} />
                                        <InfoItem label="Unit" value={`${academicProfile.unitCode} - ${academicProfile.unitName}`} />
                                        <InfoItem label="Posisi" value={academicProfile.positionTitle ?? academicProfile.employeeType ?? '-'} />
                                        {academicProfile.kelas || academicProfile.angkatan ? (
                                            <InfoItem label="Kelas / Angkatan" value={`${academicProfile.kelas ?? '-'} / ${academicProfile.angkatan ?? '-'}`} />
                                        ) : null}
                                    </>
                                ) : (
                                    <p className="text-sm text-slate-500 sm:col-span-2">Belum ada profil akademik pada akun ini.</p>
                                )}
                                </div>

                                {profile?.role === 'MAHASISWA' ? (
                                    <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                                        {profile.pendingAcademicProfileChangeRequest ? (
                                            <Alert className="border-amber-200 bg-amber-50 text-amber-800">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertDescription>
                                                    Request perubahan profil akademik sedang menunggu review admin prodi atau superadmin.
                                                </AlertDescription>
                                            </Alert>
                                        ) : (
                                            <Alert className="border-blue-200 bg-white text-blue-800">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertDescription>
                                                    Jika NIM, prodi, kelas, atau angkatan salah, ajukan perubahan di sini. Data final baru berubah setelah admin menyetujui.
                                                </AlertDescription>
                                            </Alert>
                                        )}

                                        <form onSubmit={handleSubmitAcademicChange} className="grid gap-3 md:grid-cols-2">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-700">NIM mahasiswa</label>
                                                <Input
                                                    value={academicForm.nim}
                                                    onChange={(event) => setAcademicForm((current) => ({ ...current, nim: event.target.value.replace(/\D/g, '').slice(0, 40) }))}
                                                    placeholder="Masukkan NIM"
                                                    disabled={academicFormLocked}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-700">Program studi</label>
                                                <select
                                                    value={academicForm.prodiId}
                                                    onChange={(event) => setAcademicForm((current) => ({ ...current, prodiId: event.target.value }))}
                                                    disabled={academicFormLocked}
                                                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <option value="">Pilih prodi</option>
                                                    {prodiOptions.map((prodi) => (
                                                        <option key={prodi.id} value={prodi.id}>
                                                            {prodi.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-700">Angkatan</label>
                                                <Input
                                                    value={academicForm.angkatan}
                                                    onChange={(event) => setAcademicForm((current) => ({ ...current, angkatan: event.target.value.replace(/\D/g, '').slice(0, 4) }))}
                                                    placeholder="Contoh: 2021"
                                                    disabled={academicFormLocked}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-700">Kelas</label>
                                                <Input
                                                    value={academicForm.kelas}
                                                    onChange={(event) => setAcademicForm((current) => ({ ...current, kelas: event.target.value.slice(0, 30) }))}
                                                    placeholder="Contoh: TI-4A"
                                                    disabled={academicFormLocked}
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <Button type="submit" disabled={academicFormLocked} className="bg-blue-600 hover:bg-blue-500">
                                                    {submittingAcademic ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                    {profile.pendingAcademicProfileChangeRequest ? 'Menunggu Review Admin' : 'Ajukan Perubahan Profil Akademik'}
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                ) : null}
                            </CardContent>
                        </Card>

                        <Card id="identitas-ktp" className="scroll-mt-24 rounded-2xl border-slate-200 bg-white shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <IdCard className="h-5 w-5 text-blue-600" />
                                    Identitas KTP
                                </CardTitle>
                                <CardDescription>
                                    Data ini digunakan untuk verifikasi identitas dan nama sertifikat. Perubahan pada identitas yang sudah terverifikasi akan menunggu approval admin.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Alert className="border-blue-200 bg-blue-50 text-blue-800">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        Isi data sesuai KTP asli: NIK 16 digit, nama lengkap, tempat lahir, tanggal lahir, alamat, dan foto KTP yang jelas. Data ini harus diverifikasi admin sebelum sertifikasi dokumen dapat digunakan.
                                    </AlertDescription>
                                </Alert>

                                {identityProfile?.pendingChangeRequest ? (
                                    <Alert className="border-amber-200 bg-amber-50 text-amber-800">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            Request perubahan identitas sedang menunggu review admin prodi atau superadmin.
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                                {identityStatus === 'PENDING' ? (
                                    <Alert className="border-amber-200 bg-amber-50 text-amber-800">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            Identitas sedang menunggu verifikasi. Form dikunci sementara sampai admin approve atau reject.
                                        </AlertDescription>
                                    </Alert>
                                ) : null}

                                <form onSubmit={handleSubmitIdentity} className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-700">NIK KTP</label>
                                        <p className="text-xs text-slate-500">Masukkan 16 digit angka tanpa spasi atau tanda baca.</p>
                                        <Input
                                            placeholder="Contoh: 3504020101990001"
                                            value={identityForm.nik}
                                            onChange={(event) => setIdentityForm((prev) => ({ ...prev, nik: onlyDigits(event.target.value).slice(0, 16) }))}
                                            maxLength={16}
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            disabled={identityFormLocked}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-700">Nama lengkap sesuai KTP</label>
                                        <p className="text-xs text-slate-500">Nama ini dipakai sebagai nama sertifikat.</p>
                                        <Input
                                            placeholder="Contoh: Andi Saputra"
                                            value={identityForm.fullName}
                                            onChange={(event) => setIdentityForm((prev) => ({ ...prev, fullName: onlyNameCharacters(event.target.value) }))}
                                            maxLength={150}
                                            disabled={identityFormLocked}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-700">Tempat lahir</label>
                                        <p className="text-xs text-slate-500">Wajib huruf saja, tanpa angka.</p>
                                        <Input
                                            placeholder="Contoh: Malang"
                                            value={identityForm.birthPlace}
                                            onChange={(event) => setIdentityForm((prev) => ({ ...prev, birthPlace: onlyLettersAndSpaces(event.target.value) }))}
                                            maxLength={100}
                                            disabled={identityFormLocked}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-700">Tanggal lahir</label>
                                        <p className="text-xs text-slate-500">Pilih tanggal lahir sesuai KTP.</p>
                                        <Input
                                            type="date"
                                            value={identityForm.birthDate}
                                            max={today}
                                            onChange={(event) => setIdentityForm((prev) => ({ ...prev, birthDate: event.target.value }))}
                                            disabled={identityFormLocked}
                                        />
                                    </div>
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-xs font-semibold text-slate-700">Alamat sesuai KTP</label>
                                        <p className="text-xs text-slate-500">Tuliskan alamat lengkap sesuai KTP.</p>
                                        <textarea
                                            className="min-h-28 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-xs outline-none focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                                            rows={4}
                                            placeholder="Contoh: Jl. Mawar No. 10, RT 01/RW 02, Lowokwaru, Malang"
                                            value={identityForm.address}
                                            maxLength={500}
                                            onChange={(event) => setIdentityForm((prev) => ({ ...prev, address: event.target.value.slice(0, 500) }))}
                                            disabled={identityFormLocked}
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                            <UploadCloud className="h-4 w-4" />
                                            Upload KTP (jpg/png, max 3MB)
                                        </label>
                                        <p className="text-xs text-slate-500">
                                            Submit pertama wajib mengunggah KTP. Untuk request perubahan, upload ulang jika foto KTP juga perlu diganti.
                                        </p>
                                        <Input
                                            type="file"
                                            accept="image/png,image/jpeg,image/jpg"
                                            disabled={identityFormLocked}
                                            onChange={(event) => {
                                                const file = event.target.files?.[0] ?? null;
                                                if (file && file.size > 3 * 1024 * 1024) {
                                                    setError('Ukuran file KTP maksimal 3MB.');
                                                    event.target.value = '';
                                                    setKtpFile(null);
                                                    return;
                                                }
                                                setError('');
                                                setKtpFile(file);
                                            }}
                                        />
                                        {identityProfile?.pendingChangeRequest?.ktpOriginalFileName ? (
                                            <p className="text-xs text-amber-700">File request: {identityProfile.pendingChangeRequest.ktpOriginalFileName}</p>
                                        ) : identityProfile?.ktpOriginalFileName ? (
                                            <p className="text-xs text-slate-500">File tersimpan: {identityProfile.ktpOriginalFileName}</p>
                                        ) : null}
                                    </div>
                                    <div className="md:col-span-2">
                                        <Button type="submit" disabled={submittingIdentity || identityFormLocked} className="bg-blue-600 hover:bg-blue-500">
                                            {submittingIdentity ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            {identityButtonLabel}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                    </div>

                    <div>
                        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <LockKeyhole className="h-5 w-5 text-blue-600" />
                                    Ganti Password
                                </CardTitle>
                                <CardDescription>Gunakan password minimal 8 karakter.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form className="space-y-4" onSubmit={handleChangePassword}>
                                    <PasswordInput label="Password lama" value={currentPassword} onChange={setCurrentPassword} visible={showPassword} />
                                    <PasswordInput label="Password baru" value={newPassword} onChange={setNewPassword} visible={showPassword} />
                                    <PasswordInput label="Konfirmasi password baru" value={confirmPassword} onChange={setConfirmPassword} visible={showPassword} />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full border-slate-300"
                                        onClick={() => setShowPassword((current) => !current)}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        {showPassword ? 'Sembunyikan Password' : 'Tampilkan Password'}
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="w-full bg-blue-600 hover:bg-blue-500"
                                        disabled={savingPassword || !currentPassword || newPassword.length < 8 || !confirmPassword}
                                    >
                                        {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                        Ganti Password
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

function InfoItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
        </div>
    );
}

function PasswordInput({
    label,
    value,
    onChange,
    visible,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    visible: boolean;
}) {
    return (
        <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">{label}</label>
            <Input
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={label}
                autoComplete="current-password"
            />
        </div>
    );
}
