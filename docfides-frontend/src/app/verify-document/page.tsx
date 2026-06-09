'use client';

import { useCallback, useRef, useState } from 'react';
import axios from 'axios';
import {
    ShieldCheck,
    ShieldX,
    ShieldAlert,
    Loader2,
    FileText,
    UploadCloud,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    Lock,
    Key,
    Award,
    Hash,
    Calendar,
    User,
    Building2,
    Clock,
    Fingerprint,
    Info,
    Database,
    ExternalLink,
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────────────────── */

type CertificateInfo = {
    subject: Record<string, string>;
    issuer: Record<string, string>;
    serialNumber: string;
    validFrom: string;
    validTo: string;
    isExpired: boolean;
    isCa: boolean;
    keyAlgorithm: string;
    keySize: number | null;
    sha256Fingerprint: string;
    sha1Fingerprint: string;
    signatureAlgorithm: string;
    subjectKeyId: string | null;
    authorityKeyId: string | null;
};

type SignatureDetail = {
    signerName: string;
    signerDN: string;
    reason: string | null;
    location: string | null;
    contactInfo: string | null;
    signedAt: string | null;
    digestAlgorithm: string;
    encryptionAlgorithm: string;
    integrityStatus: 'INTACT' | 'MODIFIED' | 'CANNOT_VERIFY';
    integrityMessage: string;
    certificateChain: CertificateInfo[];
};

type DbMatchResult = {
    found: boolean;
    documentId: string | null;
    originalFileName: string | null;
    status: string | null;
    isValid: boolean;
    isRevoked: boolean;
};

type InspectResult = {
    overallStatus: 'VALID' | 'MODIFIED' | 'NO_SIGNATURES' | 'PARTIAL' | 'NOT_RECORDED' | 'REVOKED';
    overallMessage: string;
    fileHash: string;
    fileSize: number;
    signatureCount: number;
    signatures: SignatureDetail[];
    dbMatch: DbMatchResult;
    blockchain: BlockchainRecord | null;
    verification: {
        hashMatchesBlockchain: boolean;
        registeredOnBlockchain: boolean;
        revokedOnBlockchain: boolean;
        verified: boolean;
        message: string;
    };
};

type BlockchainRecord = {
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

/* ─── Helpers ──────────────────────────────────────────────────────── */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function formatDate(iso: string | null) {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
    });
}

function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatFingerprint(fp: string) {
    return fp.match(/.{1,2}/g)?.join(':') ?? fp;
}

function formatDocumentStatus(status: string | null) {
    const map: Record<string, string> = {
        DRAFT: 'Draft',
        WAITING_SIGNATURES: 'Menunggu tanda tangan',
        IN_PROGRESS: 'Dalam proses tanda tangan',
        FULLY_SIGNED: 'Final dan aktif',
        REJECTED: 'Ditolak',
        REVOKED: 'Dicabut',
    };

    return status ? map[status] ?? status : '-';
}

function HashValue({ value }: { value: string | null | undefined }) {
    if (!value) {
        return <span className="text-slate-400">-</span>;
    }

    return <span className="break-all font-mono text-xs text-slate-700">{value}</span>;
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function DropZone({
    onFile,
    loading,
}: {
    onFile: (f: File) => void;
    loading: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) onFile(file);
        },
        [onFile],
    );

    return (
        <div
            id="pdf-dropzone"
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !loading && inputRef.current?.click()}
            className={`group relative flex cursor-pointer flex-col items-center justify-center gap-5 rounded-lg border-2 border-dashed p-8 text-center transition-all duration-300 md:p-12
                ${dragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/40'
                }
                ${loading ? 'pointer-events-none opacity-60' : ''}
            `}
            style={{ minHeight: 300 }}
        >
            {/* Glow ring on drag */}
            {dragging && (
                <div className="pointer-events-none absolute inset-0 rounded-lg ring-4 ring-blue-200/70" />
            )}

            <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            />

            {loading ? (
                <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-100">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-700" />
                    </div>
                    <p className="text-sm font-semibold text-slate-600 animate-pulse">
                        Menganalisis tanda tangan digital...
                    </p>
                </>
            ) : (
                <>
                    <div className={`flex h-20 w-20 items-center justify-center rounded-lg transition-all duration-300
                        ${dragging ? 'scale-105 bg-blue-600' : 'bg-blue-100 group-hover:bg-blue-200'}
                    `}>
                        <UploadCloud className={`h-9 w-9 transition-colors ${dragging ? 'text-white' : 'text-blue-700'}`} />
                    </div>

                    <div className="text-center">
                        <p className="text-base font-bold text-slate-800">
                            {dragging ? 'Lepaskan untuk memulai verifikasi' : 'Seret & lepas file PDF di sini'}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                            atau <span className="font-semibold text-blue-700 hover:underline">klik untuk memilih file</span>
                        </p>
                        <p className="mt-3 text-xs text-slate-400">
                            Hanya file PDF - Maksimal 50 MB - File tidak disimpan di server
                        </p>
                    </div>

                    <div className="mt-2 grid gap-2 text-left sm:grid-cols-3">
                        {['Tanda Tangan Digital', 'Rantai Sertifikat', 'Integritas Dokumen'].map((label) => (
                            <div key={label} className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                <span>{label}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

/* ── Certificate Chain Node ───────────────────────────── */

function CertChainNode({
    cert,
    depth,
    index,
    total,
}: {
    cert: CertificateInfo;
    depth: number;
    index: number;
    total: number;
}) {
    const [expanded, setExpanded] = useState(index === total - 1); // expand end-entity by default

    const isRoot = cert.isCa && index === total - 1;
    const isEndEntity = index === 0;

    const bgGrad = isRoot
        ? 'from-violet-50 to-purple-50 border-violet-200'
        : isEndEntity
            ? 'from-indigo-50 to-blue-50 border-indigo-200'
            : 'from-slate-50 to-slate-50 border-slate-200';

    const iconBg = isRoot
        ? 'bg-violet-100 text-violet-600'
        : isEndEntity
            ? 'bg-indigo-100 text-indigo-600'
            : 'bg-slate-100 text-slate-500';

    const label = isRoot ? 'Root CA' : isEndEntity ? 'Penandatangan' : 'Intermediate CA';
    const labelColor = isRoot
        ? 'text-violet-700 bg-violet-100'
        : isEndEntity
            ? 'text-indigo-700 bg-indigo-100'
            : 'text-slate-600 bg-slate-100';

    const cn = cert.subject['CN'] ?? cert.subject['commonName'] ?? 'Unknown';
    const org = cert.subject['O'] ?? cert.subject['organizationName'] ?? '';

    return (
        <div style={{ marginLeft: depth * 20 }}>
            {/* Connector line */}
            {depth > 0 && (
                <div
                    className="relative ml-[-10px] mb-1 h-4 w-px bg-slate-300"
                    style={{ marginLeft: (depth - 1) * 20 + 10 }}
                />
            )}

            <div className={`rounded-xl border bg-gradient-to-r ${bgGrad} overflow-hidden`}>
                {/* Header row */}
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="flex w-full items-center gap-3 px-4 py-3 hover:bg-black/5 transition-colors"
                >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
                        {isRoot ? <Award className="h-4 w-4" /> : isEndEntity ? <User className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-bold text-slate-900">{cn}</p>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${labelColor}`}>
                                {label}
                            </span>
                            {cert.isExpired && (
                                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                    Kedaluwarsa
                                </span>
                            )}
                        </div>
                        {org && <p className="truncate text-xs text-slate-500">{org}</p>}
                    </div>
                    {expanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                    ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                </button>

                {/* Expanded detail */}
                {expanded && (
                    <div className="border-t border-current/10 px-4 py-3 space-y-2 bg-white/50">
                        <DetailGrid items={[
                            { label: 'Subject DN', value: Object.entries(cert.subject).map(([k, v]) => `${k}=${v}`).join(', ') },
                            { label: 'Issued By', value: Object.entries(cert.issuer).map(([k, v]) => `${k}=${v}`).join(', ') },
                            { label: 'Serial Number', value: cert.serialNumber, mono: true },
                            { label: 'Valid From', value: formatDate(cert.validFrom) },
                            { label: 'Valid Until', value: formatDate(cert.validTo) },
                            { label: 'Key Algorithm', value: cert.keySize ? `${cert.keyAlgorithm} ${cert.keySize}-bit` : cert.keyAlgorithm },
                            { label: 'Signature Algorithm', value: cert.signatureAlgorithm },
                            { label: 'SHA-256 Fingerprint', value: cert.sha256Fingerprint, mono: true, wrap: true },
                            { label: 'SHA-1 Fingerprint', value: cert.sha1Fingerprint, mono: true, wrap: true },
                            ...(cert.subjectKeyId ? [{ label: 'Subject Key ID', value: cert.subjectKeyId, mono: true }] : []),
                            ...(cert.authorityKeyId ? [{ label: 'Authority Key ID', value: cert.authorityKeyId, mono: true }] : []),
                        ]} />
                    </div>
                )}
            </div>
        </div>
    );
}

function DetailGrid({ items }: { items: Array<{ label: string; value: string; mono?: boolean; wrap?: boolean }> }) {
    return (
        <div className="grid grid-cols-1 gap-2">
            {items.map((item) => (
                <div key={item.label} className="flex flex-col gap-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
                    <p className={`text-xs text-slate-800 ${item.mono ? 'font-mono' : 'font-medium'} ${item.wrap ? 'break-all' : 'break-words'}`}>
                        {item.value}
                    </p>
                </div>
            ))}
        </div>
    );
}

/* ── Signature Panel Card ─────────────────────────────── */

function SignaturePanel({ sig, index }: { sig: SignatureDetail; index: number }) {
    const [chainExpanded, setChainExpanded] = useState(false);

    const integrityIcon = {
        INTACT: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
        MODIFIED: <XCircle className="h-4 w-4 text-red-600" />,
        CANNOT_VERIFY: <AlertTriangle className="h-4 w-4 text-amber-600" />,
    }[sig.integrityStatus];

    const integrityColor = {
        INTACT: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        MODIFIED: 'text-red-700 bg-red-50 border-red-200',
        CANNOT_VERIFY: 'text-amber-700 bg-amber-50 border-amber-200',
    }[sig.integrityStatus];

    return (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {/* Card header */}
            <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50/50 px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white text-sm font-bold shadow">
                    {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{sig.signerName}</p>
                    <p className="truncate text-xs text-slate-500">{sig.signerDN}</p>
                </div>
                <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${integrityColor}`}>
                    {integrityIcon}
                    <span>{sig.integrityStatus === 'INTACT' ? 'Integritas OK' : sig.integrityStatus === 'MODIFIED' ? 'Dimodifikasi' : 'Tidak dapat diverifikasi'}</span>
                </div>
            </div>

            <div className="px-5 py-4 space-y-4">
                {/* Signature details grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                        { icon: Clock, label: 'Waktu Tanda Tangan', value: sig.signedAt ? formatDate(sig.signedAt) : 'Tidak tersedia' },
                        { icon: Key, label: 'Algoritma Enkripsi', value: sig.encryptionAlgorithm },
                        { icon: Hash, label: 'Algoritma Hash', value: sig.digestAlgorithm },
                        ...(sig.reason ? [{ icon: Info, label: 'Alasan', value: sig.reason }] : []),
                        ...(sig.location ? [{ icon: Building2, label: 'Lokasi', value: sig.location }] : []),
                        ...(sig.contactInfo ? [{ icon: User, label: 'Kontak', value: sig.contactInfo }] : []),
                    ].map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                                <Icon className="h-3.5 w-3.5 text-slate-400" />
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                            </div>
                            <p className="text-xs font-semibold text-slate-800 break-words">{value}</p>
                        </div>
                    ))}
                </div>

                {/* Integrity message */}
                <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 ${integrityColor}`}>
                    {integrityIcon}
                    <p className="text-xs font-medium">{sig.integrityMessage}</p>
                </div>

                {/* Certificate Chain */}
                {sig.certificateChain.length > 0 && (
                    <div>
                        <button
                            type="button"
                            onClick={() => setChainExpanded((v) => !v)}
                            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Lock className="h-4 w-4 text-slate-500" />
                                <p className="text-sm font-semibold text-slate-800">
                                    Rantai Sertifikat
                                </p>
                                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                                    {sig.certificateChain.length} sertifikat
                                </span>
                            </div>
                            {chainExpanded ? (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                            )}
                        </button>

                        {chainExpanded && (
                            <div className="mt-3 space-y-2 pl-2">
                                {/* Render chain root → leaf (reverse for display) */}
                                {[...sig.certificateChain].reverse().map((cert, i) => (
                                    <CertChainNode
                                        key={cert.serialNumber}
                                        cert={cert}
                                        depth={i}
                                        index={sig.certificateChain.length - 1 - i}
                                        total={sig.certificateChain.length}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Overall Status Banner ────────────────────────────── */

function OverallStatusBanner({ result }: { result: InspectResult }) {
    const config = {
        VALID: {
            icon: ShieldCheck,
            title: 'Dokumen Valid & Terverifikasi',
            subtitle: result.overallMessage,
            bg: 'border-emerald-200 bg-emerald-50',
            iconBg: 'bg-emerald-100',
            iconColor: 'text-emerald-600',
            titleColor: 'text-emerald-900',
        },
        MODIFIED: {
            icon: ShieldX,
            title: 'Dokumen Telah Dimodifikasi',
            subtitle: result.overallMessage,
            bg: 'border-red-200 bg-red-50',
            iconBg: 'bg-red-100',
            iconColor: 'text-red-600',
            titleColor: 'text-red-900',
        },
        NO_SIGNATURES: {
            icon: ShieldAlert,
            title: 'Tidak Ada Tanda Tangan Digital',
            subtitle: result.overallMessage,
            bg: 'border-amber-200 bg-amber-50',
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            titleColor: 'text-amber-900',
        },
        PARTIAL: {
            icon: ShieldAlert,
            title: 'Verifikasi Sebagian',
            subtitle: result.overallMessage,
            bg: 'border-amber-200 bg-amber-50',
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
            titleColor: 'text-amber-900',
        },
        NOT_RECORDED: {
            icon: ShieldAlert,
            title: 'Tidak Terdaftar di Blockchain',
            subtitle: result.overallMessage,
            bg: 'border-slate-200 bg-white',
            iconBg: 'bg-slate-100',
            iconColor: 'text-slate-600',
            titleColor: 'text-slate-900',
        },
        REVOKED: {
            icon: ShieldX,
            title: 'Dokumen Sudah Dicabut',
            subtitle: result.overallMessage,
            bg: 'border-red-200 bg-red-50',
            iconBg: 'bg-red-100',
            iconColor: 'text-red-600',
            titleColor: 'text-red-900',
        },
    }[result.overallStatus];

    const Icon = config.icon;

    return (
        <div className={`flex flex-col gap-5 rounded-lg border ${config.bg} p-6 shadow-sm md:flex-row md:items-center md:justify-between`}>
            <div className="flex items-start gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg ${config.iconBg}`}>
                <Icon className={`h-8 w-8 ${config.iconColor}`} strokeWidth={1.8} />
            </div>
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Hasil Verifikasi File
                </p>
                <h1 className={`mt-1 text-2xl font-bold tracking-tight ${config.titleColor}`}>
                    {config.title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{config.subtitle}</p>
            </div>
            </div>
            <div className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${result.verification.verified ? 'border-emerald-200 bg-white text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                {result.verification.verified ? 'VERIFIED' : 'NOT VERIFIED'}
            </div>
        </div>
    );
}

/* ── DB Match Card ────────────────────────────────────── */

function DbMatchCard({ match }: { match: DbMatchResult }) {
    if (!match.found) {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Database className="h-5 w-5 shrink-0 text-slate-400" />
                <div>
                    <p className="text-sm font-semibold text-slate-700">Tidak ditemukan di database DOCChain</p>
                    <p className="text-xs text-slate-500">
                        Dokumen ini tidak terdaftar dalam sistem — mungkin ditandatangani oleh sistem lain.
                    </p>
                </div>
            </div>
        );
    }

    const statusColor = match.isValid
        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
        : match.isRevoked
            ? 'text-red-700 bg-red-50 border-red-200'
            : 'text-amber-700 bg-amber-50 border-amber-200';

    return (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 px-4 py-3">
            <div className="flex items-start gap-3">
                <Database className="h-5 w-5 shrink-0 text-indigo-500 mt-0.5" />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-indigo-900">Terdaftar di DOCChain</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusColor}`}>
                            {formatDocumentStatus(match.status)}
                        </span>
                    </div>
                    <p className="mt-0.5 text-xs text-indigo-700 truncate">
                        {match.originalFileName}
                    </p>
                    {match.documentId && (
                        <a
                            href={`/verify?documentId=${match.documentId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                        >
                            Lihat detail verifikasi lengkap
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

function BlockchainCard({ record, fileHash }: { record: BlockchainRecord | null; fileHash: string }) {
    if (!record?.exists) {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Database className="h-5 w-5 shrink-0 text-slate-400" />
                <div>
                    <p className="text-sm font-semibold text-slate-700">Tidak ditemukan di blockchain</p>
                    <p className="text-xs text-slate-500">Hash file ini belum tercatat pada DocumentHashRegistry Besu.</p>
                </div>
            </div>
        );
    }

    const hashMatches = record.documentHash.toLowerCase().replace(/^0x/, '') === fileHash.toLowerCase();

    return (
        <div className={`rounded-xl border px-4 py-4 ${record.revoked ? 'border-red-200 bg-red-50' : hashMatches ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex items-start gap-3">
                <ShieldCheck className={`mt-0.5 h-5 w-5 shrink-0 ${record.revoked ? 'text-red-600' : hashMatches ? 'text-emerald-600' : 'text-amber-600'}`} />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">
                        Bukti blockchain
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                        {record.revoked ? 'Hash file tercatat, namun status on-chain sudah dicabut.' : hashMatches ? 'Hash file cocok dengan catatan on-chain dan statusnya aktif.' : 'Hash file tidak cocok dengan catatan on-chain.'}
                    </p>
                    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-lg border border-white/70 bg-white/70 px-3 py-2">
                            <p className="font-semibold text-slate-500">Hash file</p>
                            <p className={`mt-0.5 font-bold ${hashMatches ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {hashMatches ? 'Cocok' : 'Tidak cocok'}
                            </p>
                        </div>
                        <div className="rounded-lg border border-white/70 bg-white/70 px-3 py-2">
                            <p className="font-semibold text-slate-500">Status</p>
                            <p className={`mt-0.5 font-bold ${record.revoked ? 'text-red-700' : 'text-emerald-700'}`}>
                                {record.revoked ? 'Dicabut' : 'Aktif'}
                            </p>
                        </div>
                        <div className="rounded-lg border border-white/70 bg-white/70 px-3 py-2">
                            <p className="font-semibold text-slate-500">Waktu catat</p>
                            <p className="mt-0.5 font-bold text-slate-800">{formatDate(record.issuedAt)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TechnicalDetailsCard({
    result,
}: {
    result: InspectResult;
}) {
    const [expanded, setExpanded] = useState(false);
    const record = result.blockchain;

    const rows = [
        { label: 'SHA-256 hash file upload', value: result.fileHash },
        { label: 'Hash dokumen on-chain', value: record?.documentHash ?? null },
        { label: 'Smart contract', value: record?.contractAddress ?? null },
        { label: 'Issuer on-chain', value: record?.issuer ?? null },
        { label: 'IPFS CID final PDF', value: record?.ipfsCid ?? null },
        { label: 'Waktu catat on-chain', value: formatDate(record?.issuedAt ?? null), plain: true },
        { label: 'Status revoke on-chain', value: record?.exists ? (record.revoked ? 'Dicabut' : 'Aktif') : '-', plain: true },
        { label: 'Waktu revoke on-chain', value: formatDate(record?.revokedAt ?? null), plain: true },
        { label: 'Hash alasan revoke', value: record?.revokeReasonHash ?? null },
        { label: 'Document ID database', value: result.dbMatch.documentId },
    ];

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-slate-50"
            >
                <div className="flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-slate-500" />
                    <div>
                        <p className="text-sm font-bold text-slate-900">Detail teknis verifikasi</p>
                        <p className="text-xs text-slate-500">Hash, IPFS, contract, issuer, dan data teknis lain.</p>
                    </div>
                </div>
                {expanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                )}
            </button>

            {expanded && (
                <div className="space-y-3 border-t border-slate-100 px-5 py-4">
                    {rows.map((row) => (
                        <div key={row.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{row.label}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-800">
                                {row.plain ? row.value : <HashValue value={row.value} />}
                            </p>
                        </div>
                    ))}
                    <p className="text-xs leading-5 text-slate-500">
                        Detail ini ditujukan untuk audit teknis. Untuk pengguna umum, status utama di bagian atas sudah cukup untuk menentukan apakah dokumen valid, berubah, tidak terdaftar, atau dicabut.
                    </p>
                </div>
            )}
        </div>
    );
}

/* ── File Meta Card ───────────────────────────────────── */

function FileMetaCard({ result, fileName }: { result: InspectResult; fileName: string }) {
    const [copied, setCopied] = useState(false);

    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">Metadata File</h2>
            </div>
            <div className="divide-y divide-slate-100 px-5">
                {[
                    { icon: FileText, label: 'Nama File', value: fileName },
                    { icon: Hash, label: 'Ukuran', value: formatFileSize(result.fileSize) },
                    { icon: Fingerprint, label: 'Jumlah Tanda Tangan', value: `${result.signatureCount} tanda tangan` },
                ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 py-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                            <Icon className="h-4 w-4 text-slate-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                            <p className="text-sm font-semibold text-slate-900">{value}</p>
                        </div>
                    </div>
                ))}

                {false && (
                /* SHA-256 Hash row with copy button */
                <div className="flex items-start gap-3 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                        <Hash className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">SHA-256 Hash File</p>
                        <div className="mt-1 flex items-center gap-2">
                            <p className="font-mono text-xs text-slate-700 truncate">{result.fileHash}</p>
                            <button
                                type="button"
                                onClick={() => {
                                    void navigator.clipboard.writeText(result.fileHash).then(() => {
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    });
                                }}
                                className="shrink-0 rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:border-slate-300 hover:text-slate-800 transition-colors"
                            >
                                {copied ? '✓' : 'Salin'}
                            </button>
                        </div>
                    </div>
                </div>
                )}
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────── */

export default function VerifyDocumentPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<InspectResult | null>(null);
    const [error, setError] = useState('');
    const [fileName, setFileName] = useState('');

    const handleFile = useCallback(async (file: File) => {
        if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
            setError('Hanya file PDF yang dapat diverifikasi.');
            return;
        }

        setError('');
        setResult(null);
        setFileName(file.name);
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await axios.post<InspectResult>(
                `${API_BASE}/public/documents/inspect`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } },
            );
            setResult(res.data);
        } catch (err: unknown) {
            const msg = axios.isAxiosError(err)
                ? (err.response?.data as { message?: string })?.message ?? err.message
                : 'Gagal memverifikasi dokumen.';
            setError(typeof msg === 'string' ? msg : 'Terjadi kesalahan.');
        } finally {
            setLoading(false);
        }
    }, []);

    return (
        <div className="min-h-screen bg-[#f6f8fb] px-4 py-8">
            <div className="mx-auto w-full max-w-5xl space-y-5">

                {/* Branding header */}
                <div className="rounded-lg border border-slate-200 bg-white px-5 py-5 text-center shadow-sm">
                    <div className="mx-auto flex w-fit items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
                            <ShieldCheck className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-lg font-bold tracking-tight text-slate-950">DOCChain</span>
                    </div>
                    <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
                        Verifikasi Dokumen PDF
                    </h1>
                    <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        Unggah dokumen PDF untuk memeriksa kecocokan hash blockchain, status dokumen, tanda tangan digital, dan integritas file.
                    </p>
                </div>

                {/* Drop zone */}
                {!result && <DropZone onFile={(f) => void handleFile(f)} loading={loading} />}

                {/* Error state */}
                {error && (
                    <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                        <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                        <p className="text-sm font-medium text-red-700">{error}</p>
                    </div>
                )}

                {/* Results */}
                {result && (
                    <>
                        {/* Overall status */}
                        <OverallStatusBanner result={result} />

                        {/* DB match */}
                        <DbMatchCard match={result.dbMatch} />

                        {/* Blockchain match */}
                        <BlockchainCard record={result.blockchain} fileHash={result.fileHash} />

                        {/* File metadata */}
                        <FileMetaCard result={result} fileName={fileName} />

                        {/* Technical details */}
                        <TechnicalDetailsCard result={result} />

                        {/* Signature panels */}
                        {result.signatures.length > 0 && (
                            <div className="space-y-4">
                                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                    <Fingerprint className="h-4 w-4 text-blue-700" />
                                    Tanda Tangan Digital ({result.signatures.length})
                                </h2>
                                {result.signatures.map((sig, i) => (
                                    <SignaturePanel key={i} sig={sig} index={i} />
                                ))}
                            </div>
                        )}

                        {/* Reset button */}
                        <div className="text-center">
                            <button
                                id="verify-another-btn"
                                type="button"
                                onClick={() => { setResult(null); setError(''); setFileName(''); }}
                                className="rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:border-blue-300 hover:text-blue-700"
                            >
                                Verifikasi Dokumen Lain
                            </button>
                        </div>
                    </>
                )}

                {/* Footer */}
                <p className="text-center text-xs text-slate-400">
                    DOCChain · Sistem Sertifikasi Dokumen Digital · Hyperledger Besu + IPFS
                    <br />
                    File yang diunggah diproses di memori server dan tidak disimpan.
                </p>
            </div>
        </div>
    );
}
