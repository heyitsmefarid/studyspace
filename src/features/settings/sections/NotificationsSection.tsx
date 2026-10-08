import { useState } from 'react';
import { Switch } from '@/components/ui/Switch';
import { useAuth } from '@/features/auth/AuthProvider';
import { useUpdatePreferences } from '@/features/auth/useProfileMutations';
import { NOTIFICATION_KINDS, kindEnabled } from '@/features/notifications/kinds';
import { requestSystemPermission, systemPermission } from '@/features/notifications/browserNotify';

export function NotificationsSection() {
  const { preferences } = useAuth();
  const update = useUpdatePreferences();
  const n = preferences.notifications;
  const [permission, setPermission] = useState(systemPermission);

  async function toggleSystem(on: boolean) {
    if (!on) { update.mutate({ notifications: { browser: false } }); return; }
    const p = await requestSystemPermission();
    setPermission(p);
    update.mutate({ notifications: { browser: p === 'granted' } });
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink-muted">Notify me about</h3>
        {NOTIFICATION_KINDS.map((k) => (
          <Switch key={k.kind} label={k.label} hint={k.hint} checked={kindEnabled(n.kinds, k.kind)}
            onCheckedChange={(v) => update.mutate({ notifications: { kinds: { ...n.kinds, [k.kind]: v } } })} />
        ))}
      </section>
      <section className="flex flex-col gap-2">
        <Switch label="System notifications" hint="Pop up on your device while StudySpace is open in a tab."
          checked={n.browser && permission === 'granted'} onCheckedChange={(v) => void toggleSystem(v)} />
        {permission === 'unsupported' && <p className="text-xs text-ink-muted">This browser doesn't support system notifications.</p>}
        {permission === 'denied' && (
          <p role="alert" className="text-xs text-coral">
            Your browser is blocking notifications from StudySpace. Allow them in the site settings (the icon to the left of the address bar), then switch this on again.
          </p>
        )}
      </section>
    </div>
  );
}
