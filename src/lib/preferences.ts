import { z } from 'zod';

const int = (min: number, max: number, dflt: number) => z.number().int().min(min).max(max).default(dflt).catch(dflt);
const TIMES = ['morning', 'afternoon', 'evening', 'night'] as const;

const Study = z.object({
  focusMin: int(5, 120, 25),
  shortMin: int(1, 30, 5),
  longMin: int(5, 60, 15),
  longEvery: int(2, 8, 4),
  newCardsPerDay: int(0, 200, 20),
  dailyGoalMin: int(10, 600, 60),
  preferredTimes: z.array(z.enum(TIMES)).min(1).default(['evening']).catch(['evening']),
});
const Ai = z.object({
  fastMode: z.boolean().default(false).catch(false),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate').catch('intermediate'),
  autoAnalyzeQuizzes: z.boolean().default(true).catch(true),
});
const Notifications = z.object({
  browser: z.boolean().default(false).catch(false),
  kinds: z.record(z.string(), z.boolean()).default({}).catch({}),
});
const Privacy = z.object({
  showOnline: z.boolean().default(true).catch(true),
  shareActivity: z.boolean().default(true).catch(true),
  shareByDefault: z.boolean().default(false).catch(false),
});

export const PreferencesSchema = z.object({
  theme: z.enum(['system', 'night', 'daybreak']).default('system').catch('system'),
  study: Study.prefault({}).catch(() => Study.parse({})),
  ai: Ai.prefault({}).catch(() => Ai.parse({})),
  notifications: Notifications.prefault({}).catch(() => Notifications.parse({})),
  privacy: Privacy.prefault({}).catch(() => Privacy.parse({})),
});

export type Preferences = z.infer<typeof PreferencesSchema>;
export type PreferencesPatch = { [K in keyof Preferences]?: Preferences[K] extends object ? Partial<Preferences[K]> : Preferences[K] };

export function readPreferences(raw: unknown): Preferences {
  return PreferencesSchema.parse(typeof raw === 'object' && raw !== null ? raw : {});
}

export function mergePreferences(current: Preferences, patch: PreferencesPatch): Preferences {
  const next: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    const cur = (current as Record<string, unknown>)[k];
    next[k] = v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' ? { ...cur, ...v } : v;
  }
  return readPreferences(next);
}

export const DEFAULT_PREFERENCES: Preferences = readPreferences({});
