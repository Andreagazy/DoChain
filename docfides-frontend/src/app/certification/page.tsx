'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, FileUp, PenLine, PencilRuler, ScanText } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { buildCertificationStepHref } from '../../lib/certification-flow';

const STEPS = [
    {
        key: 'upload',
        title: 'Upload Dokumen',
        description: 'Unggah PDF baru atau lanjutkan dokumen draft yang sudah ada.',
        icon: FileUp,
    },
    {
        key: 'signers',
        title: 'Pilih Signer',
        description: 'Tentukan penandatangan sesuai urutan akademik dari level rendah ke tinggi.',
        icon: ScanText,
    },
    {
        key: 'placeholders',
        title: 'Atur Placeholder',
        description: 'Tempatkan area tanda tangan visible untuk setiap signer.',
        icon: PencilRuler,
    },
    {
        key: 'review',
        title: 'Review dan Sign',
        description: 'Tinjau signer, lalu mulai proses tanda tangan. QR ditempatkan otomatis.',
        icon: PenLine,
    },
] as const;

export default function CertificationPage() {
    const stepLinks = useMemo(
        () => STEPS.map((step) => ({ ...step, href: buildCertificationStepHref(step.key) })),
        [],
    );

    return (
        <AppShell title="Sertifikasi" subtitle="Kelola alur sertifikasi dokumen digital dari upload sampai final.">
            <div className="space-y-6">
                <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6 shadow-sm md:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="max-w-3xl">
                            <Badge className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700 hover:bg-white">
                                Alur Sertifikasi DOCChain
                            </Badge>
                            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                                Sertifikasi dokumen dengan tanda tangan bertingkat.
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                                Mulai dari upload PDF, pilih signer, tentukan posisi tanda tangan, lalu selesaikan tanda tangan digital. QR verifikasi ditempatkan otomatis oleh sistem.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Button asChild className="h-11 rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700">
                                <Link href={buildCertificationStepHref('upload')}>
                                    Mulai Sertifikasi
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                            <Button variant="outline" className="h-11 rounded-xl border-blue-200 bg-white font-semibold text-blue-700 hover:bg-blue-50" asChild>
                                <Link href="/certification/assigned">Perlu Ditandatangani</Link>
                            </Button>
                        </div>
                    </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {stepLinks.map((step, index) => {
                        const Icon = step.icon;

                        return (
                            <Card key={step.key} className="rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-100 hover:shadow-md">
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500">
                                            {index + 1}
                                        </span>
                                    </div>
                                    <h2 className="mt-4 text-lg font-bold text-slate-950">{step.title}</h2>
                                    <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{step.description}</p>
                                    <Button asChild variant="outline" className="mt-4 w-full rounded-xl border-slate-200 bg-white font-semibold hover:bg-blue-50 hover:text-blue-700">
                                        <Link href={step.href}>
                                            Buka Langkah
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </section>
            </div>
        </AppShell>
    );
}
