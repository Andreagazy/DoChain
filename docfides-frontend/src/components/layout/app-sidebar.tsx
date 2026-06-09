'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, ClipboardList, FileSignature, FileText, FolderOpen, Inbox, LayoutDashboard, PenSquare, ShieldCheck, UserCircle, Users } from 'lucide-react';
import { getUser } from '@/lib/auth-service';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/documents', label: 'Dokumen', icon: FolderOpen },
    { href: '/certification', label: 'Sertifikasi', icon: PenSquare },
    { href: '/certification/assigned', label: 'Perlu Ditandatangani', icon: Inbox },
    { href: '/signature-setup', label: 'Tanda Tangan', icon: FileSignature },
    { href: '/profile', label: 'Profil', icon: UserCircle },
];

const adminNavItems = [
    { href: '/admin', label: 'Admin Overview', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Kelola User', icon: Users },
    { href: '/admin/identities', label: 'Verifikasi Identitas', icon: ShieldCheck },
    { href: '/admin/academic-units', label: 'Unit Akademik', icon: Building2 },
    { href: '/admin/documents', label: 'Kelola Dokumen', icon: ClipboardList },
    { href: '/profile', label: 'Profil', icon: UserCircle },
];

const adminProdiNavItems = [
    { href: '/admin-prodi', label: 'Dashboard Prodi', icon: LayoutDashboard },
    { href: '/certification', label: 'Sertifikasi', icon: PenSquare },
    { href: '/documents', label: 'Dokumen Saya', icon: FolderOpen },
    { href: '/certification/assigned', label: 'Perlu Ditandatangani', icon: Inbox },
    { href: '/signature-setup', label: 'Tanda Tangan', icon: FileSignature },
    { href: '/admin/identities', label: 'Verifikasi Identitas', icon: ShieldCheck },
    { href: '/admin/users', label: 'Kelola User', icon: Users },
    { href: '/admin/documents', label: 'Kelola Dokumen', icon: ClipboardList },
    { href: '/profile', label: 'Profil', icon: UserCircle },
];

function getActiveHref(pathname: string, items: Array<{ href: string }>) {
    return items
        .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function AppSidebar() {
    const pathname = usePathname();
    const user = getUser();
    const visibleNavItems = user?.role === 'SUPERADMIN'
        ? adminNavItems
        : user?.role === 'ADMIN_PRODI'
            ? adminProdiNavItems
            : navItems;
    const activeHref = getActiveHref(pathname, visibleNavItems);

    return (
        <aside className="sticky top-0 hidden h-dvh min-h-dvh w-66 shrink-0 self-start overflow-y-auto border-r border-slate-200/60 bg-white/90 backdrop-blur-md p-4 lg:block">
            <div className="px-3 py-4 text-slate-950 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/20 text-white">
                        <FileText className="h-5.5 w-5.5" />
                    </div>
                    <div>
                        <h1 className="text-md font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent font-display">DOCChain</h1>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Trust Protocol</p>
                    </div>
                </div>
            </div>

            <nav className="mt-6 space-y-1" aria-label="Main navigation">
                {visibleNavItems.map((item) => {
                    const isActive = activeHref === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`group relative flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all duration-200 ${isActive
                                    ? 'bg-indigo-50/60 text-indigo-600 border border-indigo-100/50 shadow-xs'
                                    : 'text-slate-600 border border-transparent hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            {isActive && (
                                <span className="absolute left-0 top-[30%] h-[40%] w-1 rounded-full bg-indigo-600" />
                            )}
                            <Icon className={`h-4.5 w-4.5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-700'}`} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
