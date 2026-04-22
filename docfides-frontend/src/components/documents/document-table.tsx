import Link from 'next/link';
import { ArrowUpDown, Download, Eye, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { OwnedDocumentItem } from '@/types/auth';
import { StatusBadge } from '@/components/documents/status-badge';

interface DocumentTableProps {
    documents: OwnedDocumentItem[];
    sortBy: 'name' | 'updatedAt' | 'status';
    sortDirection: 'asc' | 'desc';
    onSortChange: (nextSortBy: 'name' | 'updatedAt' | 'status') => void;
    onDownloadOriginal: (doc: OwnedDocumentItem) => void;
    onDownloadSigned: (doc: OwnedDocumentItem) => void;
}

export function DocumentTable({
    documents,
    sortBy,
    sortDirection,
    onSortChange,
    onDownloadOriginal,
    onDownloadSigned,
}: DocumentTableProps) {
    const sortLabel = (key: 'name' | 'updatedAt' | 'status', label: string) => (
        <button
            type="button"
            onClick={() => onSortChange(key)}
            className="inline-flex items-center gap-1 text-left font-medium text-slate-700"
        >
            {label}
            {sortBy === key ? <ArrowUpDown className="h-3 w-3 text-slate-500" /> : null}
        </button>
    );

    return (
        <Card className="border-slate-200 bg-white/90 shadow-sm">
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left">{sortLabel('name', 'Document')}</th>
                                <th className="px-4 py-3 text-left">{sortLabel('status', 'Status')}</th>
                                <th className="px-4 py-3 text-left">Signers</th>
                                <th className="px-4 py-3 text-left">{sortLabel('updatedAt', 'Updated')}</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {documents.map((doc) => (
                                <tr key={doc.id} className="border-t border-slate-100">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-slate-900">{doc.originalFileName ?? doc.id}</p>
                                        <p className="text-xs text-slate-500">ID: {doc.id}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={doc.status} />
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{doc.requiredSignerCount}</td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {new Date(doc.updatedAt).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link href={`/documents/${doc.id}`}>
                                                <Button variant="outline" className="border-slate-300" size="sm">
                                                    <Eye className="mr-1 h-3 w-3" /> View
                                                </Button>
                                            </Link>
                                            <Button variant="outline" className="border-slate-300" size="sm" onClick={() => onDownloadOriginal(doc)}>
                                                <Download className="mr-1 h-3 w-3" /> Original
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="border-slate-300"
                                                size="sm"
                                                onClick={() => onDownloadSigned(doc)}
                                                disabled={!doc.finalFileName}
                                            >
                                                <Download className="mr-1 h-3 w-3" /> Signed
                                            </Button>
                                            <Link href="/certification">
                                                <Button variant="outline" className="border-slate-300" size="sm">
                                                    <ShieldCheck className="mr-1 h-3 w-3" /> Verify
                                                </Button>
                                            </Link>
                                            <Button variant="outline" className="border-slate-300 text-slate-400" size="sm" disabled>
                                                <Trash2 className="mr-1 h-3 w-3" /> Delete
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                    Sorting: {sortBy} ({sortDirection})
                </div>
            </CardContent>
        </Card>
    );
}
