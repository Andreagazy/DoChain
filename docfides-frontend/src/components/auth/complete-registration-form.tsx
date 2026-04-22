'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { register, saveAuthData } from '@/lib/auth-service';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';

type ApiError = {
    message?: string | string[];
};

interface CompleteRegistrationFormProps {
    email: string;
}

export default function CompleteRegistrationForm({
    email,
}: CompleteRegistrationFormProps) {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const validateForm = (): boolean => {
        if (!password) {
            setError('Password tidak boleh kosong');
            return false;
        }

        if (password.length < 8) {
            setError('Password harus minimal 8 karakter');
            return false;
        }

        if (!confirmPassword) {
            setError('Konfirmasi password tidak boleh kosong');
            return false;
        }

        if (password !== confirmPassword) {
            setError('Password dan konfirmasi tidak cocok');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
            });

            // Save auth data
            saveAuthData(response.access_token, response.user);

            // Redirect to dashboard
            router.push('/dashboard');
        } catch (err: unknown) {
            const error = err as AxiosError<ApiError>;
            const responseMessage = error.response?.data?.message;
            const normalizedMessage = Array.isArray(responseMessage)
                ? responseMessage.join(', ')
                : responseMessage;
            setError(normalizedMessage ?? error.message ?? 'Registrasi gagal. Silakan coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Buat Password
                </CardTitle>
                <CardDescription>
                    Lanjutkan registrasi untuk akun <br />
                    <span className="font-semibold text-foreground">{email}</span>
                </CardDescription>
            </CardHeader>

            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Error Alert */}
                    {error && (
                        <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-800 dark:text-red-300">
                                {error}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Email Display (read-only) */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Email</label>
                        <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900">
                            <Mail className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                {email}
                            </span>
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="space-y-2">
                        <label htmlFor="password" className="text-sm font-medium">
                            Password
                        </label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Minimal 8 karakter"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                {showPassword ? (
                                    <EyeOff className="w-4 h-4" />
                                ) : (
                                    <Eye className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            Minimal 8 karakter dengan kombinasi huruf, angka, dan simbol
                        </p>
                    </div>

                    {/* Confirm Password Input */}
                    <div className="space-y-2">
                        <label htmlFor="confirmPassword" className="text-sm font-medium">
                            Konfirmasi Password
                        </label>
                        <div className="relative">
                            <Input
                                id="confirmPassword"
                                type={showConfirmPassword ? 'text' : 'password'}
                                placeholder="Ulangi password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={loading}
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                {showConfirmPassword ? (
                                    <EyeOff className="w-4 h-4" />
                                ) : (
                                    <Eye className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        disabled={loading || !password || !confirmPassword}
                        className="w-full"
                        size="lg"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {loading ? 'Mendaftar...' : 'Selesaikan Registrasi'}
                    </Button>

                    {/* Login Link */}
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                        Sudah punya akun?{' '}
                        <Link
                            href="/login"
                            className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                            Masuk di sini
                        </Link>
                    </p>
                </form>
            </CardContent>
        </Card>
    );
}
