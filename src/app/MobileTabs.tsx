import { useState } from 'react';
import { NavLink } from 'react-router';
import { LayoutGrid, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Logo } from '@/components/sky/Logo';
import { MOBILE_TABS } from './nav';
import { MoreSheet } from './MoreSheet';
import { ProfileChip } from './ProfileChip';

export function MobileTopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  return (
    <header data-mobile-chrome className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/80 px-4 backdrop-blur md:hidden">
      <Logo size="sm" />
      <div className="flex items-center gap-1">
        <button onClick={onOpenPalette} className="grid size-11 place-items-center rounded-xl text-ink-muted hover:bg-surface-2" aria-label="Search or do anything">
          <Search className="size-5" />
        </button>
        <ProfileChip compact />
      </div>
    </header>
  );
}

export function MobileTabs() {
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <>
      <nav
        data-mobile-chrome
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {MOBILE_TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => cn(
              'relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-200',
              isActive ? 'text-primary' : 'text-ink-muted',
            )}
          >
            {({ isActive }) => (<>
              {isActive && <span aria-hidden className="absolute inset-x-4 top-0 h-0.5 origin-center animate-grow-x rounded-full bg-primary" />}
              <Icon className={cn('size-5 transition-[filter] duration-200', isActive && 'drop-shadow-[0_0_6px_var(--primary)]')} aria-hidden />
              <span className="max-w-full truncate px-0.5">{label}</span>
            </>)}
          </NavLink>
        ))}
        <button onClick={() => setMoreOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-ink-muted">
          <LayoutGrid className="size-5" aria-hidden />
          More
        </button>
      </nav>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
