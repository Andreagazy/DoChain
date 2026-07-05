'use client';

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileText, RefreshCw, Search, UploadCloud } from 'lucide-react';
import { AxiosError } from 'axios';
import { AppShell } from '@/components/layout/app-shell';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { DocumentTable } from '@/components/documents/document-table';
import { EmptyState } from '@/components/common/empty-state';
import {
    deleteDraftCertificationDocument,
    listMyCertificationDocuments,
    getCertificationDocumentOriginalFile,
    getCertificationDocumentSignedFile,
    getIpfsFile,
    uploadDocumentForCertification,
} from '@/lib/auth-service';
import { OwnedDocumentItem } from '@/types/auth';

const DOCUMENTS_PER_PAGE = 10;

function normalizeErrorMessage(err: unknown): string {
    const axiosError = err as AxiosError<{ message?: string | string[] }>;
    const message = axiosError.response?.data?.message;
    return Array.isArray(message) ? message.join(', ') : message ?? axiosError.message ?? 'Terjadi kesalahan';
}

export default function DocumentsPage() {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [documents, setDocuments] = useState<OwnedDocumentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingDocumentId, setDeletingDocumentId] = useState('');
    const [deleteDialog, setDeleteDialog] = useState<OwnedDocumentItem | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [success, setSuccess] = useState('');

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'pending' | 'signed'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'updatedAt' | 'status'>('updatedAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);

    const loadDocuments = async () => {
        setError('');
        setNotice('');
        setSuccess('');
        try {
            const response = await listMyCertificationDocuments();
            setDocuments(response.documents);
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadDocuments();
    }, []);

    const filteredDocuments = useMemo(() => {
        const searchTerm = search.trim().toLowerCase();

        const byFilter = documents.filter((doc) => {
            const status = doc.status.toLowerCase();
            if (statusFilter === 'draft') return status.includes('draft');
            if (statusFilter === 'pending') return status.includes('pending') || status.includes('partially');
            if (statusFilter === 'signed') return status.includes('signed') || status.includes('approved');
            return true;
        });

        const bySearch = byFilter.filter((doc) => {
            if (!searchTerm) return true;
            const name = (doc.originalFileName ?? doc.finalFileName ?? '').toLowerCase();
            return name.includes(searchTerm);
        });

        const sorted = [...bySearch].sort((a, b) => {
            if (sortBy === 'name') {
                const aName = (a.originalFileName ?? a.finalFileName ?? '').toLowerCase();
                const bName = (b.originalFileName ?? b.finalFileName ?? '').toLowerCase();
                return sortDirection === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
            }

            if (sortBy === 'status') {
                return sortDirection === 'asc'
                    ? a.status.localeCompare(b.status)
                    : b.status.localeCompare(a.status);
            }

            const aDate = new Date(a.updatedAt).getTime();
            const bDate = new Date(b.updatedAt).getTime();
            return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
        });

        return sorted;
    }, [documents, search, statusFilter, sortBy, sortDirection]);

    const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / DOCUMENTS_PER_PAGE));

    const paginatedDocuments = useMemo(() => {
        const startIndex = (currentPage - 1) * DOCUMENTS_PER_PAGE;
        return filteredDocuments.slice(startIndex, startIndex + DOCUMENTS_PER_PAGE);
    }, [currentPage, filteredDocuments]);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, statusFilter, sortBy, sortDirection]);

    useEffect(() => {
        setCurrentPage((page) => Math.min(page, totalPages));
    }, [totalPages]);

    const handleSortChange = (nextSortBy: 'name' | 'updatedAt' | 'status') => {
        if (sortBy === nextSortBy) {
            setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
            return;
        }

        setSortBy(nextSortBy);
        setSortDirection('asc');
    };

    const triggerDownload = (blob: Blob, fileName: string) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    };

    const buildSignedDownloadName = (doc: OwnedDocumentItem) => {
        const baseName = (doc.originalFileName ?? doc.finalFileName ?? 'dokumen')
            .replace(/\.pdf$/i, '')
            .replace(/\s+/g, ' ')
            .trim();
        const safeBaseName = baseName
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
            .replace(/\.+$/g, '')
            .replace(/-+/g, '-')
            .trim() || 'dokumen';

        return `${safeBaseName}-signed.pdf`;
    };

    const handleDownloadOriginal = async (doc: OwnedDocumentItem) => {
        setError('');
        setNotice('');
        setSuccess('');
        try {
            const blob = await getCertificationDocumentOriginalFile(doc.id);
            triggerDownload(blob, doc.originalFileName ?? `${doc.id}.pdf`);
        } catch (err) {
            setError(normalizeErrorMessage(err));
        }
    };

    const handleDownloadIpfs = async (doc: OwnedDocumentItem) => {
        setError('');
        setNotice('');

        try {
            if (doc.finalFileIpfsHash) {
                const blob = await getIpfsFile(doc.finalFileIpfsHash);
                triggerDownload(blob, buildSignedDownloadName(doc));
                return;
            }

            throw new Error('CID IPFS dokumen belum tersedia');
        } catch {
            try {
                const fallbackBlob = await getCertificationDocumentSignedFile(doc.id);
                triggerDownload(fallbackBlob, buildSignedDownloadName(doc));
                setNotice(
                    `Semua node IPFS sedang tidak tersedia atau file belum bisa diambil dari IPFS. Dokumen final diunduh dari penyimpanan backend sementara.`,
                );
            } catch (fallbackErr) {
                setError(
                    `IPFS tidak tersedia dan fallback backend gagal: ${normalizeErrorMessage(fallbackErr)}`,
                );
            }
        }
    };

    const handleUploadClick = () => {
        if (uploading) {
            return;
        }

        fileInputRef.current?.click();
    };

    const handleDeleteDraft = async (doc: OwnedDocumentItem) => {
        if (doc.status !== 'DRAFT' || doc.accessType !== 'OWNER') {
            setError('Hanya dokumen draft milik Anda yang dapat dihapus.');
            return;
        }

        setError('');
        setSuccess('');
        setNotice('');
        setDeleteDialog(doc);
    };

    const confirmDeleteDraft = async () => {
        if (!deleteDialog) {
            return;
        }

        const doc = deleteDialog;

        setError('');
        setNotice('');
        setSuccess('');
        setDeletingDocumentId(doc.id);

        try {
            const result = await deleteDraftCertificationDocument(doc.id);
            setDocuments((current) => current.filter((item) => item.id !== doc.id));
            setSuccess(result.message);
            setDeleteDialog(null);
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setDeletingDocumentId('');
        }
    };

    const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }

        setError('');
        setNotice('');

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            setError('File dokumen harus berupa PDF.');
            return;
        }

        setUploading(true);
        try {
            await uploadDocumentForCertification(file);
            await loadDocuments();
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setUploading(false);
        }
    };

    return (
        <AppShell title="Dokumen" subtitle="Cari dokumen, lanjutkan sertifikasi, atau unduh file final.">
            <div className="space-y-6">
                <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <Badge variant="neutral">{documents.length} dokumen</Badge>
                        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Daftar dokumen</h1>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                            Lihat status, unduh file, dan buka langkah sertifikasi berikutnya dari satu tabel.
                        </p>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(event) => void handleFileSelected(event)}
                    />
                    <Button onClick={handleUploadClick} disabled={uploading}>
                        <UploadCloud className="h-4 w-4" />
                        {uploading ? 'Mengupload...' : 'Upload Dokumen'}
                    </Button>
                </section>

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

                <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[1fr_auto_auto]">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            aria-label="Search documents"
                            className="bg-white pl-9"
                            placeholder="Cari nama file dokumen"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>

                    <select
                        aria-label="Filter by status"
                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm shadow-xs outline-none focus:border-slate-400"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as 'all' | 'draft' | 'pending' | 'signed')}
                    >
                        <option value="all">Semua Status</option>
                        <option value="draft">Draft</option>
                        <option value="pending">Pending</option>
                        <option value="signed">Signed</option>
                    </select>

                    <Button variant="outline" className="border-slate-300" onClick={() => void loadDocuments()}>
                        <RefreshCw className="h-4 w-4" />
                        Muat Ulang
                    </Button>
                </div>

                {loading ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Memuat dokumen...</div>
                ) : filteredDocuments.length === 0 ? (
                    <EmptyState
                        title="Dokumen tidak ditemukan"
                        description="Upload dokumen pertama atau ubah pencarian dan filter."
                        icon={<FileText className="h-5 w-5" />}
                    />
                ) : (
                    <div className="space-y-3">
                        <DocumentTable
                            documents={paginatedDocuments}
                            sortBy={sortBy}
                            sortDirection={sortDirection}
                            onSortChange={handleSortChange}
                            onDownloadOriginal={handleDownloadOriginal}
                            onDownloadIpfs={handleDownloadIpfs}
                            onDeleteDraft={handleDeleteDraft}
                            deletingDocumentId={deletingDocumentId}
                        />

                        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-slate-500">
                                Menampilkan {(currentPage - 1) * DOCUMENTS_PER_PAGE + 1}-{Math.min(currentPage * DOCUMENTS_PER_PAGE, filteredDocuments.length)} dari {filteredDocuments.length} dokumen
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    className="border-slate-300"
                                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Sebelumnya
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
                                    Berikutnya
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Dialog open={Boolean(notice)} onOpenChange={(open) => !open && setNotice('')}>
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
                    <DialogHeader>
                        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <DialogTitle>IPFS Sedang Tidak Tersedia</DialogTitle>
                        <DialogDescription>
                            {notice}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        File tetap berhasil diunduh dari penyimpanan backend. Cek node IPFS jika ingin memastikan replikasi berjalan normal.
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={() => setNotice('')}>Mengerti</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(deleteDialog)}
                onOpenChange={(open) => {
                    if (!open && !deletingDocumentId) {
                        setDeleteDialog(null);
                    }
                }}
            >
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
                    <DialogHeader>
                        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-700">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <DialogTitle>Hapus Dokumen Draft?</DialogTitle>
                        <DialogDescription>
                            Dokumen draft akan dihapus dari daftar dokumen dan tidak dapat dikembalikan.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <p className="text-xs font-semibold uppercase text-slate-500">Dokumen</p>
                        <p className="mt-1 break-words font-semibold text-slate-900">
                            {deleteDialog?.originalFileName ?? deleteDialog?.finalFileName ?? 'Dokumen PDF'}
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            className="border-slate-300"
                            onClick={() => setDeleteDialog(null)}
                            disabled={Boolean(deletingDocumentId)}
                        >
                            Batal
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => void confirmDeleteDraft()}
                            disabled={Boolean(deletingDocumentId)}
                        >
                            {deletingDocumentId ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                            Ya, Hapus Draft
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
}
