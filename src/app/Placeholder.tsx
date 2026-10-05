import { EmptyState } from '@/components/ui/EmptyState';
export function Placeholder({ title, body = 'Arriving in Phase 2 — this part of your sky is still being drawn.' }: { title: string; body?: string }) {
  return <div className="py-10"><EmptyState title={title} body={body} /></div>;
}
