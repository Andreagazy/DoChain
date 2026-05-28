import { ReactNode } from 'react';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: ReactNode;
    action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
    return (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            {icon ? <div className="mx-auto mb-3 flex w-fit items-center justify-center rounded-md bg-slate-100 p-3 text-slate-700">{icon}</div> : null}
            <h3 className="text-base font-semibold text-slate-950">{title}</h3>
            <p className="mx-auto mt-1 max-w-lg text-sm text-slate-600">{description}</p>
            {action ? <div className="mt-4">{action}</div> : null}
        </div>
    );
}
