import { Extension, type Editor, type Range } from '@tiptap/core';
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import { SlashMenu, type SlashMenuHandle } from './SlashMenu';

export interface SlashItem { title: string; hint: string; run: (editor: Editor, range: Range) => void }

export const SLASH_ITEMS: SlashItem[] = [
  { title: 'Heading 1', hint: 'Big section title', run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 1 }).run() },
  { title: 'Heading 2', hint: 'Medium title', run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 2 }).run() },
  { title: 'Heading 3', hint: 'Small title', run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 3 }).run() },
  { title: 'Bullet list', hint: '• item', run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { title: 'Numbered list', hint: '1. item', run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { title: 'Checklist', hint: '☐ to-do', run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { title: 'Quote', hint: 'Callout', run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { title: 'Code block', hint: 'Monospace', run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { title: 'Divider', hint: 'Horizontal line', run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
  { title: 'Image', hint: 'Upload a picture', run: (e, r) => { e.chain().focus().deleteRange(r).run(); window.dispatchEvent(new CustomEvent('ss:pick-image')); } },
];

export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: '/',
        items: ({ query }) => SLASH_ITEMS.filter((i) => i.title.toLowerCase().includes(query.toLowerCase())).slice(0, 8),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let renderer: ReactRenderer<SlashMenuHandle> | undefined;
          let el: HTMLDivElement | undefined;
          const place = (p: SuggestionProps<SlashItem>) => {
            const rect = p.clientRect?.();
            if (!rect || !el) return;
            el.style.left = `${Math.min(rect.left, window.innerWidth - 260)}px`;
            el.style.top = `${rect.bottom + 6}px`;
          };
          return {
            onStart: (p) => {
              el = document.createElement('div');
              el.className = 'fixed z-50';
              document.body.appendChild(el);
              renderer = new ReactRenderer(SlashMenu, { props: p, editor: p.editor });
              el.appendChild(renderer.element);
              place(p);
            },
            onUpdate: (p) => { renderer?.updateProps(p); place(p); },
            onKeyDown: (p: SuggestionKeyDownProps) => {
              if (p.event.key === 'Escape') { el?.remove(); return true; }
              return renderer?.ref?.onKeyDown(p.event) ?? false;
            },
            onExit: () => { renderer?.destroy(); el?.remove(); },
          };
        },
      }),
    ];
  },
});
