import { useState } from 'react';
import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { MobileTabs, MobileTopBar } from './MobileTabs';
import { CommandPalette } from './CommandPalette';
import { useHotkey } from './useHotkey';
import { OfflineBanner } from './OfflineBanner';

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  useHotkey('mod+k', () => setPaletteOpen(true));
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[auto_1fr]">
      <Sidebar onOpenPalette={() => setPaletteOpen(true)} />
      <div className="min-w-0">
        <MobileTopBar onOpenPalette={() => setPaletteOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 md:px-8 md:pb-12 md:pt-8">
          <Outlet />
        </main>
      </div>
      <MobileTabs />
      <OfflineBanner />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
