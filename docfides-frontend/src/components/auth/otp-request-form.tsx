'use client';

import { useState } from 'react';
import Link from 'next/link';
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
import { Loader2, AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { requestOtp } from '@/lib/auth-service';
import { normalizeErrorMessage } from '@/lib/certification-flow';

interface OtpRequestFormProps {
    onOtpRequested: (email: string) => void;
}

export default function OtpRequestForm({ onOtpRequested }: OtpRequestFormProps) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [cooldownMinutes, setCooldownMinutes] = useState(0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        const normalizedEmail = email.trim().toLowerCase();

        // Validation
        if (!normalizedEmail) {
            setError('Email tidak boleh kosong');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            setError('Format email tidak valid');
            return;
        }

        setLoading(true);

        try {
            const response = await requestOtp({ email: normalizedEmail });
            setSuccess(true);

            // Extract cooldown time from message if available
            const match = response.message.match(/(\d+)\s*menit/);
            if (match) {
                setCooldownMinutes(parseInt(match[1]));
            }

            // Call onOtpRequested callback with email
            onOtpRequested(normalizedEmail);
            setEmail('');
        } catch (err: unknown) {
            setError(normalizeErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-none bg-transparent shadow-none w-full max-w-md">
            <CardHeader className="px-0 pt-0 pb-6">
                <CardTitle className="text-3xl font-extrabold tracking-tight text-slate-900">
                    Buat Akun Baru
                </CardTitle>
                <CardDescription className="text-slate-500 mt-1">
                    Masukkan email aktif Anda untuk memulai proses pendaftaran platform DOCChain.
                </CardDescription>
            </CardHeader>

            <CardContent className="px-0">
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Success Alert */}
                    {success && (
                        <Alert className="border-emerald-200 bg-emerald-50/80 backdrop-blur-sm rounded-xl shadow-sm">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <AlertDescription className="text-emerald-800 font-medium text-xs">
                                Kode OTP telah dikirim ke email Anda. Silakan cek inbox atau folder spam.
                                {cooldownMinutes > 0 && ` Tunggu ${cooldownMinutes} menit sebelum meminta kode baru.`}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Error Alert */}
                    {error && (
                        <Alert className="border-red-200 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-800 font-medium text-xs">
                                {error}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Email Input */}
                    <div className="space-y-1.5">
                        <label htmlFor="email" className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            Email
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                className="pl-10 h-11 border-slate-200 bg-white/70 backdrop-blur-sm rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        disabled={loading || !email}
                        className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold shadow-lg shadow-indigo-600/20 transition-all duration-300 disabled:opacity-50 mt-2"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {loading ? 'Mengirim OTP...' : 'Minta Kode OTP'}
                    </Button>

                    <p className="text-center text-sm text-slate-500 mt-4">
                        Sudah memiliki akun?{' '}
                        <Link href="/login" className="font-bold text-indigo-600 hover:text-indigo-500 transition-colors">
                            Masuk di sini
                        </Link>
                    </p>
                </form>
            </CardContent>
        </Card>
    );
}
