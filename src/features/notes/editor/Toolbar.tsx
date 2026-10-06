import { useEditorState, type Editor } from '@tiptap/react';
import { toast } from 'sonner';
import {
  Bold, Code2, Heading1, Heading2, Heading3, Highlighter, ImagePlus, Italic, Link2, List, ListChecks, ListOrdered,
  Quote, Redo2, Underline, Undo2, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface Tool { label: string; icon: LucideIcon; run: () => void; active?: boolean }

export function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h1: e.isActive('heading', { level: 1 }), h2: e.isActive('heading', { level: 2 }), h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), mark: e.isActive('highlight'),
      ul: e.isActive('bulletList'), ol: e.isActive('orderedList'), tasks: e.isActive('taskList'), quote: e.isActive('blockquote'),
      code: e.isActive('codeBlock'), link: e.isActive('link'), undo: e.can().undo(), redo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') { c().unsetLink().run(); return; }
    if (!/^(https?:|mailto:)/i.test(url)) { toast.error('Links must start with http(s):// or mailto:'); return; }
    c().extendMarkRange('link').setLink({ href: url }).run();
  };

  const groups: Tool[][] = [
    [
      { label: 'Heading 1', icon: Heading1, run: () => c().toggleHeading({ level: 1 }).run(), active: s.h1 },
      { label: 'Heading 2', icon: Heading2, run: () => c().toggleHeading({ level: 2 }).run(), active: s.h2 },
      { label: 'Heading 3', icon: Heading3, run: () => c().toggleHeading({ level: 3 }).run(), active: s.h3 },
    ],
    [
      { label: 'Bold', icon: Bold, run: () => c().toggleBold().run(), active: s.bold },
      { label: 'Italic', icon: Italic, run: () => c().toggleItalic().run(), active: s.italic },
      { label: 'Underline', icon: Underline, run: () => c().toggleUnderline().run(), active: s.underline },
      { label: 'Highlight', icon: Highlighter, run: () => c().toggleHighlight().run(), active: s.mark },
    ],
    [
      { label: 'Bullet list', icon: List, run: () => c().toggleBulletList().run(), active: s.ul },
      { label: 'Numbered list', icon: ListOrdered, run: () => c().toggleOrderedList().run(), active: s.ol },
      { label: 'Checklist', icon: ListChecks, run: () => c().toggleTaskList().run(), active: s.tasks },
      { label: 'Quote', icon: Quote, run: () => c().toggleBlockquote().run(), active: s.quote },
      { label: 'Code block', icon: Code2, run: () => c().toggleCodeBlock().run(), active: s.code },
    ],
    [
      { label: 'Link', icon: Link2, run: setLink, active: s.link },
      { label: 'Image', icon: ImagePlus, run: () => window.dispatchEvent(new CustomEvent('ss:pick-image')) },
    ],
    [
      { label: 'Undo', icon: Undo2, run: () => c().undo().run() },
      { label: 'Redo', icon: Redo2, run: () => c().redo().run() },
    ],
  ];

  return (
    <div role="toolbar" aria-label="Formatting" className="sticky top-14 z-20 -mx-1 mb-3 flex gap-1 overflow-x-auto bg-bg/90 px-1 py-1.5 backdrop-blur md:top-0">
      {groups.map((g, gi) => (
        <div key={gi} className="flex shrink-0 gap-0.5 border-r border-line pr-1 last:border-r-0">
          {g.map(({ label, icon: Icon, run, active }) => (
            <button
              key={label}
              type="button"
              onClick={run}
              aria-label={label}
              title={label}
              aria-pressed={active ?? undefined}
              disabled={(label === 'Undo' && !s.undo) || (label === 'Redo' && !s.redo)}
              className={cn('grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40',
                active && 'bg-primary-soft text-primary')}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
