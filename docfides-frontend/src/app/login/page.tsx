'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { login, saveAuthData } from '@/lib/auth-service';
import Link from 'next/link';
import { AxiosError } from 'axios';

type ApiError = {
  message?: string | string[];
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!email || !password) {
      setError('Email dan password tidak boleh kosong');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Format email tidak valid');
      return;
    }

    setLoading(true);

    try {
      const response = await login({ email, password });

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
      setError(normalizedMessage ?? error.message ?? 'Login gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="hidden rounded-2xl bg-slate-900 p-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">DoChain Platform</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight"></h1>
            
          </div>
          <div className="space-y-2 text-sm text-slate-300">
           
          </div>
        </section>

        <section className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-8">
          <div className="w-full max-w-md">
            <Card className="border-none shadow-none">
              <CardHeader className="px-0">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Lock className="h-5 w-5" />
                  Sign In
                </CardTitle>
                <CardDescription>Use your email and password to access your workspace.</CardDescription>
              </CardHeader>

              <CardContent className="px-0">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium text-slate-700">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        className="pl-10 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" disabled={loading || !email || !password} className="w-full" size="lg">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>

                  <p className="text-center text-sm text-slate-600">
                    Don&apos;t have an account?{' '}
                    <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
                      Register
                    </Link>
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
