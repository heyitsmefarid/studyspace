import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

/** label · value · sub-line. Values use the sans face with proportional figures (dataviz stat-tile contract). */
export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <div className="text-3xl font-semibold leading-tight text-ink">{value}</div>
      {sub && <p className="text-xs text-ink-faint">{sub}</p>}
    </Card>
  );
}
