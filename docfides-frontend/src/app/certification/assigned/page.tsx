'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock3, Eye, FileText, Inbox, Loader2, PenLine, ShieldCheck, XCircle } from 'lucide-react';
import {
    Alert,
    AlertDescription,
} from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { AppShell } from '@/components/layout/app-shell';
import {
    declineDocumentCertification,
    getCertificationDocumentOriginalFile,
    getIdentityStatus,
    getSignatureStatus,
    listAssignedCertificationDocuments,
    signDocumentCertification,
} from '@/lib/auth-service';
import { normalizeErrorMessage } from '@/lib/certification-flow';
import type { AssignedDocumentItem } from '@/types/auth';

type DocumentPreviewState = {
    documentId: string;
    url: string;
    title: string;
};

type DeclineDialogState = {
    documentId: string;
    title: string;
} | null;

const ASSIGNMENTS_PER_PAGE = 5;
const INACTIVE_DOCUMENT_STATUSES = ['REVOKED', 'REJECTED'];

const documentStatusLabels: Record<string, string> = {
    REVOKED: 'Dicabut',
    REJECTED: 'Ditolak',
    FULLY_SIGNED: 'Final',
    PARTIALLY_SIGNED: 'Sebagian Ditandatangani',
    PENDING_SIGNATURES: 'Menunggu Tanda Tangan',
    PENDING_SIGNATURE: 'Menunggu Tanda Tangan',
    DRAFT: 'Draft',
    UPLOADED: 'Baru Diupload',
};

const signerStatusLabels: Record<string, string> = {
    PENDING: 'Menunggu Tanda Tangan',
    SIGNED: 'Sudah Ditandatangani',
    REJECTED: 'Ditolak',
};

const getDocumentStatusLabel = (status: string) =>
    documentStatusLabels[status] ?? status.replaceAll('_', ' ');

const getSignerStatusLabel = (status: string) =>
    signerStatusLabels[status] ?? status.replaceAll('_', ' ');

const getAssignmentTitle = (assignment: AssignedDocumentItem) =>
    assignment.document.originalFileName ?? assignment.document.finalFileName ?? 'Dokumen PDF';

const isAssignmentActionable = (assignment: AssignedDocumentItem) =>
    assignment.signerStatus === 'PENDING' &&
    !INACTIVE_DOCUMENT_STATUSES.includes(assignment.document.status);

export default function CertificationAssignedDocumentsPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [preferredMode, setPreferredMode] = useState<'visible' | 'invisible'>('invisible');
    const [hasSignature, setHasSignature] = useState(false);
    const [assignments, setAssignments] = useState<AssignedDocumentItem[]>([]);
    const [previewState, setPreviewState] = useState<DocumentPreviewState | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [declineDialog, setDeclineDialog] = useState<DeclineDialogState>(null);
    const [declineReason, setDeclineReason] = useState('');

    const pendingAssignments = useMemo(
        () => assignments.filter(isAssignmentActionable),
        [assignments],
    );

    const signedAssignments = useMemo(
        () => assignments.filter((assignment) => assignment.signerStatus === 'SIGNED'),
        [assignments],
    );

    const inactiveAssignments = useMemo(
        () => assignments.filter((assignment) => INACTIVE_DOCUMENT_STATUSES.includes(assignment.document.status)),
        [assignments],
    );

    const totalPages = Math.max(1, Math.ceil(assignments.length / ASSIGNMENTS_PER_PAGE));

    const paginatedAssignments = useMemo(() => {
        const startIndex = (currentPage - 1) * ASSIGNMENTS_PER_PAGE;
        return assignments.slice(startIndex, startIndex + ASSIGNMENTS_PER_PAGE);
    }, [assignments, currentPage]);

    const execute = async (action: string, fn: () => Promise<void>) => {
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

    const refreshAssignments = async () => {
        const assignmentResponse = await listAssignedCertificationDocuments();
        setAssignments(assignmentResponse.assignments);
    };

    useEffect(() => {
        async function loadPage() {
            try {
                const [identityStatus, signatureStatus, assignmentResponse] = await Promise.all([
                    getIdentityStatus(),
                    getSignatureStatus(),
                    listAssignedCertificationDocuments(),
                ]);

                if (identityStatus.status !== 'APPROVED') {
                    router.push('/profile#identitas-ktp');
                    return;
                }

                setPreferredMode(signatureStatus.preferredSignatureMode);
                setHasSignature(signatureStatus.hasSignature);
                setAssignments(assignmentResponse.assignments);
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }

        void loadPage();
    }, [router]);

    useEffect(() => {
        let objectUrl = '';

        async function loadPreview() {
            setPreviewError('');
            setPreviewLoading(true);

            if (!previewState?.documentId) {
                setPreviewLoading(false);
                return;
            }

            try {
                const blob = await getCertificationDocumentOriginalFile(previewState.documentId);
                objectUrl = URL.createObjectURL(blob);
                setPreviewState((current) => current ? { ...current, url: objectUrl } : current);
            } catch (err) {
                setPreviewError(normalizeErrorMessage(err));
            } finally {
                setPreviewLoading(false);
            }
        }

        void loadPreview();

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [previewState?.documentId]);

    useEffect(() => {
        setCurrentPage((page) => Math.min(page, totalPages));
    }, [totalPages]);

    const closePreview = () => {
        setPreviewState((current) => {
            if (current?.url) {
                URL.revokeObjectURL(current.url);
            }
            return null;
        });
    };

    const openPreview = (assignment: AssignedDocumentItem) => {
        setPreviewState({
            documentId: assignment.document.id,
            url: '',
            title: getAssignmentTitle(assignment),
        });
    };

    const handleAssignedSign = async (documentId: string) => {
        if (preferredMode === 'visible' && !hasSignature) {
            router.push('/signature-setup?next=/certification');
            return;
        }

        await execute('Sign Dokumen', async () => {
            await signDocumentCertification(documentId, {
                mode: preferredMode,
                reason: 'DOCChain digital signature',
            });
            await refreshAssignments();
        });
    };

    const openDeclineDialog = (assignment: AssignedDocumentItem) => {
        if (!isAssignmentActionable(assignment)) {
            return;
        }

        setDeclineReason('');
        setDeclineDialog({
            documentId: assignment.document.id,
            title: getAssignmentTitle(assignment),
        });
    };

    const handleDecline = async () => {
        if (!declineDialog) {
            return;
        }

        const reason = declineReason.trim();
        if (reason.length < 5) {
            setError('Alasan penolakan minimal 5 karakter.');
            return;
        }

        await execute('Tolak Dokumen', async () => {
            await declineDocumentCertification(declineDialog.documentId, { reason });
            setDeclineDialog(null);
            setDeclineReason('');
            await refreshAssignments();
        });
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="flex items-center gap-2 text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menyiapkan daftar dokumen untuk ditandatangani...</span>
                </div>
            </div>
        );
    }

    return (
        <AppShell title="Perlu Ditandatangani" subtitle="Tinjau dokumen yang menunggu tanda tangan Anda.">
            <div className="space-y-5">
                <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
                    <Badge className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700 hover:bg-white">Perlu Ditandatangani</Badge>
                    <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Tinjau dokumen sebelum tanda tangan.</h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                                Buka preview dokumen, pastikan isinya benar, lalu tanda tangani atau tolak dengan alasan yang jelas.
                            </p>
                        </div>
                        <Button variant="outline" className="w-fit rounded-xl border-blue-200 bg-white font-semibold text-blue-700 hover:bg-blue-50" onClick={() => router.push('/certification')}>
                            Kembali ke Sertifikasi
                        </Button>
                    </div>
                </section>

                <div className="grid gap-3 md:grid-cols-4">
                    <Card className="gap-0 rounded-2xl border-blue-100 bg-white py-0 shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Menunggu</p>
                                    <p className="mt-2 text-3xl font-bold text-slate-900">{pendingAssignments.length}</p>
                                    <p className="mt-1 text-xs text-slate-600">Siap ditinjau</p>
                                </div>
                                <span className="rounded-xl bg-amber-50 p-2 text-amber-700">
                                    <Clock3 className="h-5 w-5" />
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="gap-0 rounded-2xl border-blue-100 bg-white py-0 shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Selesai</p>
                                    <p className="mt-2 text-3xl font-bold text-slate-900">{signedAssignments.length}</p>
                                    <p className="mt-1 text-xs text-slate-600">Sudah ditandatangani</p>
                                </div>
                                <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                                    <CheckCircle2 className="h-5 w-5" />
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="gap-0 rounded-2xl border-blue-100 bg-white py-0 shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Nonaktif</p>
                                    <p className="mt-2 text-3xl font-bold text-slate-900">{inactiveAssignments.length}</p>
                                    <p className="mt-1 text-xs text-slate-600">Dicabut/ditolak</p>
                                </div>
                                <span className="rounded-xl bg-slate-100 p-2 text-slate-600">
                                    <Inbox className="h-5 w-5" />
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="gap-0 rounded-2xl border-blue-100 bg-white py-0 shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Mode TTD</p>
                                    <p className="mt-2 text-xl font-bold text-slate-900">{preferredMode === 'visible' ? 'Visible' : 'Invisible'}</p>
                                    <p className="mt-1 text-xs text-slate-600">{hasSignature ? 'Asset siap' : 'Perlu setup'}</p>
                                </div>
                                <span className="rounded-xl bg-blue-50 p-2 text-blue-700">
                                    <ShieldCheck className="h-5 w-5" />
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {error ? (
                    <Alert className="border-red-200 bg-red-50 text-red-800">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                {success ? (
                    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>{success}</AlertDescription>
                    </Alert>
                ) : null}

                <Card className="gap-0 overflow-hidden rounded-2xl border-blue-100 bg-white py-0 shadow-sm">
                    <CardHeader className="border-b border-slate-100 bg-white p-5">
                        <CardTitle>Daftar Dokumen</CardTitle>
                        <CardDescription>Preview dokumen terlebih dahulu sebelum mengambil keputusan.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4">
                        {assignments.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                                <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                                <p className="font-semibold text-slate-700">Belum ada dokumen untuk Anda tandatangani.</p>
                            </div>
                        ) : (
                            paginatedAssignments.map((assignment) => {
                                const actionable = isAssignmentActionable(assignment);
                                const inactive = INACTIVE_DOCUMENT_STATUSES.includes(assignment.document.status);

                                return (
                                <div
                                    key={`${assignment.document.id}-${assignment.order ?? 'x'}`}
                                    className={`grid gap-4 rounded-2xl border p-4 shadow-sm lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center ${
                                        inactive
                                            ? 'border-slate-200 bg-slate-100/80 opacity-75'
                                            : actionable
                                              ? 'border-amber-200 bg-amber-50/40'
                                              : 'border-slate-200 bg-slate-50'
                                    }`}
                                >
                                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                                        inactive
                                            ? 'bg-slate-200 text-slate-500'
                                            : actionable
                                              ? 'bg-amber-100 text-amber-700'
                                              : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                        {actionable ? <Clock3 className="h-5 w-5" /> : assignment.signerStatus === 'SIGNED' ? <CheckCircle2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                    </div>

                                    <div className="min-w-0 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="truncate text-sm font-semibold text-slate-900">
                                                {getAssignmentTitle(assignment)}
                                            </h3>
                                            <Badge variant={actionable ? 'warning' : assignment.signerStatus === 'SIGNED' ? 'success' : 'neutral'}>
                                                {getSignerStatusLabel(assignment.signerStatus)}
                                            </Badge>
                                            {inactive ? (
                                                <Badge variant={assignment.document.status === 'REVOKED' ? 'destructive' : 'neutral'}>
                                                    {getDocumentStatusLabel(assignment.document.status)}
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <div className="grid gap-1 text-xs text-slate-600 sm:grid-cols-3">
                                            <p><span className="font-semibold text-slate-700">Pemilik:</span> {assignment.document.ownerDisplayName ?? assignment.document.ownerEmail ?? '-'}</p>
                                            <p><span className="font-semibold text-slate-700">Urutan:</span> {assignment.order ?? '-'}</p>
                                            <p><span className="font-semibold text-slate-700">Dokumen:</span> {getDocumentStatusLabel(assignment.document.status)}</p>
                                        </div>
                                        {inactive ? (
                                            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
                                                Dokumen ini sudah {getDocumentStatusLabel(assignment.document.status).toLowerCase()}, sehingga tidak perlu ditandatangani lagi.
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                                        <Button variant="outline" className="h-10 rounded-xl border-slate-300 bg-white font-semibold" onClick={() => openPreview(assignment)}>
                                            <Eye className="mr-2 h-4 w-4" />
                                            Lihat
                                        </Button>
                                        <Button
                                            className="h-10 rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700"
                                            onClick={() => handleAssignedSign(assignment.document.id)}
                                            disabled={loadingAction !== '' || !actionable}
                                        >
                                            {loadingAction === 'Sign Dokumen' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenLine className="mr-2 h-4 w-4" />}
                                            Tanda Tangani
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            className="h-10 rounded-xl font-semibold"
                                            onClick={() => openDeclineDialog(assignment)}
                                            disabled={loadingAction !== '' || !actionable}
                                        >
                                            <XCircle className="mr-2 h-4 w-4" />
                                            Tolak
                                        </Button>
                                    </div>
                                </div>
                            );
                            })
                        )}

                        {assignments.length > ASSIGNMENTS_PER_PAGE ? (
                            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-slate-500">
                                    Menampilkan {(currentPage - 1) * ASSIGNMENTS_PER_PAGE + 1}-{Math.min(currentPage * ASSIGNMENTS_PER_PAGE, assignments.length)} dari {assignments.length} dokumen
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        className="rounded-xl border-slate-300 bg-white"
                                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        Previous
                                    </Button>
                                    <span className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        className="rounded-xl border-slate-300 bg-white"
                                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                        disabled={currentPage === totalPages}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={Boolean(previewState)} onOpenChange={(open) => !open && closePreview()}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>{previewState?.title ?? 'Preview Dokumen'}</DialogTitle>
                        <DialogDescription>Preview file original untuk dokumen yang harus Anda tandatangani.</DialogDescription>
                    </DialogHeader>

                    {previewLoading ? (
                        <div className="flex min-h-80 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Memuat preview...
                        </div>
                    ) : previewError ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                            Gagal memuat preview: {previewError}
                        </div>
                    ) : previewState?.url ? (
                        <iframe
                            title={previewState.title}
                            src={previewState.url}
                            className="h-[75vh] w-full rounded-2xl border border-slate-200 bg-white"
                        />
                    ) : (
                        <div className="flex min-h-80 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
                            Tidak ada preview yang tersedia.
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(declineDialog)} onOpenChange={(open) => !open && setDeclineDialog(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Tolak Tanda Tangan</DialogTitle>
                        <DialogDescription>
                            Penolakan akan menghentikan alur dokumen sehingga signer berikutnya tidak bisa melanjutkan.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                            {declineDialog?.title ?? '-'}
                        </div>
                        <textarea
                            value={declineReason}
                            onChange={(event) => setDeclineReason(event.target.value)}
                            placeholder="Tuliskan alasan penolakan, misalnya data dokumen tidak valid atau perlu revisi."
                            className="min-h-32 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500/20 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4"
                        />
                        <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" className="border-slate-300" onClick={() => setDeclineDialog(null)}>
                                Batal
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => void handleDecline()}
                                disabled={loadingAction !== '' || declineReason.trim().length < 5}
                            >
                                {loadingAction === 'Tolak Dokumen' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                                Tolak Dokumen
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
}
