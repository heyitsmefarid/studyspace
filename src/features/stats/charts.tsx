import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Table2, BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { SubjectDot } from '@/features/subjects/SubjectDot';
import { usePrefersReducedMotion } from '@/lib/motion';

// Mark specs (dataviz skill): bars ≤ 24px with a 4px rounded data-end, 2px lines, ≥ 8px markers with a 2px
// surface ring, solid hairline grid. Colours are the validated --chart-1 / --chart-2 tokens; text wears ink tokens.
const AXIS = { fill: 'var(--ink-faint)', fontSize: 12 };
const GRID = 'var(--line-strong)';

export const formatMinutes = (m: number) => (m >= 120 ? `${(m / 60).toFixed(m >= 600 ? 0 : 1)} h` : `${Math.round(m)} min`);

interface TipEntry { value?: unknown; color?: string; payload?: unknown }

function ChartTooltip({ active, payload, label, format }: { active?: boolean; payload?: readonly TipEntry[]; label?: unknown; format: (v: number, row: unknown) => string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!;
  return (
    <div className="rounded-lg border border-line bg-raised px-3 py-2 text-sm shadow-glow">
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: p.color }} />
        <strong className="text-ink">{format(Number(p.value), p.payload)}</strong>
      </div>
      <p className="text-xs text-ink-muted">{String(label ?? '')}</p>
    </div>
  );
}

/** Card with a "View as table" twin for every chart. */
export function ChartCard({ title, subtitle, table, empty, children }: {
  title: string; subtitle?: ReactNode; empty?: string | null;
  table: { columns: [string, string]; rows: [ReactNode, string][] }; children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className="flex min-w-0 flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg">{title}</h2>
          {subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
        </div>
        {!empty && (
          <button type="button" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-ink-muted hover:bg-surface-2 hover:text-ink">
            {asTable ? <><BarChart3 className="size-4" aria-hidden /> View as chart</> : <><Table2 className="size-4" aria-hidden /> View as table</>}
          </button>
        )}
      </div>
      {empty ? <p className="py-8 text-center text-sm text-ink-muted">{empty}</p> : asTable ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead><tr className="text-left text-ink-muted">{table.columns.map((c, i) => <th key={c} scope="col" className={i ? 'py-1.5 text-right font-medium' : 'py-1.5 font-medium'}>{c}</th>)}</tr></thead>
            <tbody>
              {table.rows.map(([a, b], i) => (
                <tr key={i} className="border-t border-line"><td className="py-1.5">{a}</td><td className="py-1.5 text-right tabular">{b}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : children}
    </Card>
  );
}

export function FocusBars({ data }: { data: { label: string; minutes: number }[] }) {
  const reduce = usePrefersReducedMotion();
  const hours = Math.max(0, ...data.map((d) => d.minutes)) > 120;
  const rows = data.map((d) => ({ label: d.label, value: hours ? Math.round((d.minutes / 60) * 10) / 10 : d.minutes, minutes: d.minutes }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={36}
            tickFormatter={(v: number) => (hours ? `${v}h` : `${v}`)} />
          <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} format={(_v, row) => formatMinutes((row as { minutes: number }).minutes)} />} />
          <Bar dataKey="value" name="Focus" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={!reduce} animationDuration={700} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AccuracyLine({ data }: { data: { label: string; accuracy: number }[] }) {
  const reduce = usePrefersReducedMotion();
  const rows = data.map((d) => ({ label: d.label, value: Math.round(d.accuracy * 100) }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={12} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => `${v}%`} />
          <ReferenceLine y={80} stroke="var(--ink-faint)" strokeWidth={1}
            label={{ value: '80% goal', position: 'insideTopLeft', fill: 'var(--ink-muted)', fontSize: 12 }} />
          <Tooltip cursor={{ stroke: 'var(--ink-faint)', strokeWidth: 1 }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} format={(v) => `${v}%`} />} />
          <Line type="linear" dataKey="value" name="Accuracy" stroke="var(--chart-2)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            dot={{ r: 4, fill: 'var(--chart-2)', stroke: 'var(--surface)', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: 'var(--chart-2)', stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={!reduce} animationDuration={700} animationEasing="ease-out" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars: one mark colour for every subject (nominal categories); the subject's own colour rides a dot beside its name. */
export function SubjectBars({ data }: { data: { id: string; name: string; color: string | null; minutes: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.minutes));
  return (
    <ul className="flex flex-col gap-3">
      {data.map((d) => (
        <li key={d.id} title={`${d.name}: ${formatMinutes(d.minutes)}`}>
          <div className="mb-1 flex items-center gap-2 text-sm">
            {d.color ? <SubjectDot color={d.color} /> : <span aria-hidden className="size-2.5 rounded-full border border-line-strong" />}
            <span className="min-w-0 flex-1 truncate text-ink">{d.name}</span>
            <span className="shrink-0 text-ink-muted tabular">{formatMinutes(d.minutes)}</span>
          </div>
          <div className="h-3 w-full" aria-hidden>
            <div className="h-full origin-left animate-grow-x rounded-r-[4px] bg-chart-1 transition-[width] duration-500 ease-soft" style={{ width: `${Math.max(1.5, (d.minutes / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
