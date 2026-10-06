import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/cn';

// Raw HTML is never rendered (skipHtml, no rehype-raw); react-markdown's default urlTransform drops javascript: links.
const COMPONENTS: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};
const PLUGINS = [remarkGfm];

export function MarkdownView({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div className={cn('prose-ss', className)}>
      <Markdown remarkPlugins={PLUGINS} skipHtml components={COMPONENTS}>{markdown}</Markdown>
    </div>
  );
}
