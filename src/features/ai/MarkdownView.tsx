import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/cn';

// Raw HTML is never rendered (skipHtml, no rehype-raw); react-markdown's default urlTransform drops javascript: links.
// Images are never loaded: a remote URL in AI output could carry note text to another server (prompt injection).
const COMPONENTS: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  img: ({ alt }) => (alt ? <span className="text-ink-muted">[image: {alt}]</span> : null),
};
const PLUGINS = [remarkGfm];

export function MarkdownView({ markdown, className, reveal }: { markdown: string; className?: string; reveal?: boolean }) {
  return (
    <div className={cn('prose-ss', reveal && 'stagger stagger-cap-8 [--stagger-step:60ms]', className)}>
      <Markdown remarkPlugins={PLUGINS} skipHtml components={COMPONENTS}>{markdown}</Markdown>
    </div>
  );
}
