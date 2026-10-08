import { EmptyState } from '@/components/ui/EmptyState';
export function Placeholder({ title, body }: { title: string; body: string }) {
  return <div className="py-10"><EmptyState title={title} body={body} /></div>;
}
