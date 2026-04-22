'use client';

import { Bell, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logout } from '@/lib/auth-service';
import { useRouter } from 'next/navigation';

interface AppTopbarProps {
    title: string;
    subtitle?: string;
}

export function AppTopbar({ title, subtitle }: AppTopbarProps) {
    const router = useRouter();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    return (
        <header className="border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        aria-label="Open navigation"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 lg:hidden"
                        type="button"
                    >
                        <Menu className="h-4 w-4" />
                    </button>
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
                        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        aria-label="Notifications"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100"
                    >
                        <Bell className="h-4 w-4" />
                    </button>
                    <Button variant="outline" className="border-slate-300" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                    </Button>
                </div>
            </div>
        </header>
    );
}
