'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createAdminUser, getUser, listAdminAcademicUnits } from '@/lib/auth-service';
import { normalizeErrorMessage } from '@/lib/certification-flow';
import type { CreateAdminUserPayload, UserRole } from '@/types/auth';

const roles: UserRole[] = ['SUPERADMIN', 'JURUSAN', 'PRODI', 'ADMIN_PRODI', 'PEGAWAI', 'MAHASISWA'];
const employeeTypes: NonNullable<CreateAdminUserPayload['employeeProfile']>['employeeType'][] = ['DOSEN', 'TENAGA_KEPENDIDIKAN', 'ADMINISTRASI'];
const structuralPositionByRole: Partial<Record<UserRole, 'KAJUR' | 'KAPRODI' | 'ADMIN_PRODI'>> = {
    JURUSAN: 'KAJUR',
    PRODI: 'KAPRODI',
    ADMIN_PRODI: 'ADMIN_PRODI',
};
const onlyDigits = (value: string) => value.replace(/\D/g, '');
const onlyNameCharacters = (value: string) => value.replace(/[^\p{L}\s.'-]/gu, '');

export default function CreateAdminUserPage() {
    const router = useRouter();
    const currentUser = useMemo(() => getUser(), []);
    const [units, setUnits] = useState<Array<{ id: string; code: string; name: string; type: 'JURUSAN' | 'PRODI'; isActive: boolean }>>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [form, setForm] = useState({
        email: '',
        displayName: '',
        role: 'MAHASISWA' as UserRole,
        password: 'User123!',
        nim: '',
        prodiId: '',
        angkatan: '',
        kelas: '',
        nip: '',
        nidn: '',
        employeeType: 'DOSEN' as NonNullable<CreateAdminUserPayload['employeeProfile']>['employeeType'],
        homeUnitId: '',
        positionTitle: '',
        structuralUnitId: '',
    });

    const activeUnits = units.filter((unit) => unit.isActive);
    const prodiUnits = activeUnits.filter((unit) => unit.type === 'PRODI');
    const jurusanUnits = activeUnits.filter((unit) => unit.type === 'JURUSAN');
    const structuralUnits = form.role === 'JURUSAN' ? jurusanUnits : prodiUnits;

    useEffect(() => {
        async function loadData() {
            if (currentUser?.role !== 'SUPERADMIN') {
                router.replace('/admin/users');
                return;
            }

            try {
                const response = await listAdminAcademicUnits();
                setUnits(response.units);
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }

        void loadData();
    }, [currentUser?.role, router]);

    const handleCreate = async () => {
        setError('');
        setSuccess('');

        if (!form.email || !form.displayName || !form.password) {
            setError('Email, nama tampilan, dan password awal wajib diisi.');
            return;
        }

        const payload: CreateAdminUserPayload = {
            email: form.email,
            displayName: form.displayName.trim(),
            role: form.role,
            password: form.password,
        };

        if (form.role === 'MAHASISWA') {
            if (!form.nim || !form.prodiId) {
                setError('NIM dan program studi wajib diisi untuk mahasiswa.');
                return;
            }

            payload.studentProfile = {
                nim: form.nim,
                prodiId: form.prodiId,
                angkatan: form.angkatan ? Number(form.angkatan) : null,
                kelas: form.kelas || null,
            };
        } else if (form.role !== 'SUPERADMIN') {
            const homeUnitId = form.homeUnitId || form.structuralUnitId;
            if (!homeUnitId) {
                setError('Home unit wajib diisi untuk pegawai atau role struktural.');
                return;
            }

            payload.employeeProfile = {
                nip: form.nip || null,
                nidn: form.nidn || null,
                employeeType: form.employeeType,
                homeUnitId,
                positionTitle: form.positionTitle || null,
            };

            const structuralPosition = structuralPositionByRole[form.role];
            if (structuralPosition) {
                if (!form.structuralUnitId) {
                    setError('Unit jabatan struktural wajib diisi.');
                    return;
                }

                payload.structuralAssignments = [{
                    academicUnitId: form.structuralUnitId,
                    position: structuralPosition,
                }];
            }
        }

        setSaving(true);
        try {
            const result = await createAdminUser(payload);
            setSuccess('User baru berhasil dibuat.');
            router.push(`/admin/users/${result.user.id}`);
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
                Memuat form user...
            </div>
        );
    }

    return (
        <AppShell title="Buat User Baru" subtitle="Tambahkan akun dan profil akademik dalam satu halaman.">
            <div className="space-y-5">
                <Button asChild variant="outline" className="border-slate-300">
                    <Link href="/admin/users">
                        <ArrowLeft className="h-4 w-4" />
                        Kembali ke Kelola User
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

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle>Data Akun</CardTitle>
                        <CardDescription>Isi akun login, role, dan password awal user.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Email login</label>
                            <Input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value.trim().toLowerCase() }))} placeholder="email@docchain.local" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Nama tampilan</label>
                            <Input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: onlyNameCharacters(event.target.value) }))} placeholder="Nama pengguna" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Role akun</label>
                            <select
                                value={form.role}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    role: event.target.value as UserRole,
                                    homeUnitId: '',
                                    structuralUnitId: '',
                                    prodiId: '',
                                }))}
                                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                            >
                                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Password awal</label>
                            <Input value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Password" />
                        </div>
                    </CardContent>
                </Card>

                {form.role === 'MAHASISWA' ? (
                    <Card className="border-blue-100 bg-white shadow-sm">
                        <CardHeader>
                            <CardTitle>Profil Akademik Mahasiswa</CardTitle>
                            <CardDescription>Data ini melekat pada akun mahasiswa dan dapat direview admin bila ada perubahan.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3 md:grid-cols-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">NIM</label>
                                <Input value={form.nim} onChange={(event) => setForm((current) => ({ ...current, nim: onlyDigits(event.target.value).slice(0, 40) }))} placeholder="NIM mahasiswa" inputMode="numeric" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Program studi</label>
                                <select value={form.prodiId} onChange={(event) => setForm((current) => ({ ...current, prodiId: event.target.value }))} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
                                    <option value="">Pilih prodi</option>
                                    {prodiUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Angkatan</label>
                                <Input value={form.angkatan} onChange={(event) => setForm((current) => ({ ...current, angkatan: onlyDigits(event.target.value).slice(0, 4) }))} placeholder="2021" inputMode="numeric" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Kelas</label>
                                <Input value={form.kelas} onChange={(event) => setForm((current) => ({ ...current, kelas: event.target.value.slice(0, 30) }))} placeholder="TI-4A" />
                            </div>
                        </CardContent>
                    </Card>
                ) : form.role !== 'SUPERADMIN' ? (
                    <Card className="border-blue-100 bg-white shadow-sm">
                        <CardHeader>
                            <CardTitle>Profil Akademik/Pegawai</CardTitle>
                            <CardDescription>Isi unit, identitas pegawai, dan jabatan bila user memiliki role struktural.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">NIP</label>
                                <Input value={form.nip} onChange={(event) => setForm((current) => ({ ...current, nip: onlyDigits(event.target.value).slice(0, 40) }))} placeholder="NIP pegawai" inputMode="numeric" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">NIDN</label>
                                <Input value={form.nidn} onChange={(event) => setForm((current) => ({ ...current, nidn: onlyDigits(event.target.value).slice(0, 40) }))} placeholder="NIDN dosen" inputMode="numeric" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Tipe pegawai</label>
                                <select value={form.employeeType} onChange={(event) => setForm((current) => ({ ...current, employeeType: event.target.value as typeof form.employeeType }))} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
                                    {employeeTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Home unit</label>
                                <select value={form.homeUnitId} onChange={(event) => setForm((current) => ({ ...current, homeUnitId: event.target.value }))} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
                                    <option value="">Pilih home unit</option>
                                    {activeUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Nama jabatan</label>
                                <Input value={form.positionTitle} onChange={(event) => setForm((current) => ({ ...current, positionTitle: onlyNameCharacters(event.target.value).slice(0, 120) }))} placeholder="Dosen / Ketua Program Studi" />
                            </div>
                            {structuralPositionByRole[form.role] ? (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-600">Unit jabatan struktural</label>
                                    <select value={form.structuralUnitId} onChange={(event) => setForm((current) => ({ ...current, structuralUnitId: event.target.value, homeUnitId: current.homeUnitId || event.target.value }))} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
                                        <option value="">Pilih unit struktural</option>
                                        {structuralUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                                    </select>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>
                ) : null}

                <div className="flex justify-end">
                    <Button onClick={() => void handleCreate()} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Buat User
                    </Button>
                </div>
            </div>
        </AppShell>
    );
}
