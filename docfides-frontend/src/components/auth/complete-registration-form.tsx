'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';
import { AlertCircle, Eye, EyeOff, GraduationCap, Hash, Loader2, Lock, Mail, User } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getRegisterOptions, register, saveAuthData } from '@/lib/auth-service';
import type { RegisterOptionsResponse } from '@/types/auth';

type ApiError = {
    message?: string | string[];
};

interface CompleteRegistrationFormProps {
    email: string;
}

const onlyDigits = (value: string) => value.replace(/\D/g, '');
const currentYear = new Date().getFullYear();

export default function CompleteRegistrationForm({ email }: CompleteRegistrationFormProps) {
    const router = useRouter();
    const [options, setOptions] = useState<RegisterOptionsResponse>({ prodi: [] });
    const [displayName, setDisplayName] = useState('');
    const [nim, setNim] = useState('');
    const [prodiId, setProdiId] = useState('');
    const [angkatan, setAngkatan] = useState('');
    const [kelas, setKelas] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingOptions, setLoadingOptions] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function loadOptions() {
            try {
                const response = await getRegisterOptions();
                setOptions(response);
                setProdiId(response.prodi[0]?.id ?? '');
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoadingOptions(false);
            }
        }

        void loadOptions();
    }, []);

    const normalizeErrorMessage = (err: unknown) => {
        const error = err as AxiosError<ApiError>;
        const responseMessage = error.response?.data?.message;
        return Array.isArray(responseMessage)
            ? responseMessage.join(', ')
            : responseMessage ?? error.message ?? 'Registrasi gagal. Silakan coba lagi.';
    };

    const validateForm = (): boolean => {
        if (displayName.trim().length < 2) {
            setError('Nama lengkap wajib diisi minimal 2 karakter.');
            return false;
        }

        if (!nim || nim.length < 5) {
            setError('NIM wajib diisi dengan angka.');
            return false;
        }

        if (!prodiId) {
            setError('Pilih program studi terlebih dahulu.');
            return false;
        }

        if (angkatan) {
            const year = Number(angkatan);
            if (Number.isNaN(year) || year < 2000 || year > currentYear + 1) {
                setError(`Angkatan harus antara 2000 sampai ${currentYear + 1}.`);
                return false;
            }
        }

        if (!password) {
            setError('Password tidak boleh kosong.');
            return false;
        }

        if (password.length < 8) {
            setError('Password harus minimal 8 karakter.');
            return false;
        }

        if (password !== confirmPassword) {
            setError('Password dan konfirmasi tidak cocok.');
            return false;
        }

        return true;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            const response = await register({
                email,
                password,
                confirmPassword,
                displayName: displayName.trim(),
                nim,
                prodiId,
                ...(angkatan && { angkatan: Number(angkatan) }),
                ...(kelas.trim() && { kelas: kelas.trim().toUpperCase() }),
            });

            saveAuthData(response.access_token, response.user);
            router.push('/dashboard');
        } catch (err: unknown) {
            setError(normalizeErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="w-full border-none bg-transparent shadow-none">
            <CardHeader className="px-0 pt-0 pb-6">
                <CardTitle className="text-3xl font-extrabold tracking-tight text-slate-900">
                    Daftar Mahasiswa
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">
                    Register publik hanya untuk mahasiswa. Role dosen, admin prodi, kaprodi, kajur, dan superadmin dibuat oleh admin sistem.
                </CardDescription>
            </CardHeader>

            <CardContent className="px-0">
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error ? (
                        <Alert className="rounded-xl border-red-200 bg-red-50/80 shadow-sm">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-xs font-medium text-red-800">
                                {error}
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Email Terverifikasi</label>
                        <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5">
                            <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="truncate text-sm font-semibold text-slate-700">{email}</span>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Nama Lengkap</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    value={displayName}
                                    onChange={(event) => setDisplayName(event.target.value)}
                                    disabled={loading}
                                    placeholder="Nama sesuai data kampus"
                                    className="h-11 rounded-xl border-slate-200 bg-white/70 pl-10"
                                    maxLength={100}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">NIM</label>
                            <div className="relative">
                                <Hash className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    value={nim}
                                    onChange={(event) => setNim(onlyDigits(event.target.value).slice(0, 30))}
                                    disabled={loading}
                                    placeholder="Contoh: 2241720001"
                                    inputMode="numeric"
                                    className="h-11 rounded-xl border-slate-200 bg-white/70 pl-10"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Program Studi</label>
                            <div className="relative">
                                <GraduationCap className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <select
                                    value={prodiId}
                                    onChange={(event) => setProdiId(event.target.value)}
                                    disabled={loading || loadingOptions}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white/70 pl-10 pr-3 text-sm font-medium text-slate-700 shadow-xs outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {loadingOptions ? (
                                        <option>Memuat prodi...</option>
                                    ) : options.prodi.length === 0 ? (
                                        <option value="">Belum ada prodi aktif</option>
                                    ) : (
                                        options.prodi.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.code} - {item.name}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Angkatan</label>
                            <Input
                                value={angkatan}
                                onChange={(event) => setAngkatan(onlyDigits(event.target.value).slice(0, 4))}
                                disabled={loading}
                                placeholder={`Contoh: ${currentYear}`}
                                inputMode="numeric"
                                className="h-11 rounded-xl border-slate-200 bg-white/70"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">Kelas</label>
                            <Input
                                value={kelas}
                                onChange={(event) => setKelas(event.target.value.slice(0, 20))}
                                disabled={loading}
                                placeholder="Contoh: TI-4A"
                                className="h-11 rounded-xl border-slate-200 bg-white/70"
                            />
                        </div>

                        <PasswordField
                            id="password"
                            label="Kata Sandi Baru"
                            value={password}
                            visible={showPassword}
                            disabled={loading}
                            onChange={setPassword}
                            onToggle={() => setShowPassword((current) => !current)}
                        />

                        <PasswordField
                            id="confirmPassword"
                            label="Ulangi Kata Sandi"
                            value={confirmPassword}
                            visible={showConfirmPassword}
                            disabled={loading}
                            onChange={setConfirmPassword}
                            onToggle={() => setShowConfirmPassword((current) => !current)}
                        />
                    </div>

                    <p className="text-[10px] font-medium leading-normal text-slate-400">
                        Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, dan angka.
                    </p>

                    <Button
                        type="submit"
                        disabled={loading || loadingOptions || !password || !confirmPassword || !displayName || !nim || !prodiId}
                        className="mt-2 h-11 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all duration-300 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {loading ? 'Menyimpan Akun...' : 'Selesaikan Registrasi Mahasiswa'}
                    </Button>

                    <p className="mt-4 text-center text-sm text-slate-500">
                        Sudah memiliki akun?{' '}
                        <Link href="/login" className="font-bold text-indigo-600 transition-colors hover:text-indigo-500">
                            Masuk di sini
                        </Link>
                    </p>
                </form>
            </CardContent>
        </Card>
    );
}

function PasswordField({
    id,
    label,
    value,
    visible,
    disabled,
    onChange,
    onToggle,
}: {
    id: string;
    label: string;
    value: string;
    visible: boolean;
    disabled: boolean;
    onChange: (value: string) => void;
    onToggle: () => void;
}) {
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                {label}
            </label>
            <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    placeholder="Minimal 8 karakter"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    disabled={disabled}
                    className="h-11 rounded-xl border-slate-200 bg-white/70 pl-10 pr-10"
                />
                <button
                    type="button"
                    onClick={onToggle}
                    className="absolute right-3 top-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-indigo-600"
                    aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                    {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
            </div>
        </div>
    );
}
