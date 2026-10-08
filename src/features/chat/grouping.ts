import { dayKey, dayLabel } from '@/lib/days';
import { todayInZone } from '@/features/gamification/streak';
import type { ChatMessage } from './types';

const CLUSTER_GAP_MS = 5 * 60_000;
export interface Cluster { key: string; senderId: string; messages: ChatMessage[] }
export interface DayGroup { key: string; label: string; clusters: Cluster[] }

/** Oldest-first messages → local-day groups of sender clusters (same sender, each ≤ 5 minutes after the last). */
export function groupMessages(messages: ChatMessage[], tz: string, now: Date): DayGroup[] {
  const today = todayInZone(tz, now);
  const days: DayGroup[] = [];
  for (const msg of messages) {
    const key = dayKey(msg.created_at, tz);
    let day = days.at(-1);
    if (!day || day.key !== key) {
      day = { key, label: dayLabel(key, today), clusters: [] };
      days.push(day);
    }
    const cluster = day.clusters.at(-1);
    const prev = cluster?.messages.at(-1);
    if (cluster && prev && cluster.senderId === msg.sender_id && Date.parse(msg.created_at) - Date.parse(prev.created_at) <= CLUSTER_GAP_MS) {
      cluster.messages.push(msg);
    } else {
      day.clusters.push({ key: msg.id, senderId: msg.sender_id, messages: [msg] });
    }
  }
  return days;
}
