'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import OtpRequestForm from '@/components/auth/otp-request-form';
import OtpVerifyForm from '@/components/auth/otp-verify-form';
import CompleteRegistrationForm from '@/components/auth/complete-registration-form';

type RegistrationStep = 'request-otp' | 'verify-otp' | 'complete-registration';

export default function RegisterPage() {
  const [step, setStep] = useState<RegistrationStep>('request-otp');
  const [email, setEmail] = useState('');

  const handleOtpRequested = (requestedEmail: string) => {
    setEmail(requestedEmail);
    setStep('verify-otp');
  };

  const handleOtpVerified = () => {
    setStep('complete-registration');
  };

  const handleBack = () => {
    if (step === 'verify-otp') {
      setStep('request-otp');
    } else if (step === 'complete-registration') {
      setStep('verify-otp');
    }
  };

  const getTitle = () => {
    switch (step) {
      case 'request-otp':
        return 'Buat Akun Baru';
      case 'verify-otp':
        return 'Verifikasi Email';
      case 'complete-registration':
        return 'Lengkapi Registrasi';
    }
  };

  const getDescription = () => {
    switch (step) {
      case 'request-otp':
        return 'Masukkan email Anda untuk memulai proses registrasi';
      case 'verify-otp':
        return `Kami telah mengirim kode OTP ke ${email}`;
      case 'complete-registration':
        return 'Buat password untuk menyelesaikan registrasi';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm lg:block">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Create Workspace Account</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900">Build trust from first upload to final signature</h1>
          <p className="mt-4 max-w-md text-sm text-slate-600">
            Registration in DoChain uses OTP verification first, then secure password setup to keep your workflow protected.
          </p>

          <div className="mt-8 space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Request OTP to validate email ownership.</div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Verify OTP and proceed to account setup.</div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Complete registration and access dashboard.</div>
          </div>
        </section>

        <section className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-8">
          <div className="w-full max-w-md">
            <Card className="border-none shadow-none">
              <CardHeader className="px-0">
                <div className="flex items-center gap-4">
                  {step !== 'request-otp' && (
                    <Button variant="ghost" size="icon" onClick={handleBack} className="hover:bg-slate-100">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <div className="flex-1">
                    <CardTitle>{getTitle()}</CardTitle>
                    <CardDescription>{getDescription()}</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-0">
                {step === 'request-otp' && <OtpRequestForm onOtpRequested={handleOtpRequested} />}
                {step === 'verify-otp' && <OtpVerifyForm email={email} onOtpVerified={handleOtpVerified} />}
                {step === 'complete-registration' && <CompleteRegistrationForm email={email} />}
              </CardContent>
            </Card>

            <div className="mt-6 flex justify-center gap-2">
              <div className={`h-2 w-12 rounded-full transition-colors ${step === 'request-otp' ? 'bg-blue-500' : 'bg-slate-300'}`} />
              <div className={`h-2 w-12 rounded-full transition-colors ${step === 'verify-otp' ? 'bg-blue-500' : 'bg-slate-300'}`} />
              <div className={`h-2 w-12 rounded-full transition-colors ${step === 'complete-registration' ? 'bg-blue-500' : 'bg-slate-300'}`} />
            </div>

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
