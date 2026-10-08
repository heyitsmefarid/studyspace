export interface Reaction { user_id: string; emoji: string }
export interface ChatMessage {
  id: string; room_id: string; sender_id: string; kind: 'text' | 'star' | 'file';
  body: string; attachment_path: string | null; attachment_name: string | null; attachment_mime: string | null;
  deleted_at: string | null; created_at: string; reactions: Reaction[];
  /** Client-only: an optimistic message waiting for (or failed at) the server. */
  pending?: 'sending' | 'failed';
}
export const EMOJIS = ['❤️', '🔥', '⭐', '😂', '👏', '💪'] as const;
