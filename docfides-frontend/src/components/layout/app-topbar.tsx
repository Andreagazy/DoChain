'use client';

import Link from 'next/link';
import { Bell, Building2, CheckCircle2, ClipboardList, FileSignature, FolderOpen, Inbox, LayoutDashboard, LogOut, PenSquare, ShieldCheck, UserCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProfile, getUser, logout, saveAuthData, getToken } from '@/lib/auth-service';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { NotificationsResponse, User } from '@/types/auth';

interface AppTopbarProps {
    title: string;
    subtitle?: string;
    notifications?: NotificationsResponse;
}

function getActiveHref(pathname: string, items: Array<{ href: string }>) {
    return items
        .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

const formatNotificationTime = (value: string) =>
    new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));

export function AppTopbar({ title, subtitle, notifications }: AppTopbarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);
    const [notificationOpen, setNotificationOpen] = useState(false);

    useEffect(() => {
        const storedUser = getUser();
        setUser(storedUser);

        const token = getToken();
        if (!token) return;

        let ignore = false;

        void getProfile()
            .then((profile) => {
                if (ignore) return;
                setUser(profile);
                saveAuthData(token, profile);
            })
            .catch(() => {
                if (!ignore) setUser(storedUser);
            });

        return () => {
            ignore = true;
        };
    }, []);

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    const userMobileItems = [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/documents', label: 'Dokumen', icon: FolderOpen },
        { href: '/certification', label: 'Sertifikasi', icon: PenSquare },
        { href: '/certification/assigned', label: 'Perlu Sign', icon: Inbox },
        { href: '/signature-setup', label: 'Tanda Tangan', icon: FileSignature },
        { href: '/profile', label: 'Profil', icon: UserCircle },
    ];
    const adminMobileItems = [
        { href: '/admin', label: 'Overview', icon: LayoutDashboard },
        { href: '/admin/users', label: 'User', icon: Users },
        { href: '/admin/identities', label: 'Identitas', icon: ShieldCheck },
        { href: '/admin/academic-units', label: 'Unit', icon: Building2 },
        { href: '/admin/documents', label: 'Dokumen', icon: ClipboardList },
        { href: '/profile', label: 'Profil', icon: UserCircle },
    ];
    const adminProdiMobileItems = [
        { href: '/admin-prodi', label: 'Prodi', icon: LayoutDashboard },
        { href: '/certification', label: 'Sertifikasi', icon: PenSquare },
        { href: '/documents', label: 'Dokumen Saya', icon: FolderOpen },
        { href: '/certification/assigned', label: 'Perlu Sign', icon: Inbox },
        { href: '/signature-setup', label: 'TTD', icon: FileSignature },
        { href: '/admin/identities', label: 'Identitas', icon: ShieldCheck },
        { href: '/admin/users', label: 'Anggota', icon: Users },
        { href: '/admin/documents', label: 'Dokumen', icon: ClipboardList },
        { href: '/profile', label: 'Profil', icon: UserCircle },
    ];
    const mobileItems = user?.role === 'SUPERADMIN'
        ? adminMobileItems
        : user?.role === 'ADMIN_PRODI'
            ? adminProdiMobileItems
            : userMobileItems;
    const activeHref = getActiveHref(pathname, mobileItems);
    const isCertificationPage = pathname === '/certification' || pathname.startsWith('/certification/');
    const profileName = user?.identity?.fullName || user?.displayName || user?.email || 'User';
    const notificationItems = notifications?.notifications ?? [];
    const actionRequiredCount = notifications?.actionRequiredCount ?? 0;
    const unreadCount = notifications?.unreadCount ?? 0;

    return (
        <header className="sticky top-0 z-20 border-b border-slate-200/50 bg-white/70 backdrop-blur-md px-4 py-3.5 md:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="truncate text-xl font-bold tracking-tight text-slate-900 font-display">{title}</h2>
                    {subtitle ? <p className="line-clamp-1 text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p> : null}
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="relative h-9 w-9 rounded-xl border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-blue-50 hover:text-blue-700"
                            onClick={() => setNotificationOpen((value) => !value)}
                            aria-label="Buka notifikasi"
                        >
                            <Bell className="h-4 w-4" />
                            {unreadCount > 0 ? (
                                <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            ) : null}
                        </Button>

                        {notificationOpen ? (
                            <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                                <div className="border-b border-slate-100 px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">Notifikasi</p>
                                            <p className="text-xs text-slate-500">
                                                {actionRequiredCount > 0
                                                    ? `${actionRequiredCount} aksi perlu dilakukan`
                                                    : 'Tidak ada aksi mendesak'}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                                            {notificationItems.length}
                                        </span>
                                    </div>
                                </div>

                                <div className="max-h-96 overflow-y-auto p-2">
                                    {notificationItems.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
                                            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                                <CheckCircle2 className="h-5 w-5" />
                                            </div>
                                            <p className="text-sm font-bold text-slate-900">Belum ada notifikasi</p>
                                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                                Aksi seperti dokumen yang perlu ditandatangani akan muncul di sini.
                                            </p>
                                        </div>
                                    ) : (
                                        notificationItems.map((item) => (
                                            <Link
                                                key={item.id}
                                                href={item.href}
                                                onClick={() => setNotificationOpen(false)}
                                                className="block rounded-xl px-3 py-3 transition hover:bg-slate-50"
                                            >
                                                <div className="flex gap-3">
                                                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                                        item.priority === 'HIGH'
                                                            ? 'bg-rose-50 text-rose-600'
                                                            : 'bg-blue-50 text-blue-600'
                                                    }`}>
                                                        {item.type === 'SIGN_REQUIRED' ? (
                                                            <PenSquare className="h-4 w-4" />
                                                        ) : (
                                                            <Inbox className="h-4 w-4" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className="line-clamp-1 text-sm font-bold text-slate-900">
                                                                {item.title}
                                                            </p>
                                                            <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                                                                {formatNotificationTime(item.createdAt)}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                                            {item.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <Link
                        href="/profile"
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-xs transition-all hover:bg-slate-50"
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                            <UserCircle className="h-4.5 w-4.5" />
                        </div>
                        <div className="hidden min-w-0 sm:block">
                            <p className="max-w-40 truncate text-xs font-bold text-slate-800">
                                {profileName}
                            </p>
                            {!isCertificationPage ? (
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    {user?.role?.replace(/_/g, ' ') ?? 'Profil'}
                                </p>
                            ) : null}
                        </div>
                    </Link>
                    <Button 
                        variant="outline" 
                        className="h-9 border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all rounded-xl"
                        onClick={handleLogout}
                    >
                        <LogOut className="h-4 w-4" />
                        <span className="hidden sm:inline font-semibold text-xs">Logout</span>
                    </Button>
                </div>
            </div>
            <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Mobile navigation">
                {mobileItems.map((item) => {
                    const isActive = activeHref === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition-all ${isActive
                                    ? 'border-indigo-100 bg-indigo-50/80 text-indigo-600 shadow-xs'
                                    : 'border-slate-200/60 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {item.label}
                            {item.href === '/certification/assigned' && actionRequiredCount > 0 ? (
                                <span className="ml-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
                                    {actionRequiredCount > 9 ? '9+' : actionRequiredCount}
                                </span>
                            ) : null}
                        </Link>
                    );
                })}
            </nav>
        </header>
    );
}
