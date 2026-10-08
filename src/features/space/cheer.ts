import { STAR_MAX } from '@/features/chat/rules';

export const STAR_PRESETS = ['You’ve got this ✦', 'Proud of you', 'Water break?'] as const;

/** A preset shooting star for cheering one of the partner's feed items. */
export function cheerFor(item: { kind: string; title: string }): string {
  switch (item.kind) {
    case 'session': return '🔥 Nice session!';
    case 'quiz': return '👏 Great quiz!';
    case 'achievement': return `✦ Congrats on ${item.title}!`.slice(0, STAR_MAX);
    default: return '💛 Thanks for sharing!';
  }
}
