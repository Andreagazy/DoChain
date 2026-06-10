'use client';

import { Suspense, useEffect, useState, type ElementType } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import {
    AlertTriangle,
    Building2,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock,
    FileText,
    Fingerprint,
    Hash,
    Link2,
    Loader2,
    ShieldCheck,
    User,
    XCircle,
} from 'lucide-react';

type SignerStatus = 'SIGNED' | 'PENDING' | 'DECLINED';

type Signer = {
    order: number;
    displayName: string;
    positionTitle: string | null;
    unitName: string | null;
    status: SignerStatus;
    signedAt: string | null;
};

type BlockchainRecord = {
    documentId: string;
    documentHash: string;
    ipfsCid: string;
    issuer: string;
    issuedAt: string | null;
    revoked: boolean;
    revokedAt: string | null;
    revokeReasonHash: string | null;
    exists: boolean;
    contractAddress: string;
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
        blockchain: BlockchainRecord | null;
    };
};

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

function formatShortDate(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
    });
}

function formatDocumentStatus(status: string) {
    const map: Record<string, string> = {
        DRAFT: 'Draft',
        WAITING_SIGNATURES: 'Menunggu tanda tangan',
        IN_PROGRESS: 'Dalam proses tanda tangan',
        FULLY_SIGNED: 'Final dan aktif',
        REJECTED: 'Ditolak',
        REVOKED: 'Dicabut',
    };

    return map[status] ?? status;
}

function shortenHash(hash: string | null | undefined): string {
    if (!hash) return '-';
    if (hash.length <= 28) return hash;
    return `${hash.slice(0, 12)}...${hash.slice(-12)}`;
}

function StatusBanner({ result }: { result: VerifyResult }) {
    const config = result.isRevoked
        ? {
            icon: XCircle,
            label: 'Dokumen Dicabut',
            title: 'Tidak Berlaku',
            message: 'Dokumen ini sudah dicabut dan tidak dapat digunakan sebagai dokumen resmi.',
            shell: 'border-rose-200 bg-rose-50',
            iconBox: 'bg-rose-100 text-rose-700',
            titleColor: 'text-rose-900',
        }
        : result.isValid
            ? {
                icon: CheckCircle2,
                label: 'Dokumen Terverifikasi',
                title: 'Dokumen Valid',
                message: 'Dokumen final tercatat pada sistem DOCChain dan statusnya masih aktif.',
                shell: 'border-emerald-200 bg-emerald-50',
                iconBox: 'bg-emerald-100 text-emerald-700',
                titleColor: 'text-emerald-900',
            }
            : {
                icon: AlertTriangle,
                label: 'Belum Final',
                title: 'Proses Belum Selesai',
                message: `Dokumen ditemukan, namun statusnya masih ${formatDocumentStatus(result.status)}.`,
                shell: 'border-amber-200 bg-amber-50',
                iconBox: 'bg-amber-100 text-amber-700',
                titleColor: 'text-amber-900',
            };

    const Icon = config.icon;

    return (
        <section className={`rounded-lg border p-6 shadow-sm ${config.shell}`}>
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg ${config.iconBox}`}>
                        <Icon className="h-8 w-8" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{config.label}</p>
                        <h1 className={`mt-1 text-2xl font-bold ${config.titleColor}`}>{config.title}</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">{config.message}</p>
                    </div>
                </div>
                <div className="rounded-lg border border-white/70 bg-white/75 px-4 py-3 text-left md:min-w-44">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status Sistem</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{formatDocumentStatus(result.status)}</p>
                </div>
            </div>
        </section>
    );
}

function InfoTile({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string | null | undefined }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-blue-600" />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            </div>
            <p className="mt-2 break-words text-sm font-semibold text-slate-900">{value ?? '-'}</p>
        </div>
    );
}

function CardSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
    return (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-bold text-slate-950">{title}</h2>
                {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
            </div>
            <div className="p-5">{children}</div>
        </section>
    );
}

function SignerTimeline({ signers }: { signers: Signer[] }) {
    const signedCount = signers.filter((signer) => signer.status === 'SIGNED').length;

    return (
        <CardSection
            title="Proses Tanda Tangan"
            description={`${signedCount} dari ${signers.length} penandatangan sudah menyelesaikan tanda tangan.`}
        >
            <div className="space-y-3">
                {signers.map((signer) => {
                    const isSigned = signer.status === 'SIGNED';
                    const isDeclined = signer.status === 'DECLINED';

                    return (
                        <div key={signer.order} className="flex gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                                isSigned ? 'bg-emerald-100 text-emerald-700' : isDeclined ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                                {signer.order}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-slate-950">{signer.displayName}</p>
                                        <p className="mt-0.5 text-xs text-slate-500">
                                            {[signer.positionTitle, signer.unitName].filter(Boolean).join(' - ') || 'Penandatangan'}
                                        </p>
                                    </div>
                                    <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-bold ${
                                        isSigned ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : isDeclined ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-500'
                                    }`}>
                                        {isSigned ? 'Sudah tanda tangan' : isDeclined ? 'Ditolak' : 'Menunggu'}
                                    </span>
                                </div>
                                <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                                    <Clock className="h-3.5 w-3.5" />
                                    {isSigned ? formatDate(signer.signedAt) : 'Belum ada waktu tanda tangan'}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </CardSection>
    );
}

function ProofSummary({ result }: { result: VerifyResult }) {
    const record = result.proof.blockchain;
    const isRecorded = Boolean(record?.exists);
    const isRevoked = Boolean(record?.revoked);

    return (
        <CardSection title="Bukti Blockchain" description="Ringkasan status pencatatan dokumen pada jaringan blockchain private.">
            <div className="grid gap-3 md:grid-cols-3">
                <InfoTile
                    icon={ShieldCheck}
                    label="Status On-chain"
                    value={isRecorded ? (isRevoked ? 'Dicabut' : 'Aktif') : 'Belum tercatat'}
                />
                <InfoTile icon={Calendar} label="Waktu Catat" value={formatDate(record?.issuedAt ?? null)} />
                <InfoTile icon={Hash} label="Tx Hash" value={shortenHash(result.proof.blockchainTxHash)} />
            </div>
        </CardSection>
    );
}

function TechnicalProof({ result }: { result: VerifyResult }) {
    const [expanded, setExpanded] = useState(false);
    const record = result.proof.blockchain;
    const rows = [
        ['IPFS CID', result.proof.ipfsHash],
        ['Blockchain TX Hash', result.proof.blockchainTxHash],
        ['Smart Contract', record?.contractAddress],
        ['Hash Dokumen On-chain', record?.documentHash],
        ['Issuer On-chain', record?.issuer],
        ['Waktu Catat On-chain', formatDate(record?.issuedAt ?? null)],
        ['Waktu Revoke On-chain', formatDate(record?.revokedAt ?? null)],
        ['Hash Alasan Revoke', record?.revokeReasonHash],
        ['Document ID', result.documentId],
    ];

    return (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-slate-50"
            >
                <div className="flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-blue-600" />
                    <div>
                        <h2 className="text-base font-bold text-slate-950">Detail Teknis</h2>
                        <p className="text-sm text-slate-500">Hash, IPFS, contract, issuer, dan data audit lain.</p>
                    </div>
                </div>
                {expanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
            </button>
            {expanded ? (
                <div className="grid gap-3 border-t border-slate-100 p-5">
                    {rows.map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                            <p className="mt-1 break-all font-mono text-xs text-slate-800">{value ?? '-'}</p>
                        </div>
                    ))}
                </div>
            ) : null}
        </section>
    );
}

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
                const msg = axios.isAxiosError(err)
                    ? (err.response?.data as { message?: string })?.message ?? err.message
                    : 'Terjadi kesalahan saat mengambil data.';
                setError(typeof msg === 'string' ? msg : 'Terjadi kesalahan.');
            })
            .finally(() => setLoading(false));
    }, [documentId]);

    if (loading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f6f8fb] px-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
                    <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
                </div>
                <p className="text-sm font-semibold text-slate-600">Memverifikasi dokumen...</p>
            </div>
        );
    }

    if (error || !result) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f8fb] px-4">
                <div className="w-full max-w-md rounded-lg border border-rose-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-rose-100">
                        <XCircle className="h-8 w-8 text-rose-700" />
                    </div>
                    <h1 className="mt-4 text-xl font-bold text-slate-950">Verifikasi Gagal</h1>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{error || 'Dokumen tidak ditemukan atau QR code tidak valid.'}</p>
                </div>
                <p className="mt-5 text-xs text-slate-400">DOCChain - Sistem Sertifikasi Dokumen Digital</p>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#f6f8fb] px-4 py-8">
            <div className="mx-auto w-full max-w-5xl space-y-5">
                <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center">
                            <img src="/image/docchain-logo.png" alt="DOCChain" className="h-10 w-10 object-contain" />
                        </div>
                        <div>
                            <p className="text-lg font-bold text-slate-950">DOCChain</p>
                            <p className="text-sm text-slate-500">Verifikasi dokumen dari QR code</p>
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        Dibaca dari QR dokumen
                    </div>
                </header>

                <StatusBanner result={result} />

                {result.revocation ? (
                    <section className="rounded-lg border border-rose-200 bg-rose-50 p-5 shadow-sm">
                        <div className="flex gap-3">
                            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
                            <div>
                                <h2 className="text-sm font-bold text-rose-900">Informasi Pencabutan</h2>
                                <p className="mt-1 text-sm leading-6 text-rose-800">{result.revocation.reason ?? 'Tidak ada alasan tertulis.'}</p>
                                <p className="mt-2 text-xs text-slate-600">
                                    Dicabut pada {formatDate(result.revocation.revokedAt)}
                                    {result.revocation.revokedBy ? ` oleh ${result.revocation.revokedBy.displayName ?? result.revocation.revokedBy.role}` : ''}
                                </p>
                            </div>
                        </div>
                    </section>
                ) : null}

                <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
                    <div className="space-y-5">
                        <CardSection title="Informasi Dokumen">
                            <div className="grid gap-3 md:grid-cols-2">
                                <InfoTile icon={FileText} label="Nama Dokumen" value={result.originalFileName} />
                                <InfoTile icon={User} label="Pemilik" value={result.owner?.displayName} />
                                <InfoTile
                                    icon={Building2}
                                    label={result.owner?.unitType === 'JURUSAN' ? 'Jurusan' : 'Program Studi'}
                                    value={result.owner?.unitName}
                                />
                                <InfoTile
                                    icon={Calendar}
                                    label="Tanggal Final"
                                    value={result.completedAt ? formatDate(result.completedAt) : 'Belum selesai'}
                                />
                            </div>
                        </CardSection>

                        {result.signers.length > 0 ? <SignerTimeline signers={result.signers} /> : null}
                    </div>

                    <aside className="space-y-5">
                        <ProofSummary result={result} />
                        <CardSection title="Ringkasan">
                            <div className="space-y-3">
                                <InfoTile icon={Calendar} label="Dibuat" value={formatShortDate(result.createdAt)} />
                                <InfoTile icon={Link2} label="IPFS" value={result.proof.ipfsHash ? 'Tersedia' : 'Belum tersedia'} />
                                <InfoTile icon={Hash} label="Hash On-chain" value={shortenHash(result.proof.blockchain?.documentHash)} />
                            </div>
                        </CardSection>
                    </aside>
                </div>

                <TechnicalProof result={result} />

                <footer className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-center text-xs leading-5 text-slate-500 shadow-sm">
                    Halaman ini dapat diakses publik untuk memeriksa status dokumen yang diterbitkan melalui DOCChain.
                    <p className="mt-1 font-semibold text-slate-400">DOCChain - Sertifikasi Dokumen Digital</p>
                </footer>
            </div>
        </main>
    );
}

export default function VerifyPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb]">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            }
        >
            <VerifyContent />
        </Suspense>
    );
}
