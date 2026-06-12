import Link from 'next/link';
import { ArrowRight, ArrowUpDown, Download, Eye, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { OwnedDocumentItem } from '@/types/auth';
import { StatusBadge } from '@/components/documents/status-badge';
import { buildCertificationStepHref, getDocumentNextCertificationStep } from '@/lib/certification-flow';

interface DocumentTableProps {
    documents: OwnedDocumentItem[];
    sortBy: 'name' | 'updatedAt' | 'status';
    sortDirection: 'asc' | 'desc';
    onSortChange: (nextSortBy: 'name' | 'updatedAt' | 'status') => void;
    onDownloadOriginal: (doc: OwnedDocumentItem) => void;
    onDownloadIpfs: (doc: OwnedDocumentItem) => void;
}

export function DocumentTable({
    documents,
    sortBy,
    sortDirection,
    onSortChange,
    onDownloadOriginal,
    onDownloadIpfs,
}: DocumentTableProps) {
    const getActionHref = (doc: OwnedDocumentItem) => {
        if (doc.accessType === 'SIGNER') {
            return '/certification/assigned';
        }

        return buildCertificationStepHref(getDocumentNextCertificationStep(doc.status, doc.requiredSignerCount), doc.id);
    };

    const sortLabel = (key: 'name' | 'updatedAt' | 'status', label: string) => (
        <button
            type="button"
            onClick={() => onSortChange(key)}
            className="inline-flex items-center gap-1 text-left font-medium text-slate-700"
        >
            {label}
            {sortBy === key ? (
                <ArrowUpDown className={`h-3 w-3 text-slate-500 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
            ) : null}
        </button>
    );

    return (
        <Card className="overflow-hidden rounded-2xl border-slate-200/60 bg-white/70 backdrop-blur-md shadow-lg shadow-slate-100/50">
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                        <thead className="border-b border-slate-200/60 bg-slate-50/40">
                            <tr>
                                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{sortLabel('name', 'Dokumen')}</th>
                                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{sortLabel('status', 'Status')}</th>
                                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Signer</th>
                                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{sortLabel('updatedAt', 'Diperbarui')}</th>
                                <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/60">
                            {documents.map((doc) => (
                                <tr key={doc.id} className="group hover:bg-slate-50/50 transition-all duration-200">
                                    <td className="px-6 py-4.5">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50/50 text-indigo-500 border border-indigo-100/30 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                <FileText className="h-4.5 w-4.5" />
                                            </div>
                                            <div className="max-w-[280px]">
                                                <p className="truncate font-semibold text-slate-900 leading-tight group-hover:text-indigo-950 transition-colors" title={doc.originalFileName ?? doc.finalFileName ?? 'Dokumen PDF'}>
                                                    {doc.originalFileName ?? doc.finalFileName ?? 'Dokumen PDF'}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    {doc.accessType === 'SIGNER'
                                                        ? `Perlu ditandatangani${doc.signerOrder ? ` - urutan ${doc.signerOrder}` : ''}`
                                                        : doc.hasVerificationQr ? 'QR verifikasi tersedia' : 'QR verifikasi belum ada'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4.5">
                                        <StatusBadge status={doc.status} />
                                    </td>
                                    <td className="px-6 py-4.5 text-slate-600">
                                        <div className="inline-flex items-center gap-1 bg-slate-100/60 px-2 py-0.5 rounded-full text-xs font-medium text-slate-600">
                                            {doc.requiredSignerCount} {doc.requiredSignerCount > 1 ? 'Signers' : 'Signer'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4.5 text-slate-600 text-xs font-medium">
                                        {new Date(doc.updatedAt).toLocaleString('id-ID', {
                                            dateStyle: 'medium',
                                            timeStyle: 'short'
                                        })}
                                    </td>
                                    <td className="px-6 py-4.5">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <Link href={`/documents/${doc.id}`}>
                                                <Button variant="outline" className="h-8 border-slate-200/80 hover:bg-indigo-50/50 hover:text-indigo-600 hover:border-indigo-200/60 rounded-lg text-xs font-semibold shadow-xs transition-all" size="sm">
                                                    <Eye className="h-3.5 w-3.5" /> Lihat
                                                </Button>
                                            </Link>
                                            <Button variant="outline" className="h-8 border-slate-200/80 hover:bg-indigo-50/50 hover:text-indigo-600 hover:border-indigo-200/60 rounded-lg text-xs font-semibold shadow-xs transition-all" size="sm" onClick={() => onDownloadOriginal(doc)} title="Unduh dokumen asli">
                                                <Download className="h-3.5 w-3.5" /> Asli
                                            </Button>
                                            {doc.finalFileName || doc.finalFileIpfsHash || doc.finalFileIpfsGatewayUrl ? (
                                                <Button
                                                    variant="outline"
                                                    className="h-8 border-slate-200/80 hover:bg-emerald-50/50 hover:text-emerald-600 hover:border-emerald-200/60 rounded-lg text-xs font-semibold shadow-xs transition-all"
                                                    size="sm"
                                                    onClick={() => onDownloadIpfs(doc)}
                                                    title="Unduh file final dari IPFS. Jika IPFS tidak tersedia, sistem memakai fallback backend."
                                                >
                                                    <Download className="h-3.5 w-3.5" /> Final IPFS
                                                </Button>
                                            ) : null}
                                            <Link href={getActionHref(doc)}>
                                                <Button size="sm" className="h-8 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all">
                                                    {doc.accessType === 'SIGNER' ? 'Sign' : 'Lanjut'} <ArrowRight className="h-3.5 w-3.5 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
