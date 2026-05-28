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
    overallStatus: 'VALID' | 'MODIFIED' | 'NO_SIGNATURES' | 'PARTIAL';
    overallMessage: string;
    fileHash: string;
    fileSize: number;
    signatureCount: number;
    signatures: SignatureDetail[];
    dbMatch: DbMatchResult;
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
            className={`group relative flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed p-14 cursor-pointer transition-all duration-300
                ${dragging
                    ? 'border-indigo-500 bg-indigo-50/60 scale-[1.01]'
                    : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/30'
                }
                ${loading ? 'pointer-events-none opacity-60' : ''}
            `}
            style={{ minHeight: 280 }}
        >
            {/* Glow ring on drag */}
            {dragging && (
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-4 ring-indigo-300/40" />
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
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    </div>
                    <p className="text-sm font-semibold text-slate-600 animate-pulse">
                        Menganalisis tanda tangan digital…
                    </p>
                </>
            ) : (
                <>
                    <div className={`flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300
                        ${dragging ? 'bg-indigo-500 scale-110' : 'bg-gradient-to-br from-indigo-100 to-violet-100 group-hover:scale-105'}
                    `}>
                        <UploadCloud className={`h-9 w-9 transition-colors ${dragging ? 'text-white' : 'text-indigo-600'}`} />
                    </div>

                    <div className="text-center">
                        <p className="text-base font-bold text-slate-800">
                            {dragging ? 'Lepaskan untuk memulai verifikasi' : 'Seret & lepas file PDF di sini'}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                            atau <span className="font-semibold text-indigo-600 hover:underline">klik untuk memilih file</span>
                        </p>
                        <p className="mt-3 text-xs text-slate-400">
                            Hanya file PDF · Maksimal 50 MB · File tidak disimpan di server
                        </p>
                    </div>

                    <div className="flex items-center gap-6 mt-2">
                        {['Tanda Tangan Digital', 'Rantai Sertifikat', 'Integritas Dokumen'].map((label) => (
                            <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
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
            bg: 'from-emerald-50 to-teal-50 border-emerald-200',
            iconBg: 'bg-emerald-100 ring-emerald-50',
            iconColor: 'text-emerald-600',
            titleColor: 'text-emerald-900',
        },
        MODIFIED: {
            icon: ShieldX,
            title: 'Dokumen Telah Dimodifikasi',
            subtitle: result.overallMessage,
            bg: 'from-red-50 to-rose-50 border-red-200',
            iconBg: 'bg-red-100 ring-red-50',
            iconColor: 'text-red-600',
            titleColor: 'text-red-900',
        },
        NO_SIGNATURES: {
            icon: ShieldAlert,
            title: 'Tidak Ada Tanda Tangan Digital',
            subtitle: result.overallMessage,
            bg: 'from-amber-50 to-yellow-50 border-amber-200',
            iconBg: 'bg-amber-100 ring-amber-50',
            iconColor: 'text-amber-600',
            titleColor: 'text-amber-900',
        },
        PARTIAL: {
            icon: ShieldAlert,
            title: 'Verifikasi Sebagian',
            subtitle: result.overallMessage,
            bg: 'from-amber-50 to-orange-50 border-amber-200',
            iconBg: 'bg-amber-100 ring-amber-50',
            iconColor: 'text-amber-600',
            titleColor: 'text-amber-900',
        },
    }[result.overallStatus];

    const Icon = config.icon;

    return (
        <div className={`flex flex-col items-center gap-4 rounded-2xl border bg-gradient-to-br ${config.bg} p-8 text-center shadow-sm`}>
            <div className={`flex h-20 w-20 items-center justify-center rounded-full ${config.iconBg} ring-8`}>
                <Icon className={`h-10 w-10 ${config.iconColor}`} strokeWidth={1.5} />
            </div>
            <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Hasil Verifikasi Tanda Tangan Digital
                </p>
                <h1 className={`mt-1 text-2xl font-extrabold tracking-tight ${config.titleColor}`}>
                    {config.title}
                </h1>
                <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">{config.subtitle}</p>
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
                    <p className="text-sm font-semibold text-slate-700">Tidak ditemukan di database DoChain</p>
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
                        <p className="text-sm font-bold text-indigo-900">Terdaftar di DoChain</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusColor}`}>
                            {match.status}
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

                {/* SHA-256 Hash row with copy button */}
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
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/30 px-4 py-10">
            {/* Decorative blobs */}
            <div className="pointer-events-none fixed -top-32 -right-32 h-96 w-96 rounded-full bg-indigo-400/10 blur-3xl" />
            <div className="pointer-events-none fixed -bottom-32 -left-32 h-96 w-96 rounded-full bg-violet-400/10 blur-3xl" />

            <div className="relative mx-auto w-full max-w-2xl space-y-6">

                {/* Branding header */}
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg">
                            <ShieldCheck className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-lg font-extrabold tracking-tight text-slate-800">DoChain</span>
                    </div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                        Verifikasi Dokumen PDF
                    </h1>
                    <p className="text-sm text-slate-500 max-w-sm">
                        Unggah dokumen PDF untuk memeriksa tanda tangan digital, rantai sertifikat, dan integritas dokumen secara menyeluruh.
                    </p>
                </div>

                {/* Drop zone */}
                <DropZone onFile={(f) => void handleFile(f)} loading={loading} />

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

                        {/* File metadata */}
                        <FileMetaCard result={result} fileName={fileName} />

                        {/* Signature panels */}
                        {result.signatures.length > 0 && (
                            <div className="space-y-4">
                                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                    <Fingerprint className="h-4 w-4 text-indigo-600" />
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
                                className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:border-indigo-300 hover:text-indigo-700 transition-all"
                            >
                                Verifikasi Dokumen Lain
                            </button>
                        </div>
                    </>
                )}

                {/* Footer */}
                <p className="text-center text-xs text-slate-400">
                    DoChain · Sistem Sertifikasi Dokumen Digital · Hyperledger Besu + IPFS
                    <br />
                    File yang diunggah diproses di memori server dan tidak disimpan.
                </p>
            </div>
        </div>
    );
}
