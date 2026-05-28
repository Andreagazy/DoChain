'use client';

import { useState, useRef } from 'react';
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
import {
    Loader2,
    AlertCircle,
    Lock,
} from 'lucide-react';
import { verifyOtp } from '@/lib/auth-service';
import { AxiosError } from 'axios';

type ApiError = {
    message?: string | string[];
};

interface OtpVerifyFormProps {
    email: string;
    onOtpVerified: () => void;
}

export default function OtpVerifyForm({
    email,
    onOtpVerified,
}: OtpVerifyFormProps) {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
    const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

    // Handle OTP input
    const handleOtpChange = (index: number, value: string) => {
        // Only allow numbers
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-move to next input
        if (value.length === 1 && index < 5) {
            otpInputs.current[index + 1]?.focus();
        }
    };

    // Handle backspace
    const handleKeyDown = (
        index: number,
        e: React.KeyboardEvent<HTMLInputElement>,
    ) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpInputs.current[index - 1]?.focus();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const otpCode = otp.join('');

        if (otpCode.length !== 6) {
            setError('Silakan masukkan 6 digit kode OTP');
            return;
        }

        setLoading(true);

        try {
            await verifyOtp({
                email,
                otp: otpCode,
            });

            // Success - pass OTP code to callback
            onOtpVerified();
        } catch (err: unknown) {
            const error = err as AxiosError<ApiError>;
            const responseMessage = error.response?.data?.message;
            const normalizedMessage = Array.isArray(responseMessage)
                ? responseMessage.join(', ')
                : responseMessage;
            const errorMessage = normalizedMessage ?? error.message ?? 'Verifikasi gagal. Silakan coba lagi.';
            setError(errorMessage);

            // Extract remaining attempts
            const match = errorMessage.match(/(\d+)/);
            if (match) {
                setRemainingAttempts(parseInt(match[0]));
            }

            // Clear OTP inputs on error
            setOtp(['', '', '', '', '', '']);
            otpInputs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-none bg-transparent shadow-none w-full max-w-md">
            <CardHeader className="px-0 pt-0 pb-6">
                <CardTitle className="text-3xl font-extrabold tracking-tight text-slate-900">
                    Verifikasi Email
                </CardTitle>
                <CardDescription className="text-slate-500 mt-1">
                    Masukkan 6 digit kode keamanan yang telah dikirimkan ke <span className="font-bold text-indigo-600 break-all">{email}</span>
                </CardDescription>
            </CardHeader>

            <CardContent className="px-0">
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Error Alert */}
                    {error && (
                        <Alert className="border-red-200 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-800 font-medium text-xs">
                                {error}
                                {remainingAttempts && (
                                    <p className="mt-1 text-[11px] font-bold text-red-700">
                                        Sisa percobaan: {remainingAttempts} kali
                                    </p>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* OTP Input */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Kode Keamanan OTP</label>
                        <div className="flex gap-2 justify-center">
                            {otp.map((digit, index) => (
                                <Input
                                    key={index}
                                    ref={(el) => {
                                        otpInputs.current[index] = el;
                                    }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleOtpChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    disabled={loading}
                                    className="w-12 h-12 text-center text-xl font-extrabold border-slate-200 bg-white/70 backdrop-blur-sm rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="•"
                                />
                            ))}
                        </div>
                    </div>

                    {/* Info Text Box */}
                    <div className="rounded-xl border border-indigo-50/60 bg-indigo-50/20 p-3 text-center text-xs text-slate-500">
                        <p className="font-medium">⏱️ Batas maksimal: 5 kali percobaan</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">Jika salah 5 kali berturut-turut, akun akan terkunci selama 30 menit demi alasan keamanan.</p>
                    </div>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        disabled={loading || otp.join('').length !== 6}
                        className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold shadow-lg shadow-indigo-600/20 transition-all duration-300 disabled:opacity-50 mt-2"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {loading ? 'Memverifikasi...' : 'Verifikasi & Lanjutkan'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
