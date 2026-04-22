'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, FolderOpen, LayoutDashboard, PenSquare, ShieldCheck, UploadCloud } from 'lucide-react';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/documents/upload', label: 'Upload Document', icon: UploadCloud },
    { href: '/documents', label: 'Documents', icon: FolderOpen },
    { href: '/certification', label: 'Certification', icon: PenSquare },
    { href: '/identity', label: 'Identity', icon: ShieldCheck },
    { href: '/signature-setup', label: 'Signature Setup', icon: FileText },
];

export function AppSidebar() {
    const pathname = usePathname();

    return (
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white/90 p-4 lg:block">
            <div className="rounded-xl bg-slate-900 px-3 py-4 text-white">
                <p className="text-xs uppercase tracking-wide text-slate-300">Workspace</p>
                <h1 className="mt-1 text-lg font-semibold">DoChain</h1>
                <p className="text-xs text-slate-300">Document Certification</p>
            </div>

            <nav className="mt-5 space-y-1" aria-label="Main navigation">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                                }`}
                        >
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
