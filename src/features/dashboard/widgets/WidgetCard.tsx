import { Component, type ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function WidgetCard({ title, more, className, children }: { title: string; more?: { to: string; label: string }; className?: string; children: ReactNode }) {
  return (
    <Card className={cn('flex h-full flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg">{title}</h2>
        {more && <Link to={more.to} className="text-sm text-primary hover:underline">{more.label}</Link>}
      </div>
      {children}
    </Card>
  );
}

/** Keeps one broken widget from taking the whole dashboard down. */
export class WidgetBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error('Dashboard widget failed', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Card className="flex h-full items-center justify-between gap-3 text-sm text-ink-muted">
        Couldn&apos;t load this.
        <Button size="sm" variant="secondary" onClick={() => this.setState({ failed: false })}>Retry</Button>
      </Card>
    );
  }
}
