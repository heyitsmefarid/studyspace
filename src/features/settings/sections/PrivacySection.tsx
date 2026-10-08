import { Switch } from '@/components/ui/Switch';
import { useAuth } from '@/features/auth/AuthProvider';
import { useUpdatePreferences } from '@/features/auth/useProfileMutations';

export function PrivacySection() {
  const { preferences } = useAuth();
  const update = useUpdatePreferences();
  const p = preferences.privacy;
  return (
    <div className="flex max-w-md flex-col gap-4">
      <Switch label="Show when I'm online" hint="Your partner sees when you're online or studying." checked={p.showOnline}
        onCheckedChange={(v) => update.mutate({ privacy: { showOnline: v } })} />
      <Switch label="Share my activity in Our Space" hint="Your sessions, quiz scores and achievements appear in the activity feed." checked={p.shareActivity}
        onCheckedChange={(v) => update.mutate({ privacy: { shareActivity: v } })} />
      <Switch label="New items start shared" hint="New notes, decks, quizzes, tasks and goals are shared with your partner." checked={p.shareByDefault}
        onCheckedChange={(v) => update.mutate({ privacy: { shareByDefault: v } })} />
    </div>
  );
}
