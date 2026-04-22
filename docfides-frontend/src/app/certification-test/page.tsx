'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AxiosError } from 'axios';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    getCertificationEligibility,
    requestDocumentSigners,
    signDocumentCertification,
    startDocumentCertification,
    uploadSignatureImage,
} from '@/lib/auth-service';
import type {
    CertificationEligibilityResponse,
    RequestSignersResponse,
    SignDocumentResponse,
    StartCertificationResponse,
    UploadSignatureResponse,
} from '@/types/auth';

type ApiError = {
    message?: string | string[];
};

function normalizeErrorMessage(err: unknown): string {
    const axiosError = err as AxiosError<ApiError>;
    const message = axiosError.response?.data?.message;
    return Array.isArray(message)
        ? message.join(', ')
        : message ?? axiosError.message ?? 'Terjadi kesalahan';
}

function CertificationTestContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [documentId, setDocumentId] = useState('');
    const [reason, setReason] = useState('Frontend manual test');
    const [mode, setMode] = useState<'invisible' | 'visible'>('invisible');
    const [visiblePage, setVisiblePage] = useState(1);
    const [visibleX, setVisibleX] = useState(50);
    const [visibleY, setVisibleY] = useState(60);
    const [visibleWidth, setVisibleWidth] = useState(180);
    const [visibleHeight, setVisibleHeight] = useState(60);
    const [signatureFile, setSignatureFile] = useState<File | null>(null);
    const [signerUserIdsText, setSignerUserIdsText] = useState('');

    const [eligibilityResult, setEligibilityResult] = useState<CertificationEligibilityResponse | null>(null);
    const [startResult, setStartResult] = useState<StartCertificationResponse | null>(null);
    const [requestSignersResult, setRequestSignersResult] = useState<RequestSignersResponse | null>(null);
    const [uploadResult, setUploadResult] = useState<UploadSignatureResponse | null>(null);
    const [signResult, setSignResult] = useState<SignDocumentResponse | null>(null);

    const [loadingAction, setLoadingAction] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const executeAction = async (action: string, fn: () => Promise<void>) => {
        setError('');
        setSuccess('');
        setLoadingAction(action);

        try {
            await fn();
            setSuccess(`${action} berhasil`);
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setLoadingAction('');
        }
    };

    const documentIdMissing = !documentId.trim();

    const parseSignerUserIds = () =>
        signerUserIdsText
            .split(/[\s,;\n\r]+/)
            .map((value) => value.trim())
            .filter(Boolean);

    useEffect(() => {
        const parseNumber = (value: string | null, fallback: number) => {
            if (!value) {
                return fallback;
            }
            const next = Number(value);
            return Number.isFinite(next) ? next : fallback;
        };

        const nextDocumentId = searchParams.get('documentId');
        const nextReason = searchParams.get('reason');
        const nextMode = searchParams.get('mode');
        const nextVisiblePage = searchParams.get('visiblePage');
        const nextVisibleX = searchParams.get('visibleX');
        const nextVisibleY = searchParams.get('visibleY');
        const nextVisibleWidth = searchParams.get('visibleWidth');
        const nextVisibleHeight = searchParams.get('visibleHeight');

        if (nextDocumentId) {
            setDocumentId(nextDocumentId);
        }

        if (nextReason) {
            setReason(nextReason);
        }

        if (nextMode === 'visible' || nextMode === 'invisible') {
            setMode(nextMode);
        }

        if (nextVisiblePage || nextVisibleX || nextVisibleY || nextVisibleWidth || nextVisibleHeight) {
            setMode('visible');
            setVisiblePage(parseNumber(nextVisiblePage, 1));
            setVisibleX(parseNumber(nextVisibleX, 50));
            setVisibleY(parseNumber(nextVisibleY, 60));
            setVisibleWidth(parseNumber(nextVisibleWidth, 180));
            setVisibleHeight(parseNumber(nextVisibleHeight, 60));
        }
    }, [searchParams]);

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-slate-100 text-slate-900">
            <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-semibold">Certification Endpoint Tester</h1>
                        <p className="text-slate-600 text-sm mt-1">
                            Tool manual untuk test endpoint sertifikasi tanpa command line.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="border-slate-300" onClick={() => router.push('/dashboard')}>
                            Kembali ke Dashboard
                        </Button>
                    </div>
                </div>

                {error && (
                    <Alert className="border-red-200 bg-red-50 text-red-800">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {success && (
                    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>{success}</AlertDescription>
                    </Alert>
                )}

                <Card className="border-slate-200 bg-white/90 shadow-sm">
                    <CardHeader>
                        <CardTitle>Input Uji</CardTitle>
                        <CardDescription>
                            Isi documentId milik user login, lalu jalankan langkah endpoint berurutan.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            placeholder="documentId"
                            value={documentId}
                            onChange={(e) => setDocumentId(e.target.value)}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-sm text-slate-700">Mode Tanda Tangan</label>
                                <select
                                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                                    value={mode}
                                    onChange={(e) => setMode(e.target.value as 'invisible' | 'visible')}
                                >
                                    <option value="invisible">invisible</option>
                                    <option value="visible">visible</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-slate-700">Reason</label>
                                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
                            </div>
                        </div>

                        {mode === 'visible' && (
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <Input type="number" value={visiblePage} onChange={(e) => setVisiblePage(Number(e.target.value))} placeholder="Page" />
                                <Input type="number" value={visibleX} onChange={(e) => setVisibleX(Number(e.target.value))} placeholder="X" />
                                <Input type="number" value={visibleY} onChange={(e) => setVisibleY(Number(e.target.value))} placeholder="Y" />
                                <Input type="number" value={visibleWidth} onChange={(e) => setVisibleWidth(Number(e.target.value))} placeholder="Width" />
                                <Input type="number" value={visibleHeight} onChange={(e) => setVisibleHeight(Number(e.target.value))} placeholder="Height" />
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm text-slate-700">Signature image (png/jpg, opsional tapi direkomendasikan)</label>
                            <Input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg"
                                onChange={(e) => setSignatureFile(e.target.files?.[0] ?? null)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm text-slate-700">
                                Signer User IDs (untuk request signer, pisahkan dengan koma/spasi/baris baru)
                            </label>
                            <textarea
                                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm min-h-[92px]"
                                placeholder="uuid-user-1, uuid-user-2"
                                value={signerUserIdsText}
                                onChange={(e) => setSignerUserIdsText(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {eligibilityResult && (
                    <Card className="border-slate-200 bg-white/90 shadow-sm">
                        <CardHeader>
                            <CardTitle>Ringkasan Eligibility</CardTitle>
                            <CardDescription>
                                Informasi ini membantu membedakan hak owner dan signer yang diundang.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-slate-500">canStartCertification</p>
                                    <p className="font-semibold text-slate-900">{String(eligibilityResult.canStartCertification)}</p>
                                </div>
                                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-slate-500">canSignCertification</p>
                                    <p className="font-semibold text-slate-900">{String(eligibilityResult.canSignCertification)}</p>
                                </div>
                                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-slate-500">Status Dokumen</p>
                                    <p className="font-semibold text-slate-900">{eligibilityResult.document.status}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card className="border-slate-200 bg-white/90 shadow-sm">
                    <CardHeader>
                        <CardTitle>Langkah Pengujian</CardTitle>
                        <CardDescription>
                            Urutan owner: Eligibility - Start - Request Signers. Urutan signer: Eligibility - Upload Signature - Sign.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Button
                            disabled={documentIdMissing || loadingAction !== ''}
                            onClick={() =>
                                executeAction('Eligibility', async () => {
                                    const response = await getCertificationEligibility(documentId.trim());
                                    setEligibilityResult(response);
                                })
                            }
                        >
                            {loadingAction === 'Eligibility' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            GET Eligibility
                        </Button>

                        <Button
                            disabled={documentIdMissing || loadingAction !== ''}
                            onClick={() =>
                                executeAction('Start Certification', async () => {
                                    const response = await startDocumentCertification(documentId.trim());
                                    setStartResult(response);
                                })
                            }
                        >
                            {loadingAction === 'Start Certification' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            POST Start
                        </Button>

                        <Button
                            variant="outline"
                            className="border-slate-300"
                            disabled={documentIdMissing || loadingAction !== '' || parseSignerUserIds().length === 0}
                            onClick={() =>
                                executeAction('Request Signers', async () => {
                                    const signerUserIds = parseSignerUserIds();
                                    const response = await requestDocumentSigners(documentId.trim(), {
                                        signerUserIds,
                                    });
                                    setRequestSignersResult(response);
                                })
                            }
                        >
                            {loadingAction === 'Request Signers' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            POST Request Signers
                        </Button>

                        <Button
                            variant="outline"
                            className="border-slate-300"
                            disabled={!signatureFile || loadingAction !== ''}
                            onClick={() =>
                                executeAction('Upload Signature', async () => {
                                    if (!signatureFile) return;
                                    const response = await uploadSignatureImage(signatureFile);
                                    setUploadResult(response);
                                })
                            }
                        >
                            {loadingAction === 'Upload Signature' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            POST Upload Signature
                        </Button>

                        <Button
                            disabled={documentIdMissing || loadingAction !== ''}
                            onClick={() =>
                                executeAction('Sign Document', async () => {
                                    const payload =
                                        mode === 'visible'
                                            ? {
                                                mode,
                                                reason,
                                                visiblePage,
                                                visibleX,
                                                visibleY,
                                                visibleWidth,
                                                visibleHeight,
                                            }
                                            : { mode, reason };

                                    const response = await signDocumentCertification(documentId.trim(), payload);
                                    setSignResult(response);
                                })
                            }
                        >
                            {loadingAction === 'Sign Document' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            POST Sign
                        </Button>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white/90 shadow-sm">
                    <CardHeader>
                        <CardTitle>Hasil Response</CardTitle>
                        <CardDescription>Output JSON dari endpoint yang sudah dipanggil.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div>
                            <p className="font-semibold text-slate-800 mb-1">Eligibility</p>
                            <pre className="rounded-md bg-slate-900 text-slate-100 p-3 overflow-auto">{JSON.stringify(eligibilityResult, null, 2)}</pre>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-800 mb-1">Start</p>
                            <pre className="rounded-md bg-slate-900 text-slate-100 p-3 overflow-auto">{JSON.stringify(startResult, null, 2)}</pre>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-800 mb-1">Request Signers</p>
                            <pre className="rounded-md bg-slate-900 text-slate-100 p-3 overflow-auto">{JSON.stringify(requestSignersResult, null, 2)}</pre>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-800 mb-1">Upload Signature</p>
                            <pre className="rounded-md bg-slate-900 text-slate-100 p-3 overflow-auto">{JSON.stringify(uploadResult, null, 2)}</pre>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-800 mb-1">Sign</p>
                            <pre className="rounded-md bg-slate-900 text-slate-100 p-3 overflow-auto">{JSON.stringify(signResult, null, 2)}</pre>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function CertificationTestPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-slate-100" />}>
            <CertificationTestContent />
        </Suspense>
    );
}
