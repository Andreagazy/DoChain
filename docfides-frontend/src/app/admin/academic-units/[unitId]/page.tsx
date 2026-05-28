'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getAdminAcademicUnit, getUser, listAdminAcademicUnits, updateAdminAcademicUnit } from '@/lib/auth-service';
import { normalizeErrorMessage } from '@/lib/certification-flow';
import type { AdminAcademicUnit } from '@/types/auth';

export default function AdminAcademicUnitEditPage() {
    const router = useRouter();
    const params = useParams<{ unitId: string }>();
    const currentUser = useMemo(() => getUser(), []);
    const [unit, setUnit] = useState<AdminAcademicUnit | null>(null);
    const [units, setUnits] = useState<AdminAcademicUnit[]>([]);
    const [draft, setDraft] = useState({ code: '', name: '', parentId: '', isActive: true });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const jurusanUnits = units.filter((item) => item.type === 'JURUSAN' && item.isActive && item.id !== params.unitId);

    useEffect(() => {
        async function loadData() {
            if (currentUser?.role !== 'SUPERADMIN') {
                router.push('/dashboard');
                return;
            }

            try {
                const [unitResponse, unitsResponse] = await Promise.all([
                    getAdminAcademicUnit(params.unitId),
                    listAdminAcademicUnits(),
                ]);
                setUnit(unitResponse.unit);
                setUnits(unitsResponse.units);
                setDraft({
                    code: unitResponse.unit.code,
                    name: unitResponse.unit.name,
                    parentId: unitResponse.unit.parentId ?? '',
                    isActive: unitResponse.unit.isActive,
                });
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }

        void loadData();
    }, [currentUser?.role, params.unitId, router]);

    const handleSave = async () => {
        if (!unit) {
            return;
        }

        setError('');
        setSuccess('');
        setSaving(true);
        try {
            const result = await updateAdminAcademicUnit(unit.id, {
                code: draft.code,
                name: draft.name,
                parentId: unit.type === 'PRODI' ? draft.parentId : null,
                isActive: draft.isActive,
            });
            setUnit(result.unit);
            setDraft({
                code: result.unit.code,
                name: result.unit.name,
                parentId: result.unit.parentId ?? '',
                isActive: result.unit.isActive,
            });
            setSuccess('Unit akademik berhasil diperbarui');
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
                Memuat detail unit...
            </div>
        );
    }

    if (!unit) {
        return (
            <AppShell title="Edit Unit" subtitle="Data unit tidak ditemukan.">
                <Alert className="border-red-200 bg-red-50 text-red-800">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error || 'Unit akademik tidak ditemukan'}</AlertDescription>
                </Alert>
            </AppShell>
        );
    }

    return (
        <AppShell title="Edit Unit Akademik" subtitle={`${unit.code} - ${unit.name}`}>
            <div className="space-y-5">
                <Button asChild variant="outline" className="border-slate-300">
                    <Link href="/admin/academic-units">
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

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle>Detail Unit</CardTitle>
                        <CardDescription>Tipe unit tidak diubah agar relasi jurusan/prodi tetap konsisten.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="neutral">{unit.type}</Badge>
                            <Badge variant={draft.isActive ? 'success' : 'neutral'}>{draft.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Kode unit</label>
                                <Input value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} placeholder="Kode unit" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Nama unit akademik</label>
                                <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Nama unit" />
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Parent jurusan</label>
                                <select value={draft.parentId} onChange={(event) => setDraft((current) => ({ ...current, parentId: event.target.value }))} disabled={unit.type === 'JURUSAN'} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm disabled:opacity-50">
                                    <option value="">Pilih jurusan</option>
                                    {jurusanUnits.map((jurusan) => <option key={jurusan.id} value={jurusan.id}>{jurusan.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Status unit</label>
                                <select value={draft.isActive ? 'ACTIVE' : 'INACTIVE'} onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.value === 'ACTIVE' }))} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="INACTIVE">INACTIVE</option>
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button onClick={() => void handleSave()} disabled={saving || !draft.code || !draft.name || (unit.type === 'PRODI' && !draft.parentId)}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Simpan Perubahan
                    </Button>
                </div>
            </div>
        </AppShell>
    );
}
