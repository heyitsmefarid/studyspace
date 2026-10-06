import { useState } from 'react';
import { useNavigate } from 'react-router';
import { SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { WidgetCard } from './WidgetCard';

export function QuickNova() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const go = () => { if (q.trim()) navigate(`/tutor?mode=explain_simply&prompt=${encodeURIComponent(q.trim().slice(0, 2000))}`); };
  return (
    <WidgetCard title="✦ Ask Nova">
      <p className="text-sm text-ink-muted">Stuck on something? Nova explains it simply — then you can go deeper.</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <Input aria-label="Ask Nova anything" placeholder="Ask Nova anything…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" size="icon" aria-label="Ask" disabled={!q.trim()}><SendHorizontal className="size-5" /></Button>
      </form>
    </WidgetCard>
  );
}
