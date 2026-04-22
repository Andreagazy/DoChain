import { ReactNode } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppTopbar } from '@/components/layout/app-topbar';

interface AppShellProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
}

export function AppShell({ title, subtitle, children }: AppShellProps) {
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="flex min-h-screen">
                <AppSidebar />
                <div className="flex min-h-screen flex-1 flex-col">
                    <AppTopbar title={title} subtitle={subtitle} />
                    <main className="flex-1 p-4 md:p-6">{children}</main>
                </div>
            </div>
        </div>
    );
}
