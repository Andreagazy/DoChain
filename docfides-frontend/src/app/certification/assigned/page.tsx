'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
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
import { loadPdfJsModule, normalizeErrorMessage, type PdfDocumentProxy } from '@/lib/certification-flow';
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

type SignDialogState = {
    documentId: string;
    title: string;
    owner: string;
    placeholder: AssignedDocumentItem['placeholder'];
} | null;

type RenderedPageSize = {
    pdfWidth: number;
    pdfHeight: number;
    viewWidth: number;
    viewHeight: number;
};

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
    const [hasSignature, setHasSignature] = useState(false);
    const [assignments, setAssignments] = useState<AssignedDocumentItem[]>([]);
    const [previewState, setPreviewState] = useState<DocumentPreviewState | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState('');
    const [previewPdfDocument, setPreviewPdfDocument] = useState<PdfDocumentProxy | null>(null);
    const [previewPage, setPreviewPage] = useState(1);
    const [previewPageCount, setPreviewPageCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [declineDialog, setDeclineDialog] = useState<DeclineDialogState>(null);
    const [signDialog, setSignDialog] = useState<SignDialogState>(null);
    const [signPreviewLoading, setSignPreviewLoading] = useState(false);
    const [signPreviewError, setSignPreviewError] = useState('');
    const [signPreviewPdfDocument, setSignPreviewPdfDocument] = useState<PdfDocumentProxy | null>(null);
    const [signPreviewPage, setSignPreviewPage] = useState(1);
    const [signPreviewPageCount, setSignPreviewPageCount] = useState(0);
    const [signRenderedPageSize, setSignRenderedPageSize] = useState<RenderedPageSize | null>(null);
    const [signPlacementConfirmed, setSignPlacementConfirmed] = useState(false);
    const [declineReason, setDeclineReason] = useState('');
    const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const signPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
                const pdfjs = await loadPdfJsModule();
                const pdfData = new Uint8Array(await blob.arrayBuffer());
                const loadingTask = pdfjs.getDocument({
                    data: pdfData,
                });
                const pdfDocument = await loadingTask.promise;
                setPreviewPdfDocument(pdfDocument);
                setPreviewPageCount(pdfDocument.numPages);
                setPreviewPage(1);
            } catch (err) {
                setPreviewError(normalizeErrorMessage(err));
                setPreviewPdfDocument(null);
                setPreviewPageCount(0);
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
        let cancelled = false;

        async function renderPreviewPage() {
            if (!previewPdfDocument) {
                return;
            }

            try {
                const page = await previewPdfDocument.getPage(previewPage);
                if (cancelled) return;

                const viewport = page.getViewport({ scale: 1.35 });
                const canvas = previewCanvasRef.current;
                const context = canvas?.getContext('2d');

                if (!canvas || !context) {
                    return;
                }

                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);
                canvas.style.width = `${viewport.width}px`;
                canvas.style.height = `${viewport.height}px`;

                await page.render({
                    canvasContext: context,
                    canvas,
                    viewport,
                }).promise;
            } catch (err) {
                if (!cancelled) {
                    setPreviewError(normalizeErrorMessage(err));
                }
            }
        }

        void renderPreviewPage();

        return () => {
            cancelled = true;
        };
    }, [previewPdfDocument, previewPage]);

    useEffect(() => {
        let objectUrl = '';

        async function loadSignPreview() {
            setSignPreviewError('');
            setSignPreviewLoading(true);
            setSignPreviewPdfDocument(null);
            setSignRenderedPageSize(null);
            setSignPlacementConfirmed(false);

            if (!signDialog?.documentId) {
                setSignPreviewLoading(false);
                return;
            }

            try {
                const blob = await getCertificationDocumentOriginalFile(signDialog.documentId);
                objectUrl = URL.createObjectURL(blob);
                const pdfjs = await loadPdfJsModule();
                const pdfData = new Uint8Array(await blob.arrayBuffer());
                const loadingTask = pdfjs.getDocument({ data: pdfData });
                const pdfDocument = await loadingTask.promise;
                setSignPreviewPdfDocument(pdfDocument);
                setSignPreviewPageCount(pdfDocument.numPages);
                setSignPreviewPage(signDialog.placeholder.visiblePage ?? 1);
            } catch (err) {
                setSignPreviewError(normalizeErrorMessage(err));
                setSignPreviewPdfDocument(null);
                setSignPreviewPageCount(0);
            } finally {
                setSignPreviewLoading(false);
            }
        }

        void loadSignPreview();

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [signDialog?.documentId, signDialog?.placeholder.visiblePage]);

    useEffect(() => {
        let cancelled = false;

        async function renderSignPreviewPage() {
            if (!signPreviewPdfDocument) {
                return;
            }

            try {
                const page = await signPreviewPdfDocument.getPage(signPreviewPage);
                if (cancelled) return;

                const viewport = page.getViewport({ scale: 1.35 });
                const canvas = signPreviewCanvasRef.current;
                const context = canvas?.getContext('2d');

                if (!canvas || !context) {
                    return;
                }

                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);
                canvas.style.width = `${viewport.width}px`;
                canvas.style.height = `${viewport.height}px`;
                setSignRenderedPageSize({
                    pdfWidth: page.view[2] - page.view[0],
                    pdfHeight: page.view[3] - page.view[1],
                    viewWidth: viewport.width,
                    viewHeight: viewport.height,
                });

                await page.render({
                    canvasContext: context,
                    canvas,
                    viewport,
                }).promise;
            } catch (err) {
                if (!cancelled) {
                    setSignPreviewError(normalizeErrorMessage(err));
                }
            }
        }

        void renderSignPreviewPage();

        return () => {
            cancelled = true;
        };
    }, [signPreviewPdfDocument, signPreviewPage]);

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
        setPreviewPdfDocument(null);
        setPreviewPage(1);
        setPreviewPageCount(0);
        setPreviewError('');
    };

    const openPreview = (assignment: AssignedDocumentItem) => {
        setPreviewState({
            documentId: assignment.document.id,
            url: '',
            title: getAssignmentTitle(assignment),
        });
    };

    const openSignDialog = (assignment: AssignedDocumentItem) => {
        if (!isAssignmentActionable(assignment)) {
            return;
        }

        if (!hasSignature) {
            router.push('/signature-setup?next=/certification');
            return;
        }

        setSignDialog({
            documentId: assignment.document.id,
            title: getAssignmentTitle(assignment),
            owner: assignment.document.ownerDisplayName ?? assignment.document.ownerEmail ?? '-',
            placeholder: assignment.placeholder,
        });
    };

    const signPlaceholderOverlay = useMemo(() => {
        if (!signDialog || !signRenderedPageSize) {
            return null;
        }

        const { placeholder } = signDialog;
        if (
            placeholder.visiblePage !== signPreviewPage ||
            placeholder.visibleX == null ||
            placeholder.visibleY == null ||
            placeholder.visibleWidth == null ||
            placeholder.visibleHeight == null
        ) {
            return null;
        }

        const scaleX = signRenderedPageSize.viewWidth / signRenderedPageSize.pdfWidth;
        const scaleY = signRenderedPageSize.viewHeight / signRenderedPageSize.pdfHeight;

        return {
            left: placeholder.visibleX * scaleX,
            top: (signRenderedPageSize.pdfHeight - (placeholder.visibleY + placeholder.visibleHeight)) * scaleY,
            width: placeholder.visibleWidth * scaleX,
            height: placeholder.visibleHeight * scaleY,
        };
    }, [signDialog, signPreviewPage, signRenderedPageSize]);

    const handleSignPreviewClick = (event: MouseEvent<HTMLDivElement>) => {
        if (!signDialog || !signRenderedPageSize || !signPreviewCanvasRef.current) {
            return;
        }

        const { placeholder } = signDialog;
        if (
            placeholder.visiblePage !== signPreviewPage ||
            placeholder.visibleX == null ||
            placeholder.visibleY == null ||
            placeholder.visibleWidth == null ||
            placeholder.visibleHeight == null
        ) {
            setSignPreviewError('Posisi tanda tangan untuk signer ini belum tersedia pada halaman ini.');
            return;
        }

        const rect = signPreviewCanvasRef.current.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        const scaleX = signRenderedPageSize.viewWidth / signRenderedPageSize.pdfWidth;
        const scaleY = signRenderedPageSize.viewHeight / signRenderedPageSize.pdfHeight;
        const pdfX = clickX / scaleX;
        const pdfY = signRenderedPageSize.pdfHeight - clickY / scaleY;
        const isInsidePlaceholder =
            pdfX >= placeholder.visibleX &&
            pdfX <= placeholder.visibleX + placeholder.visibleWidth &&
            pdfY >= placeholder.visibleY &&
            pdfY <= placeholder.visibleY + placeholder.visibleHeight;

        if (!isInsidePlaceholder) {
            setSignPlacementConfirmed(false);
            setSignPreviewError('Klik tepat pada area tanda tangan yang ditandai untuk melanjutkan.');
            return;
        }

        setSignPreviewError('');
        setSignPlacementConfirmed(true);
    };

    const handleAssignedSign = async (documentId: string) => {
        await execute('Sign Dokumen', async () => {
            await signDocumentCertification(documentId, {
                mode: 'visible',
                reason: 'DOCChain digital signature',
                visiblePage: signDialog?.placeholder.visiblePage ?? undefined,
                visibleX: signDialog?.placeholder.visibleX ?? undefined,
                visibleY: signDialog?.placeholder.visibleY ?? undefined,
                visibleWidth: signDialog?.placeholder.visibleWidth ?? undefined,
                visibleHeight: signDialog?.placeholder.visibleHeight ?? undefined,
            });
            setSignDialog(null);
            setSignPreviewPdfDocument(null);
            setSignPlacementConfirmed(false);
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
                                    <p className="mt-2 text-xl font-bold text-slate-900">Visible</p>
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
                                            onClick={() => openSignDialog(assignment)}
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
                <DialogContent className="w-[min(96vw,1180px)] max-w-none">
                    <DialogHeader>
                        <DialogTitle>{previewState?.title ?? 'Preview Dokumen'}</DialogTitle>
                        <DialogDescription>Preview file original sesuai ukuran halaman dokumen.</DialogDescription>
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
                    ) : previewPdfDocument ? (
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-sm font-semibold text-slate-700">
                                    Halaman {previewPage} dari {previewPageCount}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-8 border-slate-300 px-3 text-xs"
                                        onClick={() => setPreviewPage((page) => Math.max(1, page - 1))}
                                        disabled={previewPage <= 1}
                                    >
                                        Sebelumnya
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-8 border-slate-300 px-3 text-xs"
                                        onClick={() => setPreviewPage((page) => Math.min(previewPageCount, page + 1))}
                                        disabled={previewPage >= previewPageCount}
                                    >
                                        Berikutnya
                                    </Button>
                                </div>
                            </div>
                            <div className="max-h-[72vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-4">
                                <div className="mx-auto w-fit">
                                    <canvas ref={previewCanvasRef} className="block rounded-md bg-white shadow-sm" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex min-h-80 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
                            Tidak ada preview yang tersedia.
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(declineDialog)} onOpenChange={(open) => !open && setDeclineDialog(null)}>
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
                    <DialogHeader>
                        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-700">
                            <XCircle className="h-5 w-5" />
                        </div>
                        <DialogTitle>Tolak Tanda Tangan</DialogTitle>
                        <DialogDescription>
                            Penolakan akan menghentikan alur dokumen sehingga signer berikutnya tidak bisa melanjutkan.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                            <p className="text-xs font-semibold uppercase text-slate-500">Dokumen</p>
                            <p className="mt-1 font-semibold text-slate-900">{declineDialog?.title ?? '-'}</p>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Alasan penolakan</label>
                        <textarea
                            value={declineReason}
                            onChange={(event) => setDeclineReason(event.target.value)}
                            placeholder="Tuliskan alasan penolakan, misalnya data dokumen tidak valid atau perlu revisi."
                                className="min-h-28 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-red-500/20 placeholder:text-slate-400 focus:border-red-500 focus:ring-4"
                        />
                            <p className="text-xs text-slate-500">Minimal 5 karakter agar alasan bisa dipahami oleh pemilik dokumen.</p>
                        </div>
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

            <Dialog open={Boolean(signDialog)} onOpenChange={(open) => !open && setSignDialog(null)}>
                <DialogContent className="w-[min(96vw,980px)] max-w-none">
                    <DialogHeader>
                        <DialogTitle>Konfirmasi Tanda Tangan</DialogTitle>
                        <DialogDescription>
                            Tinjau dokumen, klik area tanda tangan yang ditandai, lalu konfirmasi untuk menerapkan tanda tangan digital.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-semibold text-slate-900">{signDialog?.title ?? '-'}</p>
                                <p className="text-xs text-slate-600">Pemilik: {signDialog?.owner ?? '-'}</p>
                            </div>
                            <Badge variant={signPlacementConfirmed ? 'success' : 'warning'}>
                                {signPlacementConfirmed ? 'Posisi dikonfirmasi' : 'Klik area tanda tangan'}
                            </Badge>
                        </div>

                        {signPreviewLoading ? (
                            <div className="flex min-h-96 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Memuat preview dokumen...
                            </div>
                        ) : signPreviewPdfDocument ? (
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                    <p className="text-sm font-semibold text-slate-700">
                                        Halaman {signPreviewPage} dari {signPreviewPageCount}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-8 border-slate-300 px-3 text-xs"
                                            onClick={() => {
                                                setSignPlacementConfirmed(false);
                                                setSignPreviewPage((page) => Math.max(1, page - 1));
                                            }}
                                            disabled={signPreviewPage <= 1}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-8 border-slate-300 px-3 text-xs"
                                            onClick={() => {
                                                setSignPlacementConfirmed(false);
                                                setSignPreviewPage((page) => Math.min(signPreviewPageCount, page + 1));
                                            }}
                                            disabled={signPreviewPage >= signPreviewPageCount}
                                        >
                                            Berikutnya
                                        </Button>
                                    </div>
                                </div>

                                {signPreviewError ? (
                                    <Alert className="border-amber-200 bg-amber-50 text-amber-800">
                                        <AlertDescription>{signPreviewError}</AlertDescription>
                                    </Alert>
                                ) : null}

                                <div className="max-h-[62vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-4">
                                    <div className="relative mx-auto w-fit" onClick={handleSignPreviewClick}>
                                        <canvas ref={signPreviewCanvasRef} className="block rounded-md bg-white shadow-sm" />
                                        {signPlaceholderOverlay ? (
                                            <div
                                                className={`pointer-events-none absolute flex items-center justify-center rounded-md border-2 text-[11px] font-bold ${
                                                    signPlacementConfirmed
                                                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800'
                                                        : 'border-blue-500 bg-blue-500/15 text-blue-800'
                                                }`}
                                                style={{
                                                    left: signPlaceholderOverlay.left,
                                                    top: signPlaceholderOverlay.top,
                                                    width: signPlaceholderOverlay.width,
                                                    height: signPlaceholderOverlay.height,
                                                }}
                                            >
                                                Area tanda tangan
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                Gagal memuat preview dokumen{signPreviewError ? `: ${signPreviewError}` : '.'}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" className="border-slate-300" onClick={() => setSignDialog(null)} disabled={loadingAction !== ''}>
                            Batal
                        </Button>
                        <Button
                            className="bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => signDialog && void handleAssignedSign(signDialog.documentId)}
                            disabled={loadingAction !== '' || !signDialog || !signPlacementConfirmed}
                        >
                            {loadingAction === 'Sign Dokumen' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenLine className="mr-2 h-4 w-4" />}
                            Ya, Tanda Tangani
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
}
