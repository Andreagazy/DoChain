import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
    status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
    const normalized = status.toUpperCase();

    if (normalized.includes('FULLY_SIGNED') || normalized.includes('APPROVED')) {
        return <Badge variant="success">{status}</Badge>;
    }

    if (normalized.includes('PENDING') || normalized.includes('PARTIALLY')) {
        return <Badge variant="warning">{status}</Badge>;
    }

    if (normalized.includes('REJECTED') || normalized.includes('REVOKED') || normalized.includes('DECLINED')) {
        return <Badge variant="destructive">{status}</Badge>;
    }

    return <Badge variant="neutral">{status}</Badge>;
}
