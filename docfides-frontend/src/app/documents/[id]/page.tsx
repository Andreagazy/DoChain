'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AxiosError } from 'axios';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getCertificationEligibility, getCertificationDocumentFile } from '@/lib/auth-service';
import type { CertificationEligibilityResponse } from '@/types/auth';

function normalizeErrorMessage(err: unknown): string {
    const axiosError = err as AxiosError<{ message?: string | string[] }>;
    const message = axiosError.response?.data?.message;
    return Array.isArray(message) ? message.join(', ') : message ?? axiosError.message ?? 'Terjadi kesalahan';
}

export default function DocumentDetailPage() {
    const params = useParams<{ id: string }>();
    const documentId = params.id;

    const [eligibility, setEligibility] = useState<CertificationEligibilityResponse | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let nextPreviewUrl = '';

        async function loadDetail() {
            setError('');
            try {
                const [eligibilityRes, previewBlob] = await Promise.all([
                    getCertificationEligibility(documentId),
                    getCertificationDocumentFile(documentId),
                ]);

                setEligibility(eligibilityRes);
                nextPreviewUrl = URL.createObjectURL(previewBlob);
                setPreviewUrl(nextPreviewUrl);
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }

        void loadDetail();

        return () => {
            if (nextPreviewUrl) {
                URL.revokeObjectURL(nextPreviewUrl);
            }
        };
    }, [documentId]);

    const timelineItems = useMemo(() => {
        if (!eligibility) {
            return [];
        }

        const status = eligibility.document.status;
        return [
            { label: 'Uploaded', done: true },
            { label: 'Verified', done: status !== 'DRAFT' },
            { label: 'Signed', done: status.includes('SIGNED') || status.includes('APPROVED') },
            { label: 'Completed', done: status === 'FULLY_SIGNED' || status === 'APPROVED' },
        ];
    }, [eligibility]);

    return (
        <AppShell title="Document Detail" subtitle="Preview, certification history, and signature state.">
            <div className="space-y-6">
                {error ? (
                    <Alert className="border-red-200 bg-red-50 text-red-800">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                {loading ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading document detail...</div>
                ) : null}

                {!loading && eligibility ? (
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
                        <Card className="border-slate-200 bg-white/90 shadow-sm">
                            <CardHeader>
                                <CardTitle>Document Preview</CardTitle>
                                <CardDescription>
                                    Document ID: {eligibility.document.id}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {previewUrl ? (
                                    <iframe src={previewUrl} title="Document preview" className="h-[680px] w-full rounded-md border border-slate-200" />
                                ) : (
                                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                                        Preview unavailable.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card className="border-slate-200 bg-white/90 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Digital Signature Status</CardTitle>
                                    <CardDescription>Current certification state for this document.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-600">Document status</span>
                                        <Badge variant={eligibility.canSignCertification ? 'warning' : 'neutral'}>
                                            {eligibility.document.status}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-600">Can sign now</span>
                                        <span className="font-medium text-slate-900">{String(eligibility.canSignCertification)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-600">Can start cert</span>
                                        <span className="font-medium text-slate-900">{String(eligibility.canStartCertification)}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-slate-200 bg-white/90 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Certification Timeline</CardTitle>
                                    <CardDescription>Progress from upload to completion.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {timelineItems.map((item, index) => (
                                        <div key={item.label} className="flex items-center gap-3">
                                            <div className={`h-2.5 w-2.5 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-slate-800">{item.label}</p>
                                            </div>
                                            <span className="text-xs text-slate-500">Step {index + 1}</span>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Button onClick={() => window.history.back()} variant="outline" className="border-slate-300">
                                Back
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>
        </AppShell>
    );
}
