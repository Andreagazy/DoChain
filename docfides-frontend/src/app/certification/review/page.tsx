'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, MapPinned, PenLine, QrCode } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { CertificationStepper } from '@/components/certification/certification-stepper';
import {
    finalizeDocumentQr,
    getCertificationDocumentFile,
    getIdentityStatus,
    getDocumentSignerPlaceholders,
    getSignatureStatus,
    getUser,
    listMyCertificationDocuments,
    signDocumentCertification,
} from '@/lib/auth-service';
import {
    buildCertificationStepHref,
    getActiveCertificationDocumentId,
    loadPdfJsModule,
    normalizeErrorMessage,
    setActiveCertificationDocumentId,
    type PdfDocumentProxy,
    type PlaceholderConfig,
} from '@/lib/certification-flow';
import type { OwnedDocumentItem, User } from '@/types/auth';

const getStoredSignerName = (signer: { fullName?: string | null; displayName?: string | null; email?: string | null; userId: string }) =>
    signer.fullName ?? signer.displayName ?? signer.email ?? 'Signer';

const DEFAULT_QR_CODE_SIZE = 48;

function CertificationReviewContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [hasSignature, setHasSignature] = useState(false);
    const [myDocuments, setMyDocuments] = useState<OwnedDocumentItem[]>([]);
    const [selectedDocumentId, setSelectedDocumentId] = useState('');
    const signingReason = 'DOCChain digital signature';
    const [signerDetailsLoading, setSignerDetailsLoading] = useState(false);
    const [documentSignerDetails, setDocumentSignerDetails] = useState<Awaited<ReturnType<typeof getDocumentSignerPlaceholders>> | null>(null);
    const [signConfirmOpen, setSignConfirmOpen] = useState(false);
    const [signPlaceholderConfirmed, setSignPlaceholderConfirmed] = useState(false);
    const [selectedDocumentPreviewUrl, setSelectedDocumentPreviewUrl] = useState('');
    const [selectedDocumentPreviewBlob, setSelectedDocumentPreviewBlob] = useState<Blob | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState('');
    const [previewPage, setPreviewPage] = useState(1);
    const [previewPageCount, setPreviewPageCount] = useState(0);
    const [previewPdfDocument, setPreviewPdfDocument] = useState<PdfDocumentProxy | null>(null);
    const [renderedPageSize, setRenderedPageSize] = useState<{
        pdfWidth: number;
        pdfHeight: number;
        viewWidth: number;
        viewHeight: number;
    } | null>(null);
    const [qrCodePlacement, setQrCodePlacement] = useState<PlaceholderConfig | null>(null);

    const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const previewContainerRef = useRef<HTMLDivElement | null>(null);

    const selectedDocument = useMemo(
        () => myDocuments.find((document) => document.id === selectedDocumentId) ?? null,
        [myDocuments, selectedDocumentId],
    );

    const signedSignerCount = documentSignerDetails?.signers.filter((signer) => signer.status === 'SIGNED').length ?? 0;
    const totalSignerCount = documentSignerDetails?.signers.length ?? selectedDocument?.requiredSignerCount ?? 0;
    const isFullySigned = selectedDocument?.status === 'FULLY_SIGNED';
    const canPlaceQrBeforeSigning = false;
    const shouldShowQrPlacement = false;
    const isCurrentUserSelectedSigner = Boolean(
        currentUser?.id &&
        documentSignerDetails?.signers.some((signer) => signer.userId === currentUser.id),
    );
    const currentUserSigner = useMemo(
        () => documentSignerDetails?.signers.find((signer) => signer.userId === currentUser?.id) ?? null,
        [currentUser?.id, documentSignerDetails?.signers],
    );
    const currentUserPlaceholder = useMemo<PlaceholderConfig | null>(() => {
        const placeholder = currentUserSigner?.placeholder;
        if (
            !placeholder ||
            placeholder.visiblePage === null ||
            placeholder.visibleX === null ||
            placeholder.visibleY === null ||
            placeholder.visibleWidth === null ||
            placeholder.visibleHeight === null
        ) {
            return null;
        }

        return {
            visiblePage: placeholder.visiblePage,
            visibleX: placeholder.visibleX,
            visibleY: placeholder.visibleY,
            visibleWidth: placeholder.visibleWidth,
            visibleHeight: placeholder.visibleHeight,
        };
    }, [currentUserSigner?.placeholder]);
    const canShowSignAction =
        Boolean(selectedDocument) &&
        !isFullySigned &&
        Boolean(documentSignerDetails?.signers.length) &&
        isCurrentUserSelectedSigner;

    const refreshSelectedDocumentState = async (documentId: string) => {
        const [documents, signerDetails] = await Promise.all([
            listMyCertificationDocuments(),
            getDocumentSignerPlaceholders(documentId).catch(() => null),
        ]);

        setMyDocuments(documents.documents);
        setDocumentSignerDetails(signerDetails);
    };

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

    useEffect(() => {
        async function loadPage() {
            try {
                setCurrentUser(getUser());

                const [identityStatus, signatureStatus, documents] = await Promise.all([
                    getIdentityStatus(),
                    getSignatureStatus(),
                    listMyCertificationDocuments(),
                ]);

                if (identityStatus.status !== 'APPROVED') {
                    router.push('/profile#identitas-ktp');
                    return;
                }

                setHasSignature(signatureStatus.hasSignature);
                setMyDocuments(documents.documents);

                const documentIdFromQuery = searchParams.get('documentId')?.trim() ?? '';
                const documentIdFromSession = getActiveCertificationDocumentId();

                setSelectedDocumentId((current) => {
                    const candidates = [
                        documentIdFromQuery,
                        documentIdFromSession,
                        current,
                        documents.documents[0]?.id ?? '',
                    ];
                    const selectedId = candidates.find((candidate) =>
                        candidate && documents.documents.some((document) => document.id === candidate)
                    ) ?? '';

                    if (selectedId) {
                        setActiveCertificationDocumentId(selectedId);
                    }

                    if (documentIdFromQuery) {
                        router.replace(buildCertificationStepHref('review'), { scroll: false });
                    }

                    return selectedId;
                });
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }

        void loadPage();
    }, [router, searchParams]);

    useEffect(() => {
        let cancelled = false;

        async function loadDocumentSignerDetails() {
            if (!selectedDocumentId) {
                setDocumentSignerDetails(null);
                return;
            }

            setSignerDetailsLoading(true);
            try {
                const data = await getDocumentSignerPlaceholders(selectedDocumentId);
                if (!cancelled) {
                    setDocumentSignerDetails(data);
                }
            } catch {
                if (!cancelled) {
                    setDocumentSignerDetails(null);
                }
            } finally {
                if (!cancelled) {
                    setSignerDetailsLoading(false);
                }
            }
        }

        void loadDocumentSignerDetails();

        return () => {
            cancelled = true;
        };
    }, [selectedDocumentId]);

    useEffect(() => {
        setQrCodePlacement(null);
        setSignPlaceholderConfirmed(false);
    }, [selectedDocumentId]);

    useEffect(() => {
        if (!signConfirmOpen) {
            setSignPlaceholderConfirmed(false);
        }
    }, [signConfirmOpen]);

    useEffect(() => {
        let objectUrl = '';

        async function loadPreviewForQr() {
            setPreviewError('');
            setPreviewPage(1);
            setPreviewPageCount(0);
            setRenderedPageSize(null);
            setSelectedDocumentPreviewBlob(null);
            setPreviewPdfDocument(null);

            if (!selectedDocumentId || (!canPlaceQrBeforeSigning && !signConfirmOpen)) {
                setSelectedDocumentPreviewUrl('');
                return;
            }

            setPreviewLoading(true);
            try {
                const blob = await getCertificationDocumentFile(selectedDocumentId);
                setSelectedDocumentPreviewBlob(blob);
                objectUrl = URL.createObjectURL(blob);
                setSelectedDocumentPreviewUrl(objectUrl);
            } catch (err) {
                setSelectedDocumentPreviewUrl('');
                setPreviewError(normalizeErrorMessage(err));
            } finally {
                setPreviewLoading(false);
            }
        }

        void loadPreviewForQr();

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [selectedDocumentId, canPlaceQrBeforeSigning, signConfirmOpen]);

    useEffect(() => {
        let cancelled = false;
        let loadedDocument: PdfDocumentProxy | null = null;

        async function loadPdfDocument() {
            if (!selectedDocumentPreviewBlob) {
                setPreviewPdfDocument(null);
                setPreviewPageCount(0);
                return;
            }

            try {
                const pdfjs = await loadPdfJsModule();
                const buffer = await selectedDocumentPreviewBlob.arrayBuffer();
                const loadingTask = pdfjs.getDocument({
                    data: new Uint8Array(buffer),
                    disableWorker: true,
                });
                const document = await loadingTask.promise;

                if (cancelled) {
                    document.destroy?.();
                    return;
                }

                loadedDocument = document;
                setPreviewPdfDocument(document);
                setPreviewPageCount(document.numPages);
                setPreviewPage(1);
            } catch (err) {
                if (!cancelled) {
                    setPreviewError(normalizeErrorMessage(err));
                }
            }
        }

        void loadPdfDocument();

        return () => {
            cancelled = true;
            loadedDocument?.destroy?.();
        };
    }, [selectedDocumentPreviewBlob]);

    useEffect(() => {
        let cancelled = false;
        let activeRenderTask: { cancel: () => void } | null = null;

        async function renderPreviewPage() {
            if (!previewPdfDocument || !previewCanvasRef.current || !previewContainerRef.current) {
                return;
            }

            const page = await previewPdfDocument.getPage(previewPage);
            if (cancelled || !previewCanvasRef.current || !previewContainerRef.current) {
                return;
            }

            const unscaledViewport = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: 1 });

            const canvas = previewCanvasRef.current;
            const context = canvas.getContext('2d');
            if (!context) {
                return;
            }

            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;

            const renderTask = page.render({
                canvasContext: context,
                canvas,
                viewport,
            });

            activeRenderTask = renderTask;
            await renderTask.promise;

            if (!cancelled) {
                setRenderedPageSize({
                    pdfWidth: unscaledViewport.width,
                    pdfHeight: unscaledViewport.height,
                    viewWidth: viewport.width,
                    viewHeight: viewport.height,
                });
                page.cleanup?.();
            }
        }

        void renderPreviewPage();

        return () => {
            cancelled = true;
            activeRenderTask?.cancel();
        };
    }, [previewPdfDocument, previewPage, previewLoading]);

    const qrOverlayBox = useMemo(() => {
        if (!renderedPageSize || !qrCodePlacement || qrCodePlacement.visiblePage !== previewPage) {
            return null;
        }

        const scaleX = renderedPageSize.viewWidth / renderedPageSize.pdfWidth;
        const scaleY = renderedPageSize.viewHeight / renderedPageSize.pdfHeight;

        return {
            left: qrCodePlacement.visibleX * scaleX,
            top: (renderedPageSize.pdfHeight - (qrCodePlacement.visibleY + qrCodePlacement.visibleHeight)) * scaleY,
            width: qrCodePlacement.visibleWidth * scaleX,
            height: qrCodePlacement.visibleHeight * scaleY,
        };
    }, [previewPage, qrCodePlacement, renderedPageSize]);

    const signOverlayBox = useMemo(() => {
        if (!renderedPageSize || !currentUserPlaceholder || currentUserPlaceholder.visiblePage !== previewPage) {
            return null;
        }

        const scaleX = renderedPageSize.viewWidth / renderedPageSize.pdfWidth;
        const scaleY = renderedPageSize.viewHeight / renderedPageSize.pdfHeight;

        return {
            left: currentUserPlaceholder.visibleX * scaleX,
            top: (renderedPageSize.pdfHeight - (currentUserPlaceholder.visibleY + currentUserPlaceholder.visibleHeight)) * scaleY,
            width: currentUserPlaceholder.visibleWidth * scaleX,
            height: currentUserPlaceholder.visibleHeight * scaleY,
        };
    }, [currentUserPlaceholder, previewPage, renderedPageSize]);

    const handleQrPickPosition = (event: MouseEvent<HTMLCanvasElement>) => {
        if (!canPlaceQrBeforeSigning) {
            setError('QR verifikasi hanya dapat ditempatkan sebelum tanda tangan pertama.');
            return;
        }

        if (!previewCanvasRef.current || !renderedPageSize) {
            return;
        }

        const rect = previewCanvasRef.current.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        const scaleX = renderedPageSize.viewWidth / renderedPageSize.pdfWidth;
        const scaleY = renderedPageSize.viewHeight / renderedPageSize.pdfHeight;

        const currentConfig = qrCodePlacement ?? {
            visiblePage: previewPage,
            visibleX: 36,
            visibleY: 36,
            visibleWidth: DEFAULT_QR_CODE_SIZE,
            visibleHeight: DEFAULT_QR_CODE_SIZE,
        };
        const width = currentConfig.visibleWidth;
        const height = currentConfig.visibleHeight;

        const rawPdfX = clickX / scaleX - width / 2;
        const rawPdfY = renderedPageSize.pdfHeight - clickY / scaleY - height / 2;

        const nextX = Math.max(0, Math.min(renderedPageSize.pdfWidth - width, rawPdfX));
        const nextY = Math.max(0, Math.min(renderedPageSize.pdfHeight - height, rawPdfY));

        setQrCodePlacement({
            ...currentConfig,
            visiblePage: previewPage,
            visibleX: Number(nextX.toFixed(2)),
            visibleY: Number(nextY.toFixed(2)),
        });
    };

    const openOwnerSignConfirmation = () => {
        if (!selectedDocumentId) {
            setError('Pilih dokumen terlebih dahulu.');
            return;
        }

        if (isFullySigned) {
            setError('Dokumen ini sudah selesai ditandatangani.');
            return;
        }

        if (!hasSignature) {
            router.push('/signature-setup?next=/certification');
            return;
        }

        if (!isCurrentUserSelectedSigner) {
            setError('Akun Anda tidak terdaftar sebagai penandatangan pada dokumen ini.');
            return;
        }

        if (!currentUserPlaceholder) {
            setError('Placeholder tanda tangan Anda belum tersedia. Kembali ke langkah Placeholder untuk mengatur posisi tanda tangan.');
            return;
        }

        setPreviewPage(currentUserPlaceholder.visiblePage);
        setSignPlaceholderConfirmed(false);
        setSignConfirmOpen(true);
    };

    const handleOwnerSign = async () => {
        if (!currentUserPlaceholder || !signPlaceholderConfirmed) {
            setError('Klik area placeholder tanda tangan Anda pada preview dokumen terlebih dahulu.');
            return;
        }

        await execute('Sign Dokumen', async () => {
            const result = await signDocumentCertification(selectedDocumentId, {
                mode: 'visible',
                reason: signingReason,
                visiblePage: currentUserPlaceholder.visiblePage,
                visibleX: currentUserPlaceholder.visibleX,
                visibleY: currentUserPlaceholder.visibleY,
                visibleWidth: currentUserPlaceholder.visibleWidth,
                visibleHeight: currentUserPlaceholder.visibleHeight,
            });

            setMyDocuments((currentDocuments) =>
                currentDocuments.map((document) =>
                    document.id === selectedDocumentId
                        ? {
                            ...document,
                            status: result.document.status,
                            finalFileName: result.document.finalFileName,
                            finalFileIpfsHash: result.document.finalFileIpfsHash ?? document.finalFileIpfsHash,
                            finalFileIpfsGatewayUrl: result.signedFile.ipfsGatewayUrl ?? document.finalFileIpfsGatewayUrl,
                            updatedAt: result.document.updatedAt,
                        }
                        : document,
                ),
            );

            await refreshSelectedDocumentState(selectedDocumentId);
            setSignConfirmOpen(false);
        });
    };

    const handleFinalizeQr = async () => {
        if (!selectedDocumentId) {
            setError('Pilih dokumen terlebih dahulu.');
            return;
        }

        if (!qrCodePlacement) {
            setError('Klik posisi QR pada preview dokumen terlebih dahulu.');
            return;
        }

        await execute('Simpan QR', async () => {
            const result = await finalizeDocumentQr(selectedDocumentId, {
                page: qrCodePlacement.visiblePage,
                x: qrCodePlacement.visibleX,
                y: qrCodePlacement.visibleY,
                width: qrCodePlacement.visibleWidth,
                height: qrCodePlacement.visibleHeight,
            });

            setMyDocuments((currentDocuments) =>
                currentDocuments.map((document) =>
                    document.id === selectedDocumentId
                        ? {
                            ...document,
                            status: result.document.status,
                            finalFileName: result.document.finalFileName,
                            finalFileIpfsHash: result.document.finalFileIpfsHash ?? null,
                            finalFileIpfsGatewayUrl: result.file.ipfsGatewayUrl ?? document.finalFileIpfsGatewayUrl,
                            hasVerificationQr: true,
                            updatedAt: result.document.updatedAt,
                        }
                        : document,
                ),
            );

            setQrCodePlacement(null);
            await refreshSelectedDocumentState(selectedDocumentId);
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex items-center gap-2 text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menyiapkan langkah review...</span>
                </div>
            </div>
        );
    }

    return (
        <AppShell title="Sertifikasi - Review" subtitle="Langkah terakhir: tinjau konfigurasi, lalu tanda tangani.">
            <div className="flex flex-col gap-6">
                <CertificationStepper currentStep="review" documentId={selectedDocumentId} />

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

                <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
                    <Badge className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700 hover:bg-white">Review Sertifikasi</Badge>
                    <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Tinjau dokumen sebelum tanda tangan.</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        QR verifikasi akan ditempatkan otomatis pada halaman tanda tangan. Pastikan posisi tanda tangan sudah benar sebelum melanjutkan.
                    </p>
                </section>

                <Card className={`rounded-2xl border-blue-100 bg-white shadow-sm ${shouldShowQrPlacement ? 'order-2' : ''}`}>
                    <CardHeader>
                        <CardTitle>Detail Dokumen</CardTitle>
                        <CardDescription>Ringkasan dokumen dan status penandatanganan sebelum melanjutkan sign.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Dokumen</p>
                                <p className="mt-1 font-semibold text-slate-900">{selectedDocument?.originalFileName ?? selectedDocument?.id ?? '-'}</p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Status Dokumen</p>
                                <p className="mt-1 font-semibold text-slate-900">{selectedDocument?.status ?? '-'}</p>
                                <p className="mt-1 text-xs text-slate-500">Owner: {currentUser?.displayName ?? currentUser?.email ?? 'Unknown'}</p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Sign Status</p>
                                <p className="mt-1 font-semibold text-slate-900">{signedSignerCount} / {totalSignerCount} sudah sign</p>
                                <p className="mt-1 text-xs text-slate-500">Mode signing: {hasSignature ? 'Visible ready' : 'Visible missing'}</p>
                            </div>
                        </div>

                        <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">Status Signer</p>
                                    <p className="text-xs text-slate-500">Daftar signer pada dokumen ini dan statusnya.</p>
                                </div>
                                {signerDetailsLoading ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : null}
                            </div>

                            {documentSignerDetails?.signers?.length ? (
                                <div className="space-y-2">
                                    {documentSignerDetails.signers.map((signer, index) => (
                                        <div key={`${signer.userId}-${signer.order ?? index}`} className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-slate-900">Urutan {signer.order ?? index + 1}: {getStoredSignerName(signer)}</p>
                                                <p className="text-xs text-slate-500">{signer.email ?? '-'}</p>
                                            </div>
                                            <Badge variant={signer.status === 'SIGNED' ? 'success' : signer.status === 'PENDING' ? 'warning' : 'neutral'}>{signer.status}</Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">Belum ada detail signer untuk dokumen ini.</p>
                            )}
                        </div>

                        {selectedDocument && documentSignerDetails?.signers?.length && !isCurrentUserSelectedSigner ? (
                            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                                <AlertDescription>
                                    Akun Anda tidak terdaftar sebagai penandatangan dokumen ini, sehingga proses tanda tangan tidak dapat dilakukan dari halaman review.
                                </AlertDescription>
                            </Alert>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" className="border-slate-300" onClick={() => {
                                setActiveCertificationDocumentId(selectedDocumentId);
                                router.push(buildCertificationStepHref('placeholders', selectedDocumentId));
                            }}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Kembali ke Placeholder
                            </Button>
                            {isFullySigned ? (
                                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                                    Semua signer sudah selesai. Dokumen final sudah tersimpan.
                                </div>
                            ) : (
                                <Button className="rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700" onClick={openOwnerSignConfirmation} disabled={loadingAction !== '' || !canShowSignAction}>
                                    {loadingAction === 'Sign Dokumen' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenLine className="mr-2 h-4 w-4" />}
                                    Sign Dokumen Terpilih
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {canPlaceQrBeforeSigning ? (
                    <Card className="order-1 rounded-2xl border-blue-100 bg-white shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <QrCode className="h-5 w-5 text-blue-600" />
                                Letakkan QR Verifikasi
                            </CardTitle>
                            <CardDescription>
                                Klik posisi QR sebelum tanda tangan pertama dimulai agar tanda tangan digital tetap valid.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {previewLoading ? (
                                <div className="flex min-h-80 items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-8">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Memuat preview dokumen...</span>
                                    </div>
                                </div>
                            ) : previewError ? (
                                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                    Gagal memuat preview dokumen: {previewError}
                                </div>
                            ) : selectedDocumentPreviewUrl ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <MapPinned className="h-4 w-4" />
                                            <span>Klik halaman PDF ukuran asli untuk menentukan lokasi QR</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {previewPageCount > 0 ? (
                                                <>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="h-8 border-slate-300 px-3 text-xs"
                                                        onClick={() => setPreviewPage((page) => Math.max(1, page - 1))}
                                                        disabled={previewPage <= 1}
                                                    >
                                                        Sebelumnya
                                                    </Button>
                                                    <span className="text-xs text-slate-600">{previewPage} / {previewPageCount}</span>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="h-8 border-slate-300 px-3 text-xs"
                                                        onClick={() => setPreviewPage((page) => Math.min(previewPageCount, page + 1))}
                                                        disabled={previewPage >= previewPageCount}
                                                    >
                                                        Berikutnya
                                                    </Button>
                                                </>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div ref={previewContainerRef} className="max-h-[70vh] w-full overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2">
                                        <div className="relative mx-auto inline-block">
                                            <canvas ref={previewCanvasRef} className="block cursor-crosshair rounded-md bg-white shadow-sm" onClick={handleQrPickPosition} />
                                            {qrOverlayBox ? (
                                                <div
                                                    className="pointer-events-none absolute border-2 border-blue-600 bg-blue-100/30"
                                                    style={{
                                                        left: `${qrOverlayBox.left}px`,
                                                        top: `${qrOverlayBox.top}px`,
                                                        width: `${qrOverlayBox.width}px`,
                                                        height: `${qrOverlayBox.height}px`,
                                                    }}
                                                >
                                                    <span className="absolute -top-5 left-0 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">QR</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button className="rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700" onClick={handleFinalizeQr} disabled={loadingAction !== '' || !qrCodePlacement}>
                                            {loadingAction === 'Simpan QR' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                                            Simpan QR
                                        </Button>
                                        <span className="text-sm text-slate-500">
                                            {qrCodePlacement ? `QR di page ${qrCodePlacement.visiblePage}` : 'Posisi QR belum dipilih.'}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                    Preview dokumen belum tersedia.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ) : null}

                <Dialog open={signConfirmOpen} onOpenChange={setSignConfirmOpen}>
                    <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-5xl">
                        <DialogHeader>
                            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                                <PenLine className="h-5 w-5" />
                            </div>
                            <DialogTitle>Konfirmasi Tanda Tangan</DialogTitle>
                            <DialogDescription>
                                Tinjau dokumen, klik area placeholder tanda tangan Anda, lalu konfirmasi tanda tangan.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                    <p className="text-sm font-semibold text-slate-800">
                                        {selectedDocument?.originalFileName ?? selectedDocument?.finalFileName ?? 'Dokumen sertifikasi'}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-8 border-slate-300 px-3 text-xs"
                                            onClick={() => setPreviewPage((page) => Math.max(1, page - 1))}
                                            disabled={previewPage <= 1 || previewLoading}
                                        >
                                            Sebelumnya
                                        </Button>
                                        <span className="text-xs text-slate-600">{previewPage} / {previewPageCount || 1}</span>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-8 border-slate-300 px-3 text-xs"
                                            onClick={() => setPreviewPage((page) => Math.min(previewPageCount || page, page + 1))}
                                            disabled={previewPage >= previewPageCount || previewLoading || previewPageCount === 0}
                                        >
                                            Berikutnya
                                        </Button>
                                    </div>
                                </div>

                                <div ref={previewContainerRef} className="max-h-[68vh] w-full overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-2">
                                    {previewLoading ? (
                                        <div className="flex min-h-[420px] items-center justify-center text-slate-600">
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Memuat preview dokumen...
                                        </div>
                                    ) : previewError ? (
                                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                            Gagal memuat preview dokumen: {previewError}
                                        </div>
                                    ) : (
                                        <div className="relative mx-auto inline-block">
                                            <canvas ref={previewCanvasRef} className="block rounded-md bg-white shadow-sm" />
                                            {signOverlayBox ? (
                                                <button
                                                    type="button"
                                                    aria-label="Konfirmasi area tanda tangan"
                                                    className={`absolute flex items-center justify-center rounded-sm border-2 text-[11px] font-bold transition ${
                                                        signPlaceholderConfirmed
                                                            ? 'border-emerald-600 bg-emerald-100/60 text-emerald-800'
                                                            : 'border-blue-600 bg-blue-100/45 text-blue-800 hover:bg-blue-200/70'
                                                    }`}
                                                    style={{
                                                        left: `${signOverlayBox.left}px`,
                                                        top: `${signOverlayBox.top}px`,
                                                        width: `${signOverlayBox.width}px`,
                                                        height: `${signOverlayBox.height}px`,
                                                    }}
                                                    onClick={() => {
                                                        setError('');
                                                        setSignPlaceholderConfirmed(true);
                                                    }}
                                                >
                                                    {signPlaceholderConfirmed ? 'Dipilih' : 'Klik area TTD'}
                                                </button>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-xs font-semibold uppercase text-slate-500">Penandatangan</p>
                                    <p className="mt-1 font-semibold text-slate-900">{currentUserSigner ? getStoredSignerName(currentUserSigner) : '-'}</p>
                                    <p className="mt-1 text-xs text-slate-500">{currentUserSigner?.email ?? currentUser?.email ?? '-'}</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-xs font-semibold uppercase text-slate-500">Status Signer</p>
                                    <p className="mt-1 text-slate-800">{signedSignerCount} / {totalSignerCount}</p>
                                </div>
                                <div className={`rounded-lg border p-3 ${signPlaceholderConfirmed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                                    <p className="font-semibold">
                                        {signPlaceholderConfirmed ? 'Area tanda tangan sudah dipilih' : 'Klik placeholder tanda tangan'}
                                    </p>
                                    <p className="mt-1 text-xs">
                                        {currentUserPlaceholder
                                            ? `Placeholder berada di halaman ${currentUserPlaceholder.visiblePage}.`
                                            : 'Placeholder tanda tangan belum tersedia.'}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2 pt-2">
                                    <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => void handleOwnerSign()} disabled={loadingAction !== '' || !signPlaceholderConfirmed}>
                                        {loadingAction === 'Sign Dokumen' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenLine className="mr-2 h-4 w-4" />}
                                        Ya, Tanda Tangani
                                    </Button>
                                    <Button variant="outline" className="border-slate-300" onClick={() => setSignConfirmOpen(false)} disabled={loadingAction !== ''}>
                                        Batal
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* <Card className="rounded-lg border-blue-100 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle>Dokumen Saya</CardTitle>
                        <CardDescription>Dokumen yang sudah disiapkan untuk certification.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {myDocuments.length === 0 ? (
                            <p className="text-slate-500">Belum ada dokumen.</p>
                        ) : (
                            myDocuments.map((document) => (
                                <button
                                    key={document.id}
                                    type="button"
                                    onClick={() => {
                                        setActiveCertificationDocumentId(document.id);
                                        setSelectedDocumentId(document.id);
                                    }}
                                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-slate-50 ${selectedDocumentId === document.id ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-800'}`}
                                >
                                    <span className="truncate pr-3 font-medium">{document.originalFileName ?? document.id}</span>
                                    <Badge variant="neutral">{document.status}</Badge>
                                </button>
                            ))
                        )}
                    </CardContent>
                </Card> */}

            </div>
        </AppShell>
    );
}

export default function CertificationReviewPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#f6f7f9]" />}>
            <CertificationReviewContent />
        </Suspense>
    );
}
