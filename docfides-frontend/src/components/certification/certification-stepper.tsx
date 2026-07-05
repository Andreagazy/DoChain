'use client';

import { CheckCircle2, ClipboardCheck, MapPinned, UploadCloud, Users } from 'lucide-react';
import { getCertificationStepIndex, type CertificationStepKey } from '@/lib/certification-flow';

const STEPS: Array<{
    key: CertificationStepKey;
    label: string;
    description: string;
    icon: typeof UploadCloud;
}> = [
    {
        key: 'upload',
        label: 'Upload',
        description: 'Mulai dari unggah PDF',
        icon: UploadCloud,
    },
    {
        key: 'signers',
        label: 'Signer',
        description: 'Pilih urutan penandatangan',
        icon: Users,
    },
    {
        key: 'placeholders',
        label: 'Placeholder',
        description: 'Atur posisi visible signature',
        icon: MapPinned,
    },
    {
        key: 'review',
        label: 'Review',
        description: 'Tinjau lalu sign',
        icon: ClipboardCheck,
    },
];

interface CertificationStepperProps {
    currentStep: CertificationStepKey;
    documentId?: string;
}

export function CertificationStepper({ currentStep, documentId }: CertificationStepperProps) {
    const currentIndex = getCertificationStepIndex(currentStep);
    void documentId;

    return (
        <nav className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm" aria-label="Langkah sertifikasi">
            <ol className="grid gap-2 md:grid-cols-4">
            {STEPS.map((step, index) => {
                const isActive = step.key === currentStep;
                const isCompleted = index < currentIndex;
                const Icon = step.icon;

                return (
                    <li key={step.key}>
                        <div
                            aria-current={isActive ? 'step' : undefined}
                            className={`flex h-full cursor-default items-center gap-3 rounded-xl border px-3 py-3 ${
                                isActive
                                    ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                                    : isCompleted
                                      ? 'border-emerald-100 bg-emerald-50/70 text-emerald-700'
                                      : 'border-slate-100 bg-slate-50/70 text-slate-600'
                            }`}
                        >
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${
                                isActive
                                    ? 'bg-blue-600 text-white'
                                    : isCompleted
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-slate-100 text-slate-600'
                            }`}>
                                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                            </span>
                            <span className="min-w-0">
                                <span className="block text-[11px] font-bold uppercase tracking-wide opacity-70">Langkah {index + 1}</span>
                                <span className="block text-sm font-semibold">{step.label}</span>
                                <span className="block truncate text-xs opacity-80">{step.description}</span>
                            </span>
                        </div>
                    </li>
                );
            })}
            </ol>
        </nav>
    );
}
