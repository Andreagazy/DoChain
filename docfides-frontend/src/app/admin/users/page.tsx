'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Edit, Loader2, Plus, Search, Trash2, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AdminPagination } from '@/components/common/admin-pagination';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createAdminUser, deleteAdminUser, getUser, listAdminUsers } from '@/lib/auth-service';
import { normalizeErrorMessage } from '@/lib/certification-flow';
import type { AdminUserItem, UserRole } from '@/types/auth';

const roles: UserRole[] = ['SUPERADMIN', 'JURUSAN', 'PRODI', 'ADMIN_PRODI', 'PEGAWAI', 'MAHASISWA'];
const pageSize = 8;

export default function AdminUsersPage() {
    const router = useRouter();
    const currentUser = useMemo(() => getUser(), []);
    const [loading, setLoading] = useState(true);
    const [savingUserId, setSavingUserId] = useState('');
    const [users, setUsers] = useState<AdminUserItem[]>([]);
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
    const [page, setPage] = useState(1);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [newUser, setNewUser] = useState({
        email: '',
        displayName: '',
        role: 'MAHASISWA' as UserRole,
        password: 'User123!',
    });

    useEffect(() => {
        async function loadData() {
            if (currentUser?.role !== 'SUPERADMIN' && currentUser?.role !== 'ADMIN_PRODI') {
                router.push('/dashboard');
                return;
            }

            try {
                const response = await listAdminUsers();
                setUsers(response.users);
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

    const handleCreate = async () => {
        setError('');
        setSuccess('');
        setSavingUserId('new');
        try {
            const result = await createAdminUser(newUser);
            setUsers((current) => [result.user, ...current]);
            setNewUser({
                email: '',
                displayName: '',
                role: 'MAHASISWA',
                password: 'User123!',
            });
            setSuccess('User baru berhasil dibuat');
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setSavingUserId('');
        }
    };

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
            title={currentUser?.role === 'ADMIN_PRODI' ? 'Anggota Prodi' : 'Admin User'}
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

                {currentUser?.role === 'SUPERADMIN' ? (
                <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5" />
                            Buat User Baru
                        </CardTitle>
                        <CardDescription>Setelah dibuat, lengkapi profil kampus melalui halaman edit user.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-[1.1fr_1fr_0.8fr_0.8fr_auto] md:items-end">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Email login</label>
                            <Input value={newUser.email} onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))} placeholder="email@dochain.local" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Nama tampilan</label>
                            <Input value={newUser.displayName} onChange={(event) => setNewUser((current) => ({ ...current, displayName: event.target.value }))} placeholder="Nama pengguna" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Role akun</label>
                            <select value={newUser.role} onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value as UserRole }))} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
                                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">Password awal</label>
                            <Input value={newUser.password} onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))} placeholder="Password" />
                        </div>
                        <Button className="md:mb-0" onClick={() => void handleCreate()} disabled={savingUserId === 'new' || !newUser.email || !newUser.displayName}>
                            {savingUserId === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Buat
                        </Button>
                    </CardContent>
                </Card>
                ) : null}

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
                            <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari user..." className="pl-9" />
                                </div>
                                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as UserRole | 'ALL')} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm">
                                    <option value="ALL">Semua role</option>
                                    {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                                </select>
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
            </div>
        </AppShell>
    );
}
