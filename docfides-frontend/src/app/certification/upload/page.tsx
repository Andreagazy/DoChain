'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/layout/app-shell';
import { UploadDropzone } from '@/components/documents/upload-dropzone';
import { CertificationStepper } from '@/components/certification/certification-stepper';
import { getIdentityStatus, listMyCertificationDocuments, uploadDocumentForCertification } from '@/lib/auth-service';
import { buildCertificationStepHref, normalizeErrorMessage } from '@/lib/certification-flow';
import type { OwnedDocumentItem } from '@/types/auth';

const isDraftDocument = (document: OwnedDocumentItem) => {
    const status = document.status.toUpperCase();
    return status.includes('DRAFT') || document.requiredSignerCount === 0;
};

export default function CertificationUploadPage() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [loadingDocuments, setLoadingDocuments] = useState(true);
    const [file, setFile] = useState<File | null>(null);
    const [myDocuments, setMyDocuments] = useState<OwnedDocumentItem[]>([]);
    const [selectedDocumentId, setSelectedDocumentId] = useState('');
    const [documentSearch, setDocumentSearch] = useState('');
    const [error, setError] = useState('');

    const selectedDocument = useMemo(
        () => myDocuments.find((document) => document.id === selectedDocumentId) ?? null,
        [myDocuments, selectedDocumentId],
    );

    const draftDocuments = useMemo(
        () => myDocuments.filter(isDraftDocument),
        [myDocuments],
    );

    const documentSearchResults = useMemo(() => {
        const term = documentSearch.trim().toLowerCase();
        if (!term) {
            return draftDocuments.slice(0, 8);
        }

        return draftDocuments.filter((document) => {
            const label = (document.originalFileName ?? document.id).toLowerCase();
            return label.includes(term) || document.id.toLowerCase().includes(term);
        });
    }, [documentSearch, draftDocuments]);

    useEffect(() => {
        async function loadIdentity() {
            try {
                const identityStatus = await getIdentityStatus();
                if (identityStatus.status !== 'APPROVED') {
                    router.push('/identity');
                    return;
                }
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setChecking(false);
            }
        }

        void loadIdentity();
    }, [router]);

    useEffect(() => {
        async function loadDocuments() {
            try {
                const response = await listMyCertificationDocuments();
                setMyDocuments(response.documents);
                setSelectedDocumentId(response.documents.find(isDraftDocument)?.id ?? '');
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoadingDocuments(false);
            }
        }

        void loadDocuments();
    }, []);

    const handleUpload = async () => {
        setError('');

        if (!file) {
            setError('Pilih file PDF terlebih dahulu.');
            return;
        }

        setUploading(true);
        try {
            const uploaded = await uploadDocumentForCertification(file);
            router.push(buildCertificationStepHref('signers', uploaded.id));
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setUploading(false);
        }
    };

    const handleContinueWithExistingDocument = () => {
        if (!selectedDocumentId) {
            setError('Pilih dokumen terlebih dahulu.');
            return;
        }

        router.push(buildCertificationStepHref('signers', selectedDocumentId));
    };

    if (checking) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex items-center gap-2 text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menyiapkan langkah upload...</span>
                </div>
            </div>
        );
    }

    return (
        <AppShell title="Certification - Upload" subtitle="Langkah pertama: pilih dokumen atau upload PDF baru.">
            <div className="space-y-6">
                <CertificationStepper currentStep="upload" />

                <section className="rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
                    <Badge variant="default">Upload</Badge>
                    <h1 className="mt-4 text-2xl font-semibold text-slate-950 md:text-3xl">Pilih dokumen atau upload PDF baru.</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        Hanya dokumen baru upload atau masih draft yang muncul di daftar ini. Dokumen yang sudah berjalan bisa dilanjutkan dari halaman Documents.
                    </p>
                </section>

                {error ? (
                    <Alert className="border-red-200 bg-red-50 text-red-800">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                    <Card className="border-slate-200 bg-white/90 shadow-sm">
                    <CardHeader>
                        <CardTitle>Pilih Dokumen</CardTitle>
                        <CardDescription>
                            Pilih dokumen draft untuk lanjut ke signer, atau upload PDF baru jika belum tersedia.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loadingDocuments ? (
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                Memuat dokumen yang sudah ada...
                            </div>
                        ) : null}

                        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">Dokumen draft</p>
                                    <p className="text-xs text-slate-600">Hanya dokumen baru upload atau belum punya signer.</p>
                                </div>
                                {selectedDocument ? <Badge variant="neutral">Terpilih</Badge> : null}
                            </div>

                            <Input
                                value={documentSearch}
                                onChange={(event) => setDocumentSearch(event.target.value)}
                                placeholder="Cari dokumen berdasarkan nama atau ID"
                            />

                            <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white">
                                {documentSearchResults.length === 0 ? (
                                    <p className="px-3 py-2 text-sm text-slate-500">Belum ada dokumen draft yang cocok.</p>
                                ) : (
                                    documentSearchResults.map((document) => (
                                        <button
                                            key={document.id}
                                            type="button"
                                            onClick={() => setSelectedDocumentId(document.id)}
                                            className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50 ${selectedDocumentId === document.id ? 'bg-blue-50 text-blue-800' : 'text-slate-800'}`}
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate font-medium">{document.originalFileName ?? document.id}</p>
                                                <p className="truncate text-xs text-slate-500">ID: {document.id}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <Badge variant="neutral">{document.status}</Badge>
                                                <span className="text-[11px] text-slate-500">{document.requiredSignerCount} signer</span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>

                            {selectedDocument ? (
                                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                                    Dipilih: <span className="font-semibold text-slate-900">{selectedDocument.originalFileName ?? selectedDocument.id}</span>
                                    <span className="ml-2 text-slate-500">| Status: {selectedDocument.status} | Signed: {selectedDocument.requiredSignerCount > 0 ? `0 / ${selectedDocument.requiredSignerCount}` : '0'}</span>
                                </div>
                            ) : null}

                            <div className="flex flex-wrap gap-2">
                                <Button onClick={handleContinueWithExistingDocument} disabled={!selectedDocumentId}>
                                    Lanjut dengan Dokumen Terpilih
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 bg-white/90 shadow-sm">
                        <CardHeader>
                            <CardTitle>Upload PDF Baru</CardTitle>
                            <CardDescription>Kalau belum ada dokumen yang cocok, langsung unggah file baru di sini.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                            <div className="mb-3">
                                <p className="text-sm font-semibold text-slate-900">Atau upload PDF baru</p>
                                <p className="text-xs text-slate-600">Gunakan ini jika dokumen belum ada di daftar.</p>
                            </div>

                            <UploadDropzone file={file} onFileSelect={setFile} />

                            <div className="mt-4 flex flex-wrap gap-2">
                                <Button onClick={handleUpload} disabled={uploading || !file}>
                                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Upload dan Lanjut
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                                <Button variant="outline" className="border-slate-300" onClick={() => router.push('/certification')}>
                                    Kembali ke Beranda Certification
                                </Button>
                            </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppShell>
    );
}
