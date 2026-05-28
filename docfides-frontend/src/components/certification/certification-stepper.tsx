'use client';

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { buildCertificationStepHref, getCertificationStepIndex, type CertificationStepKey } from '@/lib/certification-flow';

const STEPS: Array<{
    key: CertificationStepKey;
    label: string;
    description: string;
}> = [
    {
        key: 'upload',
        label: 'Upload',
        description: 'Mulai dari unggah PDF',
    },
    {
        key: 'signers',
        label: 'Signer',
        description: 'Pilih urutan penandatangan',
    },
    {
        key: 'placeholders',
        label: 'Placeholder',
        description: 'Atur posisi visible signature',
    },
    {
        key: 'review',
        label: 'Review',
        description: 'Tinjau lalu sign',
    },
];

interface CertificationStepperProps {
    currentStep: CertificationStepKey;
    documentId?: string;
}

export function CertificationStepper({ currentStep, documentId }: CertificationStepperProps) {
    const currentIndex = getCertificationStepIndex(currentStep);

    return (
        <nav className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm" aria-label="Langkah sertifikasi">
            <ol className="grid gap-2 md:grid-cols-4">
            {STEPS.map((step, index) => {
                const isActive = step.key === currentStep;
                const isCompleted = index < currentIndex;

                return (
                    <li key={step.key}>
                        <Link
                            href={buildCertificationStepHref(step.key, step.key === 'upload' ? undefined : documentId)}
                            className={`flex h-full items-center gap-3 rounded-md px-3 py-2.5 transition ${
                                isActive
                                    ? 'bg-blue-50 text-blue-700'
                                    : isCompleted
                                      ? 'text-emerald-700 hover:bg-emerald-50'
                                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                            }`}
                        >
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                                isActive
                                    ? 'bg-blue-600 text-white'
                                    : isCompleted
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-slate-100 text-slate-600'
                            }`}>
                                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold">{step.label}</span>
                                <span className="block truncate text-xs opacity-80">{step.description}</span>
                            </span>
                        </Link>
                    </li>
                );
            })}
            </ol>
        </nav>
    );
}
