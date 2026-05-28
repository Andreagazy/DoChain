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
        <div className="relative min-h-screen bg-slate-50/40 text-slate-950 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 left-0 z-0 hidden w-66 border-r border-slate-200/60 bg-white/90 backdrop-blur-md lg:block" />

            {/* Subtle Decorative Premium Background Blobs */}
            <div className="pointer-events-none absolute -top-48 right-12 h-[600px] w-[600px] rounded-full bg-indigo-500/4 blur-3xl animate-pulse" />
            <div className="pointer-events-none absolute -bottom-48 -left-24 h-[600px] w-[600px] rounded-full bg-violet-500/4 blur-3xl animate-pulse animate-float-slow" />
            <div className="pointer-events-none absolute top-1/2 left-1/3 h-[400px] w-[400px] rounded-full bg-emerald-500/2 blur-3xl animate-pulse animate-float-reverse-slow" />

            <div className="flex min-h-screen relative z-10">
                <AppSidebar />
                <div className="flex min-h-screen flex-1 flex-col">
                    <AppTopbar title={title} subtitle={subtitle} />
                    <main className="flex-1 px-4 py-5 md:px-6 lg:px-8">
                        <div className="mx-auto w-full max-w-7xl">{children}</div>
                    </main>
                </div>
            </div>
        </div>
    );
}
