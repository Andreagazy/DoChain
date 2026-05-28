'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, Loader2, Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getAdminUser, getUser, listAdminAcademicUnits, resetAdminUserPassword, updateAdminUser } from '@/lib/auth-service';
import { normalizeErrorMessage } from '@/lib/certification-flow';
import type { AdminAcademicUnit, AdminUserItem, UpdateAdminUserPayload, UserRole } from '@/types/auth';

const roles: UserRole[] = ['SUPERADMIN', 'JURUSAN', 'PRODI', 'ADMIN_PRODI', 'PEGAWAI', 'MAHASISWA'];
const statuses: AdminUserItem['status'][] = ['ACTIVE', 'SUSPENDED', 'DISABLED'];
const employeeTypes: NonNullable<UpdateAdminUserPayload['employeeProfile']>['employeeType'][] = ['DOSEN', 'TENAGA_KEPENDIDIKAN', 'ADMINISTRASI'];
const structuralPositionByRole: Partial<Record<UserRole, 'KAJUR' | 'KAPRODI' | 'ADMIN_PRODI'>> = {
    JURUSAN: 'KAJUR',
    PRODI: 'KAPRODI',
    ADMIN_PRODI: 'ADMIN_PRODI',
};

type UserDraft = {
    displayName: string;
    certificateFullName: string;
    role: UserRole;
    status: AdminUserItem['status'];
    nim: string;
    prodiId: string;
    angkatan: string;
    kelas: string;
    nip: string;
    nidn: string;
    employeeType: NonNullable<UpdateAdminUserPayload['employeeProfile']>['employeeType'];
    homeUnitId: string;
    positionTitle: string;
    structuralUnitId: string;
};

const createDraftFromUser = (user: AdminUserItem): UserDraft => {
    const structuralUnitId = user.structuralAssignments[0]?.academicUnit.id ?? '';
    return {
        displayName: user.displayName ?? '',
        certificateFullName: user.identity?.fullName ?? '',
        role: user.role,
        status: user.status,
        nim: user.studentProfile?.nim ?? '',
        prodiId: user.studentProfile?.prodi.id ?? '',
        angkatan: user.studentProfile?.angkatan ? String(user.studentProfile.angkatan) : '',
        kelas: user.studentProfile?.kelas ?? '',
        nip: user.employeeProfile?.nip ?? '',
        nidn: user.employeeProfile?.nidn ?? '',
        employeeType: user.employeeProfile?.employeeType ?? 'DOSEN',
        homeUnitId: user.employeeProfile?.homeUnit.id ?? structuralUnitId,
        positionTitle: user.employeeProfile?.positionTitle ?? '',
        structuralUnitId,
    };
};

export default function AdminUserEditPage() {
    const router = useRouter();
    const params = useParams<{ userId: string }>();
    const currentUser = useMemo(() => getUser(), []);
    const [user, setUser] = useState<AdminUserItem | null>(null);
    const [units, setUnits] = useState<AdminAcademicUnit[]>([]);
    const [draft, setDraft] = useState<UserDraft | null>(null);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const activeUnits = units.filter((unit) => unit.isActive);
    const prodiUnits = activeUnits.filter((unit) => unit.type === 'PRODI');
    const jurusanUnits = activeUnits.filter((unit) => unit.type === 'JURUSAN');
    const structuralUnits = draft?.role === 'JURUSAN' ? jurusanUnits : prodiUnits;
    const isSuperadmin = currentUser?.role === 'SUPERADMIN';
    const isAdminProdi = currentUser?.role === 'ADMIN_PRODI';
    const canEditTargetAsAdminProdi = isAdminProdi && draft ? draft.role === 'MAHASISWA' || draft.role === 'PEGAWAI' : false;
    const canSaveUser = isSuperadmin || canEditTargetAsAdminProdi;
    const profileFieldsDisabled = saving || !canSaveUser;

    useEffect(() => {
        async function loadData() {
            if (currentUser?.role !== 'SUPERADMIN' && currentUser?.role !== 'ADMIN_PRODI') {
                router.push('/dashboard');
                return;
            }

            try {
                const [userResponse, unitResponse] = await Promise.all([
                    getAdminUser(params.userId),
                    listAdminAcademicUnits(),
                ]);
                setUser(userResponse.user);
                setDraft(createDraftFromUser(userResponse.user));
                setUnits(unitResponse.units);
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }

        void loadData();
    }, [currentUser?.role, params.userId, router]);

    const handleSave = async () => {
        if (!draft) {
            return;
        }

        setError('');
        setSuccess('');
        setSaving(true);
        try {
            const payload: UpdateAdminUserPayload = {
                displayName: draft.displayName.trim() || null,
                ...(isSuperadmin && {
                    ...(draft.certificateFullName.trim() && {
                        certificateFullName: draft.certificateFullName.trim(),
                    }),
                    role: draft.role,
                    status: draft.status,
                }),
            };

            if (draft.role === 'MAHASISWA') {
                payload.studentProfile = draft.nim && draft.prodiId
                    ? {
                        nim: draft.nim,
                        prodiId: draft.prodiId,
                        angkatan: draft.angkatan ? Number(draft.angkatan) : null,
                        kelas: draft.kelas || null,
                    }
                    : null;
                if (isSuperadmin) {
                    payload.employeeProfile = null;
                    payload.structuralAssignments = [];
                }
            } else if (draft.role !== 'SUPERADMIN') {
                const homeUnitId = draft.homeUnitId || draft.structuralUnitId;
                if (homeUnitId) {
                    payload.employeeProfile = {
                        nip: draft.nip || null,
                        nidn: draft.nidn || null,
                        employeeType: draft.employeeType,
                        homeUnitId,
                        positionTitle: draft.positionTitle || null,
                    };
                }
                if (isSuperadmin) {
                    payload.studentProfile = null;
                    const position = structuralPositionByRole[draft.role];
                    payload.structuralAssignments = position && draft.structuralUnitId
                        ? [{ academicUnitId: draft.structuralUnitId, position }]
                        : [];
                }
            } else {
                payload.studentProfile = null;
                payload.employeeProfile = null;
                payload.structuralAssignments = [];
            }

            const result = await updateAdminUser(params.userId, payload);
            setUser(result.user);
            setDraft(createDraftFromUser(result.user));
            setSuccess('User berhasil diperbarui');
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const handleResetPassword = async () => {
        setError('');
        setSuccess('');
        setSaving(true);
        try {
            const result = await resetAdminUserPassword(params.userId, password);
            setPassword('');
            setSuccess(result.message);
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memuat detail user...
            </div>
        );
    }

    if (!user || !draft) {
        return (
            <AppShell title="Edit User" subtitle="Data user tidak ditemukan.">
                <Alert className="border-red-200 bg-red-50 text-red-800">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error || 'User tidak ditemukan'}</AlertDescription>
                </Alert>
            </AppShell>
        );
    }

    return (
        <AppShell title={isAdminProdi ? 'Edit Profil Anggota' : 'Edit User'} subtitle={user.email}>
            <div className="space-y-5">
                <Button asChild variant="outline" className="border-slate-300">
                    <Link href="/admin/users">
                        <ArrowLeft className="h-4 w-4" />
                        Kembali
                    </Link>
                </Button>

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

                {isAdminProdi && !canEditTargetAsAdminProdi ? (
                    <Alert className="border-amber-200 bg-amber-50 text-amber-800">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Admin prodi hanya dapat mengedit profil mahasiswa atau pegawai dalam prodi yang dikelola.
                        </AlertDescription>
                    </Alert>
                ) : null}

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle>Informasi Akun</CardTitle>
                        <CardDescription>
                            {isSuperadmin
                                ? 'Role menentukan jenis profil kampus yang ditampilkan.'
                                : 'Admin prodi hanya dapat memperbarui data profil kampus, bukan role atau status akun.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="neutral">{user.email}</Badge>
                            <Badge variant={user.identity?.status === 'APPROVED' ? 'success' : 'warning'}>{user.identity?.status ?? 'NO_IDENTITY'}</Badge>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Nama tampilan</label>
                                <Input disabled={profileFieldsDisabled} value={draft.displayName} onChange={(event) => setDraft((current) => current ? { ...current, displayName: event.target.value } : current)} placeholder="Nama tampilan" />
                            </div>
                            {isSuperadmin ? (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-600">Nama untuk sertifikat</label>
                                    <Input
                                        disabled={saving}
                                        value={draft.certificateFullName}
                                        onChange={(event) => setDraft((current) => current ? { ...current, certificateFullName: event.target.value } : current)}
                                        placeholder={user.identity ? 'Nama sesuai identitas' : 'Fallback ke nama tampilan'}
                                    />
                                    <p className="text-[11px] leading-4 text-slate-500">
                                        {user.identity
                                            ? 'Mengubah nama identitas yang dipakai sebagai CN sertifikat digital berikutnya.'
                                            : 'User belum memiliki identitas; nama tampilan menjadi fallback sertifikat.'}
                                    </p>
                                </div>
                            ) : null}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Role akun</label>
                                <select disabled={!isSuperadmin || saving} value={draft.role} onChange={(event) => setDraft((current) => current ? { ...current, role: event.target.value as UserRole } : current)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-100 disabled:text-slate-500">
                                    {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Status akun</label>
                                <select disabled={!isSuperadmin || saving} value={draft.status} onChange={(event) => setDraft((current) => current ? { ...current, status: event.target.value as AdminUserItem['status'] } : current)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-100 disabled:text-slate-500">
                                    {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle>Profil Kampus</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {draft.role === 'MAHASISWA' ? (
                            <div className="grid gap-3 md:grid-cols-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-600">NIM mahasiswa</label>
                                    <Input disabled={profileFieldsDisabled} value={draft.nim} onChange={(event) => setDraft((current) => current ? { ...current, nim: event.target.value } : current)} placeholder="NIM" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-600">Program studi</label>
                                    <select disabled={profileFieldsDisabled} value={draft.prodiId} onChange={(event) => setDraft((current) => current ? { ...current, prodiId: event.target.value } : current)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-100 disabled:text-slate-500">
                                        <option value="">Pilih prodi</option>
                                        {prodiUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-600">Angkatan</label>
                                    <Input disabled={profileFieldsDisabled} value={draft.angkatan} onChange={(event) => setDraft((current) => current ? { ...current, angkatan: event.target.value } : current)} placeholder="Angkatan" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-600">Kelas</label>
                                    <Input disabled={profileFieldsDisabled} value={draft.kelas} onChange={(event) => setDraft((current) => current ? { ...current, kelas: event.target.value } : current)} placeholder="Kelas" />
                                </div>
                            </div>
                        ) : draft.role !== 'SUPERADMIN' ? (
                            <div className="space-y-3">
                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-600">NIP pegawai</label>
                                        <Input disabled={profileFieldsDisabled} value={draft.nip} onChange={(event) => setDraft((current) => current ? { ...current, nip: event.target.value } : current)} placeholder="NIP" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-600">NIDN dosen</label>
                                        <Input disabled={profileFieldsDisabled} value={draft.nidn} onChange={(event) => setDraft((current) => current ? { ...current, nidn: event.target.value } : current)} placeholder="NIDN" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-600">Tipe pegawai</label>
                                        <select disabled={profileFieldsDisabled} value={draft.employeeType} onChange={(event) => setDraft((current) => current ? { ...current, employeeType: event.target.value as UserDraft['employeeType'] } : current)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-100 disabled:text-slate-500">
                                            {employeeTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-600">Home unit</label>
                                        <select disabled={profileFieldsDisabled} value={draft.homeUnitId} onChange={(event) => setDraft((current) => current ? { ...current, homeUnitId: event.target.value } : current)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-100 disabled:text-slate-500">
                                            <option value="">Home unit</option>
                                            {activeUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-600">Nama jabatan</label>
                                        <Input disabled={profileFieldsDisabled} value={draft.positionTitle} onChange={(event) => setDraft((current) => current ? { ...current, positionTitle: event.target.value } : current)} placeholder="Jabatan" />
                                    </div>
                                    {isSuperadmin && (draft.role === 'JURUSAN' || draft.role === 'PRODI' || draft.role === 'ADMIN_PRODI') ? (
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-slate-600">Unit jabatan struktural</label>
                                            <select value={draft.structuralUnitId} onChange={(event) => setDraft((current) => current ? { ...current, structuralUnitId: event.target.value, homeUnitId: current.homeUnitId || event.target.value } : current)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
                                                <option value="">Unit jabatan struktural</option>
                                                {structuralUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                                            </select>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">Superadmin tidak memerlukan profil kampus.</p>
                        )}
                    </CardContent>
                </Card>

                {isSuperadmin ? (
                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle>Reset Password</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Password baru</label>
                            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password baru" />
                        </div>
                        <Button variant="outline" className="border-slate-300" onClick={() => void handleResetPassword()} disabled={saving || !password}>
                            <KeyRound className="h-4 w-4" />
                            Reset Password
                        </Button>
                    </CardContent>
                </Card>
                ) : null}

                <div className="flex justify-end">
                    <Button onClick={() => void handleSave()} disabled={saving || !canSaveUser}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Simpan Perubahan
                    </Button>
                </div>
            </div>
        </AppShell>
    );
}
