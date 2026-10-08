import { cn } from '@/lib/cn';
import type { ThemePref } from '@/lib/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { originOf, useChooseTheme } from '@/features/auth/useChooseTheme';

const OPTIONS: { value: ThemePref; label: string; hint: string; preview: [string, string, string] }[] = [
  { value: 'system', label: 'System', hint: 'Follow your device', preview: ['#0B1026', '#F6F3FB', '#A99CFF'] },
  { value: 'night', label: 'Night', hint: 'Deep indigo sky', preview: ['#0B1026', '#11173A', '#F5C76B'] },
  { value: 'daybreak', label: 'Daybreak', hint: 'Warm paper dawn', preview: ['#F6F3FB', '#FFFFFF', '#5443C9'] },
];

export function AppearanceSection() {
  const { preferences } = useAuth();
  const choose = useChooseTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={preferences.theme === o.value}
          onClick={(e) => choose(o.value, originOf(e.currentTarget))}
          className={cn('rounded-2xl border p-3 text-left transition',
            preferences.theme === o.value ? 'border-primary bg-primary-soft' : 'border-line hover:border-line-strong')}
        >
          <div className="mb-3 flex h-16 overflow-hidden rounded-xl" aria-hidden>
            <span className="flex-1" style={{ background: o.preview[0] }} />
            <span className="flex-1" style={{ background: o.preview[1] }} />
            <span className="w-4" style={{ background: o.preview[2] }} />
          </div>
          <p className="font-semibold">{o.label}</p>
          <p className="text-xs text-ink-muted">{o.hint}</p>
        </button>
      ))}
    </div>
  );
}
