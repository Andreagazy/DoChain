'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Cloud, FileUp, PenLine, PencilRuler, ScanText } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getIpfsStatus } from '@/lib/auth-service';
import type { IpfsStatusResponse } from '@/types/auth';
import { buildCertificationStepHref } from '../../lib/certification-flow';

const STEPS = [
    {
        key: 'upload',
        title: 'Upload dokumen',
        description: 'Mulai dari drag and drop PDF, lalu lanjut ke langkah berikutnya.',
        icon: FileUp,
    },
    {
        key: 'signers',
        title: 'Pilih signer',
        description: 'Atur urutan user lain atau diri sendiri yang akan sign.',
        icon: ScanText,
    },
    {
        key: 'placeholders',
        title: 'Atur placeholder',
        description: 'Tempatkan posisi tanda tangan untuk signer yang visible.',
        icon: PencilRuler,
    },
    {
        key: 'review',
        title: 'Review dan sign',
        description: 'Cek ulang konfigurasi lalu lanjut ke penandatanganan.',
        icon: PenLine,
    },
] as const;

export default function CertificationPage() {
    const [ipfsStatus, setIpfsStatus] = useState<IpfsStatusResponse | null>(null);

    const stepLinks = useMemo(
        () => STEPS.map((step) => ({ ...step, href: buildCertificationStepHref(step.key) })),
        [],
    );

    useEffect(() => {
        let cancelled = false;

        async function loadIpfsStatus() {
            try {
                const status = await getIpfsStatus();
                if (!cancelled) {
                    setIpfsStatus(status);
                }
            } catch {
                if (!cancelled) {
                    setIpfsStatus(null);
                }
            }
        }

        void loadIpfsStatus();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <AppShell title="Sertifikasi" subtitle="Upload PDF, pilih signer, lalu selesaikan tanda tangan.">
            <div className="space-y-6">
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <Badge variant="default">Alur Sertifikasi</Badge>
                            <h1 className="mt-3 max-w-3xl text-2xl font-semibold leading-tight text-slate-950">
                                Selesaikan dokumen dari upload sampai final signed.
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                                Mulai dari dokumen baru, atau buka daftar dokumen yang perlu kamu tanda tangani.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button asChild>
                                <Link href={buildCertificationStepHref('upload')}>
                                    Mulai Sertifikasi
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                            <Button variant="outline" className="border-slate-300" asChild>
                                <Link href="/certification/assigned">Perlu Ditandatangani</Link>
                            </Button>
                        </div>
                    </div>

                    <div className="mt-5 flex max-w-xl items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <Cloud className={ipfsStatus?.connected ? 'h-4 w-4 text-emerald-700' : 'h-4 w-4 text-amber-700'} />
                        <div className="min-w-0">
                            <p className="font-medium text-slate-900">
                                IPFS {ipfsStatus?.connected ? 'terhubung' : ipfsStatus?.configured === false ? 'belum dikonfigurasi' : 'belum terhubung'}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                                {ipfsStatus?.connected
                                    ? `Gateway siap: ${ipfsStatus.gatewayUrl ?? '-'}`
                                    : ipfsStatus?.error ?? 'Status IPFS belum tersedia'}
                            </p>
                        </div>
                    </div>
                </section>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    {stepLinks.map((step) => {
                        const Icon = step.icon;

                        return (
                            <Link
                                key={step.key}
                                href={step.href}
                                className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-4 transition last:border-b-0 hover:bg-slate-50"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-950">{step.title}</p>
                                        <p className="truncate text-sm text-slate-500">{step.description}</p>
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                            </Link>
                        );
                    })}
                </div>
            </div>
        </AppShell>
    );
}
