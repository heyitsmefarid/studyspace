import { useState } from 'react';
import { Outlet, useMatches } from 'react-router';
import { pageKey } from './pageKey';
import { Sidebar } from './Sidebar';
import { MobileTabs, MobileTopBar } from './MobileTabs';
import { CommandPalette } from './CommandPalette';
import { useHotkey } from './useHotkey';
import { OfflineBanner } from './OfflineBanner';
import { RealtimeProvider } from '@/features/realtime/RealtimeProvider';
import { ConnectionBanner } from '@/features/realtime/ConnectionBanner';
import { LiveSync } from './LiveSync';

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const key = pageKey(useMatches());
  useHotkey('mod+k', () => setPaletteOpen(true));
  return (
    <RealtimeProvider>
      <div className="min-h-dvh md:grid md:grid-cols-[auto_1fr]">
        <Sidebar onOpenPalette={() => setPaletteOpen(true)} />
        <div className="min-w-0">
          <MobileTopBar onOpenPalette={() => setPaletteOpen(true)} />
          <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 md:px-8 md:pb-12 md:pt-8">
            {/* Keyed by route id: params/query changes keep the page mounted (tutor chat creation, note to note). */}
            <div key={key} className="animate-page-in"><Outlet /></div>
          </main>
        </div>
        <MobileTabs />
        <OfflineBanner />
        <ConnectionBanner />
        <LiveSync />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </RealtimeProvider>
  );
}
