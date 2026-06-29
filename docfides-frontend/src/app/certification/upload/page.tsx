'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, FileText, Loader2, Search, UploadCloud } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/layout/app-shell';
import { UploadDropzone } from '@/components/documents/upload-dropzone';
import { CertificationStepper } from '@/components/certification/certification-stepper';
import { getIdentityStatus, listMyCertificationDocuments, uploadDocumentForCertification } from '@/lib/auth-service';
import { buildCertificationStepHref, normalizeErrorMessage, setActiveCertificationDocumentId } from '@/lib/certification-flow';
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
                    router.push('/profile#identitas-ktp');
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
            setActiveCertificationDocumentId(uploaded.id);
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

        setActiveCertificationDocumentId(selectedDocumentId);
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
        <AppShell title="Sertifikasi - Upload" subtitle="Langkah pertama: pilih dokumen draft atau upload PDF baru.">
            <div className="space-y-6">
                <CertificationStepper currentStep="upload" />

                <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
                    <Badge className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700 hover:bg-white">Upload Dokumen</Badge>
                    <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Pilih dokumen yang akan disertifikasi.</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        Hanya dokumen baru upload atau masih draft yang muncul di daftar ini. Dokumen yang sudah berjalan bisa dilanjutkan dari halaman Documents.
                    </p>
                </section>

                {error ? (
                    <Alert className="border-red-200 bg-red-50 text-red-800">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                <div className="grid items-stretch gap-4 xl:grid-cols-2">
                    <Card className="flex h-full flex-col gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white py-0 shadow-sm">
                        <CardHeader className="border-b border-slate-100 bg-white p-5">
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                                    <FileText className="h-5 w-5" />
                                </span>
                                Pilih Dokumen Draft
                            </CardTitle>
                            <CardDescription>
                                Pilih dokumen draft untuk lanjut ke signer.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col gap-3 p-4">
                            {loadingDocuments ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                    Memuat dokumen yang sudah ada...
                                </div>
                            ) : null}

                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <Input
                                    value={documentSearch}
                                    onChange={(event) => setDocumentSearch(event.target.value)}
                                    placeholder="Cari dokumen berdasarkan nama"
                                    className="h-11 rounded-xl pl-9"
                                />
                            </div>

                            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                                {documentSearchResults.length === 0 ? (
                                    <div className="flex min-h-44 flex-col items-center justify-center px-4 py-6 text-center text-sm text-slate-500">
                                        <FileText className="mb-2 h-8 w-8 text-slate-300" />
                                        <span>Belum ada dokumen draft yang cocok.</span>
                                    </div>
                                ) : (
                                    documentSearchResults.map((document) => (
                                        <button
                                            key={document.id}
                                            type="button"
                                            onClick={() => setSelectedDocumentId(document.id)}
                                            className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-blue-50/60 ${selectedDocumentId === document.id ? 'bg-blue-50 text-blue-800' : 'text-slate-800'}`}
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate font-medium">{document.originalFileName ?? document.id}</p>
                                                <p className="truncate text-xs text-slate-500">Diperbarui {new Date(document.updatedAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <Badge variant={selectedDocumentId === document.id ? 'default' : 'neutral'}>
                                                    {selectedDocumentId === document.id ? 'Terpilih' : document.status}
                                                </Badge>
                                                <span className="text-[11px] text-slate-500">{document.requiredSignerCount} signer</span>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>

                            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                                {selectedDocument ? (
                                    <>
                                        Dipilih: <span className="font-semibold text-slate-900">{selectedDocument.originalFileName ?? selectedDocument.id}</span>
                                        <span className="ml-2 text-blue-700">| Status: {selectedDocument.status}</span>
                                    </>
                                ) : (
                                    <span className="text-blue-700">Pilih salah satu dokumen draft untuk melanjutkan.</span>
                                )}
                            </div>

                            <div className="mt-auto">
                                <Button className="h-11 w-full rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700" onClick={handleContinueWithExistingDocument} disabled={!selectedDocumentId}>
                                    Lanjut dengan Dokumen Terpilih
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="flex h-full flex-col gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white py-0 shadow-sm">
                        <CardHeader className="border-b border-slate-100 bg-white p-5">
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                                    <UploadCloud className="h-5 w-5" />
                                </span>
                                Upload PDF Baru
                            </CardTitle>
                            <CardDescription>Unggah PDF baru jika dokumen belum tersedia.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col gap-3 p-4">
                            <UploadDropzone file={file} onFileSelect={setFile} />

                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                File akan langsung masuk ke langkah pemilihan signer setelah berhasil diupload.
                            </div>

                            <div className="mt-auto grid gap-2 sm:grid-cols-2">
                                <Button className="h-11 rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700" onClick={handleUpload} disabled={uploading || !file}>
                                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Upload dan Lanjut
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                                <Button variant="outline" className="h-11 rounded-xl border-slate-300 bg-white" onClick={() => router.push('/certification')}>
                                    Kembali ke Beranda Sertifikasi
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppShell>
    );
}
