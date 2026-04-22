import { ReactNode } from 'react';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: ReactNode;
    action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
    return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            {icon ? <div className="mx-auto mb-3 flex w-fit items-center justify-center rounded-full bg-white p-3">{icon}</div> : null}
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="mx-auto mt-1 max-w-lg text-sm text-slate-600">{description}</p>
            {action ? <div className="mt-4">{action}</div> : null}
        </div>
    );
}
