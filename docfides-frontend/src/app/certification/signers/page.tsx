'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, MoveDown, MoveUp, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/layout/app-shell';
import { CertificationStepper } from '@/components/certification/certification-stepper';
import {
    getDocumentSignerPlaceholders,
    getIdentityProfile,
    getIdentityStatus,
    getSignatureStatus,
    getUser,
    listMyCertificationDocuments,
    listSignerCandidates,
    requestDocumentSigners,
    startDocumentCertification,
} from '@/lib/auth-service';
import { buildCertificationStepHref, getDefaultPlaceholder, normalizeErrorMessage, type PlaceholderConfig } from '@/lib/certification-flow';
import type { OwnedDocumentItem, SignerCandidate, User } from '@/types/auth';

const SIGNER_ROLE_RANK: Record<string, number> = {
    MAHASISWA: 10,
    PEGAWAI: 20,
    ADMIN_PRODI: 30,
    PRODI: 40,
    JURUSAN: 50,
    SUPERADMIN: 60,
};

const getSignerDisplayName = (signer?: Pick<SignerCandidate, 'certificateName' | 'fullName' | 'displayName' | 'email'> | null) =>
    signer?.certificateName ?? signer?.fullName ?? signer?.displayName ?? signer?.email ?? 'Signer';

function CertificationSignersContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [currentUserFullName, setCurrentUserFullName] = useState<string | null>(null);
    const [preferredMode, setPreferredMode] = useState<'visible' | 'invisible'>('visible');
    const [hasSignature, setHasSignature] = useState(false);
    const [myDocuments, setMyDocuments] = useState<OwnedDocumentItem[]>([]);
    const [signerCandidates, setSignerCandidates] = useState<SignerCandidate[]>([]);
    const [selectedDocumentId, setSelectedDocumentId] = useState('');
    const [signerSearch, setSignerSearch] = useState('');
    const [orderedSignerIds, setOrderedSignerIds] = useState<string[]>([]);
    const [placeholderBySignerId, setPlaceholderBySignerId] = useState<Record<string, PlaceholderConfig | null>>({});

    const selectedDocument = useMemo(
        () => myDocuments.find((document) => document.id === selectedDocumentId) ?? null,
        [myDocuments, selectedDocumentId],
    );

    const signerOptions = useMemo(() => {
        const options = [...signerCandidates];
        if (currentUser) {
            options.unshift({
                id: currentUser.id,
                email: currentUser.email,
                displayName: currentUser.displayName ?? 'Saya',
                fullName: currentUserFullName,
                certificateName: `${currentUserFullName ?? currentUser.displayName ?? 'Saya'} (Pemilik Dokumen)`,
                role: currentUser.role,
                academicProfile: currentUser.academicProfile ?? null,
                preferredSignatureMode: preferredMode,
            });
        }

        const uniqueOptions = Array.from(new Map(options.map((item) => [item.id, {
            ...item,
            preferredSignatureMode: 'visible' as const,
        }])).values());

        return uniqueOptions.sort((a, b) => {
            const levelA = SIGNER_ROLE_RANK[a.role] ?? 999;
            const levelB = SIGNER_ROLE_RANK[b.role] ?? 999;
            return levelA - levelB || getSignerDisplayName(a).localeCompare(getSignerDisplayName(b));
        });
    }, [currentUser, currentUserFullName, preferredMode, signerCandidates]);

    const signerPreferenceById = useMemo(
        () => new Map(signerOptions.map((item) => [item.id, item.preferredSignatureMode])),
        [signerOptions],
    );

    const signerById = useMemo(
        () => new Map(signerOptions.map((item) => [item.id, item])),
        [signerOptions],
    );

    const getSignerLevel = (signerId: string) => {
        const signer = signerById.get(signerId);
        return SIGNER_ROLE_RANK[signer?.role ?? ''] ?? 999;
    };

    const normalizeSignerOrder = (signerIds: string[]) => {
        return signerIds
            .map((signerId, index) => ({ signerId, index, level: getSignerLevel(signerId) }))
            .sort((a, b) => a.level - b.level || a.index - b.index)
            .map((item) => item.signerId);
    };

    const canMoveSigner = (index: number, direction: -1 | 1) => {
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= orderedSignerIds.length) {
            return false;
        }

        return getSignerLevel(orderedSignerIds[index]) === getSignerLevel(orderedSignerIds[nextIndex]);
    };

    const availableSignerOptions = useMemo(() => {
        const term = signerSearch.trim().toLowerCase();

        return signerOptions.filter((option) => {
            if (orderedSignerIds.includes(option.id)) {
                return false;
            }

            if (!term) {
                return true;
            }

            const label = getSignerDisplayName(option).toLowerCase();
            return label.includes(term) || option.email.toLowerCase().includes(term);
        });
    }, [orderedSignerIds, signerOptions, signerSearch]);

    const execute = async (action: string, fn: () => Promise<void>) => {
        setError('');
        setSuccess('');
        setLoadingAction(action);

        try {
            await fn();
            setSuccess(`${action} berhasil`);
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setLoadingAction('');
        }
    };

    useEffect(() => {
        async function loadPage() {
            try {
                setCurrentUser(getUser());

                const [identityStatus, identityProfile, signatureStatus, documents, candidates] = await Promise.all([
                    getIdentityStatus(),
                    getIdentityProfile(),
                    getSignatureStatus(),
                    listMyCertificationDocuments(),
                    listSignerCandidates(),
                ]);

                if (identityStatus.status !== 'APPROVED') {
                    router.push('/profile#identitas-ktp');
                    return;
                }

                setPreferredMode('visible');
                setHasSignature(signatureStatus.hasSignature);
                setCurrentUserFullName(identityProfile.fullName ?? null);
                setMyDocuments(documents.documents);
                setSignerCandidates(candidates.signers);

                setSelectedDocumentId((current) => {
                    const documentIdFromQuery = searchParams.get('documentId')?.trim();
                    if (documentIdFromQuery && documents.documents.some((document) => document.id === documentIdFromQuery)) {
                        return documentIdFromQuery;
                    }

                    if (current && documents.documents.some((document) => document.id === current)) {
                        return current;
                    }

                    return documents.documents[0]?.id ?? '';
                });
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }

        void loadPage();
    }, [router, searchParams]);

    useEffect(() => {
        let cancelled = false;

        async function loadStoredSigners() {
            setOrderedSignerIds([]);
            setPlaceholderBySignerId({});

            if (!selectedDocumentId) {
                return;
            }

            try {
                const data = await getDocumentSignerPlaceholders(selectedDocumentId);
                if (cancelled || !data.signers.length) {
                    return;
                }

                const sortedSigners = [...data.signers].sort((a, b) => {
                    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
                    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
                    return orderA - orderB;
                });

                setOrderedSignerIds(sortedSigners.map((signer) => signer.userId));
                setPlaceholderBySignerId(sortedSigners.reduce<Record<string, PlaceholderConfig>>((accumulator, item, index) => {
                    const fallback = getDefaultPlaceholder(index);
                    accumulator[item.userId] = {
                        visiblePage: item.placeholder.visiblePage ?? fallback.visiblePage,
                        visibleX: item.placeholder.visibleX ?? fallback.visibleX,
                        visibleY: item.placeholder.visibleY ?? fallback.visibleY,
                        visibleWidth: item.placeholder.visibleWidth ?? fallback.visibleWidth,
                        visibleHeight: item.placeholder.visibleHeight ?? fallback.visibleHeight,
                    };
                    return accumulator;
                }, {}));
            } catch {
                // Documents without signer configuration are fine on this step.
            }
        }

        void loadStoredSigners();

        return () => {
            cancelled = true;
        };
    }, [selectedDocumentId]);

    const addSigner = (signerId: string) => {
        if (!signerId || orderedSignerIds.includes(signerId)) {
            return;
        }

        setOrderedSignerIds((current) => {
            return normalizeSignerOrder([...current, signerId]);
        });
        setSignerSearch('');
    };

    const moveSigner = (index: number, direction: -1 | 1) => {
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= orderedSignerIds.length) {
            return;
        }

        if (!canMoveSigner(index, direction)) {
            setError('Signer hanya bisa dipindah dalam role/level yang sama.');
            return;
        }

        setOrderedSignerIds((current) => {
            const next = [...current];
            const temp = next[index];
            next[index] = next[nextIndex];
            next[nextIndex] = temp;
            return next;
        });
    };

    const removeSigner = (signerId: string) => {
        setOrderedSignerIds((current) => current.filter((item) => item !== signerId));
        setPlaceholderBySignerId((current) => {
            const next = { ...current };
            delete next[signerId];
            return next;
        });
    };

    const handleContinue = async () => {
        if (!selectedDocumentId) {
            setError('Pilih dokumen terlebih dahulu.');
            return;
        }

        if (orderedSignerIds.length === 0) {
            setError('Tambahkan minimal satu signer terlebih dahulu.');
            return;
        }

        await execute('Simpan Signer', async () => {
            await startDocumentCertification(selectedDocumentId);
            const normalizedSignerIds = normalizeSignerOrder(orderedSignerIds);
            const placeholders = normalizedSignerIds
                .filter((signerId) => signerPreferenceById.get(signerId) === 'visible')
                .map((signerId) => ({
                    signerUserId: signerId,
                }));

            await requestDocumentSigners(selectedDocumentId, {
                signerUserIds: normalizedSignerIds,
                placeholders,
            });

            router.push(buildCertificationStepHref('placeholders', selectedDocumentId));
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex items-center gap-2 text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menyiapkan langkah signer...</span>
                </div>
            </div>
        );
    }

    return (
        <AppShell title="Sertifikasi - Signer" subtitle="Langkah kedua: tentukan urutan penandatangan dokumen.">
            <div className="space-y-6">
                <CertificationStepper currentStep="signers" documentId={selectedDocumentId} />

                {error ? (
                    <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                        <AlertCircle className="h-4 w-4 text-amber-700" />
                        <AlertDescription>
                            <span className="block font-semibold">Perlu tindakan sebelum melanjutkan</span>
                            <span className="mt-1 block leading-5">{error}</span>
                        </AlertDescription>
                    </Alert>
                ) : null}

                {success ? (
                    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                        <AlertDescription>{success}</AlertDescription>
                    </Alert>
                ) : null}

                <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
                    <Badge className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700 hover:bg-white">Pilih Signer</Badge>
                    <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Susun penandatangan sesuai alur akademik.</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        Signer akan diurutkan dari level terendah ke tertinggi. Role setara tetap bisa ditukar urutannya.
                    </p>
                </section>

                <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle>Dokumen Terpilih</CardTitle>
                        <CardDescription>
                            Dokumen dipilih dari langkah upload. Jika ingin mengganti dokumen, kembali ke langkah upload terlebih dahulu.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {selectedDocument ? (
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                                <p className="font-semibold text-slate-900">{selectedDocument.originalFileName ?? selectedDocument.id}</p>
                                <p className="mt-1 text-xs text-slate-500">Status: {selectedDocument.status}</p>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">Belum ada dokumen yang dipilih.</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle>Tambahkan Signer</CardTitle>
                        <CardDescription>Signer otomatis disusun mengikuti alur kampus: mahasiswa, pegawai/dosen, admin prodi, kaprodi, lalu kajur. Urutan hanya bisa ditukar untuk role yang setara.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            value={signerSearch}
                            onChange={(event) => setSignerSearch(event.target.value)}
                            placeholder="Cari calon signer (nama atau email)"
                        />

                        <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white">
                            {availableSignerOptions.length === 0 ? (
                                <p className="px-3 py-2 text-sm text-slate-500">Tidak ada signer yang cocok atau semua sudah dipilih.</p>
                            ) : (
                                availableSignerOptions.map((signer) => (
                                    <div key={signer.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-slate-900">{getSignerDisplayName(signer)}</p>
                                            <p className="truncate text-xs text-slate-500">{signer.email}</p>
                                            <p className="truncate text-xs text-slate-500">
                                                {signer.academicProfile?.label ?? signer.academicProfile?.unitName ?? signer.role}
                                            </p>
                                        </div>
                                        <Button variant="outline" className="border-slate-300" onClick={() => addSigner(signer.id)}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Tambah
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle>Urutan Signer</CardTitle>
                        <CardDescription>
                            Urutan antar role dikunci mengikuti alur kampus. Jika ada dua signer dengan role setara, Anda bisa memilih siapa yang tanda tangan lebih dulu.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {orderedSignerIds.length === 0 ? (
                            <p className="text-sm text-slate-500">Belum ada signer dipilih.</p>
                        ) : (
                            orderedSignerIds.map((signerId, index) => {
                                const signer = signerById.get(signerId);
                                const isVisibleSigner = signerPreferenceById.get(signerId) === 'visible';
                                const placeholder = placeholderBySignerId[signerId];
                                const canMoveUp = canMoveSigner(index, -1);
                                const canMoveDown = canMoveSigner(index, 1);

                                return (
                                    <div key={signerId} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                                        <div className="space-y-2">
                                            <p className="text-sm text-slate-800">
                                                Urutan {index + 1}: <span className="font-semibold">{getSignerDisplayName(signer)}</span>
                                            </p>
                                            {signer?.academicProfile ? (
                                                <p className="text-xs text-slate-600">
                                                    {signer.academicProfile.label ?? signer.academicProfile.unitName}
                                                </p>
                                            ) : null}
                                            <p className="text-xs text-slate-600">
                                                Tanda tangan visible wajib digunakan. Placeholder {placeholder ? `sudah diatur di page ${placeholder.visiblePage}` : 'belum ditentukan'}.
                                            </p>
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                                Role: {signer?.role ?? '-'}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="success">Visible</Badge>
                                            <Button variant="outline" className="border-slate-300" onClick={() => moveSigner(index, -1)} disabled={!canMoveUp}>
                                                <MoveUp className="mr-2 h-4 w-4" />
                                                Naik
                                            </Button>
                                            <Button variant="outline" className="border-slate-300" onClick={() => moveSigner(index, 1)} disabled={!canMoveDown}>
                                                <MoveDown className="mr-2 h-4 w-4" />
                                                Turun
                                            </Button>
                                            <Button variant="outline" className="border-slate-300" onClick={() => removeSigner(signerId)}>
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Hapus
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </CardContent>
                </Card>

                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="rounded-xl border-slate-300 bg-white" onClick={() => router.push(buildCertificationStepHref('upload'))}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Kembali ke Upload
                    </Button>
                    <Button className="rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700" onClick={handleContinue} disabled={loadingAction !== '' || orderedSignerIds.length === 0}>
                        {loadingAction === 'Simpan Signer' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Simpan dan Lanjut ke Placeholder
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>

                {!selectedDocumentId && myDocuments.length === 0 ? (
                    <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                        <AlertDescription>Belum ada dokumen. Mulai dari langkah upload terlebih dahulu.</AlertDescription>
                    </Alert>
                ) : null}

                {!hasSignature && preferredMode === 'visible' ? (
                    <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                        <AlertDescription>
                            Tanda tangan visible aktif untuk akun ini, tetapi signature asset belum tersedia. Langkah sign nanti akan mengarahkan ke setup tanda tangan.
                        </AlertDescription>
                    </Alert>
                ) : null}
            </div>
        </AppShell>
    );
}

export default function CertificationSignersPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#f6f7f9]" />}>
            <CertificationSignersContent />
        </Suspense>
    );
}
