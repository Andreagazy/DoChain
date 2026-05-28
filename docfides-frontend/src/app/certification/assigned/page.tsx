'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ExternalLink, Loader2, PenLine, PlayCircle, XCircle } from 'lucide-react';
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
        () => assignments.filter((assignment) => assignment.signerStatus === 'PENDING'),
        [assignments],
    );

    const signedAssignments = useMemo(
        () => assignments.filter((assignment) => assignment.signerStatus === 'SIGNED'),
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
                    router.push('/identity');
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
            title: assignment.document.originalFileName ?? assignment.document.id,
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
                reason: 'DoChain digital signature',
            });
            await refreshAssignments();
        });
    };

    const openDeclineDialog = (assignment: AssignedDocumentItem) => {
        setDeclineReason('');
        setDeclineDialog({
            documentId: assignment.document.id,
            title: assignment.document.originalFileName ?? assignment.document.id,
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
        <AppShell title="Need Signature" subtitle="Dokumen yang menunggu tanda tangan Anda.">
            <div className="space-y-6">
                <section className="rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
                    <Badge variant="default">Assigned Documents</Badge>
                    <h1 className="mt-4 text-2xl font-semibold text-slate-950 md:text-3xl">Tinjau lalu tanda tangani dokumen.</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        Preview dokumen sebelum sign, lalu selesaikan permintaan yang masih pending.
                    </p>
                </section>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="rounded-lg border-blue-100 bg-white shadow-sm">
                        <CardContent className="pt-6">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Pending</p>
                            <p className="mt-2 text-3xl font-semibold text-slate-900">{pendingAssignments.length}</p>
                            <p className="mt-1 text-sm text-slate-600">Dokumen menunggu tanda tangan Anda.</p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-lg border-blue-100 bg-white shadow-sm">
                        <CardContent className="pt-6">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Signed</p>
                            <p className="mt-2 text-3xl font-semibold text-slate-900">{signedAssignments.length}</p>
                            <p className="mt-1 text-sm text-slate-600">Dokumen yang sudah Anda selesaikan.</p>
                        </CardContent>
                    </Card>
                    <Card className="rounded-lg border-blue-100 bg-white shadow-sm">
                        <CardContent className="pt-6">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Mode</p>
                            <p className="mt-2 text-3xl font-semibold text-slate-900">{preferredMode === 'visible' ? 'Visible' : 'Invisible'}</p>
                            <p className="mt-1 text-sm text-slate-600">{hasSignature ? 'Signature asset siap dipakai.' : 'Visible mode masih butuh signature asset.'}</p>
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

                <Card className="rounded-lg border-blue-100 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle>Daftar Dokumen</CardTitle>
                        <CardDescription>Setiap kartu bisa dibuka preview dulu sebelum menandatangani.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {assignments.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                Belum ada dokumen untuk Anda tandatangani.
                            </div>
                        ) : (
                            paginatedAssignments.map((assignment) => (
                                <div
                                    key={`${assignment.document.id}-${assignment.order ?? 'x'}`}
                                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"
                                >
                                    <div className="min-w-0 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="truncate text-sm font-semibold text-slate-900">
                                                {assignment.document.originalFileName ?? assignment.document.id}
                                            </h3>
                                            <Badge variant={assignment.signerStatus === 'PENDING' ? 'warning' : 'success'}>{assignment.signerStatus}</Badge>
                                        </div>
                                        <p className="text-xs text-slate-600">
                                            Owner: {assignment.document.ownerDisplayName ?? assignment.document.ownerEmail ?? '-'}
                                        </p>
                                        <p className="text-xs text-slate-600">
                                            Urutan: {assignment.order ?? '-'} | Status dokumen: {assignment.document.status}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <Button variant="outline" className="border-slate-300" onClick={() => openPreview(assignment)}>
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            Preview
                                        </Button>
                                        <Button
                                            onClick={() => handleAssignedSign(assignment.document.id)}
                                            disabled={loadingAction !== '' || assignment.signerStatus !== 'PENDING'}
                                        >
                                            {loadingAction === 'Sign Dokumen' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenLine className="mr-2 h-4 w-4" />}
                                            Sign Sekarang
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            onClick={() => openDeclineDialog(assignment)}
                                            disabled={loadingAction !== '' || assignment.signerStatus !== 'PENDING'}
                                        >
                                            <XCircle className="mr-2 h-4 w-4" />
                                            Tolak
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}

                        {assignments.length > ASSIGNMENTS_PER_PAGE ? (
                            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-slate-500">
                                    Menampilkan {(currentPage - 1) * ASSIGNMENTS_PER_PAGE + 1}-{Math.min(currentPage * ASSIGNMENTS_PER_PAGE, assignments.length)} dari {assignments.length} dokumen
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        className="border-slate-300"
                                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        Previous
                                    </Button>
                                    <span className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        className="border-slate-300"
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

                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="border-slate-300" onClick={() => router.push('/certification/review')}>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Kembali ke Review
                    </Button>
                </div>
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
