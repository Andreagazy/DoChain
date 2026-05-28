'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Eye, FileText, Info, Loader2, Search, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AdminPagination } from '@/components/common/admin-pagination';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getAdminDocumentFile, getUser, listAdminDocuments, revokeAdminDocument } from '@/lib/auth-service';
import { normalizeErrorMessage } from '@/lib/certification-flow';
import type { AdminDocumentsResponse } from '@/types/auth';

type AdminDocument = AdminDocumentsResponse['documents'][number];
const pageSize = 8;
type RevokeDialogState = {
    document: AdminDocument;
    reason: string;
    step: 'reason' | 'confirm';
    confirmed: boolean;
};

export default function AdminDocumentsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [documents, setDocuments] = useState<AdminDocument[]>([]);
    const [revokingDocumentId, setRevokingDocumentId] = useState('');
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [page, setPage] = useState(1);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [revokeDialog, setRevokeDialog] = useState<RevokeDialogState | null>(null);
    const [previewDialog, setPreviewDialog] = useState<{ document: AdminDocument; url: string; loading: boolean; error: string } | null>(null);
    const [infoDialog, setInfoDialog] = useState<AdminDocument | null>(null);
    const currentUser = useMemo(() => getUser(), []);

    useEffect(() => {
        async function loadData() {
            if (currentUser?.role !== 'SUPERADMIN' && currentUser?.role !== 'ADMIN_PRODI') {
                router.push('/dashboard');
                return;
            }

            try {
                const response = await listAdminDocuments();
                setDocuments(response.documents);
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }

        void loadData();
    }, [currentUser?.role, router]);

    const documentStatuses = useMemo(() => Array.from(new Set(documents.map((document) => document.status))), [documents]);
    const filteredDocuments = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return documents.filter((document) => {
            const matchesStatus = statusFilter === 'ALL' || document.status === statusFilter;
            const matchesQuery = !normalizedQuery
                || (document.originalFileName ?? '').toLowerCase().includes(normalizedQuery)
                || (document.user?.email ?? '').toLowerCase().includes(normalizedQuery)
                || (document.user?.displayName ?? '').toLowerCase().includes(normalizedQuery)
                || (document.finalFileHash ?? '').toLowerCase().includes(normalizedQuery);
            return matchesStatus && matchesQuery;
        });
    }, [documents, query, statusFilter]);
    const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginatedDocuments = filteredDocuments.slice((safePage - 1) * pageSize, safePage * pageSize);

    useEffect(() => {
        setPage(1);
    }, [query, statusFilter]);

    useEffect(() => () => {
        if (previewDialog?.url) {
            URL.revokeObjectURL(previewDialog.url);
        }
    }, [previewDialog?.url]);

    const handleOpenPreview = async (document: AdminDocument) => {
        if (previewDialog?.url) {
            URL.revokeObjectURL(previewDialog.url);
        }

        setError('');
        setPreviewDialog({ document, url: '', loading: true, error: '' });

        try {
            const blob = await getAdminDocumentFile(document.id);
            const url = URL.createObjectURL(blob);
            setPreviewDialog({ document, url, loading: false, error: '' });
        } catch (err) {
            setPreviewDialog({
                document,
                url: '',
                loading: false,
                error: normalizeErrorMessage(err),
            });
        }
    };

    const handleClosePreview = () => {
        if (previewDialog?.url) {
            URL.revokeObjectURL(previewDialog.url);
        }
        setPreviewDialog(null);
    };

    const openRevokeDialog = (document: AdminDocument) => {
        handleClosePreview();
        setRevokeDialog({ document, reason: '', step: 'reason', confirmed: false });
    };

    const handleContinueRevoke = () => {
        if (!revokeDialog) {
            return;
        }

        const reason = revokeDialog.reason.trim();
        if (reason.length < 5) {
            setError('Alasan pencabutan minimal 5 karakter.');
            return;
        }

        setError('');
        setRevokeDialog((current) => current ? { ...current, reason, step: 'confirm', confirmed: false } : current);
    };

    const handleRevoke = async () => {
        if (!revokeDialog) {
            return;
        }

        const reason = revokeDialog.reason.trim();
        if (reason.length < 5) {
            setError('Alasan pencabutan minimal 5 karakter.');
            return;
        }

        if (!revokeDialog.confirmed) {
            setError('Centang persetujuan pencabutan terlebih dahulu.');
            return;
        }

        setError('');
        setSuccess('');
        const documentId = revokeDialog.document.id;
        setRevokingDocumentId(documentId);
        try {
            const result = await revokeAdminDocument(documentId, { reason });
            setDocuments((current) => current.map((document) => document.id === documentId ? result.document : document));
            setSuccess(result.message);
            setRevokeDialog(null);
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setRevokingDocumentId('');
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memuat dokumen...
            </div>
        );
    }

    return (
        <AppShell
            title={currentUser?.role === 'ADMIN_PRODI' ? 'Dokumen Prodi' : 'Admin Dokumen'}
            subtitle={currentUser?.role === 'ADMIN_PRODI' ? 'Monitoring dokumen yang terkait dengan anggota prodi Anda.' : 'Monitoring seluruh dokumen, signer, dan alasan penolakan.'}
        >
            <div className="space-y-5">
                {error ? (
                    <Alert className="border-red-200 bg-red-50 text-red-800">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                {success ? (
                    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>{success}</AlertDescription>
                    </Alert>
                ) : null}

                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-slate-200 bg-white shadow-sm">
                        <CardContent className="pt-6">
                            <p className="text-xs uppercase text-slate-500">Total Dokumen</p>
                            <p className="mt-2 text-3xl font-semibold">{documents.length}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-slate-200 bg-white shadow-sm">
                        <CardContent className="pt-6">
                            <p className="text-xs uppercase text-slate-500">Fully Signed</p>
                            <p className="mt-2 text-3xl font-semibold">{documents.filter((doc) => doc.status === 'FULLY_SIGNED').length}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-slate-200 bg-white shadow-sm">
                        <CardContent className="pt-6">
                            <p className="text-xs uppercase text-slate-500">Ditolak/Revoke</p>
                            <p className="mt-2 text-3xl font-semibold">{documents.filter((doc) => doc.status === 'REVOKED').length}</p>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Semua Dokumen
                        </CardTitle>
                        <CardDescription>Gunakan halaman ini untuk audit status sertifikasi dan penolakan dokumen.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                            <p className="text-sm text-slate-600">{filteredDocuments.length} dokumen ditemukan.</p>
                            <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari dokumen..." className="pl-9" />
                                </div>
                                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm">
                                    <option value="ALL">Semua status</option>
                                    {documentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1000px] text-left text-sm">
                                <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Dokumen</th>
                                        <th className="px-4 py-3 font-medium">Owner</th>
                                        <th className="px-4 py-3 font-medium">Status</th>
                                        <th className="px-4 py-3 font-medium">Signer</th>
                                        <th className="px-4 py-3 text-right font-medium">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {paginatedDocuments.length === 0 ? (
                                        <tr>
                                            <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>Belum ada dokumen pada filter ini.</td>
                                        </tr>
                                    ) : paginatedDocuments.map((document) => (
                                        <tr key={document.id} className="bg-white align-top hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-slate-900">{document.originalFileName ?? document.id}</p>
                                                <p className="mt-0.5 text-xs text-slate-500">{new Date(document.updatedAt).toLocaleString()}</p>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{document.user?.displayName ?? document.user?.email ?? '-'}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant={document.status === 'FULLY_SIGNED' ? 'success' : document.status === 'REVOKED' ? 'destructive' : 'warning'}>{document.status}</Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="space-y-1">
                                                    {document.requiredSigners.length === 0 ? (
                                                        <span className="text-xs text-slate-500">Belum ada signer</span>
                                                    ) : document.requiredSigners.map((signer, index) => (
                                                        <div key={`${document.id}-${signer.user.email}-${index}`} className="flex items-center gap-2">
                                                            <span className="max-w-48 truncate text-xs text-slate-600">#{signer.order ?? index + 1} {signer.user.displayName ?? signer.user.email}</span>
                                                            <Badge variant={signer.status === 'SIGNED' ? 'success' : signer.status === 'DECLINED' ? 'destructive' : 'warning'}>{signer.status}</Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    <Button size="sm" variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => setInfoDialog(document)}>
                                                        <Info className="h-4 w-4" />
                                                        Info
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50" onClick={() => void handleOpenPreview(document)}>
                                                        <Eye className="h-4 w-4" />
                                                        Lihat
                                                    </Button>
                                                    {currentUser?.role === 'SUPERADMIN' ? (
                                                        <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => openRevokeDialog(document)} disabled={revokingDocumentId === document.id || document.status === 'REVOKED'}>
                                                            {revokingDocumentId === document.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                                            Cabut
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <AdminPagination page={safePage} pageSize={pageSize} totalItems={filteredDocuments.length} onPageChange={setPage} />
                    </CardContent>
                </Card>

                <Dialog open={Boolean(infoDialog)} onOpenChange={(open) => !open && setInfoDialog(null)}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Informasi Dokumen</DialogTitle>
                            <DialogDescription>Detail metadata, hash, IPFS, dan riwayat pencabutan dokumen.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 text-sm">
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs uppercase text-slate-500">Dokumen</p>
                                <p className="mt-1 font-semibold text-slate-900">{infoDialog?.originalFileName ?? infoDialog?.id ?? '-'}</p>
                                <p className="mt-1 text-xs text-slate-500">ID: {infoDialog?.id ?? '-'}</p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-md border border-slate-200 p-3">
                                    <p className="text-xs uppercase text-slate-500">Dibuat</p>
                                    <p className="mt-1 text-slate-700">{infoDialog?.createdAt ? new Date(infoDialog.createdAt).toLocaleString('id-ID') : '-'}</p>
                                </div>
                                <div className="rounded-md border border-slate-200 p-3">
                                    <p className="text-xs uppercase text-slate-500">Update Terakhir</p>
                                    <p className="mt-1 text-slate-700">{infoDialog?.updatedAt ? new Date(infoDialog.updatedAt).toLocaleString('id-ID') : '-'}</p>
                                </div>
                            </div>
                            <div className="rounded-md border border-slate-200 p-3">
                                <p className="text-xs uppercase text-slate-500">Hash final</p>
                                <p className="mt-1 break-all text-xs text-slate-700">{infoDialog?.finalFileHash ?? '-'}</p>
                            </div>
                            <div className="rounded-md border border-slate-200 p-3">
                                <p className="text-xs uppercase text-slate-500">IPFS</p>
                                <p className="mt-1 break-all text-xs text-slate-700">{infoDialog?.finalFileIpfsHash ?? '-'}</p>
                            </div>
                            {infoDialog?.status === 'REVOKED' ? (
                                <div className="rounded-md border border-red-100 bg-red-50 p-3 text-red-700">
                                    <p className="text-xs uppercase">Pencabutan</p>
                                    <p className="mt-1 font-medium">{infoDialog.revokeReason ?? '-'}</p>
                                    <p className="mt-1 text-xs">{infoDialog.revokedAt ? new Date(infoDialog.revokedAt).toLocaleString('id-ID') : '-'}</p>
                                    <p className="mt-1 text-xs">Oleh: {infoDialog.revokedBy?.displayName ?? infoDialog.revokedBy?.email ?? '-'}</p>
                                </div>
                            ) : null}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" className="border-slate-300" onClick={() => setInfoDialog(null)}>
                                Tutup
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={Boolean(previewDialog)} onOpenChange={(open) => !open && handleClosePreview()}>
                    <DialogContent className="sm:max-w-5xl">
                        <DialogHeader>
                            <DialogTitle>Lihat Dokumen</DialogTitle>
                            <DialogDescription>
                                Periksa isi dokumen dan status signer sebelum mengambil keputusan pencabutan.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                            <div className="min-h-[65vh] overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                                {previewDialog?.loading ? (
                                    <div className="flex h-[65vh] items-center justify-center text-slate-600">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Memuat dokumen...
                                    </div>
                                ) : previewDialog?.error ? (
                                    <div className="p-4 text-sm text-red-700">
                                        Gagal memuat dokumen: {previewDialog.error}
                                    </div>
                                ) : previewDialog?.url ? (
                                    <iframe title="Preview dokumen" src={previewDialog.url} className="h-[65vh] w-full bg-white" />
                                ) : (
                                    <div className="p-4 text-sm text-slate-500">Preview belum tersedia.</div>
                                )}
                            </div>
                            <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
                                <div>
                                    <p className="text-xs uppercase text-slate-500">Dokumen</p>
                                    <p className="mt-1 font-semibold text-slate-900">{previewDialog?.document.originalFileName ?? previewDialog?.document.id ?? '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-slate-500">Owner</p>
                                    <p className="mt-1 text-slate-700">{previewDialog?.document.user?.displayName ?? previewDialog?.document.user?.email ?? '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-slate-500">Status</p>
                                    <div className="mt-1">
                                        <Badge variant={previewDialog?.document.status === 'FULLY_SIGNED' ? 'success' : previewDialog?.document.status === 'REVOKED' ? 'destructive' : 'warning'}>
                                            {previewDialog?.document.status ?? '-'}
                                        </Badge>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-slate-500">Signer</p>
                                    <div className="mt-2 space-y-1">
                                        {previewDialog?.document.requiredSigners.length ? previewDialog.document.requiredSigners.map((signer, index) => (
                                            <div key={`${signer.user.email}-${index}`} className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                                                <p className="truncate text-xs font-medium text-slate-700">#{signer.order ?? index + 1} {signer.user.displayName ?? signer.user.email}</p>
                                                <p className="text-[11px] text-slate-500">{signer.status}</p>
                                            </div>
                                        )) : <p className="text-xs text-slate-500">Belum ada signer.</p>}
                                    </div>
                                </div>
                                {currentUser?.role === 'SUPERADMIN' && previewDialog?.document.status !== 'REVOKED' ? (
                                    <Button className="w-full bg-red-600 hover:bg-red-700" onClick={() => previewDialog && openRevokeDialog(previewDialog.document)}>
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Cabut Dokumen Ini
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog open={Boolean(revokeDialog)} onOpenChange={(open) => !open && setRevokeDialog(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Cabut Dokumen</DialogTitle>
                            <DialogDescription>
                                Pastikan dokumen sudah diperiksa. Alasan pencabutan akan tampil pada halaman verifikasi QR.
                            </DialogDescription>
                        </DialogHeader>
                        {revokeDialog?.step === 'confirm' ? (
                            <div className="space-y-3">
                                <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-800">
                                    <p className="font-semibold">Konfirmasi pencabutan</p>
                                    <p className="mt-1 text-xs">
                                        Setelah dicabut, halaman verifikasi QR akan menampilkan dokumen ini sebagai tidak berlaku.
                                    </p>
                                </div>
                                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                                    <p className="font-semibold text-slate-900">{revokeDialog.document.originalFileName ?? revokeDialog.document.id}</p>
                                    <p className="mt-2 text-xs uppercase text-slate-500">Alasan</p>
                                    <p className="mt-1 text-sm text-slate-700">{revokeDialog.reason}</p>
                                </div>
                                <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={revokeDialog.confirmed}
                                        onChange={(event) => setRevokeDialog((current) => current ? { ...current, confirmed: event.target.checked } : current)}
                                        className="mt-1 h-4 w-4"
                                    />
                                    <span>Saya menyetujui pencabutan dokumen ini dan memahami status dokumen akan menjadi tidak berlaku.</span>
                                </label>
                            </div>
                        ) : (
                        <div className="space-y-3">
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                                <p className="font-semibold text-slate-900">{revokeDialog?.document.originalFileName ?? revokeDialog?.document.id}</p>
                                <p className="mt-1 text-xs text-slate-500">Status saat ini: {revokeDialog?.document.status ?? '-'}</p>
                            </div>
                            <label className="block text-sm font-medium text-slate-700" htmlFor="revoke-reason">
                                Alasan pencabutan
                            </label>
                            <textarea
                                id="revoke-reason"
                                value={revokeDialog?.reason ?? ''}
                                onChange={(event) => setRevokeDialog((current) => current ? { ...current, reason: event.target.value } : current)}
                                className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                placeholder="Contoh: Data pada dokumen salah dan harus diterbitkan ulang."
                                maxLength={500}
                            />
                            <p className="text-xs text-slate-500">Alasan ini akan tampil pada halaman verifikasi QR.</p>
                        </div>
                        )}
                        <DialogFooter>
                            <Button variant="outline" className="border-slate-300" onClick={() => setRevokeDialog(null)}>
                                Batal
                            </Button>
                            {revokeDialog?.step === 'confirm' ? (
                                <>
                                    <Button variant="outline" className="border-slate-300" onClick={() => setRevokeDialog((current) => current ? { ...current, step: 'reason', confirmed: false } : current)}>
                                        Kembali
                                    </Button>
                                    <Button className="bg-red-600 hover:bg-red-700" onClick={() => void handleRevoke()} disabled={revokingDocumentId !== '' || !revokeDialog.confirmed}>
                                        {revokingDocumentId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                                        Ya, Cabut
                                    </Button>
                                </>
                            ) : (
                                <Button className="bg-red-600 hover:bg-red-700" onClick={handleContinueRevoke} disabled={(revokeDialog?.reason.trim().length ?? 0) < 5}>
                                    Lanjut Konfirmasi
                                </Button>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppShell>
    );
}
