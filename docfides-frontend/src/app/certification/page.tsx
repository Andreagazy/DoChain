'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AxiosError } from 'axios';
import { AlertCircle, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/layout/app-shell';
import { StatusBadge } from '@/components/documents/status-badge';
import {
    getCertificationDocumentFile,
    getDocumentSignerPlaceholders,
    getUser,
    getIdentityStatus,
    getSignatureStatus,
    listAssignedCertificationDocuments,
    listMyCertificationDocuments,
    listSignerCandidates,
    requestDocumentSigners,
    signDocumentCertification,
    startDocumentCertification,
    uploadDocumentForCertification,
} from '@/lib/auth-service';
import type { AssignedDocumentItem, OwnedDocumentItem, SignerCandidate, User } from '@/types/auth';

type ApiError = {
    message?: string | string[];
};

type PlaceholderConfig = {
    visiblePage: number;
    visibleX: number;
    visibleY: number;
    visibleWidth: number;
    visibleHeight: number;
};

type PdfViewport = {
    width: number;
    height: number;
};

type PdfRenderTask = {
    promise: Promise<void>;
    cancel: () => void;
};

type PdfPageProxy = {
    getViewport: (options: { scale: number }) => PdfViewport;
    render: (options: {
        canvasContext: CanvasRenderingContext2D;
        canvas: HTMLCanvasElement;
        viewport: PdfViewport;
    }) => PdfRenderTask;
    cleanup?: () => void;
};

type PdfDocumentProxy = {
    numPages: number;
    getPage: (pageNumber: number) => Promise<PdfPageProxy>;
    destroy?: () => void;
};

type PdfJsModule = {
    getDocument: (options: {
        data: Uint8Array;
        disableWorker?: boolean;
    }) => {
        promise: Promise<PdfDocumentProxy>;
    };
    GlobalWorkerOptions?: {
        workerSrc?: string;
    };
};

let cachedPdfJsModule: PdfJsModule | null = null;

async function loadPdfJsModule(): Promise<PdfJsModule> {
    if (cachedPdfJsModule) {
        return cachedPdfJsModule;
    }

    try {
        const pdfModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const pdfModuleLoaded = pdfModule as PdfJsModule & { GlobalWorkerOptions: { workerSrc: string } };

        if (pdfModuleLoaded.GlobalWorkerOptions) {
            pdfModuleLoaded.GlobalWorkerOptions.workerSrc = new URL(
                'pdfjs-dist/legacy/build/pdf.worker.mjs',
                import.meta.url
            ).href;
        }

        cachedPdfJsModule = pdfModuleLoaded;
        return cachedPdfJsModule;
    } catch {
        const fallbackModule = await import('pdfjs-dist/build/pdf.mjs');
        const pdfModuleLoaded = fallbackModule as PdfJsModule & { GlobalWorkerOptions: { workerSrc: string } };

        if (pdfModuleLoaded.GlobalWorkerOptions) {
            pdfModuleLoaded.GlobalWorkerOptions.workerSrc = new URL(
                'pdfjs-dist/build/pdf.worker.mjs',
                import.meta.url
            ).href;
        }

        cachedPdfJsModule = pdfModuleLoaded;
        return cachedPdfJsModule;
    }
}

function normalizeErrorMessage(err: unknown): string {
    const axiosError = err as AxiosError<ApiError>;
    const message = axiosError.response?.data?.message;
    return Array.isArray(message)
        ? message.join(', ')
        : message ?? axiosError.message ?? 'Terjadi kesalahan';
}

function CertificationFlowContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [preferredMode, setPreferredMode] = useState<'visible' | 'invisible'>('invisible');
    const [hasSignature, setHasSignature] = useState(false);

    const [myDocuments, setMyDocuments] = useState<OwnedDocumentItem[]>([]);
    const [assignedDocuments, setAssignedDocuments] = useState<AssignedDocumentItem[]>([]);
    const [signerCandidates, setSignerCandidates] = useState<SignerCandidate[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    const [selectedDocumentId, setSelectedDocumentId] = useState('');
    const [documentSearch, setDocumentSearch] = useState('');
    const [documentFile, setDocumentFile] = useState<File | null>(null);
    const [reason, setReason] = useState('DoChain digital signature');
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

    const [signerSearch, setSignerSearch] = useState('');
    const [orderedSignerIds, setOrderedSignerIds] = useState<string[]>([]);
    const [placeholderBySignerId, setPlaceholderBySignerId] = useState<Record<string, PlaceholderConfig>>({});
    const [activePickerSignerId, setActivePickerSignerId] = useState('');

    const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const previewContainerRef = useRef<HTMLDivElement | null>(null);

    const selectedDocument = useMemo(
        () => myDocuments.find((doc) => doc.id === selectedDocumentId) ?? null,
        [myDocuments, selectedDocumentId],
    );

    const documentSearchResults = useMemo(() => {
        const term = documentSearch.trim().toLowerCase();
        if (!term) {
            return myDocuments.slice(0, 8);
        }

        return myDocuments.filter((doc) => {
            const name = (doc.originalFileName ?? doc.id).toLowerCase();
            return name.includes(term) || doc.id.toLowerCase().includes(term);
        });
    }, [documentSearch, myDocuments]);

    const signerOptions = useMemo(() => {
        const options = [...signerCandidates];
        if (currentUser) {
            options.unshift({
                id: currentUser.id,
                email: currentUser.email,
                displayName: `${currentUser.displayName ?? 'Saya'} (Owner Dokumen)`,
                preferredSignatureMode: preferredMode,
            });
        }
        return options;
    }, [currentUser, signerCandidates, preferredMode]);

    const signerPreferenceById = useMemo(() => {
        return new Map(signerOptions.map((item) => [item.id, item.preferredSignatureMode]));
    }, [signerOptions]);

    const availableSignerOptions = useMemo(() => {
        const term = signerSearch.trim().toLowerCase();
        return signerOptions.filter((option) => {
            if (orderedSignerIds.includes(option.id)) {
                return false;
            }

            if (!term) {
                return true;
            }

            const label = (option.displayName ?? option.email).toLowerCase();
            return label.includes(term) || option.email.toLowerCase().includes(term);
        });
    }, [orderedSignerIds, signerOptions, signerSearch]);

    const signerById = useMemo(() => {
        return new Map(signerOptions.map((item) => [item.id, item]));
    }, [signerOptions]);

    const getDefaultPlaceholder = (index: number): PlaceholderConfig => ({
        visiblePage: 1,
        visibleX: 36,
        visibleY: 36 + index * 80,
        visibleWidth: 160,
        visibleHeight: 70,
    });

    const refreshData = useCallback(async () => {
        const [identityStatus, signatureStatus, myDocs, assignedDocs, candidates] = await Promise.all([
            getIdentityStatus(),
            getSignatureStatus(),
            listMyCertificationDocuments(),
            listAssignedCertificationDocuments(),
            listSignerCandidates(),
        ]);

        if (identityStatus.status !== 'APPROVED') {
            router.push('/identity');
            return;
        }

        setHasSignature(signatureStatus.hasSignature);
        setPreferredMode(signatureStatus.preferredSignatureMode);
        setMyDocuments(myDocs.documents);
        setAssignedDocuments(assignedDocs.assignments);
        setSignerCandidates(candidates.signers);

        setSelectedDocumentId((current) => {
            const documentIdFromQuery = searchParams.get('documentId')?.trim();

            if (documentIdFromQuery && myDocs.documents.some((item) => item.id === documentIdFromQuery)) {
                return documentIdFromQuery;
            }

            if (current && myDocs.documents.some((item) => item.id === current)) {
                return current;
            }
            return myDocs.documents[0]?.id ?? '';
        });
    }, [router, searchParams]);

    useEffect(() => {
        async function loadPage() {
            try {
                setCurrentUser(getUser());
                await refreshData();
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }

        void loadPage();
    }, [refreshData, router]);

    useEffect(() => {
        let objectUrl = '';

        async function loadSelectedDocumentPreview() {
            setPreviewError('');
            setPreviewPage(1);
            setPreviewPageCount(0);
            setRenderedPageSize(null);
            setSelectedDocumentPreviewBlob(null);
            setPreviewPdfDocument(null);

            if (!selectedDocumentId) {
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

        void loadSelectedDocumentPreview();

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [selectedDocumentId]);

    useEffect(() => {
        let isMounted = true;

        async function loadStoredPlaceholders() {
            setOrderedSignerIds([]);
            setPlaceholderBySignerId({});
            setActivePickerSignerId('');

            if (!selectedDocumentId) {
                return;
            }

            try {
                const data = await getDocumentSignerPlaceholders(selectedDocumentId);
                if (!isMounted || !data.signers.length) {
                    return;
                }

                const sortedSigners = [...data.signers].sort((a, b) => {
                    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
                    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
                    return orderA - orderB;
                });

                const nextOrderIds = sortedSigners.map((item) => item.userId);
                const nextPlaceholderMap = sortedSigners.reduce<Record<string, PlaceholderConfig>>((acc, item, index) => {
                    const fallback = getDefaultPlaceholder(index);
                    acc[item.userId] = {
                        visiblePage: item.placeholder.visiblePage ?? fallback.visiblePage,
                        visibleX: item.placeholder.visibleX ?? fallback.visibleX,
                        visibleY: item.placeholder.visibleY ?? fallback.visibleY,
                        visibleWidth: item.placeholder.visibleWidth ?? fallback.visibleWidth,
                        visibleHeight: item.placeholder.visibleHeight ?? fallback.visibleHeight,
                    };
                    return acc;
                }, {});

                setOrderedSignerIds(nextOrderIds);
                setPlaceholderBySignerId(nextPlaceholderMap);
                setActivePickerSignerId(
                    sortedSigners.find((item) => signerPreferenceById.get(item.userId) === 'visible')?.userId ?? '',
                );
            } catch {
                // Ignore documents without signer setup yet.
            }
        }

        void loadStoredPlaceholders();

        return () => {
            isMounted = false;
        };
    }, [selectedDocumentId, signerPreferenceById]);

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
            const maxWidth = previewContainerRef.current.clientWidth > 0
                ? previewContainerRef.current.clientWidth
                : 920;
            const scale = maxWidth / unscaledViewport.width;
            const viewport = page.getViewport({ scale });

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
    }, [previewPdfDocument, previewPage]);

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

    const handleUploadDocument = async () => {
        if (!documentFile) {
            setError('Pilih file PDF terlebih dahulu.');
            return;
        }

        await execute('Upload Dokumen', async () => {
            const uploaded = await uploadDocumentForCertification(documentFile);
            setSelectedDocumentId(uploaded.id);
            setDocumentSearch(uploaded.originalFileName ?? '');
            setDocumentFile(null);
            await refreshData();
        });
    };

    const handleSaveSignerOrder = async () => {
        if (!selectedDocumentId) {
            setError('Pilih dokumen terlebih dahulu.');
            return;
        }

        await execute('Simpan Urutan Signer', async () => {
            await startDocumentCertification(selectedDocumentId);
            if (orderedSignerIds.length > 0) {
                const placeholdersForVisibleSigners = orderedSignerIds
                    .filter((signerId) => signerPreferenceById.get(signerId) === 'visible')
                    .map((signerId, index) => {
                        const orderIndex = orderedSignerIds.indexOf(signerId);
                        const fallback = getDefaultPlaceholder(orderIndex >= 0 ? orderIndex : index);
                        const configured = placeholderBySignerId[signerId] ?? fallback;
                        return {
                            signerUserId: signerId,
                            visiblePage: configured.visiblePage,
                            visibleX: configured.visibleX,
                            visibleY: configured.visibleY,
                            visibleWidth: configured.visibleWidth,
                            visibleHeight: configured.visibleHeight,
                        };
                    });

                await requestDocumentSigners(selectedDocumentId, {
                    signerUserIds: orderedSignerIds,
                    ...(placeholdersForVisibleSigners.length > 0
                        ? { placeholders: placeholdersForVisibleSigners }
                        : {}),
                });
            }
            await refreshData();
        });
    };

    const handleOwnerSign = async () => {
        if (!selectedDocumentId) {
            setError('Pilih dokumen terlebih dahulu.');
            return;
        }

        if (preferredMode === 'visible' && !hasSignature) {
            router.push('/signature-setup?next=/certification');
            return;
        }

        await execute('Sign Dokumen', async () => {
            if (preferredMode === 'visible') {
                await signDocumentCertification(selectedDocumentId, {
                    mode: 'visible',
                    reason,
                });
            } else {
                await signDocumentCertification(selectedDocumentId, {
                    mode: 'invisible',
                    reason,
                });
            }
            await refreshData();
        });
    };

    const handleAssignedSign = async (documentId: string) => {
        if (preferredMode === 'visible' && !hasSignature) {
            router.push('/signature-setup?next=/certification');
            return;
        }

        await execute('Sign Dokumen Undangan', async () => {
            if (preferredMode === 'visible') {
                await signDocumentCertification(documentId, {
                    mode: 'visible',
                    reason,
                });
            } else {
                await signDocumentCertification(documentId, {
                    mode: 'invisible',
                    reason,
                });
            }

            await refreshData();
        });
    };

    const addSigner = (signerId: string) => {
        if (!signerId || orderedSignerIds.includes(signerId)) {
            return;
        }

        const shouldDefaultVisible = signerPreferenceById.get(signerId) === 'visible';

        setOrderedSignerIds((prev) => {
            const next = [...prev, signerId];
            setPlaceholderBySignerId((current) => ({
                ...current,
                [signerId]: current[signerId] ?? getDefaultPlaceholder(next.length - 1),
            }));
            if (shouldDefaultVisible && !activePickerSignerId) {
                setActivePickerSignerId(signerId);
            }
            return next;
        });
        setSignerSearch('');
    };

    const handlePreviewPickPosition = (event: MouseEvent<HTMLDivElement>) => {
        if (!activePickerSignerId || signerPreferenceById.get(activePickerSignerId) !== 'visible') {
            setError('Pilih signer yang mode-nya visible terlebih dahulu.');
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

        const currentConfig = placeholderBySignerId[activePickerSignerId] ?? getDefaultPlaceholder(0);
        const width = currentConfig.visibleWidth;
        const height = currentConfig.visibleHeight;

        const rawPdfX = clickX / scaleX - width / 2;
        const rawPdfY = renderedPageSize.pdfHeight - clickY / scaleY - height / 2;

        const nextX = Math.max(0, Math.min(renderedPageSize.pdfWidth - width, rawPdfX));
        const nextY = Math.max(0, Math.min(renderedPageSize.pdfHeight - height, rawPdfY));

        setPlaceholderBySignerId((current) => ({
            ...current,
            [activePickerSignerId]: {
                ...currentConfig,
                visiblePage: previewPage,
                visibleX: Number(nextX.toFixed(2)),
                visibleY: Number(nextY.toFixed(2)),
            },
        }));
    };

    const previewOverlayBoxes = useMemo(() => {
        if (!renderedPageSize) {
            return [];
        }

        const scaleX = renderedPageSize.viewWidth / renderedPageSize.pdfWidth;
        const scaleY = renderedPageSize.viewHeight / renderedPageSize.pdfHeight;

        return orderedSignerIds
            .map((signerId, index) => {
                if (signerPreferenceById.get(signerId) !== 'visible') {
                    return null;
                }

                const cfg = placeholderBySignerId[signerId] ?? getDefaultPlaceholder(index);
                if (cfg.visiblePage !== previewPage) {
                    return null;
                }

                const left = cfg.visibleX * scaleX;
                const top = (renderedPageSize.pdfHeight - (cfg.visibleY + cfg.visibleHeight)) * scaleY;
                const width = cfg.visibleWidth * scaleX;
                const height = cfg.visibleHeight * scaleY;

                return {
                    signerId,
                    order: index + 1,
                    left,
                    top,
                    width,
                    height,
                    isActive: signerId === activePickerSignerId,
                };
            })
            .filter((item): item is {
                signerId: string;
                order: number;
                left: number;
                top: number;
                width: number;
                height: number;
                isActive: boolean;
            } => item !== null);
    }, [activePickerSignerId, orderedSignerIds, placeholderBySignerId, previewPage, renderedPageSize, signerPreferenceById]);

    const moveSigner = (index: number, direction: -1 | 1) => {
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= orderedSignerIds.length) {
            return;
        }

        setOrderedSignerIds((prev) => {
            const cloned = [...prev];
            const temp = cloned[index];
            cloned[index] = cloned[nextIndex];
            cloned[nextIndex] = temp;
            return cloned;
        });
    };

    const removeSigner = (id: string) => {
        setOrderedSignerIds((prev) => {
            const next = prev.filter((item) => item !== id);
            return next;
        });
        setPlaceholderBySignerId((current) => {
            const next = { ...current };
            delete next[id];
            return next;
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex items-center gap-2 text-slate-600">
                    <Loader2 className="animate-spin" />
                    <span>Memuat alur sertifikasi...</span>
                </div>
            </div>
        );
    }

    return (
        <AppShell title="Certification Process" subtitle="Follow the guided steps from upload to signer completion.">
            <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">1. Upload</Badge>
                    <Badge variant="default">2. Assign Signers</Badge>
                    <Badge variant="default">3. Start Certification</Badge>
                    <Badge variant="default">4. Sign</Badge>
                    <Badge variant={preferredMode === 'invisible' ? 'neutral' : hasSignature ? 'success' : 'warning'}>
                        Signature Asset: {preferredMode === 'invisible' ? 'Not Required (Invisible Mode)' : hasSignature ? 'Ready' : 'Missing'}
                    </Badge>
                </div>

                <div className="flex flex-col gap-2 md:flex-row">
                    <Button variant="outline" className="border-slate-300" onClick={() => router.push('/signature-setup?next=/certification')}>
                        Setup Tanda Tangan
                    </Button>
                    <Button variant="outline" className="border-slate-300" onClick={() => router.push('/documents')}>
                        Lihat Semua Dokumen
                    </Button>
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
                        <CardTitle>1) Upload Dokumen PDF</CardTitle>
                        <CardDescription>Dokumen yang diupload akan otomatis memiliki document id di backend.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Input type="file" accept="application/pdf" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} />
                        <Button onClick={handleUploadDocument} disabled={loadingAction !== '' || !documentFile}>
                            {loadingAction === 'Upload Dokumen' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                            Upload Dokumen
                        </Button>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white/90 shadow-sm">
                    <CardHeader>
                        <CardTitle>2) Pilih Dokumen & Urutan Signer</CardTitle>
                        <CardDescription>Cari dokumen dan signer dengan cepat, lalu atur urutan tandatangan.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3">
                            <div className="space-y-2">
                                <Input
                                    value={documentSearch}
                                    onChange={(event) => setDocumentSearch(event.target.value)}
                                    placeholder="Cari dokumen berdasarkan nama atau ID"
                                />
                                <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white">
                                    {documentSearchResults.length === 0 ? (
                                        <p className="px-3 py-2 text-sm text-slate-500">Dokumen tidak ditemukan.</p>
                                    ) : (
                                        documentSearchResults.map((doc) => (
                                            <button
                                                key={doc.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedDocumentId(doc.id);
                                                    setDocumentSearch(doc.originalFileName ?? doc.id);
                                                }}
                                                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${selectedDocumentId === doc.id ? 'bg-blue-50 text-blue-800' : 'text-slate-800'
                                                    }`}
                                            >
                                                <span className="truncate pr-3">{doc.originalFileName ?? doc.id}</span>
                                                <StatusBadge status={doc.status} />
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                            <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason tanda tangan" />
                        </div>

                        {selectedDocument ? (
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                Dokumen dipilih: <span className="font-semibold text-slate-900">{selectedDocument.originalFileName ?? selectedDocument.id}</span>
                            </div>
                        ) : null}

                        <div className="rounded-md border border-slate-200 bg-white p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-slate-900">Preview Dokumen Sebelum Tanda Tangan</p>
                                <div className="flex items-center gap-2">
                                    {previewPageCount > 0 ? (
                                        <>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="border-slate-300"
                                                onClick={() => setPreviewPage((page) => Math.max(1, page - 1))}
                                                disabled={previewPage <= 1}
                                            >
                                                Halaman Sebelumnya
                                            </Button>
                                            <span className="text-xs text-slate-600">
                                                Halaman {previewPage} / {previewPageCount}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="border-slate-300"
                                                onClick={() => setPreviewPage((page) => Math.min(previewPageCount, page + 1))}
                                                disabled={previewPage >= previewPageCount}
                                            >
                                                Halaman Berikutnya
                                            </Button>
                                        </>
                                    ) : null}
                                    {selectedDocumentPreviewUrl ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="border-slate-300"
                                            onClick={() => window.open(selectedDocumentPreviewUrl, '_blank', 'noopener,noreferrer')}
                                        >
                                            Buka di Tab Baru
                                        </Button>
                                    ) : null}
                                </div>
                            </div>

                            {previewLoading ? (
                                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                    Memuat preview dokumen...
                                </div>
                            ) : previewError ? (
                                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                    Gagal memuat preview: {previewError}
                                </div>
                            ) : selectedDocumentPreviewUrl ? (
                                <div className="space-y-2">
                                    <p className="text-xs text-slate-600">
                                        Klik pada area PDF untuk menaruh placeholder signer yang mode-nya visible.
                                    </p>
                                    <div ref={previewContainerRef} className="w-full overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2">
                                        <div
                                            className={`relative inline-block ${activePickerSignerId && signerPreferenceById.get(activePickerSignerId) === 'visible' ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
                                            onClick={handlePreviewPickPosition}
                                        >
                                            <canvas ref={previewCanvasRef} className="block rounded-md bg-white" />
                                            {previewOverlayBoxes.map((box) => (
                                                <div
                                                    key={box.signerId}
                                                    className={`absolute border-2 ${box.isActive ? 'border-blue-600 bg-blue-100/30' : 'border-emerald-500 bg-emerald-100/20'}`}
                                                    style={{
                                                        left: `${box.left}px`,
                                                        top: `${box.top}px`,
                                                        width: `${box.width}px`,
                                                        height: `${box.height}px`,
                                                    }}
                                                >
                                                    <span className="absolute -top-5 left-0 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">
                                                        #{box.order}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                    Pilih dokumen terlebih dahulu untuk melihat isi dokumen sebelum sign.
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Input
                                value={signerSearch}
                                onChange={(event) => setSignerSearch(event.target.value)}
                                placeholder="Cari calon signer (nama atau email)"
                            />
                            <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white">
                                {availableSignerOptions.length === 0 ? (
                                    <p className="px-3 py-2 text-sm text-slate-500">Tidak ada signer yang cocok atau semua sudah dipilih.</p>
                                ) : (
                                    availableSignerOptions.map((user) => (
                                        <div key={user.id} className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-slate-900">{user.displayName ?? user.email}</p>
                                                <p className="truncate text-xs text-slate-500">{user.email}</p>
                                            </div>
                                            <Button variant="outline" className="border-slate-300" onClick={() => addSigner(user.id)}>
                                                Tambah
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            {orderedSignerIds.length === 0 && (
                                <p className="text-sm text-slate-500">Belum ada signer dipilih. Anda dapat menambahkan owner maupun signer lain.</p>
                            )}
                            {orderedSignerIds.map((id, index) => {
                                const signer = signerById.get(id);
                                const placeholder = placeholderBySignerId[id] ?? getDefaultPlaceholder(index);
                                const isVisibleSigner = signerPreferenceById.get(id) === 'visible';
                                return (
                                    <div key={id} className="rounded-md border border-slate-200 bg-slate-50 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                        <div className="flex-1 space-y-3">
                                            <p className="text-sm text-slate-800">
                                                Urutan {index + 1}: <span className="font-semibold">{signer?.displayName ?? signer?.email ?? id}</span>
                                            </p>
                                            <p className="text-xs text-slate-600">
                                                Mode: {isVisibleSigner ? 'Visible' : 'Invisible'}{isVisibleSigner ? `. Posisi: page ${placeholder.visiblePage}, x ${placeholder.visibleX.toFixed(2)}, y ${placeholder.visibleY.toFixed(2)}, width ${placeholder.visibleWidth.toFixed(2)}, height ${placeholder.visibleHeight.toFixed(2)}` : '. Tidak perlu set posisi, hanya mengikuti urutan signer.'}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Badge variant={isVisibleSigner ? 'success' : 'neutral'} className="self-center">
                                                {isVisibleSigner ? 'Visible' : 'Invisible'}
                                            </Badge>
                                            <Button
                                                disabled={!isVisibleSigner}
                                                variant={activePickerSignerId === id ? 'default' : 'outline'}
                                                className={activePickerSignerId === id ? '' : 'border-slate-300'}
                                                onClick={() => {
                                                    if (!isVisibleSigner) {
                                                        return;
                                                    }
                                                    setActivePickerSignerId(id);
                                                    setPreviewPage(placeholder.visiblePage);
                                                }}
                                            >
                                                Pilih di Preview
                                            </Button>
                                            <Button variant="outline" className="border-slate-300" onClick={() => moveSigner(index, -1)} disabled={index === 0}>Naik</Button>
                                            <Button variant="outline" className="border-slate-300" onClick={() => moveSigner(index, 1)} disabled={index === orderedSignerIds.length - 1}>Turun</Button>
                                            <Button variant="outline" className="border-slate-300" onClick={() => removeSigner(id)}>Hapus</Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button onClick={handleSaveSignerOrder} disabled={loadingAction !== '' || !selectedDocumentId}>
                                {loadingAction === 'Simpan Urutan Signer' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                Simpan Urutan & Mulai Sertifikasi
                            </Button>
                            <Button onClick={handleOwnerSign} disabled={loadingAction !== '' || !selectedDocumentId}>
                                {loadingAction === 'Sign Dokumen' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                Sign Dokumen Terpilih
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white/90 shadow-sm">
                    <CardHeader>
                        <CardTitle>Dokumen Saya</CardTitle>
                        <CardDescription>Daftar dokumen yang Anda upload.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        {myDocuments.length === 0 && <p className="text-slate-500">Belum ada dokumen.</p>}
                        {myDocuments.map((doc) => (
                            <div key={doc.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                <p className="font-semibold text-slate-900">{doc.originalFileName ?? doc.id}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-600">
                                    <StatusBadge status={doc.status} />
                                    <span>Total signer: {doc.requiredSignerCount}</span>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white/90 shadow-sm">
                    <CardHeader>
                        <CardTitle>Dokumen Untuk Anda Tandatangani</CardTitle>
                        <CardDescription>User lain bisa langsung meminta tanda tangan Anda dari sini.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        {assignedDocuments.length === 0 && <p className="text-slate-500">Belum ada permintaan tanda tangan.</p>}
                        {assignedDocuments.map((assignment) => (
                            <div key={`${assignment.document.id}-${assignment.order ?? 'x'}`} className="rounded-md border border-slate-200 bg-slate-50 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                <div>
                                    <p className="font-semibold text-slate-900">{assignment.document.originalFileName ?? assignment.document.id}</p>
                                    <p className="text-slate-600">
                                        Owner: {assignment.document.ownerDisplayName ?? assignment.document.ownerEmail ?? '-'} | Urutan: {assignment.order ?? '-'} | Status signer: {assignment.signerStatus}
                                    </p>
                                </div>
                                <Button
                                    disabled={loadingAction !== '' || assignment.signerStatus !== 'PENDING'}
                                    onClick={() => handleAssignedSign(assignment.document.id)}
                                >
                                    {loadingAction === 'Sign Dokumen Undangan' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                    Sign Sekarang
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </AppShell>
    );
}

export default function CertificationPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
            <CertificationFlowContent />
        </Suspense>
    );
}
