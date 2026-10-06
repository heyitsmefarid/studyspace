import { format, parseISO } from 'date-fns';
import { hashString } from '@/features/flashcards/constellation';

export interface SkySession { id: string; subject_id: string | null; focus_seconds: number; started_at: string; together?: boolean }
export interface SkySubject { id: string; name: string; color: string; mastery: number }
export interface SkyStar { id: string; x: number; y: number; r: number; color: string; twinkle: boolean; subjectId: string | null; label: string }
export interface SkyLine { from: string; to: string; color: string; opacity: number }

const PAD = 12;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function layoutSky(sessions: SkySession[], subjects: SkySubject[], opts: { width: number; height: number; now: Date; meColor: string; maxStars?: number }) {
  const { width, height, now, meColor, maxStars = 120 } = opts;
  const recent = [...sessions].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, maxStars);
  const subjectMap = new Map(subjects.map((x) => [x.id, x]));
  const clusterR = Math.min(width, height) * 0.22;
  const center = (key: string) => {
    const h = hashString(`cluster:${key}`);
    return { x: width * (0.15 + ((h % 1000) / 1000) * 0.7), y: height * (0.2 + (((h >>> 10) % 1000) / 1000) * 0.6) };
  };
  const stars: SkyStar[] = recent.map((sess) => {
    const subj = sess.subject_id ? subjectMap.get(sess.subject_id) : undefined;
    const c = center(subj?.id ?? 'none');
    const h = hashString(sess.id);
    const angle = ((h % 3600) / 3600) * Math.PI * 2;
    const dist = (((h >>> 12) % 1000) / 1000) * clusterR;
    const mins = Math.round(sess.focus_seconds / 60);
    return {
      id: sess.id,
      x: clamp(c.x + Math.cos(angle) * dist, PAD, width - PAD),
      y: clamp(c.y + Math.sin(angle) * dist * 0.7, PAD, height - PAD),
      r: 1 + Math.min(3, sess.focus_seconds / 1500),
      color: subj?.color ?? meColor,
      twinkle: now.getTime() - parseISO(sess.started_at).getTime() <= 3 * 86_400_000,
      subjectId: subj?.id ?? null,
      label: `${subj?.name ?? 'Study'} · ${mins} min · ${format(parseISO(sess.started_at), 'MMM d')}`,
    };
  });
  const lines: SkyLine[] = [];
  const bySubject = new Map<string, SkySession[]>();
  for (const sess of recent) if (sess.subject_id && subjectMap.has(sess.subject_id)) bySubject.set(sess.subject_id, [...(bySubject.get(sess.subject_id) ?? []), sess]);
  for (const [id, list] of bySubject) {
    const subj = subjectMap.get(id)!;
    const chrono = [...list].sort((a, b) => a.started_at.localeCompare(b.started_at)).slice(-8);
    for (let i = 1; i < chrono.length; i++) {
      lines.push({ from: chrono[i - 1]!.id, to: chrono[i]!.id, color: subj.color, opacity: 0.15 + 0.6 * clamp(subj.mastery, 0, 1) });
    }
  }
  return { stars, lines };
}
