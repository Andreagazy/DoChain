'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShieldCheck, Mail, Lock, CheckCircle2 } from 'lucide-react';
import OtpRequestForm from '@/components/auth/otp-request-form';
import OtpVerifyForm from '@/components/auth/otp-verify-form';
import CompleteRegistrationForm from '@/components/auth/complete-registration-form';

type RegistrationStep = 'request-otp' | 'verify-otp' | 'complete-registration';

const STEPS = [
  { id: 'request-otp', label: 'Minta Kode OTP', desc: 'Verifikasi email Anda', icon: Mail },
  { id: 'verify-otp', label: 'Verifikasi Email', desc: 'Masukkan kode OTP', icon: Lock },
  { id: 'complete-registration', label: 'Data Mahasiswa', desc: 'Lengkapi profil dan password', icon: ShieldCheck },
] as const;

export default function RegisterPage() {
  const [step, setStep] = useState<RegistrationStep>('request-otp');
  const [email, setEmail] = useState('');

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  const handleOtpRequested = (requestedEmail: string) => {
    setEmail(requestedEmail);
    setStep('verify-otp');
  };

  const handleOtpVerified = () => setStep('complete-registration');

  const handleBack = () => {
    if (step === 'verify-otp') setStep('request-otp');
    else if (step === 'complete-registration') setStep('verify-otp');
  };

  return (
    <div className="flex min-h-screen">

      {/* ── Left Panel ── */}
      <aside className="hidden w-[420px] xl:w-[480px] shrink-0 flex-col bg-blue-600 lg:flex">
        {/* Logo */}
        <div className="flex items-center gap-3 px-10 pt-10">
          <div className="flex h-9 w-9 items-center justify-center">
            <img src="/image/docchain-logo.png" alt="DOCChain" className="h-9 w-9 object-contain" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">DOCChain</p>
            <p className="text-[11px] text-blue-200">Sistem Sertifikasi Digital</p>
          </div>
        </div>

        {/* Headline */}
        <div className="flex flex-1 flex-col justify-center px-10">
          <h1 className="text-3xl font-extrabold leading-tight text-white">
            Buat Akun DOCChain Anda
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-blue-100">
            Register publik hanya untuk mahasiswa. Role pegawai, admin prodi, kaprodi, kajur, dan superadmin dibuat melalui panel admin.
          </p>

          {/* Step indicator */}
          <div className="mt-10 space-y-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = s.id === step;
              const isDone = i < currentStepIndex;

              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 rounded-xl p-4 transition-all duration-200
                    ${isActive ? 'bg-white/20' : isDone ? 'bg-white/10' : 'bg-white/5 opacity-60'}
                  `}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors
                    ${isActive ? 'bg-white text-blue-600' : isDone ? 'bg-white/30 text-white' : 'bg-white/15 text-white/60'}
                  `}>
                    {isDone
                      ? <CheckCircle2 className="h-4 w-4" />
                      : <Icon className="h-4 w-4" />
                    }
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-blue-100'}`}>
                      {i + 1}. {s.label}
                    </p>
                    <p className="text-xs text-blue-200">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <p className="px-10 pb-8 text-xs text-blue-300">
          © 2026 DOCChain · Hyperledger Besu + IPFS
        </p>
      </aside>

      {/* ── Right Panel — Form ── */}
      <main className="flex flex-1 flex-col bg-gray-50">
        {/* Top bar: back button + step counter */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-8 py-4">
          <div>
            {step !== 'request-otp' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg px-3"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </Button>
            ) : (
              <div className="flex items-center gap-2 lg:hidden">
                <div className="flex h-7 w-7 items-center justify-center">
                  <img src="/image/docchain-logo.png" alt="DOCChain" className="h-7 w-7 object-contain" />
                </div>
                <span className="text-sm font-bold text-gray-900">DOCChain</span>
              </div>
            )}
          </div>

          {/* Step dots */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`h-2 rounded-full transition-all duration-300
                  ${s.id === step ? 'w-6 bg-blue-600' : i < currentStepIndex ? 'w-2 bg-blue-400' : 'w-2 bg-gray-300'}
                `}
              />
            ))}
            <span className="ml-2 text-xs font-medium text-gray-400">
              {currentStepIndex + 1} / {STEPS.length}
            </span>
          </div>
        </div>

        {/* Form area */}
        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-12">
          <div className="w-full max-w-2xl">
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              {step === 'request-otp' && <OtpRequestForm onOtpRequested={handleOtpRequested} />}
              {step === 'verify-otp' && <OtpVerifyForm email={email} onOtpVerified={handleOtpVerified} />}
              {step === 'complete-registration' && <CompleteRegistrationForm email={email} />}
            </div>

            <p className="mt-5 text-center text-sm text-gray-500">
              Sudah punya akun?{' '}
              <a href="/login" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                Masuk
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
