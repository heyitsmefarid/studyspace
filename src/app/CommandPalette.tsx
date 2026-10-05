import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Command } from 'cmdk';
import { BookOpenText, CalendarPlus, Layers, ListChecks, MoonStar, Sparkles, Timer } from 'lucide-react';
import { applyTheme, readThemePref, type ThemePref } from '@/lib/theme';
import { NAV } from './nav';
import { PALETTE_SOURCES, type PaletteSource } from './paletteSources';

const itemClass = 'flex h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-ink data-[selected=true]:bg-surface-2';
const groupClass = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-ink-faint';
const NEXT_THEME: Record<ThemePref, ThemePref> = { system: 'night', night: 'daybreak', daybreak: 'system' };

function SourceGroup({ source, query, go }: { source: PaletteSource; query: string; go: (to: string) => void }) {
  const items = source.useItems(query);
  if (items.length === 0) return null;
  return (
    <Command.Group heading={source.heading} className={groupClass}>
      {items.map((it) => (
        <Command.Item key={it.id} value={`${source.id}:${it.id}:${it.label}`} onSelect={() => go(it.to)} className={itemClass}>
          {it.label}
        </Command.Item>
      ))}
    </Command.Group>
  );
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const go = (to: string) => { onOpenChange(false); setQuery(''); navigate(to); };

  const actions = [
    { label: 'New note', icon: BookOpenText, to: '/notes?new=1' },
    { label: 'New flashcard deck', icon: Layers, to: '/decks?new=1' },
    { label: 'Start a quiz', icon: ListChecks, to: '/quizzes' },
    { label: 'Ask Nova', icon: Sparkles, to: '/tutor' },
    { label: 'Start studying', icon: Timer, to: '/study' },
    { label: 'Add task', icon: CalendarPlus, to: '/planner?new=1' },
  ];

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      overlayClassName="fixed inset-0 z-40 bg-[#05081a]/60 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[12dvh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-raised shadow-glow"
    >
      <Command.Input
        value={query}
        onValueChange={setQuery}
        placeholder="Search or jump to…"
        className="h-14 w-full border-b border-line bg-transparent px-4 text-base text-ink placeholder:text-ink-faint focus:outline-none"
      />
      <Command.List className="max-h-[60dvh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-ink-muted">Nothing in this corner of the sky.</Command.Empty>
        <Command.Group heading="Actions" className={groupClass}>
          {actions.map(({ label, icon: Icon, to }) => (
            <Command.Item key={label} value={label} onSelect={() => go(to)} className={itemClass}>
              <Icon className="size-4 text-primary" aria-hidden />{label}
            </Command.Item>
          ))}
          <Command.Item
            value="Toggle theme"
            onSelect={() => { applyTheme(NEXT_THEME[readThemePref()]); onOpenChange(false); }}
            className={itemClass}
          >
            <MoonStar className="size-4 text-primary" aria-hidden />Toggle theme
          </Command.Item>
        </Command.Group>
        <Command.Group heading="Go to" className={groupClass}>
          {NAV.map(({ to, label, icon: Icon }) => (
            <Command.Item key={to} value={`Go to ${label}`} onSelect={() => go(to)} className={itemClass}>
              <Icon className="size-4 text-ink-muted" aria-hidden />{label}
            </Command.Item>
          ))}
        </Command.Group>
        {PALETTE_SOURCES.map((s) => <SourceGroup key={s.id} source={s} query={query} go={go} />)}
      </Command.List>
    </Command.Dialog>
  );
}
