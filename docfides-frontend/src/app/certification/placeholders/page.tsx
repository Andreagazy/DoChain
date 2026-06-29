'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, MapPinned } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppShell } from '@/components/layout/app-shell';
import { CertificationStepper } from '@/components/certification/certification-stepper';
import {
    getCertificationDocumentOriginalFile,
    getDocumentSignerPlaceholders,
    getIdentityProfile,
    getIdentityStatus,
    getSignatureStatus,
    getUser,
    listMyCertificationDocuments,
    listSignerCandidates,
    requestDocumentSigners,
} from '@/lib/auth-service';
import {
    buildCertificationStepHref,
    getActiveCertificationDocumentId,
    getDefaultPlaceholder,
    loadPdfJsModule,
    normalizeErrorMessage,
    setActiveCertificationDocumentId,
    type PdfDocumentProxy,
    type PlaceholderConfig,
} from '@/lib/certification-flow';
import type { OwnedDocumentItem, SignerCandidate, User } from '@/types/auth';

const getSignerDisplayName = (signer?: Pick<SignerCandidate, 'certificateName' | 'fullName' | 'displayName' | 'email'> | null) =>
    signer?.certificateName ?? signer?.fullName ?? signer?.displayName ?? signer?.email ?? 'Signer';

function CertificationPlaceholdersContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [currentUserFullName, setCurrentUserFullName] = useState<string | null>(null);
    const [preferredMode, setPreferredMode] = useState<'visible' | 'invisible'>('visible');
    const [hasSignature, setHasSignature] = useState(false);
    const [myDocuments, setMyDocuments] = useState<OwnedDocumentItem[]>([]);
    const [signerCandidates, setSignerCandidates] = useState<SignerCandidate[]>([]);
    const [selectedDocumentId, setSelectedDocumentId] = useState('');
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
    const [orderedSignerIds, setOrderedSignerIds] = useState<string[]>([]);
    const [placeholderBySignerId, setPlaceholderBySignerId] = useState<Record<string, PlaceholderConfig | null>>({});
    const [activePickerSignerId, setActivePickerSignerId] = useState('');

    const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const previewContainerRef = useRef<HTMLDivElement | null>(null);

    const selectedDocument = useMemo(
        () => myDocuments.find((document) => document.id === selectedDocumentId) ?? null,
        [myDocuments, selectedDocumentId],
    );

    const signerOptions = useMemo(() => {
        const options = [...signerCandidates];
        if (currentUser) {
            options.unshift({
                id: currentUser.id,
                email: currentUser.email,
                displayName: currentUser.displayName ?? 'Saya',
                fullName: currentUserFullName,
                certificateName: `${currentUserFullName ?? currentUser.displayName ?? 'Saya'} (Pemilik Dokumen)`,
                role: currentUser.role,
                academicProfile: currentUser.academicProfile ?? null,
                preferredSignatureMode: preferredMode,
            });
        }

        return options.map((item) => ({
            ...item,
            preferredSignatureMode: 'visible' as const,
        }));
    }, [currentUser, currentUserFullName, preferredMode, signerCandidates]);

    const signerPreferenceById = useMemo(
        () => new Map(signerOptions.map((item) => [item.id, item.preferredSignatureMode])),
        [signerOptions],
    );

    const signerById = useMemo(
        () => new Map(signerOptions.map((item) => [item.id, item])),
        [signerOptions],
    );

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

                const [identityStatus, identityProfile, signatureStatus, documents, candidates] = await Promise.all([
                    getIdentityStatus(),
                    getIdentityProfile(),
                    getSignatureStatus(),
                    listMyCertificationDocuments(),
                    listSignerCandidates(),
                ]);

                if (identityStatus.status !== 'APPROVED') {
                    router.push('/profile#identitas-ktp');
                    return;
                }

                setPreferredMode('visible');
                setHasSignature(signatureStatus.hasSignature);
                setCurrentUserFullName(identityProfile.fullName ?? null);
                setMyDocuments(documents.documents);
                setSignerCandidates(candidates.signers);

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
                        router.replace(buildCertificationStepHref('placeholders'), { scroll: false });
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
                const blob = await getCertificationDocumentOriginalFile(selectedDocumentId);
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
            const maxWidth = previewContainerRef.current.clientWidth > 0 ? Math.min(previewContainerRef.current.clientWidth, 680) : 680;
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

    useEffect(() => {
        let cancelled = false;

        async function loadStoredSigners() {
            setOrderedSignerIds([]);
            setPlaceholderBySignerId({});
            setActivePickerSignerId('');

            if (!selectedDocumentId) {
                return;
            }

            try {
                const data = await getDocumentSignerPlaceholders(selectedDocumentId);
                if (cancelled || !data.signers.length) {
                    return;
                }

                const sortedSigners = [...data.signers].sort((a, b) => {
                    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
                    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
                    return orderA - orderB;
                });

                const nextPlaceholderMap = sortedSigners.reduce<Record<string, PlaceholderConfig | null>>((accumulator, item) => {
                    const placeholder = item.placeholder;
                    if (
                        placeholder.visiblePage === null ||
                        placeholder.visibleX === null ||
                        placeholder.visibleY === null ||
                        placeholder.visibleWidth === null ||
                        placeholder.visibleHeight === null
                    ) {
                        accumulator[item.userId] = null;
                        return accumulator;
                    }

                    accumulator[item.userId] = {
                        visiblePage: placeholder.visiblePage,
                        visibleX: placeholder.visibleX,
                        visibleY: placeholder.visibleY,
                        visibleWidth: placeholder.visibleWidth,
                        visibleHeight: placeholder.visibleHeight,
                    };
                    return accumulator;
                }, {});

                setOrderedSignerIds(sortedSigners.map((item) => item.userId));
                setPlaceholderBySignerId(nextPlaceholderMap);
                setActivePickerSignerId(sortedSigners.find((item) => signerPreferenceById.get(item.userId) === 'visible')?.userId ?? '');
            } catch {
                // Fine to leave the page empty when signer setup has not been saved yet.
            }
        }

        void loadStoredSigners();

        return () => {
            cancelled = true;
        };
    }, [selectedDocumentId, signerPreferenceById]);

    const handlePreviewPickPosition = (event: MouseEvent<HTMLDivElement>) => {
        const isPickingVisibleSigner = signerPreferenceById.get(activePickerSignerId) === 'visible';

        if (!activePickerSignerId || !isPickingVisibleSigner) {
            setError('Pilih signer visible terlebih dahulu.');
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

        const nextPlacement = {
            ...currentConfig,
            visiblePage: previewPage,
            visibleX: Number(nextX.toFixed(2)),
            visibleY: Number(nextY.toFixed(2)),
        };

        setPlaceholderBySignerId((current) => ({
            ...current,
            [activePickerSignerId]: nextPlacement,
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

                const cfg = placeholderBySignerId[signerId];
                if (!cfg) {
                    return null;
                }
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

    const handleSavePlaceholders = async () => {
        if (!selectedDocumentId) {
            setError('Pilih dokumen terlebih dahulu.');
            return;
        }

        if (orderedSignerIds.length === 0) {
            setError('Belum ada signer yang dipilih.');
            return;
        }

        await execute('Simpan Placeholder', async () => {
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
                ...(placeholdersForVisibleSigners.length > 0 ? { placeholders: placeholdersForVisibleSigners } : {}),
            });

            setActiveCertificationDocumentId(selectedDocumentId);
            router.push(buildCertificationStepHref('review', selectedDocumentId));
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex items-center gap-2 text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menyiapkan langkah placeholder...</span>
                </div>
            </div>
        );
    }

    return (
        <AppShell title="Sertifikasi - Placeholder" subtitle="Langkah ketiga: letakkan posisi tanda tangan visible.">
            <div className="space-y-6">
                <CertificationStepper currentStep="placeholders" documentId={selectedDocumentId} />

                {error ? (
                    <Alert className="border-red-200 bg-red-50 text-red-800">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                {success ? (
                    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                        <AlertDescription>{success}</AlertDescription>
                    </Alert>
                ) : null}

                <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
                    <Badge className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700 hover:bg-white">Placeholder Signature</Badge>
                    <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Tempatkan area tanda tangan visible.</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        Pilih signer visible di panel kanan, lalu klik halaman PDF untuk menentukan posisi tanda tangan.
                    </p>
                </section>

                <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle>Preview Dokumen</CardTitle>
                            <CardDescription>Klik area PDF untuk menaruh placeholder visible pada signer aktif.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                Dokumen dipilih: <span className="font-semibold text-slate-900">{selectedDocument?.originalFileName ?? selectedDocument?.id ?? 'Belum ada dokumen'}</span>
                            </div>

                            {previewLoading ? (
                                <div className="flex min-h-80 items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-8">
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Memuat preview...</span>
                                    </div>
                                </div>
                            ) : previewError ? (
                                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                    Gagal memuat preview: {previewError}
                                </div>
                            ) : selectedDocumentPreviewUrl ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <MapPinned className="h-4 w-4" />
                                            <span>Klik halaman PDF untuk mengatur posisi</span>
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
                                        <div
                                            className={`relative mx-auto inline-block ${activePickerSignerId && signerPreferenceById.get(activePickerSignerId) === 'visible' ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
                                            onClick={handlePreviewPickPosition}
                                        >
                                            <canvas ref={previewCanvasRef} className="block rounded-md bg-white shadow-sm" />
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
                                                    <span className="absolute -top-5 left-0 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">#{box.order}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <Button variant="outline" className="border-slate-300" onClick={() => {
                                            setActiveCertificationDocumentId(selectedDocumentId);
                                            router.push(buildCertificationStepHref('signers', selectedDocumentId));
                                        }}>
                                            <ArrowLeft className="mr-2 h-4 w-4" />
                                            Kembali ke Signers
                                        </Button>
                                        <Button onClick={handleSavePlaceholders} disabled={loadingAction !== '' || orderedSignerIds.length === 0}>
                                            {loadingAction === 'Simpan Placeholder' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Simpan dan Lanjut ke Review
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                    Pilih dokumen terlebih dahulu untuk menampilkan preview.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm xl:sticky xl:top-24 xl:self-start">
                        <CardHeader className="pb-3">
                            <CardTitle>Urutan Signer</CardTitle>
                            <CardDescription>Pilih signer visible, lalu klik posisi pada preview.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                                {orderedSignerIds.length === 0 ? (
                                    <p className="text-sm text-slate-500">Belum ada signer. Kembali ke langkah signer terlebih dahulu.</p>
                                ) : (
                                    orderedSignerIds.map((signerId, index) => {
                                        const signer = signerById.get(signerId);
                                        const isVisibleSigner = signerPreferenceById.get(signerId) === 'visible';
                                        const placeholder = placeholderBySignerId[signerId];

                                        return (
                                            <div key={signerId} className={`rounded-md border p-3 ${activePickerSignerId === signerId ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900">#{index + 1} {getSignerDisplayName(signer)}</p>
                                                        <p className="mt-1 truncate text-xs text-slate-600">{signer?.email ?? signerId}</p>
                                                    </div>
                                                    <Badge variant="success">Visible</Badge>
                                                </div>
                                                <p className="mt-2 text-xs text-slate-600">
                                                    {isVisibleSigner ? `Posisi ${placeholder ? `page ${placeholder.visiblePage}` : 'belum ditentukan'}` : 'Tidak perlu posisi.'}
                                                </p>
                                                {isVisibleSigner ? (
                                                    <Button
                                                        size="sm"
                                                        variant={activePickerSignerId === signerId ? 'default' : 'outline'}
                                                        className={`mt-3 w-full ${activePickerSignerId === signerId ? '' : 'border-slate-300'}`}
                                                        onClick={() => {
                                                            setActivePickerSignerId(signerId);
                                                            setPreviewPage(placeholder?.visiblePage ?? 1);
                                                        }}
                                                    >
                                                        Pilih di Preview
                                                    </Button>
                                                ) : null}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {preferredMode === 'visible' && !hasSignature ? (
                    <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                        <AlertDescription>
                            Akun ini menggunakan mode visible tetapi belum punya signature asset. Langkah review nanti akan mengarahkan ke setup tanda tangan.
                        </AlertDescription>
                    </Alert>
                ) : null}
            </div>
        </AppShell>
    );
}

export default function CertificationPlaceholdersPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#f6f7f9]" />}>
            <CertificationPlaceholdersContent />
        </Suspense>
    );
}
