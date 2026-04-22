import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
    label: string;
    value: string | number;
    description?: string;
    icon?: ReactNode;
}

export function StatCard({ label, value, description, icon }: StatCardProps) {
    return (
        <Card className="border-slate-200 bg-white/90 shadow-sm">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-sm text-slate-500">{label}</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
                        {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
                    </div>
                    {icon ? <div className="rounded-lg bg-slate-100 p-2 text-slate-700">{icon}</div> : null}
                </div>
            </CardContent>
        </Card>
    );
}
