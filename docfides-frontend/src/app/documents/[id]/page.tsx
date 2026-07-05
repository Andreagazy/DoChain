'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3, FileText, Loader2, UploadCloud, UserCheck, Users, XCircle } from 'lucide-react';
import { AxiosError } from 'axios';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    getCertificationDocumentDetail,
    getCertificationDocumentFile,
    getCertificationEligibility,
    requestDocumentRevoke,
} from '@/lib/auth-service';
import { buildCertificationStepHref, getDocumentNextCertificationStep, setActiveCertificationDocumentId } from '@/lib/certification-flow';
import type { CertificationDocumentDetailResponse, CertificationEligibilityResponse } from '@/types/auth';

function normalizeErrorMessage(err: unknown): string {
    const axiosError = err as AxiosError<{ message?: string | string[] }>;
    const message = axiosError.response?.data?.message;
    return Array.isArray(message) ? message.join(', ') : message ?? axiosError.message ?? 'Terjadi kesalahan';
}

const documentStatusLabels: Record<string, string> = {
    DRAFT: 'Draft',
    UPLOADED: 'Baru Diupload',
    PENDING_SIGNATURE: 'Menunggu Tanda Tangan',
    PENDING_SIGNATURES: 'Menunggu Tanda Tangan',
    PARTIALLY_SIGNED: 'Sebagian Ditandatangani',
    FULLY_SIGNED: 'Final',
    REJECTED: 'Ditolak',
    REVOKED: 'Dicabut',
};

const signerStatusLabels: Record<string, string> = {
    PENDING: 'Menunggu',
    SIGNED: 'Ditandatangani',
    DECLINED: 'Ditolak',
    REJECTED: 'Ditolak',
};

const getDocumentStatusLabel = (status: string) =>
    documentStatusLabels[status] ?? status.replaceAll('_', ' ');

const getSignerStatusLabel = (status: string) =>
    signerStatusLabels[status] ?? status.replaceAll('_', ' ');

const getDocumentBadgeVariant = (status: string) => {
    if (status === 'FULLY_SIGNED') return 'success';
    if (status === 'REVOKED' || status === 'REJECTED') return 'destructive';
    if (status === 'PENDING_SIGNATURE' || status === 'PENDING_SIGNATURES' || status === 'PARTIALLY_SIGNED') {
        return 'warning';
    }
    return 'default';
};

const getSignerBadgeVariant = (status: string) => {
    if (status === 'SIGNED') return 'success';
    if (status === 'DECLINED' || status === 'REJECTED') return 'destructive';
    return 'warning';
};

const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
};

const formatFileSize = (value?: number | null) => {
    if (!value) return '-';
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

const getSignerName = (
    signer: CertificationDocumentDetailResponse['signingProcess'][number]['signer'],
) => signer.fullName ?? signer.displayName ?? signer.email;

export default function DocumentDetailPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const documentId = params.id;

    const [eligibility, setEligibility] = useState<CertificationEligibilityResponse | null>(null);
    const [detail, setDetail] = useState<CertificationDocumentDetailResponse | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [revokeReason, setRevokeReason] = useState('');
    const [revokeEvidenceFiles, setRevokeEvidenceFiles] = useState<File[]>([]);
    const [submittingRevokeRequest, setSubmittingRevokeRequest] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let nextPreviewUrl = '';

        async function loadDetail() {
            setError('');
            try {
                const [eligibilityRes, detailRes, previewBlob] = await Promise.all([
                    getCertificationEligibility(documentId),
                    getCertificationDocumentDetail(documentId),
                    getCertificationDocumentFile(documentId),
                ]);

                setEligibility(eligibilityRes);
                setDetail(detailRes);
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

    const nextStep = useMemo(() => {
        if (!eligibility) return null;
        return getDocumentNextCertificationStep(eligibility.document.status);
    }, [eligibility]);

    const nextActionLabel = useMemo(() => {
        if (!eligibility || !nextStep) return 'Lanjutkan';
        if (nextStep === 'signers') return 'Tambah Signer';
        if (nextStep === 'placeholders') return 'Atur Placeholder';
        return 'Buka Review dan Sign';
    }, [eligibility, nextStep]);

    const signingProcess = detail?.signingProcess ?? [];
    const signedCount = signingProcess.filter((item) => item.status === 'SIGNED').length;
    const declinedSigner = signingProcess.find((item) => item.status === 'DECLINED' || item.status === 'REJECTED');
    const latestRevokeRequest = detail?.revokeRequests?.[0] ?? null;

    const refreshDetail = async () => {
        const detailRes = await getCertificationDocumentDetail(documentId);
        setDetail(detailRes);
    };

    const handleSubmitRevokeRequest = async () => {
        setError('');
        if (revokeReason.trim().length < 10) {
            setError('Alasan request pencabutan minimal 10 karakter.');
            return;
        }

        if (revokeEvidenceFiles.length < 2) {
            setError('Upload minimal 2 gambar bukti untuk request pencabutan.');
            return;
        }

        setSubmittingRevokeRequest(true);
        try {
            const result = await requestDocumentRevoke(
                documentId,
                revokeReason.trim(),
                revokeEvidenceFiles,
            );
            setRevokeReason('');
            setRevokeEvidenceFiles([]);
            await refreshDetail();
            setError('');
            window.alert(result.message);
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setSubmittingRevokeRequest(false);
        }
    };

    return (
        <AppShell title="Detail Dokumen" subtitle="Lihat preview dokumen dan proses tanda tangan.">
            <div className="space-y-6">
                {error ? (
                    <Alert className="border-red-200 bg-red-50 text-red-800">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                {loading ? (
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        Memuat detail dokumen...
                    </div>
                ) : null}

                {!loading && eligibility && detail ? (
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.55fr_1fr]">
                        <Card className="rounded-xl border-blue-100 bg-white shadow-sm">
                            <CardHeader>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <CardTitle>Preview Dokumen</CardTitle>
                                        <CardDescription>
                                            {detail.document.originalFileName ?? detail.document.finalFileName ?? 'Dokumen sertifikasi'}
                                        </CardDescription>
                                    </div>
                                    <Badge variant={getDocumentBadgeVariant(detail.document.status)}>
                                        {getDocumentStatusLabel(detail.document.status)}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {previewUrl ? (
                                    <iframe src={previewUrl} title="Document preview" className="h-[680px] w-full rounded-md border border-blue-100" />
                                ) : (
                                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                                        Preview tidak tersedia.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card className="rounded-xl border-blue-100 bg-white shadow-sm">
                                <CardHeader>
                                    <CardTitle>Status Dokumen</CardTitle>
                                    <CardDescription>Ringkasan posisi dokumen saat ini.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-slate-600">Status</span>
                                        <Badge variant={getDocumentBadgeVariant(detail.document.status)}>
                                            {getDocumentStatusLabel(detail.document.status)}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-slate-600">Tanda tangan</span>
                                        <span className="font-semibold text-slate-900">
                                            {detail.document.signatureCount}/{detail.document.requiredSignerCount}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-slate-600">QR verifikasi</span>
                                        <span className="font-semibold text-slate-900">
                                            {detail.document.hasVerificationQr ? 'Sudah ditempatkan' : 'Belum ditempatkan'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-slate-600">Terakhir update</span>
                                        <span className="font-semibold text-slate-900">{formatDateTime(detail.document.updatedAt)}</span>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-xs font-bold uppercase text-slate-500">Pemilik Dokumen</p>
                                        <p className="mt-1 font-semibold text-slate-900">
                                            {detail.document.owner.fullName ?? detail.document.owner.displayName ?? detail.document.owner.email ?? '-'}
                                        </p>
                                        <p className="text-xs text-slate-500">{detail.document.owner.email ?? '-'}</p>
                                    </div>
                                    {detail.document.revokeReason ? (
                                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                                            <p className="text-xs font-bold uppercase">Alasan pencabutan</p>
                                            <p className="mt-1 text-sm">{detail.document.revokeReason}</p>
                                            <p className="mt-1 text-xs">{formatDateTime(detail.document.revokedAt)}</p>
                                        </div>
                                    ) : null}
                                    <Button
                                        className="mt-3 w-full"
                                        disabled={!nextStep || detail.document.status === 'REVOKED'}
                                        onClick={() => {
                                            if (!nextStep) return;
                                            setActiveCertificationDocumentId(eligibility.document.id);
                                            router.push(buildCertificationStepHref(nextStep, eligibility.document.id));
                                        }}
                                    >
                                        {nextStep === 'signers' ? <Users className="h-4 w-4" /> : null}
                                        {nextActionLabel}
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                    {eligibility.reason ? (
                                        <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                                            {eligibility.reason}
                                        </p>
                                    ) : null}
                                </CardContent>
                            </Card>

                            <Card className="rounded-xl border-blue-100 bg-white shadow-sm">
                                <CardHeader>
                                    <CardTitle>Informasi File</CardTitle>
                                    <CardDescription>Data ringkas file tanpa menampilkan hash teknis.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-xs font-bold uppercase text-slate-500">File awal</p>
                                        <p className="mt-1 truncate font-semibold text-slate-900">{detail.document.originalFileName ?? '-'}</p>
                                        <p className="text-xs text-slate-500">{formatFileSize(detail.document.originalFileSize)}</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-xs font-bold uppercase text-slate-500">File final</p>
                                        <p className="mt-1 truncate font-semibold text-slate-900">{detail.document.finalFileName ?? '-'}</p>
                                        <p className="text-xs text-slate-500">{formatFileSize(detail.document.finalFileSize)}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-xl border-red-100 bg-white shadow-sm">
                                <CardHeader>
                                    <CardTitle>Request Pencabutan</CardTitle>
                                    <CardDescription>
                                        Ajukan pencabutan jika dokumen final memiliki kesalahan. Request akan direview superadmin.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {latestRevokeRequest ? (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                            <p className="font-bold">Request terakhir: {latestRevokeRequest.status === 'PENDING' ? 'Menunggu Review' : latestRevokeRequest.status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}</p>
                                            <p className="mt-1">{latestRevokeRequest.reason}</p>
                                            <p className="mt-1 text-xs">{formatDateTime(latestRevokeRequest.createdAt)} | {latestRevokeRequest.evidences.length} bukti</p>
                                            {latestRevokeRequest.reviewNote ? (
                                                <p className="mt-2 text-xs">Catatan admin: {latestRevokeRequest.reviewNote}</p>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    {detail.document.status === 'FULLY_SIGNED' && latestRevokeRequest?.status !== 'PENDING' ? (
                                        <div className="space-y-3">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Alasan pencabutan</label>
                                                <textarea
                                                    value={revokeReason}
                                                    onChange={(event) => setRevokeReason(event.target.value.slice(0, 700))}
                                                    placeholder="Contoh: Terdapat kesalahan data pada dokumen final dan perlu diterbitkan ulang."
                                                    className="min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                                />
                                                <p className="text-xs text-slate-500">Alasan minimal 10 karakter dan akan dibaca superadmin.</p>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                                    <UploadCloud className="h-4 w-4" />
                                                    Bukti gambar
                                                </label>
                                                <Input
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/jpg,image/webp"
                                                    multiple
                                                    onChange={(event) => {
                                                        const files = Array.from(event.target.files ?? []);
                                                        const validFiles = files.filter((file) => file.size <= 3 * 1024 * 1024);
                                                        if (validFiles.length !== files.length) {
                                                            setError('Setiap gambar bukti maksimal 3MB.');
                                                        }
                                                        setRevokeEvidenceFiles(validFiles.slice(0, 5));
                                                    }}
                                                />
                                                <p className="text-xs text-slate-500">Minimal 2 gambar, maksimal 5 gambar. Format jpg, png, atau webp.</p>
                                                {revokeEvidenceFiles.length > 0 ? (
                                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                                        {revokeEvidenceFiles.map((file) => (
                                                            <p key={`${file.name}-${file.size}`}>{file.name}</p>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                            <Button
                                                className="w-full bg-red-600 hover:bg-red-700"
                                                onClick={() => void handleSubmitRevokeRequest()}
                                                disabled={submittingRevokeRequest || revokeReason.trim().length < 10 || revokeEvidenceFiles.length < 2}
                                            >
                                                {submittingRevokeRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                                Ajukan Request Pencabutan
                                            </Button>
                                        </div>
                                    ) : latestRevokeRequest?.status === 'PENDING' ? (
                                        <p className="text-sm text-slate-500">Form dikunci karena request pencabutan sedang menunggu review.</p>
                                    ) : (
                                        <p className="text-sm text-slate-500">Request pencabutan hanya tersedia untuk dokumen final yang belum dicabut.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="rounded-xl border-blue-100 bg-white shadow-sm xl:col-span-2">
                            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <CardTitle>Proses Tanda Tangan</CardTitle>
                                    <CardDescription>
                                        Urutan signer, status tanda tangan, dan alasan penolakan jika ada.
                                    </CardDescription>
                                </div>
                                <Badge variant={declinedSigner ? 'destructive' : signedCount === signingProcess.length && signingProcess.length > 0 ? 'success' : 'warning'}>
                                    {signedCount}/{signingProcess.length} selesai
                                </Badge>
                            </CardHeader>
                            <CardContent>
                                {signingProcess.length > 0 ? (
                                    <div className="space-y-3">
                                        {signingProcess.map((item, index) => {
                                            const signerName = getSignerName(item.signer);
                                            const isSigned = item.status === 'SIGNED';
                                            const isDeclined = item.status === 'DECLINED' || item.status === 'REJECTED';
                                            const timestamp = isSigned ? item.signedAt : isDeclined ? item.declinedAt : item.updatedAt;

                                            return (
                                                <div key={`${item.userId}-${item.order ?? index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                        <div className="flex gap-3">
                                                            <div
                                                                className={
                                                                    isSigned
                                                                        ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700'
                                                                        : isDeclined
                                                                            ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700'
                                                                            : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700'
                                                                }
                                                            >
                                                                {isSigned ? <CheckCircle2 className="h-5 w-5" /> : isDeclined ? <XCircle className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <p className="font-bold text-slate-900">
                                                                        {item.order ?? index + 1}. {signerName}
                                                                    </p>
                                                                    <Badge variant="neutral">{item.signer.role.replaceAll('_', ' ')}</Badge>
                                                                    <Badge variant={getSignerBadgeVariant(item.status)}>
                                                                        {getSignerStatusLabel(item.status)}
                                                                    </Badge>
                                                                </div>
                                                                <p className="mt-1 text-sm text-slate-600">{item.signer.email}</p>
                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    {isSigned ? 'Ditandatangani' : isDeclined ? 'Ditolak' : 'Menunggu'}: {formatDateTime(timestamp)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {item.signature ? (
                                                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                                                Signature urutan {item.signature.order}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                    {item.declineReason ? (
                                                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                                                            <span className="font-bold">Alasan penolakan:</span> {item.declineReason}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                                        <FileText className="mx-auto h-8 w-8 text-slate-400" />
                                        <p className="mt-3 font-bold text-slate-900">Signer belum ditentukan</p>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Tambahkan signer terlebih dahulu agar proses tanda tangan bisa dipantau.
                                        </p>
                                        <Button asChild className="mt-4 rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700">
                                            <Link
                                                href={buildCertificationStepHref('signers', detail.document.id)}
                                                onClick={() => setActiveCertificationDocumentId(detail.document.id)}
                                            >
                                                <UserCheck className="mr-2 h-4 w-4" />
                                                Tambah Signer
                                            </Link>
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <div className="xl:col-span-2">
                            <Button onClick={() => window.history.back()} variant="outline" className="border-slate-300">
                                Kembali
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>
        </AppShell>
    );
}
