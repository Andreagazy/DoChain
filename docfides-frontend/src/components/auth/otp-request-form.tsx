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
import { Loader2, AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { requestOtp } from '@/lib/auth-service';
import { AxiosError } from 'axios';

type ApiError = {
    message?: string | string[];
};

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

        // Validation
        if (!email) {
            setError('Email tidak boleh kosong');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Format email tidak valid');
            return;
        }

        setLoading(true);

        try {
            const response = await requestOtp({ email });
            setSuccess(true);

            // Extract cooldown time from message if available
            const match = response.message.match(/(\d+)\s*menit/);
            if (match) {
                setCooldownMinutes(parseInt(match[1]));
            }

            // Call onOtpRequested callback with email
            onOtpRequested(email);
            setEmail('');
        } catch (err: unknown) {
            const error = err as AxiosError<ApiError>;
            const responseMessage = error.response?.data?.message;
            const normalizedMessage = Array.isArray(responseMessage)
                ? responseMessage.join(', ')
                : responseMessage;
            setError(normalizedMessage ?? error.message ?? 'Gagal mengirim OTP. Silakan coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Minta Kode OTP
                </CardTitle>
                <CardDescription>
                    Masukkan email Anda untuk menerima kode OTP
                </CardDescription>
            </CardHeader>

            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Success Alert */}
                    {success && (
                        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800 dark:text-green-300">
                                Kode OTP telah dikirim ke email Anda. Silakan cek inbox atau folder spam.
                                {cooldownMinutes > 0 && ` Tunggu ${cooldownMinutes} menit sebelum meminta kode baru.`}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Error Alert */}
                    {error && (
                        <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-800 dark:text-red-300">
                                {error}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Email Input */}
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium">
                            Email
                        </label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="nama@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            className="w-full"
                        />
                    </div>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        disabled={loading || !email}
                        className="w-full"
                        size="lg"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {loading ? 'Mengirim...' : 'Minta Kode OTP'}
                    </Button>

                </form>
            </CardContent>
        </Card>
    );
}
