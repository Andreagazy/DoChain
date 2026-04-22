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
        <Card className="w-full max-w-md">
            <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Verifikasi Kode OTP
                </CardTitle>
                <CardDescription>
                    Masukkan 6 digit kode yang telah dikirim ke <br />
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
                                {remainingAttempts && (
                                    <p className="mt-1 text-xs">
                                        Sisa percobaan: {remainingAttempts}
                                    </p>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* OTP Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Kode OTP</label>
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
                                    className="w-12 h-12 text-center text-lg font-bold"
                                    placeholder="•"
                                />
                            ))}
                        </div>
                    </div>

                    {/* Info Text */}
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        ⏱️ Batas maksimal: 5 percobaan
                        <br />
                        🔒 Jika gagal 5x, akun akan terkunci 30 menit
                    </p>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        disabled={loading || otp.join('').length !== 6}
                        className="w-full"
                        size="lg"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {loading ? 'Memverifikasi...' : 'Verifikasi'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
