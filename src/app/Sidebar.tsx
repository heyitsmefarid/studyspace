import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import { ChevronsLeft, ChevronsRight, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Logo, LogoMark } from '@/components/sky/Logo';
import { Badge } from '@/components/ui/Badge';
import { NAV } from './nav';
import { ProfileChip } from './ProfileChip';

const KEY = 'ss.sidebar';

function readCollapsed(): boolean {
  try { return localStorage.getItem(KEY) === 'collapsed'; } catch { return false; }
}

export function Sidebar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(KEY, c ? 'expanded' : 'collapsed'); } catch { /* storage unavailable */ }
      return !c;
    });
  };

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface/60 p-3 backdrop-blur md:flex',
        collapsed ? 'w-[76px]' : 'w-64',
      )}
    >
      <div className="mb-4 flex items-center justify-between px-2 pt-2">
        <Link to="/" aria-label="StudySpace home">{collapsed ? <LogoMark /> : <Logo />}</Link>
        {!collapsed && (
          <button onClick={toggle} className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-2 hover:text-ink" aria-label="Collapse sidebar">
            <ChevronsLeft className="size-4" />
          </button>
        )}
      </div>

      <button
        onClick={onOpenPalette}
        className={cn(
          'mb-3 flex h-10 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink-muted hover:border-line-strong',
          collapsed && 'justify-center px-0',
        )}
        aria-label="Search or do anything"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        {!collapsed && <><span className="flex-1 truncate text-left">Search…</span><kbd className="text-xs text-ink-faint">Ctrl K</kbd></>}
      </button>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon, phase }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={collapsed ? label : undefined}
            className={({ isActive }) => cn(
              'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-200',
              isActive ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
              collapsed && 'justify-center px-0',
            )}
          >
            {({ isActive }) => (<>
              <Icon className="size-5 shrink-0" aria-hidden />
              {!collapsed && <span className="flex-1">{label}</span>}
              {!collapsed && phase === 2 && <Badge>soon</Badge>}
              {!collapsed && isActive && <span aria-hidden className="size-1.5 animate-pop-in rounded-full bg-gold shadow-[0_0_8px_var(--gold)]" />}
            </>)}
          </NavLink>
        ))}
      </nav>

      <div className="mt-3 border-t border-line pt-3">
        {collapsed ? (
          <button onClick={toggle} className="mx-auto flex rounded-lg p-2 text-ink-faint hover:bg-surface-2 hover:text-ink" aria-label="Expand sidebar">
            <ChevronsRight className="size-4" />
          </button>
        ) : (
          <ProfileChip />
        )}
      </div>
    </aside>
  );
}
