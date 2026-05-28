'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, UserCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { changePassword, getProfile, getUser, saveAuthData } from '@/lib/auth-service';
import { normalizeErrorMessage } from '@/lib/certification-flow';
import type { User } from '@/types/auth';

export default function ProfilePage() {
    const router = useRouter();
    const [profile, setProfile] = useState<User | null>(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(true);
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
                const response = await getProfile();
                setProfile(response);
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
    const initial = (profile?.displayName || profile?.email || 'U').charAt(0).toUpperCase();

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
                                {profile?.displayName || 'Nama belum diatur'}
                            </h1>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <Badge className="bg-white/15 text-white hover:bg-white/20">{profile?.role?.replace(/_/g, ' ')}</Badge>
                                <Badge className="bg-white/15 text-white hover:bg-white/20">
                                    Identitas: {profile?.identityStatus ?? 'BELUM ADA'}
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
                                <InfoItem label="Nama Tampilan" value={profile?.displayName ?? '-'} />
                                <InfoItem label="Status Identitas" value={profile?.identityStatus ?? 'BELUM ADA'} />
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                            <CardHeader>
                                <CardTitle>Profil Kampus</CardTitle>
                                <CardDescription>Data akademik atau pegawai yang melekat pada akun.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3 sm:grid-cols-2">
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
                                    <p className="text-sm text-slate-500 sm:col-span-2">Belum ada profil kampus pada akun ini.</p>
                                )}
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
