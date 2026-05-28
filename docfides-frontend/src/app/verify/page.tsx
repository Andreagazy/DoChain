'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import {
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Loader2,
    FileText,
    User,
    Building2,
    Calendar,
    Link2,
    ShieldCheck,
    Hash,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */

type SignerStatus = 'SIGNED' | 'PENDING' | 'DECLINED';

type Signer = {
    order: number;
    displayName: string;
    positionTitle: string | null;
    unitName: string | null;
    status: SignerStatus;
    signedAt: string | null;
};

type VerifyResult = {
    documentId: string;
    status: string;
    isValid: boolean;
    isRevoked: boolean;
    originalFileName: string | null;
    completedAt: string | null;
    createdAt: string;
    owner: {
        displayName: string | null;
        unitName: string | null;
        unitType: string | null;
    } | null;
    signers: Signer[];
    revocation: {
        revokedAt: string | null;
        reason: string | null;
        revokedBy: {
            displayName: string | null;
            role: string;
        } | null;
    } | null;
    proof: {
        ipfsHash: string | null;
        blockchainTxHash: string | null;
    };
};

/* ─── Helpers ────────────────────────────────────────────── */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function formatDate(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
    });
}

function shortenHash(hash: string | null): string {
    if (!hash) return '-';
    if (hash.length <= 20) return hash;
    return `${hash.slice(0, 10)}...${hash.slice(-10)}`;
}

/* ─── Sub-components ─────────────────────────────────────── */

function StatusBanner({ result }: { result: VerifyResult }) {
    if (result.isValid) {
        return (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-8 text-center shadow-sm">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 ring-8 ring-emerald-50">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" strokeWidth={1.5} />
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
                        Dokumen Terverifikasi
                    </p>
                    <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-emerald-900">
                        DOKUMEN VALID
                    </h1>
                    <p className="mt-2 text-sm text-emerald-700">
                        Dokumen ini telah ditandatangani secara digital dan tercatat pada sistem blockchain.
                    </p>
                </div>
            </div>
        );
    }

    if (result.isRevoked) {
        return (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-rose-50 p-8 text-center shadow-sm">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 ring-8 ring-red-50">
                    <XCircle className="h-10 w-10 text-red-600" strokeWidth={1.5} />
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-red-600">
                        Dokumen Dicabut
                    </p>
                    <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-red-900">
                        TIDAK BERLAKU
                    </h1>
                    <p className="mt-2 text-sm text-red-700">
                        Dokumen ini telah dicabut dan tidak dapat digunakan sebagai dokumen resmi.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-8 text-center shadow-sm">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 ring-8 ring-amber-50">
                <AlertTriangle className="h-10 w-10 text-amber-600" strokeWidth={1.5} />
            </div>
            <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
                    Proses Belum Selesai
                </p>
                <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-amber-900">
                    BELUM FINAL
                </h1>
                <p className="mt-2 text-sm text-amber-700">
                    Dokumen ini masih dalam proses penandatanganan. Status:{' '}
                    <span className="font-semibold">{result.status}</span>
                </p>
            </div>
        </div>
    );
}

function InfoRow({ icon: Icon, label, value }: {
    icon: React.ElementType;
    label: string;
    value: string | null | undefined;
}) {
    return (
        <div className="flex items-start gap-3 py-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <Icon className="h-4 w-4 text-slate-500" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900 break-all">{value ?? '-'}</p>
            </div>
        </div>
    );
}

function HashRow({ label, value }: { label: string; value: string | null }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!value) return;
        void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (!value) {
        return (
            <div className="flex items-start gap-3 py-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <Hash className="h-4 w-4 text-slate-400" />
                </div>
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-0.5 text-sm text-slate-400 italic">Belum tersedia</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-start gap-3 py-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <Hash className="h-4 w-4 text-slate-500" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
                <div className="mt-0.5 flex items-center gap-2">
                    <p className="font-mono text-xs text-slate-700 break-all">{shortenHash(value)}</p>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
                    >
                        {copied ? '✓ Disalin' : 'Salin'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main content ───────────────────────────────────────── */

function VerifyContent() {
    const searchParams = useSearchParams();
    const documentId = searchParams.get('documentId')?.trim() ?? '';

    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<VerifyResult | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!documentId) {
            setError('ID dokumen tidak ditemukan pada QR code ini.');
            setLoading(false);
            return;
        }

        setLoading(true);
        axios
            .get<VerifyResult>(`${API_BASE}/public/documents/${encodeURIComponent(documentId)}/verify`)
            .then((res) => setResult(res.data))
            .catch((err: unknown) => {
                const msg =
                    axios.isAxiosError(err)
                        ? (err.response?.data as { message?: string })?.message ?? err.message
                        : 'Terjadi kesalahan saat mengambil data.';
                setError(typeof msg === 'string' ? msg : 'Terjadi kesalahan.');
            })
            .finally(() => setLoading(false));
    }, [documentId]);

    /* Loading state */
    if (loading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg">
                    <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
                </div>
                <p className="text-sm font-medium text-slate-600">Memverifikasi dokumen...</p>
            </div>
        );
    }

    /* Error state */
    if (error || !result) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4">
                <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-xl text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                        <XCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <h1 className="mt-4 text-xl font-bold text-slate-900">Verifikasi Gagal</h1>
                    <p className="mt-2 text-sm text-slate-500">{error || 'Dokumen tidak ditemukan atau QR code tidak valid.'}</p>
                    <p className="mt-4 text-xs text-slate-400">
                        Pastikan QR code terbaca dengan benar dan dokumen masih terdaftar dalam sistem.
                    </p>
                </div>
                <p className="text-xs text-slate-400">DoChain · Sistem Sertifikasi Dokumen Digital</p>
            </div>
        );
    }

    /* Result state */
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/30 px-4 py-10">
            {/* Decorative blobs */}
            <div className="pointer-events-none fixed -top-32 -right-32 h-96 w-96 rounded-full bg-indigo-400/10 blur-3xl" />
            <div className="pointer-events-none fixed -bottom-32 -left-32 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />

            <div className="relative mx-auto w-full max-w-lg space-y-5">

                {/* Header branding */}
                <div className="flex items-center justify-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                        <ShieldCheck className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-bold tracking-tight text-slate-700">DoChain</span>
                    <span className="text-xs text-slate-400">· Verifikasi Dokumen</span>
                </div>

                {/* Status banner */}
                <StatusBanner result={result} />

                {result.revocation ? (
                    <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                                <XCircle className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-red-900">Informasi Pencabutan</h2>
                                <p className="mt-1 text-sm text-red-700">{result.revocation.reason ?? 'Tidak ada alasan tertulis.'}</p>
                                <p className="mt-2 text-xs text-slate-500">
                                    Dicabut pada {formatDate(result.revocation.revokedAt)}
                                    {result.revocation.revokedBy ? ` oleh ${result.revocation.revokedBy.displayName ?? result.revocation.revokedBy.role}` : ''}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* Document info card */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-5 py-4">
                        <h2 className="text-sm font-bold text-slate-900">Informasi Dokumen</h2>
                    </div>
                    <div className="divide-y divide-slate-100 px-5">
                        <InfoRow icon={FileText} label="Nama Dokumen" value={result.originalFileName} />
                        <InfoRow icon={User} label="Pemilik" value={result.owner?.displayName} />
                        <InfoRow
                            icon={Building2}
                            label={result.owner?.unitType === 'JURUSAN' ? 'Jurusan' : 'Program Studi'}
                            value={result.owner?.unitName}
                        />
                        <InfoRow
                            icon={Calendar}
                            label="Tanggal Selesai Ditandatangani"
                            value={result.completedAt ? formatDate(result.completedAt) : 'Belum selesai'}
                        />
                    </div>
                </div>

                {/* Signers card */}
                {result.signers.length > 0 && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-5 py-4">
                            <h2 className="text-sm font-bold text-slate-900">Penandatangan</h2>
                            <p className="mt-0.5 text-xs text-slate-400">
                                {result.signers.filter((s) => s.status === 'SIGNED').length} dari{' '}
                                {result.signers.length} telah menandatangani
                            </p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {result.signers.map((signer) => (
                                <div
                                    key={signer.order}
                                    className="flex items-center gap-4 px-5 py-4"
                                >
                                    {/* Order + status icon */}
                                    <div className="relative shrink-0">
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ${signer.status === 'SIGNED' ? 'bg-emerald-100 text-emerald-700' : signer.status === 'DECLINED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {signer.order}
                                        </div>
                                        <div className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white ${signer.status === 'SIGNED' ? 'bg-emerald-500' : signer.status === 'DECLINED' ? 'bg-red-500' : 'bg-slate-300'}`}>
                                            {signer.status === 'SIGNED' && (
                                                <CheckCircle2 className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                                            )}
                                            {signer.status === 'DECLINED' && (
                                                <XCircle className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                                            )}
                                        </div>
                                    </div>

                                    {/* Signer info */}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-slate-900">
                                            {signer.displayName}
                                        </p>
                                        <p className="truncate text-xs text-slate-500">
                                            {[signer.positionTitle, signer.unitName]
                                                .filter(Boolean)
                                                .join(' · ') || 'Penandatangan'}
                                        </p>
                                    </div>

                                    {/* Sign time */}
                                    <div className="shrink-0 text-right">
                                        {signer.status === 'SIGNED' && signer.signedAt ? (
                                            <>
                                                <p className="text-[10px] font-medium text-emerald-600">Ditandatangani</p>
                                                <p className="text-[10px] text-slate-400">
                                                    {new Date(signer.signedAt).toLocaleDateString('id-ID', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric',
                                                    })}
                                                </p>
                                            </>
                                        ) : signer.status === 'DECLINED' ? (
                                            <p className="text-[10px] font-medium text-red-600">Ditolak</p>
                                        ) : (
                                            <p className="text-[10px] font-medium text-slate-400">Menunggu</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Blockchain proof card */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-5 py-4">
                        <div className="flex items-center gap-2">
                            <Link2 className="h-4 w-4 text-indigo-600" />
                            <h2 className="text-sm font-bold text-slate-900">Bukti Blockchain</h2>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">
                            Hash kriptografis sebagai bukti integritas dokumen yang tidak dapat dimanipulasi.
                        </p>
                    </div>
                    <div className="divide-y divide-slate-100 px-5">
                        <HashRow label="IPFS Hash" value={result.proof.ipfsHash} />
                        <HashRow label="Blockchain TX Hash (Besu)" value={result.proof.blockchainTxHash} />
                    </div>
                </div>

                {/* Footer note */}
                <div className="rounded-xl border border-slate-200 bg-white/60 px-5 py-4 text-center">
                    <p className="text-xs text-slate-500">
                        Halaman ini dapat diakses oleh siapa saja untuk memverifikasi keaslian dokumen resmi yang
                        diterbitkan melalui sistem DoChain.
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                        DoChain · Sertifikasi Dokumen Digital · Hyperledger Besu + IPFS
                    </p>
                </div>
            </div>
        </div>
    );
}

/* ─── Page export ────────────────────────────────────────── */

export default function VerifyPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-slate-50">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                </div>
            }
        >
            <VerifyContent />
        </Suspense>
    );
}
