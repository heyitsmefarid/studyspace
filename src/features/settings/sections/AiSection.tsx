import { Field, Select } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { useAuth } from '@/features/auth/AuthProvider';
import { useUpdatePreferences } from '@/features/auth/useProfileMutations';

export function AiSection() {
  const { preferences } = useAuth();
  const update = useUpdatePreferences();
  const ai = preferences.ai;
  return (
    <div className="flex max-w-md flex-col gap-4">
      <Switch label="Fast mode" hint="Quick answers via Groq first; Gemini stays the backup." checked={ai.fastMode}
        onCheckedChange={(v) => update.mutate({ ai: { fastMode: v } })} />
      <Field label="Default difficulty">
        {(id) => (
          <Select id={id} value={ai.difficulty} onChange={(e) => update.mutate({ ai: { difficulty: e.target.value as typeof ai.difficulty } })}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </Select>
        )}
      </Field>
      <Switch label="Analyse quizzes automatically" hint="Nova reviews each finished quiz (uses one request)." checked={ai.autoAnalyzeQuizzes}
        onCheckedChange={(v) => update.mutate({ ai: { autoAnalyzeQuizzes: v } })} />
    </div>
  );
}
