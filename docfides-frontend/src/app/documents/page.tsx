'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { AxiosError } from 'axios';
import { AppShell } from '@/components/layout/app-shell';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DocumentTable } from '@/components/documents/document-table';
import { EmptyState } from '@/components/common/empty-state';
import {
    listMyCertificationDocuments,
    getCertificationDocumentOriginalFile,
    getCertificationDocumentSignedFile,
} from '@/lib/auth-service';
import { OwnedDocumentItem } from '@/types/auth';

function normalizeErrorMessage(err: unknown): string {
    const axiosError = err as AxiosError<{ message?: string | string[] }>;
    const message = axiosError.response?.data?.message;
    return Array.isArray(message) ? message.join(', ') : message ?? axiosError.message ?? 'Terjadi kesalahan';
}

export default function DocumentsPage() {
    const [documents, setDocuments] = useState<OwnedDocumentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'pending' | 'signed'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'updatedAt' | 'status'>('updatedAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const loadDocuments = async () => {
        setError('');
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
            const name = (doc.originalFileName ?? doc.id).toLowerCase();
            return name.includes(searchTerm) || doc.id.toLowerCase().includes(searchTerm);
        });

        const sorted = [...bySearch].sort((a, b) => {
            if (sortBy === 'name') {
                const aName = (a.originalFileName ?? a.id).toLowerCase();
                const bName = (b.originalFileName ?? b.id).toLowerCase();
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

    const handleDownloadOriginal = async (doc: OwnedDocumentItem) => {
        try {
            const blob = await getCertificationDocumentOriginalFile(doc.id);
            triggerDownload(blob, doc.originalFileName ?? `${doc.id}.pdf`);
        } catch (err) {
            setError(normalizeErrorMessage(err));
        }
    };

    const handleDownloadSigned = async (doc: OwnedDocumentItem) => {
        try {
            const blob = await getCertificationDocumentSignedFile(doc.id);
            triggerDownload(blob, doc.finalFileName ?? `${doc.id}-signed.pdf`);
        } catch (err) {
            setError(normalizeErrorMessage(err));
        }
    };

    return (
        <AppShell title="Documents" subtitle="Search, filter, sort, and manage your certified documents.">
            <div className="space-y-5">
                {error ? (
                    <Alert className="border-red-200 bg-red-50 text-red-800">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            aria-label="Search documents"
                            className="pl-9"
                            placeholder="Search by file name or document ID"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>

                    <select
                        aria-label="Filter by status"
                        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as 'all' | 'draft' | 'pending' | 'signed')}
                    >
                        <option value="all">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="pending">Pending</option>
                        <option value="signed">Signed</option>
                    </select>

                    <Button variant="outline" className="border-slate-300" onClick={() => void loadDocuments()}>
                        Refresh
                    </Button>
                </div>

                {loading ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading documents...</div>
                ) : filteredDocuments.length === 0 ? (
                    <EmptyState
                        title="No documents found"
                        description="Upload your first document or adjust your search and filters."
                    />
                ) : (
                    <DocumentTable
                        documents={filteredDocuments}
                        sortBy={sortBy}
                        sortDirection={sortDirection}
                        onSortChange={handleSortChange}
                        onDownloadOriginal={handleDownloadOriginal}
                        onDownloadSigned={handleDownloadSigned}
                    />
                )}
            </div>
        </AppShell>
    );
}
