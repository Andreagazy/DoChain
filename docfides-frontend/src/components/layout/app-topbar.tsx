'use client';

import Link from 'next/link';
import { Building2, ClipboardList, FileSignature, FolderOpen, Inbox, LayoutDashboard, LogOut, PenSquare, ShieldCheck, UserCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getUser, logout } from '@/lib/auth-service';
import { usePathname, useRouter } from 'next/navigation';

interface AppTopbarProps {
    title: string;
    subtitle?: string;
}

function getActiveHref(pathname: string, items: Array<{ href: string }>) {
    return items
        .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function AppTopbar({ title, subtitle }: AppTopbarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const user = getUser();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    const userMobileItems = [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/documents', label: 'Dokumen', icon: FolderOpen },
        { href: '/certification', label: 'Sertifikasi', icon: PenSquare },
        { href: '/certification/assigned', label: 'Perlu Sign', icon: Inbox },
        { href: '/identity', label: 'Identitas', icon: ShieldCheck },
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

    return (
        <header className="sticky top-0 z-20 border-b border-slate-200/50 bg-white/70 backdrop-blur-md px-4 py-3.5 md:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="truncate text-xl font-bold tracking-tight text-slate-900 font-display">{title}</h2>
                    {subtitle ? <p className="line-clamp-1 text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p> : null}
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href="/profile"
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-xs transition-all hover:bg-slate-50"
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                            <UserCircle className="h-4.5 w-4.5" />
                        </div>
                        <div className="hidden min-w-0 sm:block">
                            <p className="max-w-40 truncate text-xs font-bold text-slate-800">
                                {user?.displayName || user?.email || 'User'}
                            </p>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                {user?.role?.replace(/_/g, ' ') ?? 'Profil'}
                            </p>
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
                        </Link>
                    );
                })}
            </nav>
        </header>
    );
}
