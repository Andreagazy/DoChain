'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Building2, CheckCircle2, Edit, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AdminPagination } from '@/components/common/admin-pagination';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createAdminAcademicUnit, deleteAdminAcademicUnit, getUser, listAdminAcademicUnits, updateAdminAcademicUnit } from '@/lib/auth-service';
import { normalizeErrorMessage } from '@/lib/certification-flow';
import type { AdminAcademicUnit } from '@/types/auth';

const pageSize = 8;

export default function AdminAcademicUnitsPage() {
    const router = useRouter();
    const currentUser = useMemo(() => getUser(), []);
    const [units, setUnits] = useState<AdminAcademicUnit[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingUnitId, setSavingUnitId] = useState('');
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<AdminAcademicUnit['type'] | 'ALL'>('ALL');
    const [page, setPage] = useState(1);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [newUnit, setNewUnit] = useState({
        code: '',
        name: '',
        type: 'PRODI' as AdminAcademicUnit['type'],
        parentId: '',
    });

    const jurusanUnits = units.filter((unit) => unit.type === 'JURUSAN' && unit.isActive);

    useEffect(() => {
        async function loadData() {
            if (currentUser?.role !== 'SUPERADMIN') {
                router.push('/dashboard');
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

    const filteredUnits = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return units.filter((unit) => {
            const matchesType = typeFilter === 'ALL' || unit.type === typeFilter;
            const matchesQuery = !normalizedQuery
                || unit.code.toLowerCase().includes(normalizedQuery)
                || unit.name.toLowerCase().includes(normalizedQuery);
            return matchesType && matchesQuery;
        });
    }, [query, typeFilter, units]);

    const totalPages = Math.max(1, Math.ceil(filteredUnits.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginatedUnits = filteredUnits.slice((safePage - 1) * pageSize, safePage * pageSize);

    useEffect(() => {
        setPage(1);
    }, [query, typeFilter]);

    const handleCreate = async () => {
        setError('');
        setSuccess('');
        setSavingUnitId('new');
        try {
            const result = await createAdminAcademicUnit({
                code: newUnit.code,
                name: newUnit.name,
                type: newUnit.type,
                parentId: newUnit.type === 'PRODI' ? newUnit.parentId : null,
            });
            setUnits((current) => [...current, result.unit]);
            setNewUnit({ code: '', name: '', type: 'PRODI', parentId: '' });
            setSuccess('Unit akademik berhasil dibuat');
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setSavingUnitId('');
        }
    };

    const toggleUnit = async (unit: AdminAcademicUnit) => {
        setSavingUnitId(unit.id);
        setError('');
        setSuccess('');
        try {
            const result = await updateAdminAcademicUnit(unit.id, { isActive: !unit.isActive });
            setUnits((current) => current.map((item) => item.id === unit.id ? result.unit : item));
            setSuccess('Status unit akademik diperbarui');
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setSavingUnitId('');
        }
    };

    const handleDelete = async (unit: AdminAcademicUnit) => {
        setSavingUnitId(unit.id);
        setError('');
        setSuccess('');
        try {
            const result = await deleteAdminAcademicUnit(unit.id);
            setUnits((current) => current.map((item) => item.id === unit.id ? result.unit : item));
            setSuccess(result.message);
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setSavingUnitId('');
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memuat unit akademik...
            </div>
        );
    }

    return (
        <AppShell title="Unit Akademik" subtitle="Daftar jurusan dan prodi dengan pagination.">
            <div className="space-y-5">
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
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5" />
                            Tambah Unit
                        </CardTitle>
                        <CardDescription>Edit detail unit dilakukan dari halaman edit.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-[0.7fr_1.2fr_0.8fr_1fr_auto] md:items-end">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Kode unit</label>
                            <Input value={newUnit.code} onChange={(event) => setNewUnit((current) => ({ ...current, code: event.target.value }))} placeholder="Kode" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Nama unit akademik</label>
                            <Input value={newUnit.name} onChange={(event) => setNewUnit((current) => ({ ...current, name: event.target.value }))} placeholder="Nama unit" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Tipe unit</label>
                            <select value={newUnit.type} onChange={(event) => setNewUnit((current) => ({ ...current, type: event.target.value as AdminAcademicUnit['type'] }))} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
                                <option value="JURUSAN">JURUSAN</option>
                                <option value="PRODI">PRODI</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Parent jurusan</label>
                            <select value={newUnit.parentId} onChange={(event) => setNewUnit((current) => ({ ...current, parentId: event.target.value }))} disabled={newUnit.type === 'JURUSAN'} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm disabled:opacity-50">
                                <option value="">Pilih jurusan</option>
                                {jurusanUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                            </select>
                        </div>
                        <Button onClick={() => void handleCreate()} disabled={savingUnitId === 'new' || !newUnit.code || !newUnit.name || (newUnit.type === 'PRODI' && !newUnit.parentId)}>
                            {savingUnitId === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Buat
                        </Button>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5" />
                                    Daftar Unit
                                </CardTitle>
                                <CardDescription>{filteredUnits.length} unit ditemukan.</CardDescription>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari unit..." className="pl-9" />
                                </div>
                                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as AdminAcademicUnit['type'] | 'ALL')} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm">
                                    <option value="ALL">Semua tipe</option>
                                    <option value="JURUSAN">JURUSAN</option>
                                    <option value="PRODI">PRODI</option>
                                </select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[780px] text-left text-sm">
                                <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Kode</th>
                                        <th className="px-4 py-3 font-medium">Nama Unit</th>
                                        <th className="px-4 py-3 font-medium">Tipe</th>
                                        <th className="px-4 py-3 font-medium">Parent</th>
                                        <th className="px-4 py-3 font-medium">Status</th>
                                        <th className="px-4 py-3 text-right font-medium">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {paginatedUnits.length === 0 ? (
                                        <tr>
                                            <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>Tidak ada unit pada filter ini.</td>
                                        </tr>
                                    ) : paginatedUnits.map((unit) => (
                                        <tr key={unit.id} className="bg-white hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-900">{unit.code}</td>
                                            <td className="px-4 py-3 text-slate-700">{unit.name}</td>
                                            <td className="px-4 py-3"><Badge variant="neutral">{unit.type}</Badge></td>
                                            <td className="px-4 py-3 text-slate-600">{unit.parentId ? units.find((item) => item.id === unit.parentId)?.name ?? '-' : '-'}</td>
                                            <td className="px-4 py-3"><Badge variant={unit.isActive ? 'success' : 'neutral'}>{unit.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge></td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-2">
                                                    <Button asChild size="sm" variant="outline" className="border-slate-300">
                                                        <Link href={`/admin/academic-units/${unit.id}`}>
                                                            <Edit className="h-4 w-4" />
                                                            Edit
                                                        </Link>
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="border-slate-300" onClick={() => void toggleUnit(unit)} disabled={savingUnitId === unit.id}>
                                                        {savingUnitId === unit.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                                        {unit.isActive ? 'Nonaktif' : 'Aktif'}
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => void handleDelete(unit)} disabled={savingUnitId === unit.id || !unit.isActive}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <AdminPagination page={safePage} pageSize={pageSize} totalItems={filteredUnits.length} onPageChange={setPage} />
                    </CardContent>
                </Card>
            </div>
        </AppShell>
    );
}
