'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Edit, Loader2, Plus, RotateCcw, Search, Trash2, Users, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AdminPagination } from '@/components/common/admin-pagination';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    deleteAdminUser,
    getUser,
    listAcademicProfileChangeRequests,
    listAdminUsers,
    reviewAcademicProfileChangeRequest,
} from '@/lib/auth-service';
import { normalizeErrorMessage } from '@/lib/certification-flow';
import type { AcademicProfileChangeRequestItem, AdminUserItem, UserRole } from '@/types/auth';

const roles: UserRole[] = ['SUPERADMIN', 'JURUSAN', 'PRODI', 'ADMIN_PRODI', 'PEGAWAI', 'MAHASISWA'];
const pageSize = 8;
type AcademicReviewDialogState = {
    request: AcademicProfileChangeRequestItem;
    status: 'APPROVED' | 'REJECTED';
} | null;

export default function AdminUsersPage() {
    const router = useRouter();
    const currentUser = useMemo(() => getUser(), []);
    const [loading, setLoading] = useState(true);
    const [savingUserId, setSavingUserId] = useState('');
    const [reviewingRequestId, setReviewingRequestId] = useState('');
    const [users, setUsers] = useState<AdminUserItem[]>([]);
    const [academicRequests, setAcademicRequests] = useState<AcademicProfileChangeRequestItem[]>([]);
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
    const [page, setPage] = useState(1);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [academicReviewDialog, setAcademicReviewDialog] = useState<AcademicReviewDialogState>(null);
    const [rejectReason, setRejectReason] = useState('');

    useEffect(() => {
        async function loadData() {
            if (currentUser?.role !== 'SUPERADMIN' && currentUser?.role !== 'ADMIN_PRODI') {
                router.push('/dashboard');
                return;
            }

            try {
                const [response, requests] = await Promise.all([
                    listAdminUsers(),
                    listAcademicProfileChangeRequests(),
                ]);
                setUsers(response.users);
                setAcademicRequests(requests);
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }

        void loadData();
    }, [currentUser?.role, router]);

    const filteredUsers = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return users.filter((user) => {
            const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
            const matchesQuery = !normalizedQuery
                || user.email.toLowerCase().includes(normalizedQuery)
                || (user.displayName ?? '').toLowerCase().includes(normalizedQuery)
                || (user.studentProfile?.nim ?? '').toLowerCase().includes(normalizedQuery)
                || (user.employeeProfile?.nip ?? '').toLowerCase().includes(normalizedQuery);
            return matchesRole && matchesQuery;
        });
    }, [query, roleFilter, users]);

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginatedUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);

    useEffect(() => {
        setPage(1);
    }, [query, roleFilter]);

    const handleDelete = async (userId: string) => {
        setError('');
        setSuccess('');
        setSavingUserId(userId);
        try {
            const result = await deleteAdminUser(userId);
            setUsers((current) => current.map((user) => user.id === userId ? result.user : user));
            setSuccess(result.message);
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setSavingUserId('');
        }
    };

    const refreshData = async () => {
        const [response, requests] = await Promise.all([
            listAdminUsers(),
            listAcademicProfileChangeRequests(),
        ]);
        setUsers(response.users);
        setAcademicRequests(requests);
    };

    const openAcademicReviewDialog = (request: AcademicProfileChangeRequestItem, status: 'APPROVED' | 'REJECTED') => {
        setRejectReason('');
        setAcademicReviewDialog({ request, status });
    };

    const handleReviewAcademicRequest = async () => {
        if (!academicReviewDialog) {
            return;
        }

        const { request, status } = academicReviewDialog;
        setError('');
        setSuccess('');
        setReviewingRequestId(request.id);
        try {
            const result = await reviewAcademicProfileChangeRequest(request.id, {
                status,
                ...(status === 'REJECTED' && {
                    rejectionReason: rejectReason.trim() || 'Data profil akademik tidak valid',
                }),
            });
            setSuccess(result.message);
            setAcademicReviewDialog(null);
            setRejectReason('');
            await refreshData();
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setReviewingRequestId('');
        }
    };

    const canEditUser = (user: AdminUserItem) => (
        currentUser?.role === 'SUPERADMIN'
        || (currentUser?.role === 'ADMIN_PRODI' && (user.role === 'MAHASISWA' || user.role === 'PEGAWAI'))
    );

    const getProfileLabel = (user: AdminUserItem) => {
        if (user.studentProfile) {
            return `${user.studentProfile.nim} - ${user.studentProfile.prodi.name}`;
        }

        if (user.employeeProfile) {
            return `${user.employeeProfile.positionTitle ?? user.employeeProfile.employeeType} - ${user.employeeProfile.homeUnit.name}`;
        }

        return 'Belum ada profil kampus';
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memuat data admin...
            </div>
        );
    }

    return (
        <AppShell
            title="Kelola User"
            subtitle={currentUser?.role === 'ADMIN_PRODI' ? 'Pantau mahasiswa dan pegawai dalam prodi yang Anda kelola.' : 'Kelola akun dari tabel, lalu buka halaman edit untuk perubahan detail.'}
        >
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

                <Card className="border-amber-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <RotateCcw className="h-5 w-5 text-amber-600" />
                            Request Perubahan Profil Akademik
                        </CardTitle>
                        <CardDescription>
                            Review pengajuan perubahan NIM, prodi, kelas, atau angkatan dari mahasiswa.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {academicRequests.length === 0 ? (
                            <div className="px-5 py-8 text-center text-sm font-medium text-slate-400">
                                Tidak ada request perubahan profil akademik yang menunggu review.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px] text-left text-sm">
                                    <thead className="border-y border-amber-100 bg-amber-50 text-xs uppercase text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Mahasiswa</th>
                                            <th className="px-4 py-3 font-medium">Data Saat Ini</th>
                                            <th className="px-4 py-3 font-medium">Data Diajukan</th>
                                            <th className="px-4 py-3 font-medium">Tanggal</th>
                                            <th className="px-4 py-3 text-right font-medium">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-amber-100">
                                        {academicRequests.map((request) => (
                                            <tr key={request.id} className="bg-white hover:bg-amber-50/40">
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-slate-900">{request.user.identity?.fullName ?? request.user.displayName ?? '-'}</p>
                                                    <p className="mt-0.5 text-xs text-slate-500">{request.user.email}</p>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-600">
                                                    <p className="font-semibold text-slate-800">{request.user.studentProfile?.nim ?? '-'}</p>
                                                    <p className="mt-1">{request.user.studentProfile?.prodi.name ?? '-'}</p>
                                                    <p className="mt-1">Kelas {request.user.studentProfile?.kelas ?? '-'} | Angkatan {request.user.studentProfile?.angkatan ?? '-'}</p>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-600">
                                                    <p className="font-semibold text-slate-800">{request.nim}</p>
                                                    <p className="mt-1">{request.prodi.name}</p>
                                                    <p className="mt-1">Kelas {request.kelas ?? '-'} | Angkatan {request.angkatan ?? '-'}</p>
                                                </td>
                                                <td className="px-4 py-3 text-xs font-medium text-slate-500">
                                                    {new Date(request.createdAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            className="bg-emerald-600 text-white hover:bg-emerald-500"
                                                            onClick={() => openAcademicReviewDialog(request, 'APPROVED')}
                                                            disabled={reviewingRequestId === request.id}
                                                        >
                                                            {reviewingRequestId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                                            Approve
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => openAcademicReviewDialog(request, 'REJECTED')}
                                                            disabled={reviewingRequestId === request.id}
                                                        >
                                                            {reviewingRequestId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                                            Reject
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    Daftar User
                                </CardTitle>
                                <CardDescription>{filteredUsers.length} user ditemukan.</CardDescription>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari user..." className="pl-9" />
                                </div>
                                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as UserRole | 'ALL')} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm">
                                    <option value="ALL">Semua role</option>
                                    {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                                </select>
                                {currentUser?.role === 'SUPERADMIN' ? (
                                    <Button asChild className="h-9">
                                        <Link href="/admin/users/create">
                                            <Plus className="h-4 w-4" />
                                            Buat User
                                        </Link>
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] text-left text-sm">
                                <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">User</th>
                                        <th className="px-4 py-3 font-medium">Role</th>
                                        <th className="px-4 py-3 font-medium">Profil Kampus</th>
                                        <th className="px-4 py-3 font-medium">Identitas</th>
                                        <th className="px-4 py-3 font-medium">Status</th>
                                        {(currentUser?.role === 'SUPERADMIN' || currentUser?.role === 'ADMIN_PRODI') ? (
                                            <th className="px-4 py-3 text-right font-medium">Aksi</th>
                                        ) : null}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {paginatedUsers.length === 0 ? (
                                        <tr>
                                            <td className="px-4 py-8 text-center text-slate-500" colSpan={(currentUser?.role === 'SUPERADMIN' || currentUser?.role === 'ADMIN_PRODI') ? 6 : 5}>Tidak ada user pada filter ini.</td>
                                        </tr>
                                    ) : paginatedUsers.map((user) => (
                                        <tr key={user.id} className="bg-white hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-slate-900">{user.displayName ?? '-'}</p>
                                                <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
                                            </td>
                                            <td className="px-4 py-3"><Badge variant="neutral">{user.role}</Badge></td>
                                            <td className="px-4 py-3 text-slate-600">{getProfileLabel(user)}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant={user.identity?.status === 'APPROVED' ? 'success' : user.identity?.status === 'REJECTED' ? 'destructive' : 'warning'}>
                                                    {user.identity?.status ?? 'NO_IDENTITY'}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant={user.status === 'ACTIVE' ? 'success' : user.status === 'DISABLED' ? 'neutral' : 'warning'}>{user.status}</Badge>
                                            </td>
                                            {(currentUser?.role === 'SUPERADMIN' || currentUser?.role === 'ADMIN_PRODI') ? (
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-2">
                                                    {canEditUser(user) ? (
                                                        <Button asChild size="sm" variant="outline" className="border-slate-300">
                                                            <Link href={`/admin/users/${user.id}`}>
                                                                <Edit className="h-4 w-4" />
                                                                {currentUser?.role === 'ADMIN_PRODI' ? 'Edit Profil' : 'Edit'}
                                                            </Link>
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">Tidak tersedia</span>
                                                    )}
                                                    {currentUser?.role === 'SUPERADMIN' ? (
                                                        <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => void handleDelete(user.id)} disabled={savingUserId === user.id || user.status === 'DISABLED'}>
                                                            {savingUserId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                            Nonaktif
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </td>
                                            ) : null}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <AdminPagination page={safePage} pageSize={pageSize} totalItems={filteredUsers.length} onPageChange={setPage} />
                    </CardContent>
                </Card>

                <Dialog open={Boolean(academicReviewDialog)} onOpenChange={(open) => !open && setAcademicReviewDialog(null)}>
                    <DialogContent className="w-[min(92vw,560px)] rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>
                                {academicReviewDialog?.status === 'APPROVED'
                                    ? 'Konfirmasi Approve Perubahan Akademik'
                                    : 'Konfirmasi Reject Perubahan Akademik'}
                            </DialogTitle>
                            <DialogDescription>
                                {academicReviewDialog?.status === 'APPROVED'
                                    ? 'Pastikan data baru sudah sesuai sebelum mengganti profil akademik mahasiswa.'
                                    : 'Tuliskan alasan penolakan agar mahasiswa memahami data yang perlu diperbaiki.'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-3 text-sm md:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data Saat Ini</p>
                                <p className="mt-2 font-semibold text-slate-900">{academicReviewDialog?.request.user.studentProfile?.nim ?? '-'}</p>
                                <p className="mt-1 text-xs text-slate-600">{academicReviewDialog?.request.user.studentProfile?.prodi.name ?? '-'}</p>
                                <p className="mt-1 text-xs text-slate-500">Kelas {academicReviewDialog?.request.user.studentProfile?.kelas ?? '-'} | Angkatan {academicReviewDialog?.request.user.studentProfile?.angkatan ?? '-'}</p>
                            </div>
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Data Diajukan</p>
                                <p className="mt-2 font-semibold text-slate-900">{academicReviewDialog?.request.nim ?? '-'}</p>
                                <p className="mt-1 text-xs text-slate-600">{academicReviewDialog?.request.prodi.name ?? '-'}</p>
                                <p className="mt-1 text-xs text-slate-500">Kelas {academicReviewDialog?.request.kelas ?? '-'} | Angkatan {academicReviewDialog?.request.angkatan ?? '-'}</p>
                            </div>
                        </div>

                        {academicReviewDialog?.status === 'REJECTED' ? (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Alasan penolakan</label>
                                <textarea
                                    value={rejectReason}
                                    onChange={(event) => setRejectReason(event.target.value)}
                                    placeholder="Contoh: NIM tidak sesuai dengan data akademik prodi."
                                    className="min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                />
                            </div>
                        ) : null}

                        <DialogFooter>
                            <Button variant="outline" className="border-slate-300" onClick={() => setAcademicReviewDialog(null)}>
                                Tidak
                            </Button>
                            <Button
                                variant={academicReviewDialog?.status === 'REJECTED' ? 'destructive' : 'default'}
                                onClick={() => void handleReviewAcademicRequest()}
                                disabled={Boolean(academicReviewDialog && reviewingRequestId === academicReviewDialog.request.id) || (academicReviewDialog?.status === 'REJECTED' && rejectReason.trim().length < 5)}
                            >
                                {academicReviewDialog && reviewingRequestId === academicReviewDialog.request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Ya, {academicReviewDialog?.status === 'APPROVED' ? 'Approve' : 'Reject'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppShell>
    );
}
